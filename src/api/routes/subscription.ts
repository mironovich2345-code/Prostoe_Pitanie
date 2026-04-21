import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

const router = Router();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const userSubDb = (prisma as unknown as { userSubscription: any }).userSubscription as {
  findUnique(args: object): Promise<Record<string, unknown> | null>;
};

/** Normalize any subscription record to the SubscriptionInfo shape the frontend expects. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeUserSub(us: any) {
  return {
    planId:          us.planId,
    status:          us.status,
    trialEndsAt:     us.trialEndsAt    ? new Date(us.trialEndsAt).toISOString()    : null,
    currentPeriodEnd: us.currentPeriodEnd ? new Date(us.currentPeriodEnd).toISOString() : null,
    autoRenew:       us.autoRenew,
    hasPaymentMethod: !!(us.providerSubId),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeLegacySub(sub: any) {
  return {
    planId:           sub.planId,
    status:           sub.status,
    trialEndsAt:      sub.trialEndsAt    ? new Date(sub.trialEndsAt).toISOString()    : null,
    currentPeriodEnd: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toISOString() : null,
    autoRenew:        sub.autoRenew,
    hasPaymentMethod: false, // legacy table has no providerSubId — auto-renewal not possible
  };
}

// ─── GET /api/subscription — subscription status for the authenticated user ──
//
// UserSubscription (userId-keyed) is the canonical source: it is what the payment
// webhook writes to after a successful charge. The legacy Subscription (chatId-keyed)
// is kept as a read fallback for pre-migration users who have not yet been backfilled.

router.get('/', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const userId  = req.userId ?? null;
  try {
    // 1. Prefer UserSubscription (canonical: written by webhook + activateSubscription)
    if (userId) {
      const userSub = await userSubDb.findUnique({ where: { userId } } as object);
      if (userSub) {
        res.json({ subscription: normalizeUserSub(userSub) });
        return;
      }
    }
    // 2. Fallback: legacy Subscription (chatId-keyed, pre-migration users)
    const legacySub = await prisma.subscription.findUnique({ where: { chatId } });
    res.json({ subscription: legacySub ? normalizeLegacySub(legacySub) : null });
  } catch (err) {
    console.error('[subscription GET]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/subscription/auto-renew ───────────────────────────────────────
//
// Enables or disables auto-renewal for the authenticated user's subscription.
// Body: { enabled: boolean }
//
// When enabled=false:
//   - The current paid period is preserved (no refund, no early cancellation).
//   - The renewal job will skip this subscription because autoRenew=false.
//   - The user must purchase manually to continue after the period ends.
//
// Updates UserSubscription (canonical table) if the user has one, falling back
// to the legacy Subscription table (chatId-keyed) for older records.

router.patch('/auto-renew', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const userId  = req.userId ?? null;
  const { enabled } = req.body as { enabled?: boolean };

  if (typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'enabled must be a boolean' });
    return;
  }

  try {
    // Prefer UserSubscription (userId-keyed, the canonical table after payment flow)
    if (userId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subDb = (prisma as unknown as { userSubscription: any }).userSubscription as {
        findUnique(args: object): Promise<{ userId: string } | null>;
        update(args: object): Promise<{ userId: string; autoRenew: boolean }>;
      };
      const existing = await subDb.findUnique({ where: { userId } } as object);
      if (existing) {
        const updated = await subDb.update({
          where: { userId },
          data: { autoRenew: enabled },
        } as object);
        console.log(`[subscription/auto-renew] userId=${userId} autoRenew=${updated.autoRenew}`);
        res.json({ ok: true, autoRenew: updated.autoRenew });
        return;
      }
    }

    // Fallback: legacy Subscription table (chatId-keyed)
    const updated = await prisma.subscription.update({
      where: { chatId },
      data: { autoRenew: enabled },
    });
    console.log(`[subscription/auto-renew] chatId=${chatId} autoRenew=${updated.autoRenew} (legacy table)`);
    res.json({ ok: true, autoRenew: updated.autoRenew });
  } catch (err) {
    console.error('[subscription/auto-renew]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
