/**
 * Subscription service — provider-independent.
 *
 * All operations work against the UserSubscription table (keyed by userId).
 * The old chatId-based Subscription table is untouched and remains functional.
 *
 * Plans:
 *   'intro'          — paid intro period (7 days / 1 ₽); trialEndsAt tracks expiry
 *   'client_monthly' — recurring monthly subscription; currentPeriodEnd tracks expiry
 *
 * Access levels:
 *   'full'  — active paid period, active intro, or past_due within grace window
 *   'basic' — no record, expired, or canceled
 *
 * NOTE: prisma.userSubscription calls are cast via `(prisma as any)` because
 * the Prisma client has not yet been regenerated against the new schema.
 * After running `prisma migrate dev` on the server, remove the casts.
 */

import prisma from '../db';

// ─── Types ────────────────────────────────────────────────────────────────────

/** 'intro' = paid 7-day intro at 1 ₽; 'client_monthly' = recurring monthly plan. */
export type PlanId = 'client_monthly' | 'intro';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'expired';
export type AccessLevel = 'full' | 'basic';

/** Mirrors the UserSubscription Prisma model. Defined locally so the service
 *  compiles before `prisma generate` runs on the server. */
export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  status: string;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  gracePeriodEnd: Date | null;
  autoRenew: boolean;
  providerSubId: string | null;
  paymentProvider: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionState {
  subscription: UserSubscription | null;
  accessLevel: AccessLevel;
}

// ─── Access check ─────────────────────────────────────────────────────────────

/**
 * Pure function — compute access level from a subscription record.
 * Safe to call without a DB round-trip when the record is already loaded.
 */
export function getAccessLevel(sub: UserSubscription | null): AccessLevel {
  if (!sub) return 'basic';

  const now = new Date();

  if (sub.status === 'active') {
    if (sub.planId === 'intro') {
      // Paid 7-day intro: full access while trialEndsAt has not passed
      return sub.trialEndsAt && sub.trialEndsAt > now ? 'full' : 'basic';
    }
    // client_monthly
    return sub.currentPeriodEnd && sub.currentPeriodEnd > now ? 'full' : 'basic';
  }

  if (sub.status === 'past_due') {
    // Grace period: full access until gracePeriodEnd
    return sub.gracePeriodEnd && sub.gracePeriodEnd > now ? 'full' : 'basic';
  }

  // 'canceled' | 'expired'
  return 'basic';
}

// ─── DB accessor (isolated to ease removal of cast after prisma generate) ─────

type SubCreateInput = Omit<UserSubscription, 'id' | 'createdAt' | 'updatedAt'>;
type SubUpdateData = Partial<Omit<UserSubscription, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (prisma as any).userSubscription as {
  upsert:     (args: { where: { userId: string }; update: SubUpdateData; create: SubCreateInput }) => Promise<UserSubscription>;
  update:     (args: { where: { userId: string }; data: SubUpdateData }) => Promise<UserSubscription>;
  findUnique: (args: { where: { userId: string } }) => Promise<UserSubscription | null>;
};

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Activate (or re-activate) a subscription.
 *
 * planId='intro'          → trialEndsAt = periodEnd (7 days), status = 'active'
 * planId='client_monthly' → currentPeriodEnd = periodEnd, status = 'active'
 *
 * Called by: payment webhook handler (payment succeeded), or manual admin activation.
 */
export async function activateSubscription(
  userId: string,
  planId: PlanId,
  periodEnd: Date,
): Promise<UserSubscription> {
  const isIntro = planId === 'intro';
  return db.upsert({
    where: { userId },
    update: {
      planId,
      status: 'active',
      currentPeriodEnd: isIntro ? null : periodEnd,
      trialEndsAt: isIntro ? periodEnd : null,
      gracePeriodEnd: null,
    },
    create: {
      userId,
      planId,
      status: 'active',
      autoRenew: true,
      providerSubId: null,
      paymentProvider: null,
      currentPeriodEnd: isIntro ? null : periodEnd,
      trialEndsAt: isIntro ? periodEnd : null,
      gracePeriodEnd: null,
    },
  });
}

/**
 * Mark subscription as past_due (recurring payment failed).
 * The user retains 'full' access until gracePeriodEnd.
 *
 * Called by: payment webhook handler (payment_failed event).
 */
export async function markPastDue(
  userId: string,
  gracePeriodEnd: Date,
): Promise<UserSubscription> {
  return db.update({
    where: { userId },
    data: { status: 'past_due', gracePeriodEnd },
  });
}

/**
 * Expire a subscription (grace period elapsed or trial ended without conversion).
 * Drops to 'basic' access immediately.
 *
 * Called by: cron job that checks gracePeriodEnd / trialEndsAt.
 */
export async function expireSubscription(userId: string): Promise<UserSubscription> {
  return db.update({
    where: { userId },
    data: { status: 'expired', gracePeriodEnd: null },
  });
}

/**
 * Cancel a subscription (user-initiated).
 * Sets autoRenew=false. Access continues until currentPeriodEnd (paid period is not refunded).
 *
 * Called by: user cancels from settings UI.
 */
export async function cancelSubscription(userId: string): Promise<UserSubscription> {
  return db.update({
    where: { userId },
    data: { status: 'canceled', autoRenew: false },
  });
}

/**
 * Fetch subscription record and compute access level in one call.
 *
 * Usage in route handlers:
 *   const { accessLevel } = await getSubscriptionState(req.userId!);
 *   if (accessLevel !== 'full') return res.status(403).json({ error: 'Subscription required' });
 */
export async function getSubscriptionState(userId: string): Promise<SubscriptionState> {
  const subscription = await db.findUnique({ where: { userId } });
  return { subscription, accessLevel: getAccessLevel(subscription) };
}
