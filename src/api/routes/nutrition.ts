import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import { requirePremiumAccess } from '../middleware/requirePremiumAccess';
import prisma from '../../db';
import { analyzeFood, analyzeFoodPhoto, NotFoodError } from '../../ai/analyzeFood';
import { generateNutritionInsight, generateWeeklyInsight, InsightInput, WeeklyInsightInput } from '../../ai/nutritionInsight';
import { validateImageDataUrl, PHOTO_MAX_BYTES } from '../utils/validateImage';

const router = Router();

/** Strip photoData from bulk meal responses — photos are served via /media endpoint */
function omitPhotoData<T extends { photoData?: unknown }>(meal: T): Omit<T, 'photoData'> {
  const { photoData: _dropped, ...rest } = meal;
  return rest;
}

/**
 * Build a Prisma where-filter for MealEntry reads.
 *
 * userId present → read records where userId matches (new/backfilled) OR where
 *   chatId matches and userId is still null (legacy records not yet backfilled).
 *   After full backfill the second branch never fires.
 * userId absent (legacy/dev path) → read by chatId only.
 *
 * Cast to `any` because userId is absent from the stale Prisma client;
 * remove the cast after `prisma generate` runs on the server.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mealFilter(chatId: string, userId?: string): any {
  if (userId) return { OR: [{ userId }, { chatId, userId: null }] };
  return { chatId };
}

/**
 * Ownership filter for a single meal record (DELETE / media endpoints).
 * Prevents accessing another user's record even if their chatId is known.
 * userId present → match by id + (userId OR chatId+userId=null).
 * Fallback to id+chatId when userId is unavailable (legacy/dev path).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ownerFilter(id: number, chatId: string, userId?: string): any {
  if (userId) return { id, OR: [{ userId }, { chatId, userId: null }] };
  return { id, chatId };
}

// GET /api/nutrition/today — today's meals and totals
router.get('/today', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const meals = await prisma.mealEntry.findMany({
      where: { ...mealFilter(chatId, req.userId), createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: 'asc' },
    });
    let totalCal = 0, totalProt = 0, totalFat = 0, totalCarbs = 0, totalFiber = 0;
    const counts: Record<string, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
    for (const m of meals) {
      totalCal += m.caloriesKcal ?? 0;
      totalProt += m.proteinG ?? 0;
      totalFat += m.fatG ?? 0;
      totalCarbs += m.carbsG ?? 0;
      totalFiber += m.fiberG ?? 0;
      if (m.mealType in counts) counts[m.mealType]++;
    }
    res.json({ meals: meals.map(omitPhotoData), totals: { calories: Math.round(totalCal), protein: totalProt, fat: totalFat, carbs: totalCarbs, fiber: totalFiber }, counts });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/nutrition/diary?date=YYYY-MM-DD
router.get('/diary', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const dateStr = req.query.date as string;
  try {
    const date = dateStr ? new Date(dateStr) : new Date();
    const start = new Date(date); start.setHours(0,0,0,0);
    const end = new Date(date); end.setHours(23,59,59,999);
    const meals = await prisma.mealEntry.findMany({
      where: { ...mealFilter(chatId, req.userId), createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ date: date.toISOString().split('T')[0], meals: meals.map(omitPhotoData) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/nutrition/meals/:id — delete a meal entry (owner only)
router.delete('/meals/:id', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  try {
    const meal = await prisma.mealEntry.findFirst({ where: ownerFilter(id, chatId, req.userId) });
    if (!meal) { res.status(404).json({ error: 'Not found' }); return; }
    await prisma.mealEntry.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[nutrition/meals/:id DELETE]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/nutrition/meals/:id/media — returns media info for a meal
router.get('/meals/:id/media', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  try {
    const meal = await prisma.mealEntry.findFirst({
      where: ownerFilter(id, chatId, req.userId),
      select: { sourceType: true, photoFileId: true, voiceFileId: true, photoData: true },
    });
    if (!meal) { res.status(404).json({ error: 'Not found' }); return; }

    // Mini-app photo: stored as base64 data URL — return directly
    if (meal.sourceType === 'photo' && meal.photoData) {
      res.json({ url: meal.photoData, type: 'photo' }); return;
    }

    // Bot photo/voice: redirect to stream endpoint (never expose bot token to client)
    const hasTelegramFile = meal.sourceType === 'photo' ? !!meal.photoFileId
                          : meal.sourceType === 'voice' ? !!meal.voiceFileId
                          : false;
    if (!hasTelegramFile) { res.status(404).json({ error: 'No media source' }); return; }

    res.json({ url: `/api/nutrition/meals/${id}/media/stream`, type: meal.sourceType });
  } catch (err) {
    console.error('[nutrition/meals/:id/media]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/nutrition/meals/:id/media/stream — proxy-stream Telegram file server-side
router.get('/meals/:id/media/stream', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  try {
    const meal = await prisma.mealEntry.findFirst({
      where: ownerFilter(id, chatId, req.userId),
      select: { sourceType: true, photoFileId: true, voiceFileId: true },
    });
    if (!meal) { res.status(404).json({ error: 'Not found' }); return; }

    const fileId = meal.sourceType === 'photo' ? meal.photoFileId
                 : meal.sourceType === 'voice' ? meal.voiceFileId
                 : null;
    if (!fileId) { res.status(404).json({ error: 'No media source' }); return; }

    const botToken = process.env.BOT_TOKEN;
    if (!botToken) { res.status(500).json({ error: 'Bot not configured' }); return; }

    // Resolve file_path server-side — bot token never leaves the server
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const tgData = await tgRes.json() as { ok: boolean; result?: { file_path: string } };
    if (!tgData.ok || !tgData.result?.file_path) {
      res.status(404).json({ error: 'File not available' }); return;
    }

    // Fetch the actual file server-side and stream to client
    const fileRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${tgData.result.file_path}`);
    if (!fileRes.ok || !fileRes.body) {
      res.status(502).json({ error: 'Upstream fetch failed' }); return;
    }

    const contentType = fileRes.headers.get('content-type') ?? 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, no-store');

    // Stream response body to client using Node.js readable stream
    const { Readable } = await import('stream');
    Readable.fromWeb(fileRes.body as import('stream/web').ReadableStream).pipe(res);
  } catch (err) {
    console.error('[nutrition/meals/:id/media/stream]', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/nutrition/analyze-ingredients — compute КБЖУ from explicit ingredient list [no premium required]
// User provides exact ingredients + grams, AI is used only for nutritional value lookup.
router.post('/analyze-ingredients', async (req: AuthRequest, res: Response) => {
  const { text } = req.body as { text?: string };
  if (!text?.trim()) { res.status(400).json({ error: 'Missing text' }); return; }
  try {
    const result = await analyzeFood(text.trim(), { userId: req.userId, chatId: req.chatId, scenario: 'food_ingredients' });
    res.json(result);
  } catch (err) {
    console.error('[nutrition/analyze-ingredients]', err);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// POST /api/nutrition/analyze — analyze meal text via AI [premium]
router.post('/analyze', requirePremiumAccess, async (req: AuthRequest, res: Response) => {
  const { text } = req.body as { text?: string };
  if (!text?.trim()) { res.status(400).json({ error: 'Missing text' }); return; }
  try {
    const result = await analyzeFood(text.trim(), { userId: req.userId, chatId: req.chatId, scenario: 'food_text' });
    res.json(result);
  } catch (err) {
    console.error('[nutrition/analyze]', err);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// POST /api/nutrition/analyze-photo — analyze meal photo (base64 data URL) via AI [premium]
router.post('/analyze-photo', requirePremiumAccess, async (req: AuthRequest, res: Response) => {
  const { imageData } = req.body as { imageData?: string };
  if (!imageData) { res.status(400).json({ error: 'Missing imageData' }); return; }
  if (!validateImageDataUrl(imageData, PHOTO_MAX_BYTES)) {
    res.status(400).json({ error: 'Invalid imageData' }); return;
  }
  try {
    const result = await analyzeFoodPhoto(imageData, { userId: req.userId, chatId: req.chatId, scenario: 'food_photo' });
    res.json(result);
  } catch (err) {
    if (err instanceof NotFoodError) {
      res.status(422).json({ error: 'NOT_FOOD' }); return;
    }
    console.error('[nutrition/analyze-photo]', err);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// POST /api/nutrition/add — save a meal entry created via mini app
router.post('/add', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { text, mealType, sourceType, caloriesKcal, proteinG, fatG, carbsG, fiberG, imageData } = req.body as {
    text?: string;
    mealType?: string;
    sourceType?: string;
    caloriesKcal?: number | null;
    proteinG?: number | null;
    fatG?: number | null;
    carbsG?: number | null;
    fiberG?: number | null;
    imageData?: string; // base64 data URL for photo entries from mini app
  };
  if (!text?.trim()) { res.status(400).json({ error: 'Missing text' }); return; }
  if (sourceType === 'photo' && imageData && !validateImageDataUrl(imageData, PHOTO_MAX_BYTES)) {
    res.status(400).json({ error: 'Invalid imageData' }); return;
  }
  try {
    const meal = await prisma.mealEntry.create({
      // userId is absent from stale Prisma client; cast removed after prisma generate
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        chatId,
        userId: req.userId ?? null,
        text: text.trim(),
        mealType: mealType ?? 'unknown',
        sourceType: sourceType ?? 'text',
        photoData: (sourceType === 'photo' && imageData) ? imageData : null,
        caloriesKcal: caloriesKcal ?? null,
        proteinG: proteinG ?? null,
        fatG: fatG ?? null,
        carbsG: carbsG ?? null,
        fiberG: fiberG ?? null,
      } as any,
    });
    res.json({ ok: true, meal: omitPhotoData(meal) });
  } catch (err) {
    console.error('[nutrition/add]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Insight cache helpers ────────────────────────────────────────────────────

/** Signature = "count_latestCreatedAtISO" — changes whenever meals are added or removed */
function mealSig(meals: { createdAt: Date }[]): string {
  if (meals.length === 0) return '0_';
  return `${meals.length}_${meals[meals.length - 1].createdAt.toISOString()}`;
}

