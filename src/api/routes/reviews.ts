import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

const router = Router();

/** GET /api/reviews/my-trainer — client's own review for their current trainer */
router.get('/my-trainer', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const link = await prisma.trainerClientLink.findFirst({
      where: { clientId: chatId, status: 'active' },
      select: { trainerId: true },
    });
    if (!link) { res.json({ review: null }); return; }

    const review = await prisma.trainerReview.findFirst({
      where: { clientId: chatId, trainerId: link.trainerId },
    });
    res.json({ review: review ?? null });
  } catch (err) {
    console.error('[reviews/my-trainer GET]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** PUT /api/reviews/my-trainer — upsert client's review (create or update) */
router.put('/my-trainer', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { rating, reviewText, allowTrainerComment } = req.body as {
    rating?: number;
    reviewText?: string;
    allowTrainerComment?: boolean;
  };

  if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: 'rating must be integer 1–5' }); return;
  }

  try {
    const link = await prisma.trainerClientLink.findFirst({
      where: { clientId: chatId, status: 'active' },
      select: { trainerId: true },
    });
    if (!link) { res.status(404).json({ error: 'No active trainer' }); return; }

    const text = reviewText?.trim() || null;
    const review = await prisma.trainerReview.upsert({
      where: { clientId_trainerId: { clientId: chatId, trainerId: link.trainerId } },
      update: { rating, reviewText: text, allowTrainerComment: allowTrainerComment ?? true },
      create: { clientId: chatId, trainerId: link.trainerId, rating, reviewText: text, allowTrainerComment: allowTrainerComment ?? true },
    });
    res.json({ review });
  } catch (err) {
    console.error('[reviews/my-trainer PUT]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
