import { Router } from 'express';
import { requireWebAuth, WebAuthRequest } from '../middleware/webAuth';
import prisma from '../../db';

const router = Router();
router.use(requireWebAuth as import('express').RequestHandler);

const VALID_MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack', 'other']);

async function collectChatIds(userId: string): Promise<string[]> {
  const identities = await prisma.userIdentity.findMany({
    where: { userId },
    select: { platform: true, platformId: true },
  });
  const set = new Set<string>([`web_${userId}`]);
  for (const id of identities) {
    if (id.platform === 'telegram' || id.platform === 'max') {
      set.add(id.platformId);
    }
  }
  return [...set];
}

// Returns Prisma OR filter covering userId + legacy chatId records.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ownerFilter(userId: string, chatIds: string[]): any {
  return { OR: [{ userId }, { chatId: { in: chatIds }, userId: null }] };
}

// GET /api/web/nutrition/day?date=YYYY-MM-DD
router.get('/day', async (req: WebAuthRequest, res) => {
  const { userId } = req.webUser!;

  const raw = typeof req.query.date === 'string' ? req.query.date : '';
  let dateStr: string;
  let start: Date, end: Date;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    start = new Date(`${raw}T00:00:00.000Z`);
    end   = new Date(`${raw}T23:59:59.999Z`);
    if (isNaN(start.getTime())) {
      res.status(400).json({ ok: false, error: 'invalid_date' });
      return;
    }
    dateStr = raw;
  } else {
    const now = new Date();
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    dateStr = start.toISOString().slice(0, 10);
  }

  try {
    const chatIds = await collectChatIds(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { ...ownerFilter(userId, chatIds), createdAt: { gte: start, lte: end } };

    const meals = await prisma.mealEntry.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, text: true, mealType: true,
        caloriesKcal: true, proteinG: true, fatG: true, carbsG: true, fiberG: true,
        createdAt: true,
      },
    }) as Array<{
      id: number; text: string; mealType: string;
      caloriesKcal: number | null; proteinG: number | null; fatG: number | null;
      carbsG: number | null; fiberG: number | null; createdAt: Date;
    }>;

    let totalCal = 0, totalProt = 0, totalFat = 0, totalCarbs = 0, totalFiber = 0;
    for (const m of meals) {
      totalCal   += m.caloriesKcal ?? 0;
      totalProt  += m.proteinG    ?? 0;
      totalFat   += m.fatG        ?? 0;
      totalCarbs += m.carbsG      ?? 0;
      totalFiber += m.fiberG      ?? 0;
    }

    const profile = await prisma.userProfile.findFirst({
      where: { userId },
      select: { dailyCaloriesKcal: true, dailyProteinG: true, dailyFatG: true, dailyCarbsG: true },
    });

    res.json({
      ok: true,
      date: dateStr,
      meals: meals.map(m => ({
        id:           m.id,
        name:         m.text,
        mealType:     m.mealType,
        caloriesKcal: m.caloriesKcal,
        proteinG:     m.proteinG,
        fatG:         m.fatG,
        carbsG:       m.carbsG,
        fiberG:       m.fiberG,
        createdAt:    m.createdAt,
      })),
      totals: {
        calories: Math.round(totalCal),
        protein:  Math.round(totalProt  * 10) / 10,
        fat:      Math.round(totalFat   * 10) / 10,
        carbs:    Math.round(totalCarbs * 10) / 10,
        fiber:    Math.round(totalFiber * 10) / 10,
      },
      target: profile ? {
        calories: profile.dailyCaloriesKcal,
        protein:  profile.dailyProteinG,
        fat:      profile.dailyFatG,
        carbs:    profile.dailyCarbsG,
      } : null,
    });
  } catch (err) {
    console.error('[web/nutrition/day] failed', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// POST /api/web/nutrition/meals
router.post('/meals', async (req: WebAuthRequest, res) => {
  const { userId, chatId } = req.webUser!;
  const syntheticChatId = chatId ?? `web_${userId}`;
  const body = req.body as Record<string, unknown>;

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    res.status(400).json({ ok: false, error: 'name_required' });
    return;
  }
  const mealType = typeof body.mealType === 'string' ? body.mealType : '';
  if (!VALID_MEAL_TYPES.has(mealType)) {
    res.status(400).json({ ok: false, error: 'invalid_meal_type' });
    return;
  }

  const toFloat = (v: unknown): number | null => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {
    chatId: syntheticChatId,
    userId,
    text: name.slice(0, 1000),
    mealType,
    sourceType:   'web_manual',
    caloriesKcal: toFloat(body.caloriesKcal),
    proteinG:     toFloat(body.proteinG),
    fatG:         toFloat(body.fatG),
    carbsG:       toFloat(body.carbsG),
    fiberG:       toFloat(body.fiberG),
  };

  try {
    const meal = await prisma.mealEntry.create({
      data,
      select: {
        id: true, text: true, mealType: true,
        caloriesKcal: true, proteinG: true, fatG: true, carbsG: true, fiberG: true,
        createdAt: true,
      },
    }) as {
      id: number; text: string; mealType: string;
      caloriesKcal: number | null; proteinG: number | null; fatG: number | null;
      carbsG: number | null; fiberG: number | null; createdAt: Date;
    };

    res.json({
      ok: true,
      meal: {
        id:           meal.id,
        name:         meal.text,
        mealType:     meal.mealType,
        caloriesKcal: meal.caloriesKcal,
        proteinG:     meal.proteinG,
        fatG:         meal.fatG,
        carbsG:       meal.carbsG,
        fiberG:       meal.fiberG,
        createdAt:    meal.createdAt,
      },
    });
  } catch (err) {
    console.error('[web/nutrition/meals POST] failed', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// DELETE /api/web/nutrition/meals/:id
router.delete('/meals/:id', async (req: WebAuthRequest, res) => {
  const { userId } = req.webUser!;

  const mealId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(mealId) || mealId <= 0) {
    res.status(400).json({ ok: false, error: 'invalid_id' });
    return;
  }

  try {
    const chatIds = await collectChatIds(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { id: mealId, ...ownerFilter(userId, chatIds) };

    const meal = await prisma.mealEntry.findFirst({
      where,
      select: { id: true },
    }) as { id: number } | null;

    if (!meal) {
      res.status(404).json({ ok: false, error: 'not_found' });
      return;
    }

    await prisma.mealEntry.delete({ where: { id: mealId } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[web/nutrition/meals DELETE] failed', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;
