/**
 * Backfill script: populate userId on UserProfile and TrainerProfile rows
 * that were created before the User/UserIdentity migration.
 *
 * For each existing chatId, this script:
 *   1. Upserts a UserIdentity (platform='telegram', platformId=chatId) → creates a User if none exists.
 *   2. Sets userId on UserProfile / TrainerProfile if still null.
 *
 * Safe to run multiple times (idempotent).
 *
 * Usage:
 *   npx tsx scripts/backfill-user-ids.ts
 */

import prisma from '../src/db';

async function backfill() {
  // --- UserProfile ---
  const userProfiles = await prisma.userProfile.findMany({
    where: { userId: null },
    select: { id: true, chatId: true },
  });

  console.log(`[backfill] UserProfile rows to backfill: ${userProfiles.length}`);

  for (const row of userProfiles) {
    const identity = await prisma.userIdentity.upsert({
      where: { platform_platformId: { platform: 'telegram', platformId: row.chatId } },
      update: {},
      create: {
        platform: 'telegram',
        platformId: row.chatId,
        user: { create: {} },
      },
      select: { userId: true },
    });

    await prisma.userProfile.update({
      where: { id: row.id },
      data: { userId: identity.userId },
    });
  }

  console.log(`[backfill] UserProfile done.`);

  // --- TrainerProfile ---
  const trainerProfiles = await prisma.trainerProfile.findMany({
    where: { userId: null },
    select: { id: true, chatId: true },
  });

  console.log(`[backfill] TrainerProfile rows to backfill: ${trainerProfiles.length}`);

  for (const row of trainerProfiles) {
    // Re-use existing UserIdentity if the user already got one from UserProfile backfill
    const identity = await prisma.userIdentity.upsert({
      where: { platform_platformId: { platform: 'telegram', platformId: row.chatId } },
      update: {},
      create: {
        platform: 'telegram',
        platformId: row.chatId,
        user: { create: {} },
      },
      select: { userId: true },
    });

    await prisma.trainerProfile.update({
      where: { id: row.id },
      data: { userId: identity.userId },
    });
  }

  console.log(`[backfill] TrainerProfile done.`);
  console.log(`[backfill] Complete.`);
}

backfill()
  .catch((err) => {
    console.error('[backfill] Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
