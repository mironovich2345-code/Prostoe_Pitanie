import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';
import { ensureReferralCode, buildReferralLink, applyReferral } from '../../utils/referral';

const router = Router();

/** GET /api/referral/me — own code, link and invited count */
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

/** POST /api/referral/apply — apply someone else's code */
router.post('/apply', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { code } = req.body as { code?: string };
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Missing code' });
    return;
  }
  try {
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
  } catch (err) {
    console.error('[referral/apply]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
