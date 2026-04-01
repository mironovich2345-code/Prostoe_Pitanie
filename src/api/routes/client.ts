import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

const router = Router();

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

// POST /api/client/trainer/lookup — find trainer by 5-char connection code (no DB write)
router.post('/trainer/lookup', async (req: AuthRequest, res: Response) => {
  const { code } = req.body as { code?: string };
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Missing code' }); return;
  }
  const normalizedCode = code.trim().toUpperCase();
  try {
    const tp = await prisma.trainerProfile.findFirst({
      where: {
        connectionCode: normalizedCode,
        connectionCodeExpiresAt: { gt: new Date() },
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
  const normalizedCode = code.trim().toUpperCase();

  try {
    // Only one active trainer allowed
    const existing = await prisma.trainerClientLink.findFirst({
      where: { clientId: chatId, status: 'active' },
    });
    if (existing) {
      res.status(409).json({ error: 'Already have an active trainer' }); return;
    }

    // Find trainer by code
    const tp = await prisma.trainerProfile.findFirst({
      where: {
        connectionCode: normalizedCode,
        connectionCodeExpiresAt: { gt: new Date() },
        verificationStatus: 'verified',
      },
      select: { chatId: true, fullName: true, specialization: true },
    });
    if (!tp) { res.status(404).json({ error: 'Code not found or expired' }); return; }
    if (tp.chatId === chatId) { res.status(400).json({ error: 'Cannot connect to yourself' }); return; }

    // Create or reactivate link
    const link = await prisma.trainerClientLink.upsert({
      where: { trainerId_clientId: { trainerId: tp.chatId, clientId: chatId } },
      update: {
        status: 'active',
        fullHistoryAccess: fullHistoryAccess ?? false,
        canViewPhotos: canViewPhotos ?? true,
        connectedAt: new Date(),
        disconnectedAt: null,
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
