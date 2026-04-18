/**
 * Hold-release job for TrainerReward.
 *
 * Runs daily (called via setInterval from src/index.ts).
 * Finds all TrainerReward records where:
 *   - status = 'pending_hold'
 *   - holdUntil <= now
 *
 * Transitions them to 'available', making them eligible for payout requests.
 *
 * Safe to run multiple times (idempotent): Prisma updateMany applies the filter
 * to already-available rewards too, but since the where clause includes
 * status='pending_hold', records already transitioned are not touched.
 */

import prisma from '../db';

export async function runHoldReleaseJob(): Promise<void> {
  const now = new Date();
  try {
    const result = await prisma.trainerReward.updateMany({
      where: {
        status: 'pending_hold',
        holdUntil: { lte: now },
      },
      data: { status: 'available' },
    });

    if (result.count > 0) {
      console.log(`[hold-release] released ${result.count} reward(s) from pending_hold → available`);
    } else {
      console.log('[hold-release] no rewards ready for release');
    }
  } catch (err) {
    console.error('[hold-release] error:', (err as Error).message);
  }
}
