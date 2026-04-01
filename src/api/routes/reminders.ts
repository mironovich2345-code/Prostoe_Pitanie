import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

const router = Router();

const MAX_REMINDERS = 5;
const MAX_PER_TYPE: Record<string, number> = {
  breakfast: 1,
  lunch: 1,
  dinner: 1,
  snack: 2,
};
const VALID_TYPES = Object.keys(MAX_PER_TYPE);

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
        const types: string[] = ['breakfast', 'lunch', 'snack', 'dinner', 'snack'];
        for (let i = 0; i < Math.min(times.length, types.length); i++) {
          await prisma.mealReminder.create({
            data: { chatId, mealType: types[i], time: times[i], enabled: true },
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

  if (!VALID_TYPES.includes(mealType)) {
    res.status(400).json({ error: 'Invalid mealType' });
    return;
  }
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    res.status(400).json({ error: 'Invalid time (HH:MM required)' });
    return;
  }

  try {
    const existing = await prisma.mealReminder.findMany({ where: { chatId } });

    if (existing.length >= MAX_REMINDERS) {
      res.status(409).json({ error: `Максимум ${MAX_REMINDERS} напоминаний` });
      return;
    }

    const typeCount = existing.filter(r => r.mealType === mealType).length;
    const maxForType = MAX_PER_TYPE[mealType] ?? 1;
    if (typeCount >= maxForType) {
      res.status(409).json({ error: 'Достигнут лимит для этого типа напоминания' });
      return;
    }

    const reminder = await prisma.mealReminder.create({
      data: { chatId, mealType, time, enabled: enabled ?? true },
    });
    res.json({ reminder });
  } catch {
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
