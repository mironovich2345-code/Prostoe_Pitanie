import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';
import {
  ensureReferralCode,
  buildReferralLink,
  applyReferral,
  buildTrainerOfferLink,
  applyTrainerReferral,
  TRAINER_OFFER_IDS,
  TRAINER_OFFERS,
} from '../../utils/referral';

const router = Router();

/** GET /api/referral/me — own code, link and invited count (for clients) */
router.get('/me', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const code = await ensureReferralCode(chatId);
    const link = buildReferralLink(code);
    const invitedCount = await prisma.userProfile.count({ where: { referredBy: chatId } });
    res.json({ code, link, invitedCount });
  } catch (err) {
    console.error('[referral/me]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/referral/my-invited — list of users who signed up via this user's referral */
router.get('/my-invited', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const rows = await prisma.userProfile.findMany({
      where: { referredBy: chatId },
      select: { chatId: true, preferredName: true, telegramUsername: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const invited = rows.map(r => ({
      displayName: r.preferredName?.trim() || null,
      username: r.telegramUsername ?? null,
      joinedAt: r.createdAt.toISOString(),
    }));
    res.json({ invited });
  } catch (err) {
    console.error('[referral/my-invited]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/referral/trainer-offers — 3 offer links with stats (for verified trainers) */
router.get('/trainer-offers', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const trainerProfile = await prisma.trainerProfile.findUnique({
      where: { chatId },
      select: { verificationStatus: true },
    });
    if (trainerProfile?.verificationStatus !== 'verified') {
      res.status(403).json({ error: 'Not a verified trainer' });
      return;
    }

    const code = await ensureReferralCode(chatId);

    // Per-offer users with chatId for reward aggregation
    const referredUsers = await prisma.userProfile.findMany({
      where: { referredBy: chatId, referredByRole: 'trainer' },
      select: { chatId: true, trainerOfferType: true, telegramUsername: true, preferredName: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const usersByKey: Record<string, Array<{ displayName: string | null; username: string | null; joinedAt: string }>> = {};
    const clientIdsByKey: Record<string, string[]> = {};
    for (const u of referredUsers) {
      const key = u.trainerOfferType ?? '';
      if (!usersByKey[key]) { usersByKey[key] = []; clientIdsByKey[key] = []; }
      usersByKey[key].push({
        displayName: u.preferredName?.trim() || null,
        username: u.telegramUsername ?? null,
        joinedAt: u.createdAt.toISOString(),
      });
      clientIdsByKey[key].push(u.chatId);
    }

    // Fetch rewards for all referred clients to compute per-offer earnings
    const allReferredChatIds = referredUsers.map(u => u.chatId);
    const allRewards = allReferredChatIds.length > 0
      ? await prisma.trainerReward.findMany({
          where: { trainerId: chatId, referredChatId: { in: allReferredChatIds } },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    // First reward per client (for first_payment offer) + total per client (for lifetime_20)
    const firstRewardByClient: Record<string, number> = {};
    const totalRewardByClient: Record<string, number> = {};
    for (const r of allRewards) {
      if (!(r.referredChatId in firstRewardByClient)) {
        firstRewardByClient[r.referredChatId] = r.amountRub;
      }
      totalRewardByClient[r.referredChatId] = (totalRewardByClient[r.referredChatId] ?? 0) + r.amountRub;
    }

    function computeEarned(offerKey: string, clientIds: string[]): number | null {
      if (offerKey === 'first_payment') {
        return clientIds.reduce((s, id) => s + (firstRewardByClient[id] ?? 0), 0);
      }
      if (offerKey === 'lifetime_20') {
        return clientIds.reduce((s, id) => s + (totalRewardByClient[id] ?? 0), 0);
      }
      return null; // first_month_1rub: no further payment display
    }

    const offers = TRAINER_OFFER_IDS.map(offerId => {
      const meta = TRAINER_OFFERS[offerId];
      const users = usersByKey[meta.key] ?? [];
      const clientIds = clientIdsByKey[meta.key] ?? [];
      return {
        offerId,
        offerKey: meta.key,
        title: meta.title,
        desc: meta.desc,
        emoji: meta.emoji,
        link: buildTrainerOfferLink(code, offerId),
        invitedCount: users.length,
        users,
        earnedRub: computeEarned(meta.key, clientIds),
      };
    });

    const totalUniqueUsers = referredUsers.length;

    res.json({ offers, totalUniqueUsers });
  } catch (err) {
    console.error('[referral/trainer-offers]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/referral/apply — apply a referral payload (client ref_ or trainer trf_) */
router.post('/apply', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { code } = req.body as { code?: string };
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Missing code' });
    return;
  }
  try {
    // Route by payload prefix
    if (code.startsWith('trf_')) {
      const result = await applyTrainerReferral(chatId, code);
      if (result === 'ok') {
        res.json({ ok: true });
      } else if (result === 'not_found' || result === 'not_trainer') {
        res.status(404).json({ error: 'Trainer referral not found' });
      } else if (result === 'self') {
        res.status(400).json({ error: 'Cannot refer yourself' });
      } else {
        res.status(409).json({ error: 'Referral already applied' });
      }
    } else {
      const result = await applyReferral(chatId, code);
      if (result === 'ok') {
        res.json({ ok: true });
      } else if (result === 'not_found') {
        res.status(404).json({ error: 'Referral code not found' });
      } else if (result === 'self') {
        res.status(400).json({ error: 'Cannot refer yourself' });
      } else {
        res.status(409).json({ error: 'Referral already applied' });
      }
    }
  } catch (err) {
    console.error('[referral/apply]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
