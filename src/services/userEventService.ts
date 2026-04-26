/**
 * Fail-open user behaviour event logger.
 * Never throws — if the DB write fails, only console.warn is emitted.
 * The main user flow is never blocked.
 */

import prisma from '../db';

// Fields allowed in metadata — keep this list short and safe
const SAFE_META_KEYS = new Set([
  'sourceType', 'mealType', 'scenario', 'planId', 'source', 'platform',
]);

function sanitizeMeta(
  meta: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!meta) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (!SAFE_META_KEYS.has(k)) continue;
    if (typeof v === 'string' && v.length > 200) continue;
    if (v !== undefined && v !== null) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

type UserEventDb = {
  create(args: { data: object }): Promise<unknown>;
};

function getDb(): UserEventDb {
  return (prisma as unknown as { userEvent: UserEventDb }).userEvent;
}

export function trackUserEvent(params: {
  userId: string | null | undefined;
  platform?: string;
  eventName: string;
  metadata?: Record<string, unknown>;
}): void {
  const { userId, platform = 'unknown', eventName, metadata } = params;
  if (!userId) return; // no userId → silently skip

  const cleanMeta = sanitizeMeta(metadata);

  getDb()
    .create({
      data: {
        userId,
        platform,
        eventName,
        ...(cleanMeta ? { metadata: cleanMeta } : {}),
      },
    })
    .catch(err => {
      console.warn('[trackUserEvent] write failed:', (err as Error).message ?? err);
    });
}
