/**
 * One-time idempotent script: migrate legacy MealEntry.photoData to R2.
 *
 * A record is considered migrated when photoStorageKey IS NOT NULL.
 * Records without photoData or with sourceType != 'photo' are skipped.
 *
 * Usage:
 *   npx tsx scripts/migrate-meal-photos-to-r2.ts
 *
 * Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET in .env
 * (or export them) before running.
 *
 * Safe to re-run: already-migrated records (storageKey != null) are skipped.
 *
 * CLEAR_FILE_DATA=true  — null out photoData after a successful R2 upload.
 *   Run WITHOUT this flag first to verify the migration is working, then
 *   run with CLEAR_FILE_DATA=true to reclaim DB space.
 *
 * BATCH_DELAY_MS (default: 200) — pause between batches to avoid hammering R2.
 * MAX_ERRORS (default: 20)      — abort after this many consecutive failures.
 */

import 'dotenv/config';
import prisma from '../src/db';
import { uploadObject, mimeToExt } from '../src/storage/r2';

const CLEAR_FILE_DATA = process.env['CLEAR_FILE_DATA'] === 'true';
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = parseInt(process.env['BATCH_DELAY_MS'] ?? '200', 10);
const MAX_ERRORS = parseInt(process.env['MAX_ERRORS'] ?? '20', 10);

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('MealEntry.photoData → R2 migration starting…');
  console.log(`CLEAR_FILE_DATA=${CLEAR_FILE_DATA}  BATCH_SIZE=${BATCH_SIZE}  BATCH_DELAY_MS=${BATCH_DELAY_MS}`);

  // Count total pending records
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalPending: number = await (prisma.mealEntry as any).count({
    where: { photoData: { not: null }, photoStorageKey: null, sourceType: 'photo' },
  });
  console.log(`Records to migrate: ${totalPending}`);
  if (totalPending === 0) {
    console.log('Nothing to do.');
    await prisma.$disconnect();
    return;
  }

  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let consecutiveErrors = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (consecutiveErrors >= MAX_ERRORS) {
      console.error(`Aborting: ${consecutiveErrors} consecutive errors.`);
      break;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batch = await (prisma.mealEntry as any).findMany({
      where: { photoData: { not: null }, photoStorageKey: null, sourceType: 'photo' },
      select: { id: true, chatId: true, photoData: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
    }) as Array<{ id: number; chatId: string; photoData: string }>;

    if (batch.length === 0) break;

    for (const meal of batch) {
      try {
        const comma = meal.photoData.indexOf(',');
        const semi  = meal.photoData.indexOf(';');
        if (comma === -1 || semi === -1) {
          console.warn(`  [SKIP] id=${meal.id} — malformed data URL`);
          totalSkipped++;
          consecutiveErrors = 0;
          continue;
        }

        const mimeType = meal.photoData.slice(5, semi);
        const buffer = Buffer.from(meal.photoData.slice(comma + 1), 'base64');
        const ext = mimeToExt(mimeType);
        // Use a stable key derived from meal id (idempotent if re-run)
        const storageKey = `meal-photos/${meal.chatId}/${meal.id}.${ext}`;

        await uploadObject(storageKey, buffer, mimeType);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma.mealEntry as any).update({
          where: { id: meal.id },
          data: {
            photoStorageKey: storageKey,
            photoStorageProvider: 'r2',
            photoSizeBytes: buffer.length,
            ...(CLEAR_FILE_DATA ? { photoData: null } : {}),
          },
        });

        console.log(`  [OK] id=${meal.id} chatId=${meal.chatId} → ${storageKey} (${buffer.length} bytes)`);
        totalMigrated++;
        consecutiveErrors = 0;
      } catch (err) {
        console.error(`  [FAIL] id=${meal.id} chatId=${meal.chatId}`, err);
        totalFailed++;
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_ERRORS) break;
      }
    }

    if (BATCH_DELAY_MS > 0) await sleep(BATCH_DELAY_MS);
  }

  const pct = totalPending > 0 ? Math.round((totalMigrated / totalPending) * 100) : 0;
  console.log(`\nDone. migrated=${totalMigrated}/${totalPending} (${pct}%) skipped=${totalSkipped} failed=${totalFailed}`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
