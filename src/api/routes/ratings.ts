import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

const router = Router();

const MEAL_RATINGS = ['good', 'ok', 'improve'] as const;
const DAY_RATINGS = ['excellent', 'good', 'improve'] as const;

/** POST /api/ratings/meal/:mealId — trainer rates a specific meal */
router.post('/meal/:mealId', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const mealId = req.params['mealId'] as string;
  const { rating } = req.body as { rating?: string };

  if (!rating || !(MEAL_RATINGS as readonly string[]).includes(rating)) {
    res.status(400).json({ error: `rating must be one of: ${MEAL_RATINGS.join(', ')}` }); return;
  }
  try {
    // Verify meal exists and belongs to a client connected to this trainer
    const meal = await prisma.mealEntry.findUnique({ where: { id: parseInt(mealId) }, select: { chatId: true } });
    if (!meal) { res.status(404).json({ error: 'Meal not found' }); return; }

    const link = await prisma.trainerClientLink.findFirst({
      where: { trainerId: chatId, clientId: meal.chatId, status: { in: ['active', 'frozen'] } },
    });
    if (!link) { res.status(403).json({ error: 'No active link with this client' }); return; }

    const result = await prisma.trainerRating.upsert({
      where: { trainerId_clientId_targetType_targetId: { trainerId: chatId, clientId: meal.chatId, targetType: 'meal', targetId: mealId } },
      update: { rating },
      create: { trainerId: chatId, clientId: meal.chatId, targetType: 'meal', targetId: mealId, rating },
    });
    res.json({ rating: result });
  } catch (err) {
    console.error('[ratings/meal]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/ratings/day/:date — trainer rates a day (date: YYYY-MM-DD) */
router.post('/day/:date', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const date = req.params['date'] as string;
  const { clientId, rating } = req.body as { clientId?: string; rating?: string };

  if (!clientId) { res.status(400).json({ error: 'clientId required' }); return; }
  if (!rating || !(DAY_RATINGS as readonly string[]).includes(rating)) {
    res.status(400).json({ error: `rating must be one of: ${DAY_RATINGS.join(', ')}` }); return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { res.status(400).json({ error: 'date must be YYYY-MM-DD' }); return; }

  try {
    const link = await prisma.trainerClientLink.findFirst({
      where: { trainerId: chatId, clientId, status: { in: ['active', 'frozen'] } },
    });
    if (!link) { res.status(403).json({ error: 'No active link with this client' }); return; }

    const result = await prisma.trainerRating.upsert({
      where: { trainerId_clientId_targetType_targetId: { trainerId: chatId, clientId, targetType: 'day', targetId: date } },
      update: { rating },
      create: { trainerId: chatId, clientId, targetType: 'day', targetId: date, rating },
    });
    res.json({ rating: result });
  } catch (err) {
    console.error('[ratings/day]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/ratings/for-client/:clientId — trainer gets ratings they gave to a client */
router.get('/for-client/:clientId', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const clientId = req.params['clientId'] as string;
  try {
    const link = await prisma.trainerClientLink.findFirst({
      where: { trainerId: chatId, clientId, status: { in: ['active', 'frozen'] } },
    });
    if (!link) { res.status(403).json({ error: 'No active link' }); return; }

    const ratings = await prisma.trainerRating.findMany({
      where: { trainerId: chatId, clientId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ ratings });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/ratings/my — client sees ratings from their trainer (enriched with meal info) */
router.get('/my', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const link = await prisma.trainerClientLink.findFirst({
      where: { clientId: chatId, status: 'active' },
      select: { trainerId: true },
    });
    if (!link) { res.json({ ratings: [] }); return; }

    const ratings = await prisma.trainerRating.findMany({
      where: { trainerId: link.trainerId, clientId: chatId },
      orderBy: { createdAt: 'desc' },
    });

    // Batch-fetch meal info for meal-type ratings
    const mealIds = ratings
      .filter(r => r.targetType === 'meal')
      .map(r => parseInt(r.targetId, 10))
      .filter(id => !isNaN(id));

    const meals = mealIds.length > 0
      ? await prisma.mealEntry.findMany({
          where: { id: { in: mealIds } },
          select: { id: true, mealType: true, createdAt: true },
        })
      : [];

    const mealMap = new Map(meals.map(m => [m.id, m]));

    const enriched = ratings.map(r => {
      if (r.targetType === 'meal') {
        const meal = mealMap.get(parseInt(r.targetId, 10));
        return { ...r, mealType: meal?.mealType ?? null, mealCreatedAt: meal?.createdAt.toISOString() ?? null };
      }
      return { ...r, mealType: null as null, mealCreatedAt: null as null };
    });

    res.json({ ratings: enriched });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
