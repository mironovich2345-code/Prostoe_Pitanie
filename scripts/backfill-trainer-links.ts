/**
 * Backfill script: populate userId fields on TrainerClientLink, TrainerRating,
 * TrainerReward, and UserProfile.referredByUserId from legacy chatId data.
 *
 * Resolution strategy: for each chatId, find the corresponding UserIdentity
 * (platform='telegram', platformId=chatId) and extract userId.
 *
 * Idempotent: only writes to rows where the userId field is still null.
 *
 * Usage:
 *   npx tsx scripts/backfill-trainer-links.ts
 *
 * Run AFTER:
 *   npx prisma migrate dev
 *   npx tsx scripts/backfill-user-ids.ts   (UserProfile/TrainerProfile userId first)
 */

import prisma from '../src/db';

/** Resolve chatId → userId via UserIdentity. Returns null if not found. */
async function resolveUserId(chatId: string): Promise<string | null> {
  const identity = await (prisma as any).userIdentity.findFirst({
    where: { platform: 'telegram', platformId: chatId },
    select: { userId: true },
  });
  return identity?.userId ?? null;
}

// ─── TrainerClientLink ────────────────────────────────────────────────────────

async function backfillTrainerClientLinks() {
  const rows = await prisma.trainerClientLink.findMany({
    where: { OR: [{ trainerUserId: null }, { clientUserId: null }] },
    select: { id: true, trainerId: true, clientId: true, trainerUserId: true, clientUserId: true },
  });
  console.log(`[TrainerClientLink] rows to backfill: ${rows.length}`);

  for (const row of rows) {
    const [trainerUserId, clientUserId] = await Promise.all([
      row.trainerUserId ? null : resolveUserId(row.trainerId),
      row.clientUserId  ? null : resolveUserId(row.clientId),
    ]);
    const data: Record<string, string> = {};
    if (trainerUserId) data['trainerUserId'] = trainerUserId;
    if (clientUserId)  data['clientUserId']  = clientUserId;
    if (Object.keys(data).length === 0) continue;
    await prisma.trainerClientLink.update({ where: { id: row.id }, data });
  }
  console.log(`[TrainerClientLink] done.`);
}

// ─── TrainerRating ────────────────────────────────────────────────────────────

async function backfillTrainerRatings() {
  const rows = await prisma.trainerRating.findMany({
    where: { OR: [{ trainerUserId: null }, { clientUserId: null }] },
    select: { id: true, trainerId: true, clientId: true, trainerUserId: true, clientUserId: true },
  });
  console.log(`[TrainerRating] rows to backfill: ${rows.length}`);

  for (const row of rows) {
    const [trainerUserId, clientUserId] = await Promise.all([
      row.trainerUserId ? null : resolveUserId(row.trainerId),
      row.clientUserId  ? null : resolveUserId(row.clientId),
    ]);
    const data: Record<string, string> = {};
    if (trainerUserId) data['trainerUserId'] = trainerUserId;
    if (clientUserId)  data['clientUserId']  = clientUserId;
    if (Object.keys(data).length === 0) continue;
    await prisma.trainerRating.update({ where: { id: row.id }, data });
  }
  console.log(`[TrainerRating] done.`);
}

// ─── TrainerReward ────────────────────────────────────────────────────────────

async function backfillTrainerRewards() {
  const rows = await prisma.trainerReward.findMany({
    where: { OR: [{ trainerUserId: null }, { referredUserId: null }] },
    select: { id: true, trainerId: true, referredChatId: true, trainerUserId: true, referredUserId: true },
  });
  console.log(`[TrainerReward] rows to backfill: ${rows.length}`);

  for (const row of rows) {
    const [trainerUserId, referredUserId] = await Promise.all([
      row.trainerUserId  ? null : resolveUserId(row.trainerId),
      row.referredUserId ? null : resolveUserId(row.referredChatId),
    ]);
    const data: Record<string, string> = {};
    if (trainerUserId)  data['trainerUserId']  = trainerUserId;
    if (referredUserId) data['referredUserId'] = referredUserId;
    if (Object.keys(data).length === 0) continue;
    await prisma.trainerReward.update({ where: { id: row.id }, data });
  }
  console.log(`[TrainerReward] done.`);
}

// ─── UserProfile.referredByUserId ─────────────────────────────────────────────

async function backfillReferredByUserId() {
  const rows = await prisma.userProfile.findMany({
    where: { referredBy: { not: null }, referredByUserId: null },
    select: { id: true, referredBy: true },
  });
  console.log(`[UserProfile.referredByUserId] rows to backfill: ${rows.length}`);

  for (const row of rows) {
    if (!row.referredBy) continue;
    const referredByUserId = await resolveUserId(row.referredBy);
    if (!referredByUserId) continue;
    await prisma.userProfile.update({ where: { id: row.id }, data: { referredByUserId } });
  }
  console.log(`[UserProfile.referredByUserId] done.`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await backfillTrainerClientLinks();
  await backfillTrainerRatings();
  await backfillTrainerRewards();
  await backfillReferredByUserId();
  console.log('[backfill-trainer-links] Complete.');
}

main()
  .catch((err) => { console.error('[backfill-trainer-links] Error:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
