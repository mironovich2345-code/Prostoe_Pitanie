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

/** GET /api/ratings/my — client sees ratings from their trainer */
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
    res.json({ ratings });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