// GET /api/nutrition/insight?date=YYYY-MM-DD [premium]
router.get('/insight', requirePremiumAccess, async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const dateStr = req.query.date as string | undefined;
  try {
    const now = new Date();
    const currentDate = dateStr ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const date = new Date(currentDate + 'T00:00:00');
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end   = new Date(date); end.setHours(23, 59, 59, 999);

    const [profile, meals] = await Promise.all([
      prisma.userProfile.findUnique({ where: { chatId } }),
      prisma.mealEntry.findMany({
        where: { ...mealFilter(chatId, req.userId), createdAt: { gte: start, lte: end } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Check cache
    const sig = mealSig(meals);
    const cached = await prisma.nutritionInsightCache.findUnique({
      where: { chatId_period_periodKey: { chatId, period: 'day', periodKey: currentDate } },
    });
    if (cached && cached.mealSignature === sig) {
      res.json(JSON.parse(cached.contentJson));
      return;
    }

    let consumedCal = 0, consumedProtein = 0, consumedFat = 0, consumedCarbs = 0, consumedFiber = 0;
    for (const m of meals) {
      consumedCal     += m.caloriesKcal ?? 0;
      consumedProtein += m.proteinG     ?? 0;
      consumedFat     += m.fatG         ?? 0;
      consumedCarbs   += m.carbsG       ?? 0;
      consumedFiber   += m.fiberG       ?? 0;
    }

    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const input: InsightInput = {
      currentWeight: profile?.currentWeightKg ?? null,
      targetWeight:  profile?.desiredWeightKg ?? null,
      normCal:       profile?.dailyCaloriesKcal ?? null,
      normProtein:   profile?.dailyProteinG     ?? null,
      normFat:       profile?.dailyFatG         ?? null,
      normCarbs:     profile?.dailyCarbsG       ?? null,
      normFiber:     profile?.dailyFiberG       ?? null,
      consumedCal:     Math.round(consumedCal),
      consumedProtein,
      consumedFat,
      consumedCarbs,
      consumedFiber,
      currentDate,
      currentTime,
      meals: meals.map(m => ({
        mealType:   m.mealType,
        title:      m.text,
        kcal:       m.caloriesKcal,
        protein:    m.proteinG,
        fat:        m.fatG,
        carbs:      m.carbsG,
        fiber:      m.fiberG,
        sourceType: m.sourceType,
      })),
    };

    const insight = await generateNutritionInsight(input, { userId: req.userId, chatId, scenario: 'nutrition_insight_daily' });

    // Store in cache
    await prisma.nutritionInsightCache.upsert({
      where: { chatId_period_periodKey: { chatId, period: 'day', periodKey: currentDate } },
      create: { chatId, period: 'day', periodKey: currentDate, mealSignature: sig, contentJson: JSON.stringify(insight) },
      update: { mealSignature: sig, contentJson: JSON.stringify(insight) },
    });

    res.json(insight);
  } catch (err) {
    console.error('[nutrition/insight]', err);
    res.status(500).json({ error: 'Insight generation failed' });
  }
});

// GET /api/nutrition/insight/week?from=YYYY-MM-DD&to=YYYY-MM-DD [premium]
router.get('/insight/week', requirePremiumAccess, async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const fromStr = req.query.from as string | undefined;
  const toStr   = req.query.to   as string | undefined;
  if (!fromStr || !toStr) {
    res.status(400).json({ error: 'Missing from/to' });
    return;
  }
  try {
    const start = new Date(fromStr + 'T00:00:00'); start.setHours(0, 0, 0, 0);
    const end   = new Date(toStr   + 'T00:00:00'); end.setHours(23, 59, 59, 999);

    const [profile, meals] = await Promise.all([
      prisma.userProfile.findUnique({ where: { chatId } }),
      prisma.mealEntry.findMany({
        where: { ...mealFilter(chatId, req.userId), createdAt: { gte: start, lte: end } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Check cache
    const sig = mealSig(meals);
    const cached = await prisma.nutritionInsightCache.findUnique({
      where: { chatId_period_periodKey: { chatId, period: 'week', periodKey: fromStr } },
    });
    if (cached && cached.mealSignature === sig) {
      res.json(JSON.parse(cached.contentJson));
      return;
    }

    // Aggregate by day
    const byDate: Record<string, { kcal: number; protein: number; fat: number; carbs: number; count: number }> = {};
    for (const m of meals) {
      const d = m.createdAt.toISOString().split('T')[0];
      if (!byDate[d]) byDate[d] = { kcal: 0, protein: 0, fat: 0, carbs: 0, count: 0 };
      byDate[d].kcal    += m.caloriesKcal ?? 0;
      byDate[d].protein += m.proteinG     ?? 0;
      byDate[d].fat     += m.fatG         ?? 0;
      byDate[d].carbs   += m.carbsG       ?? 0;
      byDate[d].count   += 1;
    }

    // Build 7-day list
    const days: WeeklyInsightInput['days'] = [];
    const startDate = new Date(fromStr + 'T12:00:00');
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const s = byDate[iso];
      days.push({ date: iso, kcal: s?.kcal ?? 0, protein: s?.protein ?? 0, fat: s?.fat ?? 0, carbs: s?.carbs ?? 0, mealCount: s?.count ?? 0 });
    }

    const activeDays = days.filter(d => d.mealCount > 0).length;
    const totalCal     = days.reduce((s, d) => s + d.kcal, 0);
    const totalProtein = days.reduce((s, d) => s + d.protein, 0);
    const totalFat     = days.reduce((s, d) => s + d.fat, 0);
    const totalCarbs   = days.reduce((s, d) => s + d.carbs, 0);
    const div = activeDays || 1;

    const input: WeeklyInsightInput = {
      currentWeight: profile?.currentWeightKg ?? null,
      targetWeight:  profile?.desiredWeightKg ?? null,
      normCal:       profile?.dailyCaloriesKcal ?? null,
      normProtein:   profile?.dailyProteinG     ?? null,
      normFat:       profile?.dailyFatG         ?? null,
      normCarbs:     profile?.dailyCarbsG       ?? null,
      weekFrom: fromStr,
      weekTo:   toStr,
      activeDays,
      totalDays: 7,
      totalCal,
      avgCal:     totalCal     / div,
      avgProtein: totalProtein / div,
      avgFat:     totalFat     / div,
      avgCarbs:   totalCarbs   / div,
      days,
    };

    const insight = await generateWeeklyInsight(input, { userId: req.userId, chatId, scenario: 'nutrition_insight_weekly' });

    // Store in cache
    await prisma.nutritionInsightCache.upsert({
      where: { chatId_period_periodKey: { chatId, period: 'week', periodKey: fromStr } },
      create: { chatId, period: 'week', periodKey: fromStr, mealSignature: sig, contentJson: JSON.stringify(insight) },
      update: { mealSignature: sig, contentJson: JSON.stringify(insight) },
    });

    res.json(insight);
  } catch (err) {
    console.error('[nutrition/insight/week]', err);
    res.status(500).json({ error: 'Weekly insight generation failed' });
  }
});

// GET /api/nutrition/stats?days=7 (or ?from=YYYY-MM-DD&to=YYYY-MM-DD)
router.get('/stats', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const fromStr = req.query.from as string | undefined;
  const toStr = req.query.to as string | undefined;
  try {
    let since: Date;
    let until: Date;
    if (fromStr && toStr) {
      since = new Date(fromStr + 'T00:00:00');
      until = new Date(toStr + 'T23:59:59');
    } else {
      const days = parseInt(req.query.days as string) || 7;
      since = new Date(); since.setDate(since.getDate() - days); since.setHours(0,0,0,0);
      until = new Date(); until.setHours(23,59,59,999);
    }
    const meals = await prisma.mealEntry.findMany({
      where: { ...mealFilter(chatId, req.userId), createdAt: { gte: since, lte: until } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ days: 7, meals: meals.map(omitPhotoData) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Saved Meals ─────────────────────────────────────────────────────────────

/** Normalise a route/query param that Express types as string | string[]. */
function getSingleParam(value: string | string[]): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

type SavedMealRecord = { id: number; chatId: string; userId: string | null; title: string; totalWeightG: number | null; caloriesKcal: number | null; proteinG: number | null; fatG: number | null; carbsG: number | null; fiberG: number | null; mealType: string | null; notes: string | null; createdAt: Date; updatedAt: Date };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const savedMealDb = (prisma as any).savedMeal as {
  findMany(args: unknown): Promise<SavedMealRecord[]>;
  findFirst(args: unknown): Promise<SavedMealRecord | null>;
  create(args: unknown): Promise<SavedMealRecord>;
  update(args: unknown): Promise<SavedMealRecord>;
  delete(args: unknown): Promise<SavedMealRecord>;
};

function savedMealFilter(chatId: string, userId?: string): unknown {
  if (userId) return { OR: [{ userId }, { chatId, userId: null }] };
  return { chatId };
}
function savedMealOwnerFilter(id: number, chatId: string, userId?: string): unknown {
  if (userId) return { id, OR: [{ userId }, { chatId, userId: null }] };
  return { id, chatId };
}

// GET /api/nutrition/saved-meals
router.get('/saved-meals', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const meals = await savedMealDb.findMany({
      where: savedMealFilter(chatId, req.userId),
      orderBy: { createdAt: 'desc' },
    });
    res.json({ savedMeals: meals });
  } catch (err) {
    console.error('[nutrition/saved-meals GET]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/nutrition/saved-meals — create a saved meal template
router.post('/saved-meals', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { title, totalWeightG, caloriesKcal, proteinG, fatG, carbsG, fiberG, mealType, notes } = req.body as {
    title?: string;
    totalWeightG?: number | null;
    caloriesKcal?: number | null;
    proteinG?: number | null;
    fatG?: number | null;
    carbsG?: number | null;
    fiberG?: number | null;
    mealType?: string | null;
    notes?: string | null;
  };
  if (!title?.trim()) { res.status(400).json({ error: 'title required' }); return; }
  try {
    const meal = await savedMealDb.create({
      data: {
        chatId,
        userId: req.userId ?? null,
        title: title.trim(),
        totalWeightG: totalWeightG != null && totalWeightG > 0 ? totalWeightG : null,
        caloriesKcal: caloriesKcal ?? null,
        proteinG: proteinG ?? null,
        fatG: fatG ?? null,
        carbsG: carbsG ?? null,
        fiberG: fiberG ?? null,
        mealType: mealType ?? null,
        notes: notes ?? null,
      },
    });
    res.json({ savedMeal: meal });
  } catch (err) {
    console.error('[nutrition/saved-meals POST]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/nutrition/saved-meals/:id — rename a saved meal
router.patch('/saved-meals/:id', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const id = parseInt(getSingleParam(req.params.id) ?? '', 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  const { title } = req.body as { title?: string };
  const trimmedTitle = title?.trim();
  if (!trimmedTitle) { res.status(400).json({ error: 'title required' }); return; }
  try {
    const existing = await savedMealDb.findFirst({ where: savedMealOwnerFilter(id, chatId, req.userId) });
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
    const updated = await savedMealDb.update({ where: { id }, data: { title: trimmedTitle } });
    res.json({ savedMeal: updated });
  } catch (err) {
    console.error('[nutrition/saved-meals PATCH]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/nutrition/saved-meals/:id
router.delete('/saved-meals/:id', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const id = parseInt(getSingleParam(req.params.id) ?? '', 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  try {
    const existing = await savedMealDb.findFirst({ where: savedMealOwnerFilter(id, chatId, req.userId) });
    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
    await savedMealDb.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[nutrition/saved-meals DELETE]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/nutrition/saved-meals/:id/add — add saved meal to diary as a new MealEntry
// Body: { mealType?: string; portionGrams?: number }
// If portionGrams is provided and the saved meal has totalWeightG > 0, all macros
// are scaled proportionally (portionGrams / totalWeightG). Otherwise values are used as-is.
router.post('/saved-meals/:id/add', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const id = parseInt(getSingleParam(req.params.id) ?? '', 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  const { mealType, portionGrams } = req.body as { mealType?: string; portionGrams?: number };
  try {
    const saved = await savedMealDb.findFirst({ where: savedMealOwnerFilter(id, chatId, req.userId) });
    if (!saved) { res.status(404).json({ error: 'Saved meal not found' }); return; }

    // Portion scaling: only if portionGrams is a positive number and totalWeightG is set
    const portion = portionGrams != null ? Number(portionGrams) : NaN;
    const total   = saved.totalWeightG ?? 0;
    const ratio   = isFinite(portion) && portion > 0 && total > 0 ? portion / total : 1;

    function scale(v: number | null): number | null {
      if (v == null) return null;
      return Math.round(v * ratio * 10) / 10;
    }

    // Label the text with portion size so diary entries are informative
    const portionLabel = ratio !== 1 ? ` (${Math.round(portion)} г)` : '';

    const meal = await prisma.mealEntry.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        chatId,
        userId: req.userId ?? null,
        text: saved.title + portionLabel,
        mealType: mealType ?? saved.mealType ?? 'unknown',
        sourceType: 'saved',
        caloriesKcal: scale(saved.caloriesKcal),
        proteinG:     scale(saved.proteinG),
        fatG:         scale(saved.fatG),
        carbsG:       scale(saved.carbsG),
        fiberG:       scale(saved.fiberG),
      } as any,
    });
    res.json({ ok: true, meal: omitPhotoData(meal) });
  } catch (err) {
    console.error('[nutrition/saved-meals/:id/add]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
