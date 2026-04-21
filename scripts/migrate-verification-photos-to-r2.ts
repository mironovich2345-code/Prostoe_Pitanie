/**
 * One-time idempotent script: migrate legacy TrainerProfile.verificationPhotoData to R2.
 *
 * A record is considered migrated when verificationPhotoStorageKey IS NOT NULL.
 * Only records with status='pending' typically have a verificationPhotoData, but
 * the script processes all profiles that have base64 data and no storage key.
 *
 * Usage:
 *   npx tsx scripts/migrate-verification-photos-to-r2.ts
 *
 * Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET in .env
 * (or export them) before running.
 *
 * Safe to re-run: already-migrated records (storageKey != null) are skipped.
 * Set CLEAR_FILE_DATA=true to null out the legacy base64 column after migration.
 */

import 'dotenv/config';
import prisma from '../src/db';
import { uploadObject, mimeToExt } from '../src/storage/r2';

const CLEAR_FILE_DATA = process.env['CLEAR_FILE_DATA'] === 'true';
const BATCH_SIZE = 20;

async function main() {
  console.log('TrainerProfile.verificationPhotoData → R2 migration starting…');
  console.log(`CLEAR_FILE_DATA=${CLEAR_FILE_DATA}`);

  let offset = 0;
  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batch = await (prisma.trainerProfile as any).findMany({
      where: {
        verificationPhotoData: { not: null },
        verificationPhotoStorageKey: null,
      },
      select: { chatId: true, verificationPhotoData: true },
      orderBy: { chatId: 'asc' },
      take: BATCH_SIZE,
      skip: offset,
    }) as Array<{ chatId: string; verificationPhotoData: string }>;

    if (batch.length === 0) break;

    for (const profile of batch) {
      try {
        const comma = profile.verificationPhotoData.indexOf(',');
        const semi  = profile.verificationPhotoData.indexOf(';');
        if (comma === -1 || semi === -1) {
          console.warn(`  [SKIP] chatId=${profile.chatId} — malformed data URL`);
          totalSkipped++;
          continue;
        }
        const mimeType = profile.verificationPhotoData.slice(5, semi);
        const buffer = Buffer.from(profile.verificationPhotoData.slice(comma + 1), 'base64');
        const ext = mimeToExt(mimeType);
        const storageKey = `trainer-verification-photos/${profile.chatId}.${ext}`;

        await uploadObject(storageKey, buffer, mimeType);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma.trainerProfile as any).update({
          where: { chatId: profile.chatId },
          data: {
            verificationPhotoStorageKey: storageKey,
            verificationPhotoStorageProvider: 'r2',
            verificationPhotoSizeBytes: buffer.length,
            ...(CLEAR_FILE_DATA ? { verificationPhotoData: null } : {}),
          },
        });

        console.log(`  [OK] chatId=${profile.chatId} → ${storageKey} (${buffer.length} bytes)`);
        totalMigrated++;
      } catch (err) {
        console.error(`  [FAIL] chatId=${profile.chatId}`, err);
        totalFailed++;
      }
    }

    if (batch.length < BATCH_SIZE) break;
    // Only advance offset if all records in this batch failed (none got storageKey set)
    if (totalFailed > 0 && totalMigrated === 0) {
      offset += BATCH_SIZE;
    }
  }

  console.log(`\nDone. migrated=${totalMigrated} skipped=${totalSkipped} failed=${totalFailed}`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
