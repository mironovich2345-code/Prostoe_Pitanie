import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

const router = Router();

const VALID_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'extra'] as const;
type MealType = typeof VALID_TYPES[number];

// GET /api/reminders — list, with legacy notificationTimes auto-convert on first access
router.get('/', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    let reminders = await prisma.mealReminder.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    });

    if (reminders.length === 0) {
      const profile = await prisma.userProfile.findUnique({
        where: { chatId },
        select: { notificationTimes: true },
      });
      if (profile?.notificationTimes) {
        const times = profile.notificationTimes.trim().split(/[\s,]+/).filter(t => /^\d{2}:\d{2}$/.test(t));
        for (let i = 0; i < Math.min(times.length, VALID_TYPES.length); i++) {
          await prisma.mealReminder.create({
            data: { chatId, mealType: VALID_TYPES[i], time: times[i], enabled: true },
          }).catch(() => {});
        }
        reminders = await prisma.mealReminder.findMany({ where: { chatId }, orderBy: { createdAt: 'asc' } });
      }
    }

    res.json({ reminders });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/reminders
router.post('/', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { mealType, time, enabled } = req.body as { mealType: string; time: string; enabled?: boolean };

  if (!VALID_TYPES.includes(mealType as MealType)) {
    res.status(400).json({ error: 'Invalid mealType' });
    return;
  }
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    res.status(400).json({ error: 'Invalid time (HH:MM required)' });
    return;
  }

  try {
    const reminder = await prisma.mealReminder.create({
      data: { chatId, mealType, time, enabled: enabled ?? true },
    });
    res.json({ reminder });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      res.status(409).json({ error: 'Напоминание для этого типа уже существует' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/reminders/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const id = parseInt(String(req.params.id), 10);
  const { time, enabled } = req.body as { time?: string; enabled?: boolean };

  if (time !== undefined && !/^\d{2}:\d{2}$/.test(time)) {
    res.status(400).json({ error: 'Invalid time (HH:MM required)' });
    return;
  }

  try {
    const existing = await prisma.mealReminder.findFirst({ where: { id, chatId } });
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

    const data: { time?: string; enabled?: boolean } = {};
    if (time !== undefined) data.time = time;
    if (enabled !== undefined) data.enabled = enabled;

    const reminder = await prisma.mealReminder.update({ where: { id }, data });
    res.json({ reminder });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/reminders/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const id = parseInt(String(req.params.id), 10);

  try {
    const existing = await prisma.mealReminder.findFirst({ where: { id, chatId } });
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

    await prisma.mealReminder.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
