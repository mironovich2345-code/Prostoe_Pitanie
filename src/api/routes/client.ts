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

export default router;
