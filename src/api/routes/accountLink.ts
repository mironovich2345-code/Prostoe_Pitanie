/**
 * Account linking — cross-platform identity merge (Telegram ↔ MAX).
 * Prefix: /api/account-link
 *
 * Flow:
 *   1. User on a NEW platform (e.g. MAX) calls POST /request.
 *      They receive a 6-char code valid for 15 minutes.
 *   2. They go to their CANONICAL account (e.g. TG) and call POST /confirm
 *      with that code.
 *   3. The system reassigns the initiator's UserIdentity to the canonical userId.
 *      From that moment on, any login from the new platform resolves to the same
 *      canonical userId as the first platform.
 *
 * Security properties:
 *   - Code is one-time (marked used after confirmation).
 *   - Code expires in 15 minutes.
 *   - Confirming account must be authenticated (different userId than initiator).
 *   - Cannot link two accounts of the same platform (UserIdentity unique constraint).
 *   - Cannot link a platform that the canonical account already has.
 *   - Only one pending request allowed per initiator; excess requests cancel prior ones.
 */

import crypto from 'crypto';
import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

const router = Router();

const LINK_TTL_MINUTES = 15;
const CODE_BYTES = 3; // → 6 hex chars (e.g. "A3F2B1")

// ─── DB cast helpers (AccountLinkRequest & UserIdentity absent from stale client) ───

interface ALRRecord {
  id: string;
  initiatorUserId: string;
  initiatorPlatform: string;
  initiatorPlatformId: string;
  code: string;
  status: string;
  canonicalUserId: string | null;
  createdAt: Date;
  expiresAt: Date;
  confirmedAt: Date | null;
}

type ALRDb = {
  findFirst(args: object): Promise<ALRRecord | null>;
  findUnique(args: object): Promise<ALRRecord | null>;
  create(args: object): Promise<ALRRecord>;
  update(args: object): Promise<ALRRecord>;
  updateMany(args: object): Promise<{ count: number }>;
};

function getALRDb(): ALRDb {
  return (prisma as unknown as { accountLinkRequest: ALRDb }).accountLinkRequest;
}

type UIdentityDb = {
  findFirst(args: object): Promise<{ id: string; userId: string; platform: string; platformId: string } | null>;
  updateMany(args: object): Promise<{ count: number }>;
};

