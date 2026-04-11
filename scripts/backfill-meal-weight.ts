/**
 * Backfill script: populate userId on MealEntry and WeightEntry rows.
 *
 * For each distinct chatId that has records without userId, resolves the
 * corresponding userId via UserIdentity (platform='telegram', platformId=chatId),
 * then bulk-updates all matching rows for that chatId in one updateMany call.
 *
 * Idempotent: only touches rows where userId IS NULL.
 * Safe to re-run: updateMany with where:{ chatId, userId:null } is a no-op if
 * all rows for that chatId are already backfilled.
 *
 * Usage:
 *   npx tsx scripts/backfill-meal-weight.ts
 *
 * Run AFTER:
 *   npx prisma migrate dev
 *   npx tsx scripts/backfill-user-ids.ts
 */

import prisma from '../src/db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mealDb = (prisma as any).mealEntry as {
  findMany: (args: { where: { userId: null }; select: { chatId: true }; distinct: ['chatId'] }) => Promise<{ chatId: string }[]>;
  updateMany: (args: { where: { chatId: string; userId: null }; data: { userId: string } }) => Promise<{ count: number }>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const weightDb = (prisma as any).weightEntry as {
  findMany: (args: { where: { userId: null }; select: { chatId: true }; distinct: ['chatId'] }) => Promise<{ chatId: string }[]>;
  updateMany: (args: { where: { chatId: string; userId: null }; data: { userId: string } }) => Promise<{ count: number }>;
};

/** Resolve chatId → userId via UserIdentity. Returns null if not found. */
async function resolveUserId(chatId: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const identity = await (prisma as any).userIdentity.findFirst({
    where: { platform: 'telegram', platformId: chatId },
    select: { userId: true },
  });
  return identity?.userId ?? null;
}

async function backfillTable(
  label: string,
  db: typeof mealDb | typeof weightDb,
) {
  // Get distinct chatIds that still have unresolved rows
  const rows = await db.findMany({
    where: { userId: null },
    select: { chatId: true },
    distinct: ['chatId'],
  });

  console.log(`[${label}] distinct chatIds to backfill: ${rows.length}`);

  let updatedRows = 0;
  let skipped = 0;

  for (const { chatId } of rows) {
    const userId = await resolveUserId(chatId);
    if (!userId) { skipped++; continue; }

    const result = await db.updateMany({
      where: { chatId, userId: null },
      data: { userId },
    });
    updatedRows += result.count;
  }

  console.log(`[${label}] done. rows updated=${updatedRows}, chatIds skipped (no identity)=${skipped}`);
}

async function main() {
  await backfillTable('MealEntry', mealDb);
  await backfillTable('WeightEntry', weightDb);
  console.log('[backfill-meal-weight] Complete.');
}

main()
  .catch((err) => { console.error('[backfill-meal-weight] Error:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
