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

    // Per-offer stats
    const stats = await prisma.userProfile.groupBy({
      by: ['trainerOfferType'],
      where: { referredBy: chatId, referredByRole: 'trainer' },
      _count: { id: true },
    });
    const statsByKey = Object.fromEntries(
      stats.map(s => [s.trainerOfferType ?? '', s._count.id])
    );

    const offers = TRAINER_OFFER_IDS.map(offerId => {
      const meta = TRAINER_OFFERS[offerId];
      return {
        offerId,
        offerKey: meta.key,
        title: meta.title,
        desc: meta.desc,
        emoji: meta.emoji,
        link: buildTrainerOfferLink(code, offerId),
        invitedCount: statsByKey[meta.key] ?? 0,
      };
    });

    res.json({ offers });
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
