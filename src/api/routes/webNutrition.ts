import { Router } from 'express';
import { requireWebAuth, WebAuthRequest } from '../middleware/webAuth';
import prisma from '../../db';
import { analyzeFood, analyzeFoodPhoto } from '../../ai/analyzeFood';
import { getSubscriptionState } from '../../services/subscriptionService';
import { validateImageDataUrl, PHOTO_MAX_BYTES } from '../utils/validateImage';

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

// POST /api/web/nutrition/add-product
router.post('/add-product', async (req: WebAuthRequest, res) => {
  const { userId, chatId } = req.webUser!;
  const syntheticChatId = chatId ?? `web_${userId}`;
  const body = req.body as Record<string, unknown>;

  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  if (!productId) {
    res.status(400).json({ ok: false, error: 'product_id_required' });
    return;
  }

  const gramsRaw = Number(body.grams);
  if (!Number.isFinite(gramsRaw) || gramsRaw < 1 || gramsRaw > 5000) {
    res.status(400).json({ ok: false, error: 'invalid_grams' });
    return;
  }

  const mealType = typeof body.mealType === 'string' ? body.mealType : '';
  if (!VALID_MEAL_TYPES.has(mealType)) {
    res.status(400).json({ ok: false, error: 'invalid_meal_type' });
    return;
  }

  const dateRaw = typeof body.date === 'string' ? body.date : '';
  let createdAt: Date | undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    const d = new Date(`${dateRaw}T12:00:00.000Z`);
    if (!isNaN(d.getTime())) createdAt = d;
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true, name: true, brand: true,
        caloriesPer100g: true, proteinPer100g: true, fatPer100g: true, carbsPer100g: true,
        isHidden: true,
      },
    });

    if (!product || product.isHidden) {
      res.status(404).json({ ok: false, error: 'product_not_found' });
      return;
    }

    const g = gramsRaw;
    const text = `${product.name}${product.brand ? ', ' + product.brand : ''}, ${g} г`;
    const caloriesKcal = Math.round(product.caloriesPer100g * g / 100);
    const proteinG     = Math.round(product.proteinPer100g  * g / 100 * 10) / 10;
    const fatG         = Math.round(product.fatPer100g      * g / 100 * 10) / 10;
    const carbsG       = Math.round(product.carbsPer100g    * g / 100 * 10) / 10;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {
      chatId: syntheticChatId,
      userId,
      text,
      mealType,
      sourceType:  'web_product',
      caloriesKcal,
      proteinG,
      fatG,
      carbsG,
      ...(createdAt ? { createdAt } : {}),
    };

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
    console.error('[web/nutrition/add-product POST] failed', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// POST /api/web/nutrition/analyze-photo  [premium — same policy as /api/nutrition/analyze-photo]
router.post('/analyze-photo', async (req: WebAuthRequest, res) => {
  const { userId, chatId } = req.webUser!;
  const syntheticChatId = chatId ?? `web_${userId}`;
  const body = req.body as Record<string, unknown>;

  // ── Premium check ─────────────────────────────────────────────────────────
  try {
    const { accessLevel } = await getSubscriptionState(userId);
    if (accessLevel !== 'full') {
      // Legacy bridge: check old chatId-based Subscription for still-active records
      let legacyOk = false;
      if (chatId) {
        try {
          const legacy = await prisma.subscription.findUnique({ where: { chatId } });
          const now = new Date();
          if (legacy) {
            if (legacy.status === 'active' && legacy.currentPeriodEnd && legacy.currentPeriodEnd > now) legacyOk = true;
            if (legacy.status === 'trial'  && legacy.trialEndsAt    && legacy.trialEndsAt    > now) legacyOk = true;
          }
        } catch { /* ignore */ }
      }
      if (!legacyOk) {
        res.status(402).json({ ok: false, error: 'subscription_required' });
        return;
      }
    }
  } catch {
    // Fail-open on DB errors (same policy as requirePremiumAccess middleware)
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  const imageDataUrl = body.imageDataUrl;
  if (!validateImageDataUrl(imageDataUrl, PHOTO_MAX_BYTES)) {
    res.status(400).json({ ok: false, error: 'invalid_image' });
    return;
  }

  try {
    const result = await analyzeFoodPhoto(imageDataUrl as string, {
      userId,
      chatId: syntheticChatId,
      scenario: 'food_photo',
    });

    res.json({
      ok: true,
      analysis: {
        name:                  result.name,
        mealType:              result.mealType,
        items:                 result.items ?? [],
        caloriesKcal:          result.caloriesKcal ?? null,
        proteinG:              result.proteinG ?? null,
        fatG:                  result.fatG ?? null,
        carbsG:                result.carbsG ?? null,
        fiberG:                result.fiberG ?? null,
        weightG:               result.weightG ?? null,
        confidence:            result.confidence ?? 'low',
        needsClarification:    result.needsClarification ?? false,
        clarificationQuestion: result.clarificationQuestion ?? null,
      },
    });
  } catch (err) {
    console.error('[web/nutrition/analyze-photo] failed', err);
    res.status(500).json({ ok: false, error: 'analysis_failed' });
  }
});

// POST /api/web/nutrition/analyze-text  [free — same policy as /api/nutrition/analyze]
router.post('/analyze-text', async (req: WebAuthRequest, res) => {
  const { userId, chatId } = req.webUser!;
  const syntheticChatId = chatId ?? `web_${userId}`;
  const body = req.body as Record<string, unknown>;

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length < 2 || text.length > 1000) {
    res.status(400).json({ ok: false, error: 'invalid_text' });
    return;
  }

  try {
    const result = await analyzeFood(text, {
      userId,
      chatId: syntheticChatId,
      scenario: 'food_text',
    });

    res.json({
      ok: true,
      analysis: {
        name:                  result.name,
        mealType:              result.mealType,
        items:                 result.items ?? [],
        caloriesKcal:          result.caloriesKcal ?? null,
        proteinG:              result.proteinG ?? null,
        fatG:                  result.fatG ?? null,
        carbsG:                result.carbsG ?? null,
        fiberG:                result.fiberG ?? null,
        weightG:               result.weightG ?? null,
        confidence:            result.confidence ?? 'low',
        needsClarification:    result.needsClarification ?? false,
        clarificationQuestion: result.clarificationQuestion ?? null,
      },
    });
  } catch (err) {
    console.error('[web/nutrition/analyze-text] failed', err);
    res.status(500).json({ ok: false, error: 'analysis_failed' });
  }
});

// POST /api/web/nutrition/add-ai-analysis
router.post('/add-ai-analysis', async (req: WebAuthRequest, res) => {
  const { userId, chatId } = req.webUser!;
  const syntheticChatId = chatId ?? `web_${userId}`;
  const body = req.body as Record<string, unknown>;

  const rawAnalysis = typeof body.analysis === 'object' && body.analysis !== null
    ? body.analysis as Record<string, unknown>
    : null;
  if (!rawAnalysis) {
    res.status(400).json({ ok: false, error: 'analysis_required' });
    return;
  }

  const name = typeof rawAnalysis.name === 'string' ? rawAnalysis.name.trim() : '';
  if (!name || name.length > 500) {
    res.status(400).json({ ok: false, error: 'invalid_name' });
    return;
  }

  const rawMealType = typeof rawAnalysis.mealType === 'string' ? rawAnalysis.mealType : '';
  const mealType = rawMealType === 'unknown' ? 'other'
    : VALID_MEAL_TYPES.has(rawMealType) ? rawMealType
    : 'other';

  const toFloat = (v: unknown): number | null => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null;
  };

  const caloriesKcal = rawAnalysis.caloriesKcal != null ? (() => {
    const n = Number(rawAnalysis.caloriesKcal);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  })() : null;
  const proteinG = toFloat(rawAnalysis.proteinG);
  const fatG     = toFloat(rawAnalysis.fatG);
  const carbsG   = toFloat(rawAnalysis.carbsG);
  const fiberG   = toFloat(rawAnalysis.fiberG);

  if (rawAnalysis.needsClarification === true && caloriesKcal === null) {
    res.status(422).json({ ok: false, error: 'needs_clarification' });
    return;
  }

  const dateRaw = typeof body.date === 'string' ? body.date : '';
  let createdAt: Date | undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    const d = new Date(`${dateRaw}T12:00:00.000Z`);
    if (!isNaN(d.getTime())) createdAt = d;
  }

  const VALID_SOURCE_TYPES = new Set(['web_ai_text', 'web_ai_photo']);
  const rawSourceType = typeof body.sourceType === 'string' ? body.sourceType : '';
  const sourceType = VALID_SOURCE_TYPES.has(rawSourceType) ? rawSourceType : 'web_ai_text';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {
    chatId: syntheticChatId,
    userId,
    text:         name.slice(0, 1000),
    mealType,
    sourceType,
    caloriesKcal,
    proteinG,
    fatG,
    carbsG,
    fiberG,
    ...(createdAt ? { createdAt } : {}),
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
    console.error('[web/nutrition/add-ai-analysis POST] failed', err);
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
