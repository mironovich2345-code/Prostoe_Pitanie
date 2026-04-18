/**
 * Subscription renewal job.
 *
 * Runs hourly. Finds UserSubscriptions that are:
 *   - status = 'active'
 *   - autoRenew = true
 *   - providerSubId is set (YooKassa payment method ID saved from first payment)
 *   - currentPeriodEnd (or trialEndsAt for intro plan) is within a ±24-hour window
 *
 * For each qualifying subscription it creates a recurring YooKassa payment
 * using the saved payment method (no user redirect required).
 *
 * Idempotence:
 *   Before creating a charge we check for an existing Payment record for this
 *   userId + plan created within the past 25 hours. If one exists (pending or
 *   succeeded), we skip — preventing double-charging if the job runs multiple
 *   times within the same window.
 *   Additionally, a YooKassa Idempotence-Key tied to userId + planId + period
 *   date ensures duplicate API calls are deduplicated server-side.
 *
 * Outcomes:
 *   succeeded → activate subscription for the next 30-day period
 *   canceled  → mark subscription as past_due with a 3-day grace period
 *   pending   → leave as-is; the payment.succeeded / payment.canceled webhook
 *               will fire and be handled by the existing webhook handler
 */

import prisma from '../db';
import { activateSubscription, markPastDue, type PlanId } from './subscriptionService';
import { createRecurringPayment } from './yookassaService';

// ─── Plan prices ──────────────────────────────────────────────────────────────

const PLAN_PRICES: Record<string, number> = {
  pro: 499,
  optimal: 399,
  client_monthly: 399,
};

// ─── DB accessors (stale-cast pattern consistent with rest of project) ─────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const subDb = (prisma as unknown as { userSubscription: any }).userSubscription as {
  findMany(args: object): Promise<Array<{
    userId: string; planId: string; status: string;
    autoRenew: boolean; providerSubId: string | null;
    currentPeriodEnd: Date | null; trialEndsAt: Date | null;
  }>>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const paymentDb = (prisma as unknown as { payment: any }).payment as {
  findFirst(args: object): Promise<{ id: string; status: string } | null>;
  create(args: object): Promise<{ id: string }>;
  update(args: object): Promise<{ id: string }>;
};

// ─── Job ──────────────────────────────────────────────────────────────────────

export async function runRenewalJob(): Promise<void> {
  const now = new Date();
  const windowPast = new Date(now.getTime() - 24 * 60 * 60 * 1000);   // 24 h ago
  const windowFuture = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 h from now

  // Find expiring regular subscriptions (non-intro: tracked by currentPeriodEnd)
  const [regularExpiring, introExpiring] = await Promise.all([
    subDb.findMany({
      where: {
        status: 'active',
        autoRenew: true,
        providerSubId: { not: null },
        planId: { not: 'intro' },
        currentPeriodEnd: { gte: windowPast, lte: windowFuture },
      },
    } as object),
    subDb.findMany({
      where: {
        status: 'active',
        autoRenew: true,
        providerSubId: { not: null },
        planId: 'intro',
        trialEndsAt: { gte: windowPast, lte: windowFuture },
      },
    } as object),
  ]);

  const subscriptions = [...regularExpiring, ...introExpiring];

  // Diagnostic: count subscriptions that want auto-renewal but have no saved payment method.
  // These users paid via a method that doesn't support recurring (e.g. SBP), so the job
  // can't charge them automatically. They will need to renew manually.
  const [noMethodRegular, noMethodIntro] = await Promise.all([
    subDb.findMany({
      where: {
        status: 'active',
        autoRenew: true,
        providerSubId: null,
        planId: { not: 'intro' },
        currentPeriodEnd: { gte: windowPast, lte: windowFuture },
      },
    } as object),
    subDb.findMany({
      where: {
        status: 'active',
        autoRenew: true,
        providerSubId: null,
        planId: 'intro',
        trialEndsAt: { gte: windowPast, lte: windowFuture },
      },
    } as object),
  ]);
  const noMethodCount = noMethodRegular.length + noMethodIntro.length;
  if (noMethodCount > 0) {
    console.log(`[renewal] ${noMethodCount} subscription(s) with autoRenew=true but no saved payment method — manual renewal required`);
  }

  if (subscriptions.length === 0) {
    console.log('[renewal] no subscriptions due for renewal');
    return;
  }

  console.log(`[renewal] ${subscriptions.length} subscription(s) in renewal window`);

  for (const sub of subscriptions) {
    try {
      await renewOne(sub, now, windowPast);
    } catch (err) {
      console.error(`[renewal] unhandled error for userId=${sub.userId}:`, (err as Error).message);
    }
  }
}

