import { Router } from 'express';
import { requireWebAuth, WebAuthRequest } from '../middleware/webAuth';
import prisma from '../../db';
import { analyzeFood, analyzeFoodPhoto } from '../../ai/analyzeFood';
import { generateWeeklyInsight, type WeeklyInsightInput } from '../../ai/nutritionInsight';
import { getSubscriptionState } from '../../services/subscriptionService';
import { validateImageDataUrl, PHOTO_MAX_BYTES } from '../utils/validateImage';
import { webAiTextRateLimit, webAiPhotoRateLimit, webAiInsightRateLimit } from '../middleware/rateLimit';

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

// POST /api/web/nutrition/day/copy
router.post('/day/copy', async (req: WebAuthRequest, res) => {
  const { userId, chatId } = req.webUser!;
  const syntheticChatId = chatId ?? `web_${userId}`;
  const body = req.body as Record<string, unknown>;

  const fromDateRaw = typeof body.fromDate === 'string' ? body.fromDate : '';
  const toDateRaw   = typeof body.toDate   === 'string' ? body.toDate   : '';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDateRaw) || !/^\d{4}-\d{2}-\d{2}$/.test(toDateRaw)) {
    res.status(400).json({ ok: false, error: 'invalid_date' });
    return;
  }
  if (fromDateRaw === toDateRaw) {
    res.status(400).json({ ok: false, error: 'same_date' });
    return;
  }

  const fromStart = new Date(`${fromDateRaw}T00:00:00.000Z`);
  const fromEnd   = new Date(`${fromDateRaw}T23:59:59.999Z`);
  const toDate    = new Date(`${toDateRaw}T00:00:00.000Z`);
  if (isNaN(fromStart.getTime()) || isNaN(toDate.getTime())) {
    res.status(400).json({ ok: false, error: 'invalid_date' });
    return;
  }

  try {
    const chatIds = await collectChatIds(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { ...ownerFilter(userId, chatIds), createdAt: { gte: fromStart, lte: fromEnd } };

    const sources = await prisma.mealEntry.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        text: true, mealType: true,
        caloriesKcal: true, proteinG: true, fatG: true, carbsG: true, fiberG: true,
        createdAt: true,
      },
    }) as Array<{
      text: string; mealType: string;
      caloriesKcal: number | null; proteinG: number | null; fatG: number | null;
      carbsG: number | null; fiberG: number | null; createdAt: Date;
    }>;

    if (sources.length === 0) {
      res.status(404).json({ ok: false, error: 'source_day_empty' });
      return;
    }

    // Preserve time-of-day from source entries, shift the date to toDate.
    const copies = sources.map(s => {
      const src = s.createdAt as Date;
      const shifted = new Date(Date.UTC(
        toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate(),
        src.getUTCHours(), src.getUTCMinutes(), src.getUTCSeconds(),
      ));
      return {
        chatId:       syntheticChatId,
        userId,
        text:         s.text,
        mealType:     s.mealType,
        sourceType:   'web_day_copy',
        caloriesKcal: s.caloriesKcal,
        proteinG:     s.proteinG,
        fatG:         s.fatG,
        carbsG:       s.carbsG,
        fiberG:       s.fiberG,
        createdAt:    shifted,
      };
    });

    await prisma.mealEntry.createMany({ data: copies });

    res.json({ ok: true, copied: copies.length });
  } catch (err) {
    console.error('[web/nutrition/day/copy POST] failed', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

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
router.post('/analyze-photo', webAiPhotoRateLimit as import('express').RequestHandler, async (req: WebAuthRequest, res) => {
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
router.post('/analyze-text', webAiTextRateLimit as import('express').RequestHandler, async (req: WebAuthRequest, res) => {
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

// POST /api/web/nutrition/insight/week
router.post('/insight/week', webAiInsightRateLimit as import('express').RequestHandler, async (req: WebAuthRequest, res) => {
  const { userId, chatId } = req.webUser!;

  // ── Subscription check ────────────────────────────────────────────────────
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
    // Fail-open on DB errors (same policy as analyze-photo)
  }

  // ── Parse endDate from body ───────────────────────────────────────────────
  const body = req.body as Record<string, unknown>;
  const rawEnd = typeof body.endDate === 'string' ? body.endDate : '';
  let endDateStr: string;
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawEnd)) {
    const d = new Date(`${rawEnd}T00:00:00.000Z`);
    if (isNaN(d.getTime())) {
      res.status(400).json({ ok: false, error: 'invalid_date' });
      return;
    }
    endDateStr = rawEnd;
  } else {
    endDateStr = new Date().toISOString().slice(0, 10);
  }

  const startDateStr = (() => {
    const d = new Date(`${endDateStr}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 6);
    return d.toISOString().slice(0, 10);
  })();
  const rangeStart = new Date(`${startDateStr}T00:00:00.000Z`);
  const rangeEnd   = new Date(`${endDateStr}T23:59:59.999Z`);

  try {
    const chatIds = await collectChatIds(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { ...ownerFilter(userId, chatIds), createdAt: { gte: rangeStart, lte: rangeEnd } };

    const meals = await prisma.mealEntry.findMany({
      where,
      select: { caloriesKcal: true, proteinG: true, fatG: true, carbsG: true, createdAt: true },
    }) as Array<{ caloriesKcal: number | null; proteinG: number | null; fatG: number | null; carbsG: number | null; createdAt: Date }>;

    // Group into 7-day buckets
    type DayAcc = { kcal: number; protein: number; fat: number; carbs: number; count: number };
    const dayMap = new Map<string, DayAcc>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(`${startDateStr}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() + i);
      dayMap.set(d.toISOString().slice(0, 10), { kcal: 0, protein: 0, fat: 0, carbs: 0, count: 0 });
    }
    for (const m of meals) {
      const key = (m.createdAt as Date).toISOString().slice(0, 10);
      const acc = dayMap.get(key);
      if (!acc) continue;
      acc.kcal    += m.caloriesKcal ?? 0;
      acc.protein += m.proteinG    ?? 0;
      acc.fat     += m.fatG        ?? 0;
      acc.carbs   += m.carbsG      ?? 0;
      acc.count++;
    }

    const profile = await prisma.userProfile.findFirst({
      where: { userId },
      select: {
        dailyCaloriesKcal: true, dailyProteinG: true, dailyFatG: true, dailyCarbsG: true,
        currentWeightKg: true, desiredWeightKg: true,
      },
    });

    let totalCal = 0, totalProt = 0, totalFat = 0, totalCarbs = 0, activeDays = 0;
    const days: WeeklyInsightInput['days'] = [];
    for (const [date, acc] of dayMap) {
      days.push({ date, kcal: acc.kcal, protein: acc.protein, fat: acc.fat, carbs: acc.carbs, mealCount: acc.count });
      if (acc.count > 0) {
        activeDays++;
        totalCal   += acc.kcal;
        totalProt  += acc.protein;
        totalFat   += acc.fat;
        totalCarbs += acc.carbs;
      }
    }
    days.sort((a, b) => a.date.localeCompare(b.date));

    const insightInput: WeeklyInsightInput = {
      currentWeight:  profile?.currentWeightKg  ?? null,
      targetWeight:   profile?.desiredWeightKg  ?? null,
      normCal:        profile?.dailyCaloriesKcal ?? null,
      normProtein:    profile?.dailyProteinG     ?? null,
      normFat:        profile?.dailyFatG         ?? null,
      normCarbs:      profile?.dailyCarbsG       ?? null,
      weekFrom:       startDateStr,
      weekTo:         endDateStr,
      activeDays,
      totalDays:      7,
      totalCal,
      avgCal:     activeDays > 0 ? totalCal   / activeDays : 0,
      avgProtein: activeDays > 0 ? totalProt  / activeDays : 0,
      avgFat:     activeDays > 0 ? totalFat   / activeDays : 0,
      avgCarbs:   activeDays > 0 ? totalCarbs / activeDays : 0,
      days,
    };

    const result = await generateWeeklyInsight(insightInput, {
      userId,
      chatId: chatId ?? `web_${userId}`,
      scenario: 'nutrition_insight_weekly',
    });

    res.json({
      ok: true,
      insight: {
        bannerTitle:        result.bannerTitle,
        bannerText:         result.bannerText,
        severity:           result.severity,
        nextMealSuggestion: result.nextMealSuggestion,
        mealAdvice:         result.mealAdvice,
      },
    });
  } catch (err) {
    console.error('[web/nutrition/insight/week] failed', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// GET /api/web/nutrition/stats/week?endDate=YYYY-MM-DD
router.get('/stats/week', async (req: WebAuthRequest, res) => {
  const { userId } = req.webUser!;

  const rawEnd = typeof req.query.endDate === 'string' ? req.query.endDate : '';
  let endDateStr: string;
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawEnd)) {
    const d = new Date(`${rawEnd}T00:00:00.000Z`);
    if (isNaN(d.getTime())) {
      res.status(400).json({ ok: false, error: 'invalid_date' });
      return;
    }
    endDateStr = rawEnd;
  } else {
    endDateStr = new Date().toISOString().slice(0, 10);
  }

  const startDateStr = (() => {
    const d = new Date(`${endDateStr}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 6);
    return d.toISOString().slice(0, 10);
  })();

  const rangeStart = new Date(`${startDateStr}T00:00:00.000Z`);
  const rangeEnd   = new Date(`${endDateStr}T23:59:59.999Z`);

  try {
    const chatIds = await collectChatIds(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { ...ownerFilter(userId, chatIds), createdAt: { gte: rangeStart, lte: rangeEnd } };

    const meals = await prisma.mealEntry.findMany({
      where,
      select: { caloriesKcal: true, proteinG: true, fatG: true, carbsG: true, createdAt: true },
    }) as Array<{ caloriesKcal: number | null; proteinG: number | null; fatG: number | null; carbsG: number | null; createdAt: Date }>;

    // Build a map for all 7 days initialised to zero
    type DayAccum = { cal: number; prot: number; fat: number; carbs: number; count: number };
    const dayMap = new Map<string, DayAccum>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(`${startDateStr}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() + i);
      dayMap.set(d.toISOString().slice(0, 10), { cal: 0, prot: 0, fat: 0, carbs: 0, count: 0 });
    }

    for (const m of meals) {
      const key = (m.createdAt as Date).toISOString().slice(0, 10);
      const acc = dayMap.get(key);
      if (!acc) continue;
      acc.cal   += m.caloriesKcal ?? 0;
      acc.prot  += m.proteinG    ?? 0;
      acc.fat   += m.fatG        ?? 0;
      acc.carbs += m.carbsG      ?? 0;
      acc.count++;
    }

    const profile = await prisma.userProfile.findFirst({
      where: { userId },
      select: { dailyCaloriesKcal: true, dailyProteinG: true, dailyFatG: true, dailyCarbsG: true },
    });
    const target = profile ? {
      dailyCaloriesKcal: profile.dailyCaloriesKcal,
      dailyProteinG:     profile.dailyProteinG,
      dailyFatG:         profile.dailyFatG,
      dailyCarbsG:       profile.dailyCarbsG,
    } : null;

    const calTarget = target?.dailyCaloriesKcal;
    type CalStatus = 'no_data' | 'no_target' | 'under' | 'ok' | 'over';
    function calStatus(cal: number, count: number): CalStatus {
      if (count === 0) return 'no_data';
      if (!calTarget) return 'no_target';
      const r = cal / calTarget;
      if (r < 0.9) return 'under';
      if (r > 1.1) return 'over';
      return 'ok';
    }

    const days = [];
    let sumCal = 0, sumProt = 0, sumFat = 0, sumCarbs = 0;
    let daysWithData = 0, daysUnder = 0, daysOk = 0, daysOver = 0;

    for (const [date, acc] of dayMap) {
      const status = calStatus(acc.cal, acc.count);
      days.push({
        date,
        totals: {
          caloriesKcal: Math.round(acc.cal),
          proteinG:     Math.round(acc.prot  * 10) / 10,
          fatG:         Math.round(acc.fat   * 10) / 10,
          carbsG:       Math.round(acc.carbs * 10) / 10,
        },
        mealCount:     acc.count,
        calorieStatus: status,
      });
      if (acc.count > 0) {
        daysWithData++;
        sumCal   += acc.cal;
        sumProt  += acc.prot;
        sumFat   += acc.fat;
        sumCarbs += acc.carbs;
      }
      if (status === 'under') daysUnder++;
      else if (status === 'ok') daysOk++;
      else if (status === 'over') daysOver++;
    }

    days.sort((a, b) => a.date.localeCompare(b.date));

    const averages = daysWithData > 0 ? {
      caloriesKcal: Math.round(sumCal   / daysWithData),
      proteinG:     Math.round(sumProt  / daysWithData * 10) / 10,
      fatG:         Math.round(sumFat   / daysWithData * 10) / 10,
      carbsG:       Math.round(sumCarbs / daysWithData * 10) / 10,
    } : { caloriesKcal: 0, proteinG: 0, fatG: 0, carbsG: 0 };

    res.json({
      ok: true,
      period: { startDate: startDateStr, endDate: endDateStr },
      target,
      days,
      averages,
      summary: { daysWithData, daysUnderTarget: daysUnder, daysOk, daysOverTarget: daysOver },
    });
  } catch (err) {
    console.error('[web/nutrition/stats/week] failed', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// PATCH /api/web/nutrition/meals/:id
router.patch('/meals/:id', async (req: WebAuthRequest, res) => {
  const { userId } = req.webUser!;

  const mealId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(mealId) || mealId <= 0) {
    res.status(400).json({ ok: false, error: 'invalid_id' });
    return;
  }

  const body = req.body as Record<string, unknown>;

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 120) {
    res.status(400).json({ ok: false, error: 'invalid_name' });
    return;
  }

  const mealType = typeof body.mealType === 'string' ? body.mealType : '';
  if (!VALID_MEAL_TYPES.has(mealType)) {
    res.status(400).json({ ok: false, error: 'invalid_meal_type' });
    return;
  }

  function parseOptionalFloat(v: unknown, min: number, max: number): { ok: true; val: number | null } | { ok: false } {
    if (v === undefined || v === null || v === '') return { ok: true, val: null };
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) return { ok: false };
    return { ok: true, val: Math.round(n * 10) / 10 };
  }

  const calRaw = body.caloriesKcal;
  let caloriesKcal: number | null = null;
  if (calRaw !== undefined && calRaw !== null && calRaw !== '') {
    const n = Number(calRaw);
    if (!Number.isFinite(n) || n < 0 || n > 10000) {
      res.status(400).json({ ok: false, error: 'invalid_caloriesKcal' });
      return;
    }
    caloriesKcal = Math.round(n);
  }

  const protRes  = parseOptionalFloat(body.proteinG, 0, 1000);
  const fatRes   = parseOptionalFloat(body.fatG,     0, 1000);
  const carbsRes = parseOptionalFloat(body.carbsG,   0, 1000);

  if (!protRes.ok)  { res.status(400).json({ ok: false, error: 'invalid_proteinG'  }); return; }
  if (!fatRes.ok)   { res.status(400).json({ ok: false, error: 'invalid_fatG'      }); return; }
  if (!carbsRes.ok) { res.status(400).json({ ok: false, error: 'invalid_carbsG'    }); return; }

  try {
    const chatIds = await collectChatIds(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { id: mealId, ...ownerFilter(userId, chatIds) };

    const existing = await prisma.mealEntry.findFirst({
      where,
      select: { id: true },
    }) as { id: number } | null;

    if (!existing) {
      res.status(404).json({ ok: false, error: 'not_found' });
      return;
    }

    const meal = await prisma.mealEntry.update({
      where: { id: mealId },
      data: {
        text:         name.slice(0, 1000),
        mealType,
        caloriesKcal,
        proteinG:     protRes.val,
        fatG:         fatRes.val,
        carbsG:       carbsRes.val,
      },
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
    console.error('[web/nutrition/meals PATCH] failed', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// POST /api/web/nutrition/meals/:id/copy
router.post('/meals/:id/copy', async (req: WebAuthRequest, res) => {
  const { userId, chatId } = req.webUser!;
  const syntheticChatId = chatId ?? `web_${userId}`;

  const mealId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(mealId) || mealId <= 0) {
    res.status(400).json({ ok: false, error: 'invalid_id' });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const dateRaw = typeof body.date === 'string' ? body.date : '';
  let createdAt: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    const d = new Date(`${dateRaw}T12:00:00.000Z`);
    if (isNaN(d.getTime())) {
      res.status(400).json({ ok: false, error: 'invalid_date' });
      return;
    }
    createdAt = d;
  } else {
    const now = new Date();
    createdAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
  }

  try {
    const chatIds = await collectChatIds(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { id: mealId, ...ownerFilter(userId, chatIds) };

    const source = await prisma.mealEntry.findFirst({
      where,
      select: {
        text: true, mealType: true,
        caloriesKcal: true, proteinG: true, fatG: true, carbsG: true, fiberG: true,
      },
    }) as {
      text: string; mealType: string;
      caloriesKcal: number | null; proteinG: number | null; fatG: number | null;
      carbsG: number | null; fiberG: number | null;
    } | null;

    if (!source) {
      res.status(404).json({ ok: false, error: 'not_found' });
      return;
    }

    const meal = await prisma.mealEntry.create({
      data: {
        chatId:       syntheticChatId,
        userId,
        text:         source.text,
        mealType:     source.mealType,
        sourceType:   'web_copy',
        caloriesKcal: source.caloriesKcal,
        proteinG:     source.proteinG,
        fatG:         source.fatG,
        carbsG:       source.carbsG,
        fiberG:       source.fiberG,
        createdAt,
      },
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
    console.error('[web/nutrition/meals/:id/copy POST] failed', err);
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
