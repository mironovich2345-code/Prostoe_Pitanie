import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';
import { upsertProfile } from '../../state/profileStore';
import { tryAutoCalcNorms } from '../../utils/normsCalc';
import { resolveTimezone } from '../../utils/timezone';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const [profile, weights] = await Promise.all([
      prisma.userProfile.findUnique({ where: { chatId } }),
      prisma.weightEntry.findMany({ where: { chatId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);
    res.json({
      profile: profile ? {
        heightCm: profile.heightCm,
        currentWeightKg: profile.currentWeightKg,
        desiredWeightKg: profile.desiredWeightKg,
        dailyCaloriesKcal: profile.dailyCaloriesKcal,
        dailyProteinG: profile.dailyProteinG,
        dailyFatG: profile.dailyFatG,
        dailyCarbsG: profile.dailyCarbsG,
        dailyFiberG: profile.dailyFiberG,
        notificationsEnabled: profile.notificationsEnabled,
        notificationCount: profile.notificationCount,
        notificationTimes: profile.notificationTimes,
        city: profile.city,
        timezone: profile.timezone,
        sex: profile.sex,
        birthDate: profile.birthDate,
        activityLevel: profile.activityLevel,
      } : null,
      weightHistory: weights,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/profile/data — update physical profile fields, recalculate norms
router.patch('/data', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { heightCm, currentWeightKg, desiredWeightKg, sex, birthDate, activityLevel, city } = req.body as {
    heightCm?: number;
    currentWeightKg?: number;
    desiredWeightKg?: number;
    sex?: string;
    birthDate?: string;
    activityLevel?: number;
    city?: string;
  };

  try {
    const data: Parameters<typeof upsertProfile>[1] = {};
    if (heightCm !== undefined) data.heightCm = Number(heightCm);
    if (currentWeightKg !== undefined) data.currentWeightKg = Number(currentWeightKg);
    if (desiredWeightKg !== undefined) data.desiredWeightKg = Number(desiredWeightKg);
    if (sex !== undefined) data.sex = sex;
    if (birthDate !== undefined) data.birthDate = new Date(birthDate);
    if (activityLevel !== undefined) data.activityLevel = Number(activityLevel);
    if (city !== undefined) {
      data.city = city;
      const tz = resolveTimezone(city);
      if (tz) data.timezone = tz;
    }

    const chatIdNum = parseInt(chatId, 10);
    await upsertProfile(chatIdNum, data);
    await tryAutoCalcNorms(chatIdNum);

    const updated = await prisma.userProfile.findUnique({ where: { chatId } });
    res.json({ ok: true, profile: updated });
  } catch (err) {
    console.error('[profile/data]', err);
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
