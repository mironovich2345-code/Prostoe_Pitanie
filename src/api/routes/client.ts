import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

const router = Router();

// GET /api/client/trainers — list all verified trainers (public info only)
router.get('/trainers', async (_req: AuthRequest, res: Response) => {
  try {
    const trainers = await prisma.trainerProfile.findMany({
      where: { verificationStatus: 'verified', specialization: { not: 'Компания' } },
      select: { chatId: true, fullName: true, specialization: true, bio: true },
      orderBy: { verifiedAt: 'desc' },
    });
    res.json({ trainers });
  } catch (err) {
    console.error('[client/trainers]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/client/trainer/lookup-by-id?trainerId=xxx — preview a verified trainer by chatId
router.get('/trainer/lookup-by-id', async (req: AuthRequest, res: Response) => {
  const { trainerId } = req.query as { trainerId?: string };
  if (!trainerId) { res.status(400).json({ error: 'trainerId required' }); return; }
  try {
    const tp = await prisma.trainerProfile.findFirst({
      where: { chatId: trainerId, verificationStatus: 'verified' },
      select: { chatId: true, fullName: true, specialization: true, bio: true },
    });
    if (!tp) { res.status(404).json({ error: 'Trainer not found' }); return; }
    res.json({ trainerId: tp.chatId, fullName: tp.fullName, specialization: tp.specialization, bio: tp.bio });
  } catch (err) {
    console.error('[client/trainer/lookup-by-id]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/client/trainer/connect-direct — connect by trainerId, no code required
router.post('/trainer/connect-direct', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { trainerId, fullHistoryAccess, canViewPhotos } = req.body as {
    trainerId?: string;
    fullHistoryAccess?: boolean;
    canViewPhotos?: boolean;
  };
  if (!trainerId) { res.status(400).json({ error: 'trainerId required' }); return; }
  if (trainerId === chatId) { res.status(400).json({ error: 'Cannot connect to yourself' }); return; }
  try {
    const existing = await prisma.trainerClientLink.findFirst({
      where: { clientId: chatId, status: 'active' },
    });
    if (existing) { res.status(409).json({ error: 'Already have an active trainer' }); return; }

    const tp = await prisma.trainerProfile.findFirst({
      where: { chatId: trainerId, verificationStatus: 'verified' },
      select: { chatId: true, fullName: true, specialization: true },
    });
    if (!tp) { res.status(404).json({ error: 'Trainer not found or not verified' }); return; }

    const link = await prisma.trainerClientLink.upsert({
      where: { trainerId_clientId: { trainerId: tp.chatId, clientId: chatId } },
      update: {
        status: 'active',
        fullHistoryAccess: fullHistoryAccess ?? false,
        canViewPhotos: canViewPhotos ?? true,
        connectedAt: new Date(),
        disconnectedAt: { set: null },
      },
      create: {
        trainerId: tp.chatId,
        clientId: chatId,
        status: 'active',
        fullHistoryAccess: fullHistoryAccess ?? false,
        canViewPhotos: canViewPhotos ?? true,
      },
    });
    res.json({
      ok: true,
      link: { trainerId: link.trainerId, fullHistoryAccess: link.fullHistoryAccess, canViewPhotos: link.canViewPhotos, connectedAt: link.connectedAt },
      trainer: { fullName: tp.fullName, specialization: tp.specialization },
    });
  } catch (err) {
    console.error('[client/trainer/connect-direct]', err);
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/client/trainer — disconnect current active trainer
router.delete('/trainer', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const link = await prisma.trainerClientLink.findFirst({
      where: { clientId: chatId, status: 'active' },
    });
    if (!link) {
      res.status(404).json({ error: 'No active trainer link' });
      return;
    }
    await prisma.trainerClientLink.update({
      where: { id: link.id },
      data: { status: 'ended', disconnectedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/client/trainer/access — update both fullHistoryAccess and canViewPhotos
router.patch('/trainer/access', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { fullHistoryAccess, canViewPhotos } = req.body as { fullHistoryAccess?: boolean; canViewPhotos?: boolean };
  try {
    const link = await prisma.trainerClientLink.findFirst({
      where: { clientId: chatId, status: 'active' },
    });
    if (!link) { res.status(404).json({ error: 'No active trainer link' }); return; }
    const data: Record<string, boolean> = {};
    if (typeof fullHistoryAccess === 'boolean') data['fullHistoryAccess'] = fullHistoryAccess;
    if (typeof canViewPhotos === 'boolean') data['canViewPhotos'] = canViewPhotos;
    await prisma.trainerClientLink.update({ where: { id: link.id }, data });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/client/trainer/history-access — grant or revoke full history access
router.patch('/trainer/history-access', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { fullAccess } = req.body as { fullAccess: boolean };
  if (typeof fullAccess !== 'boolean') {
    res.status(400).json({ error: 'fullAccess must be boolean' });
    return;
  }
  try {
    const link = await prisma.trainerClientLink.findFirst({
      where: { clientId: chatId, status: 'active' },
    });
    if (!link) {
      res.status(404).json({ error: 'No active trainer link' });
      return;
    }
    await prisma.trainerClientLink.update({
      where: { id: link.id },
      data: { fullHistoryAccess: fullAccess },
    });
    res.json({ ok: true, fullHistoryAccess: fullAccess });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/client/trainer/lookup — find trainer by 6-digit connection code (no DB write)
router.post('/trainer/lookup', async (req: AuthRequest, res: Response) => {
  const { code } = req.body as { code?: string };
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Missing code' }); return;
  }
  // Accept 6-digit numeric codes; also accept old alphanumeric for backward compatibility during migration
  const normalizedCode = code.trim();
  try {
    const tp = await prisma.trainerProfile.findFirst({
      where: {
        connectionCode: normalizedCode,
        verificationStatus: 'verified',
      },
      select: { chatId: true, fullName: true, specialization: true, bio: true },
    });
    if (!tp) {
      res.status(404).json({ error: 'Code not found or expired' }); return;
    }
    res.json({ trainerId: tp.chatId, fullName: tp.fullName, specialization: tp.specialization, bio: tp.bio });
  } catch (err) {
    console.error('[client/trainer/lookup]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/client/trainer/connect — confirm connection with access rights
router.post('/trainer/connect', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { code, fullHistoryAccess, canViewPhotos } = req.body as {
    code?: string;
    fullHistoryAccess?: boolean;
    canViewPhotos?: boolean;
  };
  if (!code) { res.status(400).json({ error: 'Missing code' }); return; }
  const normalizedCode = code.trim();

  try {
    // Only one active trainer allowed
    const existing = await prisma.trainerClientLink.findFirst({
      where: { clientId: chatId, status: 'active' },
    });
    if (existing) {
      res.status(409).json({ error: 'Already have an active trainer' }); return;
    }

    // Find trainer by permanent code (no TTL)
    const tp = await prisma.trainerProfile.findFirst({
      where: {
        connectionCode: normalizedCode,
        verificationStatus: 'verified',
      },
      select: { chatId: true, fullName: true, specialization: true },
    });
    if (!tp) { res.status(404).json({ error: 'Code not found' }); return; }
    if (tp.chatId === chatId) { res.status(400).json({ error: 'Cannot connect to yourself' }); return; }

    // Create or reactivate link
    const link = await prisma.trainerClientLink.upsert({
      where: { trainerId_clientId: { trainerId: tp.chatId, clientId: chatId } },
      update: {
        status: 'active',
        fullHistoryAccess: fullHistoryAccess ?? false,
        canViewPhotos: canViewPhotos ?? true,
        connectedAt: new Date(),
        disconnectedAt: { set: null },
      },
      create: {
        trainerId: tp.chatId,
        clientId: chatId,
        status: 'active',
        fullHistoryAccess: fullHistoryAccess ?? false,
        canViewPhotos: canViewPhotos ?? true,
      },
    });

    res.json({
      ok: true,
      link: {
        trainerId: link.trainerId,
        fullHistoryAccess: link.fullHistoryAccess,
        canViewPhotos: link.canViewPhotos,
        connectedAt: link.connectedAt,
      },
      trainer: { fullName: tp.fullName, specialization: tp.specialization },
    });
  } catch (err) {
    console.error('[client/trainer/connect]', err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
