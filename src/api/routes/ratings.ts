import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

const router = Router();

const MEAL_RATINGS = ['good', 'ok', 'improve'] as const;
const DAY_RATINGS = ['excellent', 'good', 'improve'] as const;

// ─── userId-aware link lookup ─────────────────────────────────────────────────
//
// All three write-endpoints verify the trainer-client link before acting.
// The lookups use userId-OR-chatId on BOTH sides so they work after TG↔MAX
// account linking regardless of which platform the trainer/client logged in from.
//
// Crucially: once a link is found, its canonical `trainerId` and `clientId`
// (the stable chatIds from link creation) are used for the TrainerRating
// upsert key, so the unique constraint remains stable across platforms.

/** Build the trainer-side WHERE clause for TrainerClientLink lookups. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function trainerLinkFilter(chatId: string, userId?: string | null): any {
  return userId
    ? { OR: [{ trainerId: chatId }, { trainerUserId: userId }] }
    : { trainerId: chatId };
}

/** Build the client-side WHERE clause for TrainerClientLink lookups. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clientLinkFilter(chatId: string, userId?: string | null): any {
  return userId
    ? { OR: [{ clientId: chatId }, { clientUserId: userId }] }
    : { clientId: chatId };
}

// ─── POST /api/ratings/meal/:mealId — trainer rates a specific meal ───────────

router.post('/meal/:mealId', async (req: AuthRequest, res: Response) => {
  const chatId  = req.chatId!;
  const userId  = req.userId ?? null;
  const mealId  = req.params['mealId'] as string;
  const { rating } = req.body as { rating?: string };

  if (!rating || !(MEAL_RATINGS as readonly string[]).includes(rating)) {
    res.status(400).json({ error: `rating must be one of: ${MEAL_RATINGS.join(', ')}` }); return;
  }
  try {
    // Fetch meal — also pull userId so the client-side filter can use it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meal = await (prisma.mealEntry.findUnique as (args: any) => Promise<{ chatId: string; userId: string | null } | null>)({
      where: { id: parseInt(mealId) },
      select: { chatId: true, userId: true },
    });
    if (!meal) { res.status(404).json({ error: 'Meal not found' }); return; }

    // Verify trainer-client link with userId-OR-chatId on both sides
    const link = await (prisma.trainerClientLink.findFirst as (args: any) => Promise<{ trainerId: string; clientId: string } | null>)({
      where: {
        ...trainerLinkFilter(chatId, userId),
        ...clientLinkFilter(meal.chatId, meal.userId),
        status: { in: ['active', 'frozen'] },
      },
    });
    if (!link) { res.status(403).json({ error: 'No active link with this client' }); return; }

    // Use the link's canonical chatIds as the rating key — stable across platforms
    const result = await prisma.trainerRating.upsert({
      where: { trainerId_clientId_targetType_targetId: {
        trainerId: link.trainerId, clientId: link.clientId, targetType: 'meal', targetId: mealId,
      }},
      update: { rating },
      create: { trainerId: link.trainerId, clientId: link.clientId, targetType: 'meal', targetId: mealId, rating },
    });
    res.json({ rating: result });
  } catch (err) {
    console.error('[ratings/meal]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/ratings/day/:date — trainer rates a day (YYYY-MM-DD) ──────────

router.post('/day/:date', async (req: AuthRequest, res: Response) => {
  const chatId  = req.chatId!;
  const userId  = req.userId ?? null;
  const date    = req.params['date'] as string;
  const { clientId, rating } = req.body as { clientId?: string; rating?: string };

  if (!clientId) { res.status(400).json({ error: 'clientId required' }); return; }
  if (!rating || !(DAY_RATINGS as readonly string[]).includes(rating)) {
    res.status(400).json({ error: `rating must be one of: ${DAY_RATINGS.join(', ')}` }); return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { res.status(400).json({ error: 'date must be YYYY-MM-DD' }); return; }

  try {
    // Verify link — trainer side uses userId-OR-chatId; client side uses the provided clientId (chatId)
    const link = await (prisma.trainerClientLink.findFirst as (args: any) => Promise<{ trainerId: string; clientId: string } | null>)({
      where: {
        ...trainerLinkFilter(chatId, userId),
        clientId,                              // clientId from body is always a chatId
        status: { in: ['active', 'frozen'] },
      },
    });
    if (!link) { res.status(403).json({ error: 'No active link with this client' }); return; }

    const result = await prisma.trainerRating.upsert({
      where: { trainerId_clientId_targetType_targetId: {
        trainerId: link.trainerId, clientId: link.clientId, targetType: 'day', targetId: date,
      }},
      update: { rating },
      create: { trainerId: link.trainerId, clientId: link.clientId, targetType: 'day', targetId: date, rating },
    });
    res.json({ rating: result });
  } catch (err) {
    console.error('[ratings/day]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/ratings/for-client/:clientId — trainer gets ratings for a client ─

router.get('/for-client/:clientId', async (req: AuthRequest, res: Response) => {
  const chatId   = req.chatId!;
  const userId   = req.userId ?? null;
  const clientId = req.params['clientId'] as string;
  try {
    // Verify trainer has an active link to this client (userId-OR-chatId on trainer side)
    const link = await (prisma.trainerClientLink.findFirst as (args: any) => Promise<{ trainerId: string; clientId: string } | null>)({
      where: {
        ...trainerLinkFilter(chatId, userId),
        clientId,
        status: { in: ['active', 'frozen'] },
      },
    });
    if (!link) { res.status(403).json({ error: 'No active link' }); return; }

    // Read ratings using the link's canonical chatIds (covers all entries regardless of platform)
    const ratings = await prisma.trainerRating.findMany({
      where: { trainerId: link.trainerId, clientId: link.clientId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ ratings });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/ratings/my — client sees ratings from their trainer ─────────────

router.get('/my', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const userId = req.userId ?? null;
  try {
    // Find client's active trainer link — userId-OR-chatId on client side
    const link = await (prisma.trainerClientLink.findFirst as (args: any) => Promise<{ trainerId: string; clientId: string } | null>)({
      where: {
        ...clientLinkFilter(chatId, userId),
        status: 'active',
      },
    });
    if (!link) { res.json({ ratings: [] }); return; }

    // Read via the link's canonical chatIds (stable across platforms)
    const ratings = await prisma.trainerRating.findMany({
      where: { trainerId: link.trainerId, clientId: link.clientId },
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
