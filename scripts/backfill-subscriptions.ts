/**
 * Backfill script: migrate active legacy Subscription records (chatId-based)
 * into UserSubscription (userId-based).
 *
 * Migrates only subscriptions with currently active access:
 *   - status='active'  + currentPeriodEnd in the future
 *   - status='trial'   + trialEndsAt in the future (legacy free trial, honored until expiry)
 *
 * Mapping:
 *   Both cases → planId='client_monthly', status='active'
 *   currentPeriodEnd = old currentPeriodEnd (active) or old trialEndsAt (trial)
 *
 * Skips:
 *   - Subscriptions with no matching UserIdentity (user not yet on userId system)
 *   - Users who already have a UserSubscription record (idempotent)
 *   - Expired / canceled subscriptions
 *
 * Usage:
 *   npx tsx scripts/backfill-subscriptions.ts
 */

import prisma from '../src/db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const userIdentityDb = (prisma as any).userIdentity as {
  findFirst: (args: { where: { platform: string; platformId: string }; select: { userId: true } }) => Promise<{ userId: string } | null>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const userSubDb = (prisma as any).userSubscription as {
  findUnique: (args: { where: { userId: string } }) => Promise<unknown | null>;
  create: (args: { data: {
    userId: string; planId: string; status: string;
    currentPeriodEnd: Date | null; trialEndsAt: Date | null;
    gracePeriodEnd: null; autoRenew: boolean;
    providerSubId: null; paymentProvider: null;
  }}) => Promise<unknown>;
};

async function backfill() {
  const now = new Date();

  const legacySubscriptions = await prisma.subscription.findMany({
    where: {
      OR: [
        { status: 'active',  currentPeriodEnd: { gt: now } },
        { status: 'trial',   trialEndsAt:       { gt: now } },
      ],
    },
    select: { chatId: true, status: true, currentPeriodEnd: true, trialEndsAt: true },
  });

  console.log(`[backfill-subscriptions] Active legacy records found: ${legacySubscriptions.length}`);

  let created = 0;
  let skippedNoIdentity = 0;
  let skippedAlreadyExists = 0;

  for (const sub of legacySubscriptions) {
    // Resolve userId via UserIdentity
    const identity = await userIdentityDb.findFirst({
      where: { platform: 'telegram', platformId: sub.chatId },
      select: { userId: true },
    });

    if (!identity) {
      skippedNoIdentity++;
      continue;
    }

    const { userId } = identity;

    // Skip if UserSubscription already exists (idempotent)
    const existing = await userSubDb.findUnique({ where: { userId } });
    if (existing) {
      skippedAlreadyExists++;
      continue;
    }

    // Map old access to new record
    const periodEnd =
      sub.status === 'active' ? sub.currentPeriodEnd :
      sub.status === 'trial'  ? sub.trialEndsAt :
      null;

    await userSubDb.create({
      data: {
        userId,
        planId: 'client_monthly',
        status: 'active',
        currentPeriodEnd: periodEnd,
        trialEndsAt: null,
        gracePeriodEnd: null,
        autoRenew: true,
        providerSubId: null,
        paymentProvider: null,
      },
    });

    created++;
    console.log(`  migrated chatId=${sub.chatId} → userId=${userId} (periodEnd=${periodEnd?.toISOString()})`);
  }

  console.log(`[backfill-subscriptions] Done. created=${created}, skippedNoIdentity=${skippedNoIdentity}, skippedAlreadyExists=${skippedAlreadyExists}`);
}

backfill()
  .catch((err) => {
    console.error('[backfill-subscriptions] Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
