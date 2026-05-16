import express, { Response } from 'express';
import { requireWebAuth, WebAuthRequest } from '../middleware/webAuth';
import prisma from '../../db';

const router = express.Router();
router.use(requireWebAuth as express.RequestHandler);

async function findVerifiedProfile(userId: string) {
  const profile = await prisma.trainerProfile.findUnique({
    where: { userId },
    select: { id: true, chatId: true, userId: true, verificationStatus: true },
  });
  if (!profile || profile.verificationStatus !== 'verified') return null;
  return profile;
}

// GET /api/web/expert/client-requests
router.get('/client-requests', async (req: WebAuthRequest, res: Response) => {
  const { userId } = req.webUser!;
  try {
    const profile = await findVerifiedProfile(userId);
    if (!profile) { res.status(403).json({ error: 'not_expert' }); return; }

    const requests = await prisma.clientExpertRequest.findMany({
      where: { trainerProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with safe client display info — no chatId exposed
    const clientIds = [...new Set(requests.map(r => r.clientUserId))];
    const identities = clientIds.length > 0
      ? await prisma.userIdentity.findMany({
          where: { userId: { in: clientIds }, platform: 'telegram' },
          select: { userId: true, username: true, firstName: true },
        })
      : [];
    const identityMap = new Map(identities.map(i => [i.userId, i]));

    const enriched = requests.map(r => {
      const id = identityMap.get(r.clientUserId);
      return {
        id: r.id,
        status: r.status,
        message: r.message,
        createdAt: r.createdAt,
        respondedAt: r.respondedAt,
        client: {
          displayName: id?.firstName ?? id?.username ?? 'Клиент',
          telegramUsername: id?.username ?? null,
        },
      };
    });

    res.json({ requests: enriched });
  } catch (err) {
    console.error('[web/expert/client-requests] GET:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/web/expert/client-requests/:id/accept
router.post('/client-requests/:id/accept', async (req: WebAuthRequest, res: Response) => {
  const requestId = String(req.params.id ?? '');
  const { userId } = req.webUser!;
  try {
    const profile = await findVerifiedProfile(userId);
    if (!profile) { res.status(403).json({ error: 'not_expert' }); return; }

    const expertRequest = await prisma.clientExpertRequest.findUnique({ where: { id: requestId } });
    if (!expertRequest || expertRequest.trainerProfileId !== profile.id) {
      res.status(404).json({ error: 'Not found' }); return;
    }
    if (expertRequest.status !== 'pending') {
      res.status(409).json({ error: 'not_pending' }); return;
    }

    // Resolve client's chatId from UserIdentity for the legacy trainerId/clientId fields
    const clientIdentity = await prisma.userIdentity.findFirst({
      where: { userId: expertRequest.clientUserId, platform: 'telegram' },
      select: { platformId: true },
    });
    const clientChatId = clientIdentity?.platformId ?? expertRequest.clientUserId;

    await prisma.$transaction(async (tx) => {
      // Upsert TrainerClientLink without duplicates
      const existingLink = await tx.trainerClientLink.findUnique({
        where: { trainerId_clientId: { trainerId: profile.chatId, clientId: clientChatId } },
      });
      if (existingLink) {
        await tx.trainerClientLink.update({
          where: { trainerId_clientId: { trainerId: profile.chatId, clientId: clientChatId } },
          data: { status: 'active', disconnectedAt: null },
        });
      } else {
        await tx.trainerClientLink.create({
          data: {
            trainerId: profile.chatId,
            clientId: clientChatId,
            trainerUserId: profile.userId ?? null,
            clientUserId: expertRequest.clientUserId,
            status: 'active',
          },
        });
      }
      await tx.clientExpertRequest.update({
        where: { id: requestId },
        data: { status: 'accepted', respondedAt: new Date() },
      });
    });

    res.json({ ok: true, status: 'accepted' });
  } catch (err) {
    console.error('[web/expert/client-requests] accept:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/web/expert/client-requests/:id/reject
router.post('/client-requests/:id/reject', async (req: WebAuthRequest, res: Response) => {
  const requestId = String(req.params.id ?? '');
  const { userId } = req.webUser!;
  try {
    const profile = await findVerifiedProfile(userId);
    if (!profile) { res.status(403).json({ error: 'not_expert' }); return; }

    const expertRequest = await prisma.clientExpertRequest.findUnique({ where: { id: requestId } });
    if (!expertRequest || expertRequest.trainerProfileId !== profile.id) {
      res.status(404).json({ error: 'Not found' }); return;
    }
    if (expertRequest.status !== 'pending') {
      res.status(409).json({ error: 'not_pending' }); return;
    }

    await prisma.clientExpertRequest.update({
      where: { id: requestId },
      data: { status: 'rejected', respondedAt: new Date() },
    });

    res.json({ ok: true, status: 'rejected' });
  } catch (err) {
    console.error('[web/expert/client-requests] reject:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