function getIdentityDb(): UIdentityDb {
  return (prisma as unknown as { userIdentity: UIdentityDb }).userIdentity;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateCode(): string {
  return crypto.randomBytes(CODE_BYTES).toString('hex').toUpperCase();
}

function linkExpiresAt(): Date {
  return new Date(Date.now() + LINK_TTL_MINUTES * 60 * 1000);
}

// ─── POST /api/account-link/request ──────────────────────────────────────────
// Called by the user on the NEW / second platform.
// Creates (or replaces) a pending link request and returns the code.
// Requires: req.userId (user must be authenticated and have a resolved userId).
router.post('/request', async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.status(400).json({ error: 'userId not resolved — cannot create link request' });
    return;
  }

  // Determine which platform identity is making the request
  const platform = 'telegram'; // placeholder; replace with req.platform when MAX auth is added
  const platformId = req.chatId!;

  try {
    const db = getALRDb();

    // Cancel any previous pending requests from this initiator to keep exactly one active
    await db.updateMany({
      where: { initiatorUserId: userId, status: 'pending' } as object,
      data: { status: 'canceled' } as object,
    });

    // Check the canonical account doesn't already have an identity on this platform
    // (would violate UserIdentity @@unique([userId, platform]) after linking)
    // Not needed here — we validate on confirm side.

    const code = generateCode();
    const record = await db.create({
      data: {
        initiatorUserId: userId,
        initiatorPlatform: platform,
        initiatorPlatformId: platformId,
        code,
        status: 'pending',
        expiresAt: linkExpiresAt(),
      } as object,
    });

    res.json({
      code: record.code,
      expiresAt: record.expiresAt,
      ttlMinutes: LINK_TTL_MINUTES,
      instructions: `Введите этот код в первом аккаунте в разделе Настройки → Связать аккаунт`,
    });
  } catch (err) {
    console.error('[account-link/request]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/account-link/pending ───────────────────────────────────────────
// Returns the pending outgoing link request for the current user, if any.
router.get('/pending', async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  if (!userId) { res.json({ pending: null }); return; }

  try {
    const record = await getALRDb().findFirst({
      where: { initiatorUserId: userId, status: 'pending' } as object,
    });
    if (!record || record.expiresAt <= new Date()) {
      res.json({ pending: null });
      return;
    }
    res.json({
      pending: {
        code: record.code,
        expiresAt: record.expiresAt,
        initiatorPlatform: record.initiatorPlatform,
      },
    });
  } catch (err) {
    console.error('[account-link/pending]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/account-link/confirm ──────────────────────────────────────────
// Called by the user on their CANONICAL / first platform.
// Validates the code, then reassigns the initiator's UserIdentity to this userId.
// Requires: req.userId (canonical account must be authenticated).
router.post('/confirm', async (req: AuthRequest, res: Response) => {
  const canonicalUserId = req.userId;
  if (!canonicalUserId) {
    res.status(400).json({ error: 'userId not resolved — cannot confirm link' });
    return;
  }

  const { code } = req.body as { code?: string };
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'code required' });
    return;
  }
  const normalizedCode = code.trim().toUpperCase();

  try {
    const db = getALRDb();
    const identityDb = getIdentityDb();

    // Find the link request
    const linkReq = await db.findFirst({
      where: { code: normalizedCode } as object,
    });

    if (!linkReq) {
      res.status(404).json({ error: 'Код не найден' });
      return;
    }
    if (linkReq.status !== 'pending') {
      const msg = linkReq.status === 'confirmed'
        ? 'Этот код уже был использован'
        : 'Этот код был отменён или истёк';
      res.status(409).json({ error: msg });
      return;
    }
    if (linkReq.expiresAt <= new Date()) {
      // Mark as expired for clarity
      await db.update({ where: { id: linkReq.id } as object, data: { status: 'expired' } as object });
      res.status(410).json({ error: 'Срок действия кода истёк. Запросите новый код.' });
      return;
    }

    // Prevent self-linking
    if (linkReq.initiatorUserId === canonicalUserId) {
      res.status(400).json({ error: 'Нельзя привязать аккаунт к самому себе' });
      return;
    }

    // Ensure the canonical account does NOT already have an identity on the initiator's platform
    // (UserIdentity @@unique([userId, platform]) would be violated)
    const existingConflict = await identityDb.findFirst({
      where: { userId: canonicalUserId, platform: linkReq.initiatorPlatform } as object,
    });
    if (existingConflict) {
      res.status(409).json({
        error: `Ваш аккаунт уже привязан к платформе ${linkReq.initiatorPlatform}. Сначала отвяжите существующий аккаунт.`,
      });
      return;
    }

    // ── Execute merge in a transaction ──────────────────────────────────────
    // Reassign the initiator's UserIdentity to the canonical userId.
    // After this:
    //   - Any login from the initiator's platform → same canonicalUserId
    //   - All userId-based queries find the canonical user's data
    //   - The initiator's old User record becomes orphaned (mergedAt is set)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.$transaction as (fn: (tx: any) => Promise<void>) => Promise<void>)(async (tx) => {
      // 1. Reassign UserIdentity: initiatorPlatform/initiatorPlatformId → canonicalUserId
      await tx.userIdentity.updateMany({
        where: {
          userId: linkReq.initiatorUserId,
          platform: linkReq.initiatorPlatform,
          platformId: linkReq.initiatorPlatformId,
        },
        data: { userId: canonicalUserId },
      });
      // 2. Mark the orphaned User as merged (mergedAt field exists in schema)
      await tx.user.update({
        where: { id: linkReq.initiatorUserId },
        data: { mergedAt: new Date() },
      });
      // 3. Mark link request as confirmed
      await tx.accountLinkRequest.update({
        where: { id: linkReq.id },
        data: {
          status: 'confirmed',
          canonicalUserId,
          confirmedAt: new Date(),
        },
      });
    });

    console.log(
      `[account-link/confirm] linked: initiator=${linkReq.initiatorUserId} platform=${linkReq.initiatorPlatform} platformId=${linkReq.initiatorPlatformId} → canonicalUserId=${canonicalUserId}`,
    );

    res.json({
      ok: true,
      linkedPlatform: linkReq.initiatorPlatform,
      linkedPlatformId: linkReq.initiatorPlatformId,
      message: `Аккаунт ${linkReq.initiatorPlatform} успешно привязан. Теперь оба аккаунта работают с одним профилем.`,
    });
  } catch (err) {
    console.error('[account-link/confirm]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/account-link/request ────────────────────────────────────────
// Cancel the current user's pending outgoing link request.
router.delete('/request', async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  if (!userId) { res.status(400).json({ error: 'userId not resolved' }); return; }

  try {
    const result = await getALRDb().updateMany({
      where: { initiatorUserId: userId, status: 'pending' } as object,
      data: { status: 'canceled' } as object,
    });
    res.json({ ok: true, canceled: result.count });
  } catch (err) {
    console.error('[account-link/request DELETE]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
