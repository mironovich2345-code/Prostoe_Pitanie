import express, { Response } from 'express';
import { requireWebAuth, WebAuthRequest } from '../middleware/webAuth';
import prisma from '../../db';
import { getSubscriptionState } from '../../services/subscriptionService';

const router = express.Router();
router.use(requireWebAuth as express.RequestHandler);

// Check Pro access: canonical UserSubscription first, then legacy Subscription fallback.
async function hasPro(userId: string, chatId: string): Promise<boolean> {
  try {
    const { accessLevel } = await getSubscriptionState(userId);
    if (accessLevel === 'full') return true;
  } catch { /* ignore, fall through to legacy */ }
  try {
    const legacySub = await prisma.subscription.findUnique({ where: { chatId } });
    if (legacySub) {
      const end = legacySub.currentPeriodEnd ?? legacySub.trialEndsAt;
      const active = legacySub.status === 'active' || legacySub.status === 'trial';
      if (active && end && new Date(end) > new Date()) return true;
    }
  } catch { /* ignore */ }
  return false;
}

// GET /api/client-expert-requests/subscription-status
router.get('/subscription-status', async (req: WebAuthRequest, res: Response) => {
  const { userId, chatId } = req.webUser!;
  try {
    const pro = await hasPro(userId, chatId);
    res.json({ hasPro: pro });
  } catch {
    res.json({ hasPro: false });
  }
});

// GET /api/client-expert-requests/me
router.get('/me', async (req: WebAuthRequest, res: Response) => {
  const { userId } = req.webUser!;
  try {
    const requests = await prisma.clientExpertRequest.findMany({
      where: { clientUserId: userId },
      orderBy: { createdAt: 'desc' },
    });

    const trainerIds = [...new Set(requests.map(r => r.trainerProfileId))];
    const trainers = trainerIds.length > 0
      ? await prisma.trainerProfile.findMany({
          where: { id: { in: trainerIds } },
          select: { id: true, fullName: true, specialization: true, slug: true, city: true, publicStatus: true },
        })
      : [];
    const trainerMap = new Map(trainers.map(t => [t.id, t]));

    const enriched = requests.map(r => ({
      id: r.id,
      status: r.status,
      message: r.message,
      createdAt: r.createdAt,
      respondedAt: r.respondedAt,
      expert: trainerMap.get(r.trainerProfileId) ?? null,
    }));

    res.json({ requests: enriched });
  } catch (err) {
    console.error('[client-expert-requests] GET /me:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/client-expert-requests
router.post('/', async (req: WebAuthRequest, res: Response) => {
  const { userId, chatId } = req.webUser!;
  const { trainerSlug, message } = (req.body ?? {}) as { trainerSlug?: string; message?: string };

  if (!trainerSlug?.trim()) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }
  if (message !== undefined && String(message).length > 500) {
    res.status(400).json({ error: 'invalid_message' });
    return;
  }

  try {
    // 1. Resolve trainer
    const trainer = await prisma.trainerProfile.findUnique({
      where: { slug: trainerSlug },
      select: { id: true, userId: true, chatId: true, verificationStatus: true, publicStatus: true },
    });
    if (!trainer || trainer.verificationStatus !== 'verified' || trainer.publicStatus !== 'published') {
      res.status(404).json({ error: 'expert_not_found' });
      return;
    }

    // 2. Prevent self-request
    if (trainer.userId && trainer.userId === userId) {
      res.status(400).json({ error: 'cannot_request_self' });
      return;
    }

    // 3. Pro gate
    const pro = await hasPro(userId, chatId);
    if (!pro) {
      res.status(402).json({ error: 'requires_pro' });
      return;
    }

    // 4. Check existing TrainerClientLink (already connected)
    const existingLink = await prisma.trainerClientLink.findFirst({
      where: {
        OR: [
          ...(trainer.userId ? [{ trainerUserId: trainer.userId, clientUserId: userId }] : []),
          { trainerId: trainer.chatId, clientId: chatId },
        ],
      },
      select: { status: true },
    });
    if (existingLink && existingLink.status === 'active') {
      res.status(409).json({ error: 'already_connected' });
      return;
    }

    // 5. Upsert request — prevent duplicate pending; allow re-send after rejection/cancellation
    const existing = await prisma.clientExpertRequest.findUnique({
      where: { clientUserId_trainerProfileId: { clientUserId: userId, trainerProfileId: trainer.id } },
    });

    if (existing) {
      if (existing.status === 'pending') {
        res.status(409).json({ error: 'pending_exists', request: { id: existing.id, status: existing.status } });
        return;
      }
      if (existing.status === 'accepted') {
        res.status(409).json({ error: 'already_connected' });
        return;
      }
      // Rejected / canceled — allow re-sending
      const updated = await prisma.clientExpertRequest.update({
        where: { id: existing.id },
        data: { status: 'pending', message: message?.trim() || null, respondedAt: null },
      });
      res.json({ request: updated });
      return;
    }

    const request = await prisma.clientExpertRequest.create({
      data: {
        clientUserId: userId,
        expertUserId: trainer.userId ?? null,
        trainerProfileId: trainer.id,
        status: 'pending',
        message: message?.trim() || null,
        source: 'web',
      },
    });
    res.status(201).json({ request });
  } catch (err) {
    console.error('[client-expert-requests] POST:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