async function renewOne(
  sub: {
    userId: string; planId: string; providerSubId: string | null;
    currentPeriodEnd: Date | null; trialEndsAt: Date | null;
  },
  now: Date,
  windowPast: Date,
): Promise<void> {
  // Resolve the actual billing plan (intro → pro at full price after trial ends)
  const billingPlanId: PlanId = sub.planId === 'intro' ? 'pro' : sub.planId as PlanId;
  const amountRub = PLAN_PRICES[billingPlanId];

  if (!amountRub) {
    console.warn(`[renewal] unknown planId=${billingPlanId} for userId=${sub.userId} — skipping`);
    return;
  }

  if (!sub.providerSubId) return; // guard (already filtered by query)

  // ── Idempotence check: skip if a recent payment already exists for this plan ──
  const existingPayment = await paymentDb.findFirst({
    where: {
      userId: sub.userId,
      planId: billingPlanId,
      status: { in: ['pending', 'succeeded'] },
      createdAt: { gte: windowPast },
    },
  } as object);

  if (existingPayment) {
    console.log(`[renewal] userId=${sub.userId} has recent payment ${existingPayment.id} (${existingPayment.status}) — skipping`);
    return;
  }

  // Idempotence key: tied to (userId, plan, period start date) so the YooKassa
  // API also deduplicates if we somehow call it twice.
  const periodDateStr = (sub.currentPeriodEnd ?? sub.trialEndsAt ?? now).toISOString().slice(0, 10);
  const idempotenceKey = `renewal-${sub.userId}-${billingPlanId}-${periodDateStr}`;

  const newPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const description = `${billingPlanId === 'pro' ? 'Pro' : 'Optimal'} — автопродление`;

  // Create local Payment record with status 'pending' before calling YooKassa
  const payment = await paymentDb.create({
    data: {
      userId: sub.userId,
      provider: 'yookassa',
      planId: billingPlanId,
      amountRub,
      status: 'pending',
      periodStart: now,
      periodEnd: newPeriodEnd,
    },
  } as object);

  console.log(`[renewal] attempting charge userId=${sub.userId} planId=${billingPlanId} amount=${amountRub} paymentId=${payment.id}`);

  let result: { yookassaPaymentId: string; status: string };
  try {
    result = await createRecurringPayment({
      paymentMethodId: sub.providerSubId,
      amountRub,
      description,
      planId: billingPlanId,
      userId: sub.userId,
      idempotenceKey,
    });
  } catch (err) {
    // YooKassa API error (network, invalid method, etc.) — mark payment failed and bail out.
    // The subscription remains active until its period expires naturally; we'll retry next run.
    await paymentDb.update({ where: { id: payment.id }, data: { status: 'failed' } } as object);
    console.error(`[renewal] YooKassa API error for userId=${sub.userId}:`, (err as Error).message);
    return;
  }

  // Persist the YooKassa payment ID so the webhook handler can match the record
  await paymentDb.update({
    where: { id: payment.id },
    data: { providerPaymentId: result.yookassaPaymentId },
  } as object);

  if (result.status === 'succeeded') {
    await paymentDb.update({ where: { id: payment.id }, data: { status: 'succeeded' } } as object);
    await activateSubscription(sub.userId, billingPlanId, newPeriodEnd);
    console.log(`[renewal] SUCCESS userId=${sub.userId} planId=${billingPlanId} ykId=${result.yookassaPaymentId} periodEnd=${newPeriodEnd.toISOString()}`);

  } else if (result.status === 'canceled') {
    await paymentDb.update({ where: { id: payment.id }, data: { status: 'failed' } } as object);
    const gracePeriodEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    await markPastDue(sub.userId, gracePeriodEnd);
    console.warn(`[renewal] FAILED userId=${sub.userId} ykId=${result.yookassaPaymentId} → past_due until ${gracePeriodEnd.toISOString()}`);

  } else {
    // status = 'pending' — YooKassa is still processing (unusual for saved-card payments).
    // The payment.succeeded or payment.canceled webhook will fire and be handled normally
    // by the existing webhook handler. The local payment record already has providerPaymentId set.
    console.log(`[renewal] PENDING userId=${sub.userId} ykId=${result.yookassaPaymentId} — awaiting webhook`);
  }
}
