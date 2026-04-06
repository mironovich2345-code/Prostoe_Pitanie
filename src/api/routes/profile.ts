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
        goalType: profile.goalType,
        notificationsEnabled: profile.notificationsEnabled,
        notificationCount: profile.notificationCount,
        notificationTimes: profile.notificationTimes,
        city: profile.city,
        timezone: profile.timezone,
        preferredName: profile.preferredName,
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
  const { heightCm, currentWeightKg, desiredWeightKg, sex, birthDate, activityLevel, city, timezone, preferredName } = req.body as {
    heightCm?: number;
    currentWeightKg?: number;
    desiredWeightKg?: number;
    sex?: string;
    birthDate?: string;
    activityLevel?: number;
    city?: string;
    timezone?: string;
    preferredName?: string;
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
      // Prefer explicitly provided timezone; fallback to resolveTimezone
      const resolved = resolveTimezone(city);
      const tz = resolved ?? timezone;
      if (tz) data.timezone = tz;
    } else if (timezone !== undefined) {
      // Allow updating timezone standalone (e.g., manual override)
      data.timezone = timezone;
    }
    if (preferredName !== undefined) data.preferredName = preferredName.trim() || undefined;

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

// POST /api/profile/weight — log current weight (updates profile + adds WeightEntry)
router.post('/weight', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { weightKg } = req.body as { weightKg: number };
  const w = Number(weightKg);
  if (isNaN(w) || w < 10 || w > 600) {
    res.status(400).json({ error: 'Invalid weight' });
    return;
  }
  try {
    const [entry] = await Promise.all([
      prisma.weightEntry.create({ data: { chatId, weightKg: w } }),
      prisma.userProfile.upsert({
        where: { chatId },
        update: { currentWeightKg: w },
        create: { chatId, currentWeightKg: w },
      }),
    ]);
    res.json({ ok: true, weightEntry: entry });
  } catch (err) {
    console.error('[profile/weight]', err);
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

// PATCH /api/profile/avatar — store base64 avatar for user profile
router.patch('/avatar', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { avatarData } = req.body as { avatarData?: string | null };
  if (avatarData !== null && avatarData !== undefined && typeof avatarData !== 'string') {
    res.status(400).json({ error: 'Invalid avatarData' });
    return;
  }
  try {
    await prisma.userProfile.upsert({
      where: { chatId },
      update: { avatarData: avatarData ?? null },
      create: { chatId, avatarData: avatarData ?? null },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[profile/avatar]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
