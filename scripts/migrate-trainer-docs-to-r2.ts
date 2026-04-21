/**
 * One-time idempotent script: migrate legacy TrainerDocument records to R2.
 *
 * A record is considered migrated when storageKey IS NOT NULL.
 * Records without fileData are skipped with a warning.
 *
 * Usage:
 *   npx tsx scripts/migrate-trainer-docs-to-r2.ts
 *
 * Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET in .env
 * (or export them) before running.
 *
 * The script is safe to re-run: already-migrated records are skipped.
 * After a successful migration, the legacy fileData column can be cleared
 * by setting `clearFileData=true` below (default: false).
 */

import 'dotenv/config';
import prisma from '../src/db';
import { uploadObject, trainerDocKey, mimeToExt } from '../src/storage/r2';

// Set to true to NULL-out fileData after a successful upload (saves DB space).
// Run without this first to verify, then set to true for cleanup.
const CLEAR_FILE_DATA = process.env['CLEAR_FILE_DATA'] === 'true';

const BATCH_SIZE = 20;

async function main() {
  console.log('TrainerDocument → R2 migration starting…');
  console.log(`CLEAR_FILE_DATA=${CLEAR_FILE_DATA}`);

  let offset = 0;
  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Fetch records that have legacy fileData but no R2 key yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batch = await (prisma.trainerDocument as any).findMany({
      where: { storageKey: null, fileData: { not: null } },
      select: { id: true, chatId: true, mimeType: true, fileData: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      skip: offset,
    }) as Array<{ id: number; chatId: string; mimeType: string; fileData: string }>;

    if (batch.length === 0) break;

    for (const doc of batch) {
      try {
        const comma = doc.fileData.indexOf(',');
        if (comma === -1) {
          console.warn(`  [SKIP] id=${doc.id} — fileData has no comma separator`);
          totalSkipped++;
          continue;
        }
        const buffer = Buffer.from(doc.fileData.slice(comma + 1), 'base64');
        const ext = mimeToExt(doc.mimeType);
        const key = trainerDocKey(doc.chatId, doc.id, ext);

        await uploadObject(key, buffer, doc.mimeType);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma.trainerDocument as any).update({
          where: { id: doc.id },
          data: {
            storageKey: key,
            storageProvider: 'r2',
            sizeBytes: buffer.length,
            ...(CLEAR_FILE_DATA ? { fileData: null } : {}),
          },
        });

        console.log(`  [OK] id=${doc.id} chatId=${doc.chatId} → ${key} (${buffer.length} bytes)`);
        totalMigrated++;
      } catch (err) {
        console.error(`  [FAIL] id=${doc.id} chatId=${doc.chatId}`, err);
        totalFailed++;
      }
    }

    // If batch was smaller than BATCH_SIZE the loop is done; otherwise advance offset
    // (we don't advance offset because migrated records drop out of the WHERE clause)
    if (batch.length < BATCH_SIZE) break;

    // Safety: if all in the batch failed (none got storageKey set), advance offset
    // to avoid an infinite loop over persistently failing records.
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
