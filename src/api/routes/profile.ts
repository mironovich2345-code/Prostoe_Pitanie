import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const [profile, weights] = await Promise.all([
      prisma.userProfile.findUnique({ where: { chatId } }),
      prisma.weightEntry.findMany({ where: { chatId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);
    res.json({ profile, weightHistory: weights });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/notifications', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { notificationsEnabled, notificationCount, notificationTimes } = req.body as {
    notificationsEnabled?: boolean;
    notificationCount?: number;
    notificationTimes?: string;
  };
  try {
    const data: Record<string, unknown> = {};
    if (notificationsEnabled !== undefined) data.notificationsEnabled = notificationsEnabled;
    if (notificationCount !== undefined) data.notificationCount = notificationCount;
    if (notificationTimes !== undefined) data.notificationTimes = notificationTimes;
    await prisma.userProfile.upsert({
      where: { chatId },
      update: data,
      create: { chatId, ...data },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
