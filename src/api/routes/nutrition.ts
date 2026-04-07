import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';
import { analyzeFood, analyzeFoodPhoto, NotFoodError } from '../../ai/analyzeFood';
import { generateNutritionInsight, generateWeeklyInsight, InsightInput, WeeklyInsightInput } from '../../ai/nutritionInsight';

const router = Router();

// GET /api/nutrition/today — today's meals and totals
router.get('/today', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const meals = await prisma.mealEntry.findMany({
      where: { chatId, createdAt: { gte: start, lte: end } },
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
    res.json({ meals, totals: { calories: Math.round(totalCal), protein: totalProt, fat: totalFat, carbs: totalCarbs, fiber: totalFiber }, counts });
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
      where: { chatId, createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ date: date.toISOString().split('T')[0], meals });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/nutrition/meals/:id/media — fetch Telegram file URL for a meal
router.get('/meals/:id/media', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  try {
    const meal = await prisma.mealEntry.findFirst({
      where: { id, chatId },
      select: { sourceType: true, photoFileId: true, voiceFileId: true, photoData: true },
    });
    if (!meal) { res.status(404).json({ error: 'Not found' }); return; }

    // Mini-app photo: stored as base64 data URL in photoData
    if (meal.sourceType === 'photo' && meal.photoData) {
      res.json({ url: meal.photoData, type: 'photo' }); return;
    }

    // Bot photo/voice: stored as Telegram file ID
    const fileId = meal.sourceType === 'photo' ? meal.photoFileId
                 : meal.sourceType === 'voice' ? meal.voiceFileId
                 : null;
    if (!fileId) { res.status(404).json({ error: 'No media source' }); return; }
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) { res.status(500).json({ error: 'Bot not configured' }); return; }
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const tgData = await tgRes.json() as { ok: boolean; result?: { file_path: string } };
    if (!tgData.ok || !tgData.result?.file_path) {
      res.status(404).json({ error: 'File not available' }); return;
    }
    res.json({ url: `https://api.telegram.org/file/bot${botToken}/${tgData.result.file_path}`, type: meal.sourceType });
  } catch (err) {
    console.error('[nutrition/meals/:id/media]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/nutrition/analyze — analyze meal text via AI
router.post('/analyze', async (req: AuthRequest, res: Response) => {
  const { text } = req.body as { text?: string };
  if (!text?.trim()) { res.status(400).json({ error: 'Missing text' }); return; }
  try {
    const result = await analyzeFood(text.trim());
    res.json(result);
  } catch (err) {
    console.error('[nutrition/analyze]', err);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// POST /api/nutrition/analyze-photo — analyze meal photo (base64 data URL) via AI
router.post('/analyze-photo', async (req: AuthRequest, res: Response) => {
  const { imageData } = req.body as { imageData?: string };
  if (!imageData) { res.status(400).json({ error: 'Missing imageData' }); return; }
  try {
    const result = await analyzeFoodPhoto(imageData);
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
  try {
    const meal = await prisma.mealEntry.create({
      data: {
        chatId,
        text: text.trim(),
        mealType: mealType ?? 'unknown',
        sourceType: sourceType ?? 'text',
        photoData: (sourceType === 'photo' && imageData) ? imageData : null,
        caloriesKcal: caloriesKcal ?? null,
        proteinG: proteinG ?? null,
        fatG: fatG ?? null,
        carbsG: carbsG ?? null,
        fiberG: fiberG ?? null,
      },
    });
    res.json({ ok: true, meal });
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

// GET /api/nutrition/insight?date=YYYY-MM-DD
router.get('/insight', async (req: AuthRequest, res: Response) => {
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
        where: { chatId, createdAt: { gte: start, lte: end } },
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

    const insight = await generateNutritionInsight(input);

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

// GET /api/nutrition/insight/week?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/insight/week', async (req: AuthRequest, res: Response) => {
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
        where: { chatId, createdAt: { gte: start, lte: end } },
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

    const insight = await generateWeeklyInsight(input);

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
      where: { chatId, createdAt: { gte: since, lte: until } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ days: 7, meals });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
