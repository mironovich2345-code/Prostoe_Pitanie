/**
 * POST /api/webhooks/yookassa
 *
 * YooKassa sends a notification for every payment status change.
 * This route is registered WITHOUT auth middleware (YooKassa is not a user).
 *
 * Security model:
 *   We do NOT trust the webhook payload blindly. After receiving a notification
 *   we re-fetch the payment directly from the YooKassa API using our credentials.
 *   This means a spoofed POST to our webhook URL cannot trigger free subscriptions.
 *
 * Handled events:
 *   payment.succeeded  → activate subscription
 *   payment.canceled   → mark payment as canceled (no subscription change)
 *
 * Unhandled events (ignored, 200 returned):
 *   payment.waiting_for_capture, refund.succeeded, etc.
 */

import { Router, Request, Response } from 'express';
import prisma from '../../db';
import { fetchYooKassaPayment } from '../../services/yookassaService';
import { activateSubscription, type PlanId } from '../../services/subscriptionService';
import { normalizeOfferType } from '../../utils/referral';

const router = Router();

// ─── Payment DB (stale Prisma cast) ───────────────────────────────────────────

interface PaymentRow {
  id: string;
  userId: string;
  planId: string;
  amountRub: number;
  status: string;
  periodEnd: Date | null;
  providerPaymentId: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const paymentDb = (prisma as unknown as { payment: any }).payment as {
  findFirst(args: { where: object }): Promise<PaymentRow | null>;
  update(args: { where: { id: string }; data: object }): Promise<PaymentRow>;
  create(args: { data: object }): Promise<PaymentRow>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const webhookLogDb = (prisma as unknown as { webhookLog: any }).webhookLog as {
  create(args: { data: object }): Promise<{ id: string }>;
  update(args: { where: { id: string }; data: object }): Promise<{ id: string }>;
} | null;

async function logWebhook(provider: string, eventType: string, payloadJson: string): Promise<string | null> {
  if (!webhookLogDb) return null;
  try {
    const log = await webhookLogDb.create({ data: { provider, eventType, payloadJson } });
    return log.id;
  } catch { return null; }
}

async function markLogProcessed(logId: string | null, error?: string) {
  if (!logId || !webhookLogDb) return;
  try {
    await webhookLogDb.update({
      where: { id: logId },
      data: { processedAt: new Date(), ...(error ? { error } : {}) },
    });
  } catch { /* best-effort */ }
}

// ─── Referral reward creation ─────────────────────────────────────────────────

/**
 * After a payment succeeds, check whether the paying client was referred by a
 * trainer/company via an offer link. If so, create a TrainerReward record.
 *
 * Offer logic:
 *   one_time  → 100 % of amountRub, only on the first payment (idempotent)
 *   lifetime  → 20 % of amountRub, on every succeeded payment
 *   month_1rub → no trainer reward (the offer is a discount for the client)
 *
 * Runs fire-and-forget after subscription activation — errors are logged but
 * never bubble up to fail the webhook response.
 */
async function createReferralRewardIfApplicable(
  clientUserId: string,
  payment: { id: string; planId: string; amountRub: number },
): Promise<void> {
  // Look up client's referral attribution via userId
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = await (prisma.userProfile.findFirst as (args: any) => Promise<{
    chatId: string;
    referredBy: string | null;
    referredByUserId: string | null;
    referredByRole: string | null;
    trainerOfferType: string | null;
  } | null>)({
    where: { userId: clientUserId },
    select: {
      chatId: true,
      referredBy: true,
      referredByUserId: true,
      referredByRole: true,
      trainerOfferType: true,
    },
  });

  if (!profile) return;

  const { chatId: clientChatId, referredBy: trainerChatId, referredByUserId: trainerUserId, referredByRole, trainerOfferType } = profile;

  // Only process trainer/company client offers — skip plain client-to-client referrals
  if (!trainerChatId || (referredByRole !== 'trainer' && referredByRole !== 'company')) return;

  const offerType = normalizeOfferType(trainerOfferType);

  // month_1rub is a client discount, not a trainer payout
  if (!offerType || offerType === 'month_1rub') return;

  // Compute reward amount
  let rewardRub: number;
  if (offerType === 'one_time') {
    rewardRub = payment.amountRub; // 100 %
  } else {
    // lifetime → 20 %
    rewardRub = Math.round(payment.amountRub * 0.20 * 100) / 100;
  }

  if (rewardRub <= 0) return;

  // one_time: idempotent — only the first payment triggers a reward
  if (offerType === 'one_time') {
    const existing = await prisma.trainerReward.findFirst({
      where: { trainerId: trainerChatId, referredChatId: clientChatId },
    });
    if (existing) {
      console.log(`[webhook/yk] referral reward (one_time) already exists for client=${clientChatId} — skipping`);
      return;
    }
  }

  const holdUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30-day hold

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.trainerReward.create as (args: any) => Promise<any>)({
    data: {
      trainerId:       trainerChatId,
      trainerUserId:   trainerUserId ?? null,
      referredChatId:  clientChatId,
      referredUserId:  clientUserId,
      planId:          payment.planId,
      amountRub:       rewardRub,
      status:          'pending_hold',
      holdUntil,
    },
  });

  console.log(
    `[webhook/yk] referral reward created: ${rewardRub}₽ ` +
    `trainer=${trainerChatId} client=${clientChatId} offerType=${offerType} paymentId=${payment.id}`,
  );
}

// ─── Shared handler (exported for alias mount in server.ts) ──────────────────

export async function handleYooKassaWebhook(req: Request, res: Response): Promise<void> {
  const body = req.body as { event?: string; object?: { id?: string } };
  const eventType = body?.event ?? 'unknown';
  const yookassaPaymentId = body?.object?.id;

  console.log(`[webhook/yk] received event=${eventType} ykId=${yookassaPaymentId ?? 'none'}`);

  // Always respond 200 quickly so YooKassa doesn't retry indefinitely
  res.json({ ok: true });

  const logId = await logWebhook('yookassa', eventType, JSON.stringify(body));

  if (!yookassaPaymentId) {
    console.warn('[webhook/yk] missing payment id in payload');
    await markLogProcessed(logId, 'missing payment id in payload');
    return;
  }

  // Only handle payment events we care about
  if (!eventType.startsWith('payment.')) {
    await markLogProcessed(logId);
    return;
  }

  try {
    // ── Re-fetch from YooKassa to verify authenticity (prevents spoofed webhooks) ─
    const verified = await fetchYooKassaPayment(yookassaPaymentId);
    console.log(`[webhook/yk] re-fetched ykId=${verified.id} status=${verified.status}`);

    // Find our local Payment record
    const payment = await paymentDb.findFirst({
      where: { providerPaymentId: verified.id },
    });

    if (!payment) {
      console.warn(`[webhook/yk] local Payment not found for ykId=${verified.id}`);
      await markLogProcessed(logId, 'payment record not found');
      return;
    }

    console.log(`[webhook/yk] local payment id=${payment.id} status=${payment.status} userId=${payment.userId}`);

    if (verified.status === 'succeeded') {
      // Idempotent: already processed
      if (payment.status === 'succeeded') {
        console.log(`[webhook/yk] already succeeded — skipping`);
        await markLogProcessed(logId);
        return;
      }

      await paymentDb.update({ where: { id: payment.id }, data: { status: 'succeeded' } });
      console.log(`[webhook/yk] Payment ${payment.id} → succeeded`);

      const periodEnd = payment.periodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const planId = payment.planId as PlanId;
      await activateSubscription(payment.userId, planId, periodEnd);

      console.log(`[webhook/yk] subscription activated planId=${planId} userId=${payment.userId} periodEnd=${periodEnd.toISOString()}`);

      // Fire-and-forget referral reward — non-fatal if it fails
      createReferralRewardIfApplicable(payment.userId, {
        id: payment.id,
        planId: payment.planId,
        amountRub: payment.amountRub,
      }).catch(err => console.error('[webhook/yk] referral reward creation failed:', (err as Error).message));

    } else if (verified.status === 'canceled') {
      if (payment.status !== 'canceled') {
        await paymentDb.update({ where: { id: payment.id }, data: { status: 'canceled' } });
        console.log(`[webhook/yk] Payment ${payment.id} → canceled`);
      }
    } else {
      console.log(`[webhook/yk] unhandled status=${verified.status} — no action`);
    }

    await markLogProcessed(logId);
  } catch (err) {
    const msg = (err as Error).message;
    console.error('[webhook/yk] error:', msg);
    await markLogProcessed(logId, msg);
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Primary path: /api/webhooks/yookassa  (mounted before auth in server.ts)
router.post('/yookassa', handleYooKassaWebhook);

export default router;
