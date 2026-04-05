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

/** GET /api/reviews/trainer — trainer sees all reviews they received */
router.get('/trainer', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const reviews = await prisma.trainerReview.findMany({
      where: { trainerId: chatId },
      orderBy: { createdAt: 'desc' },
    });
    const clientIds = reviews.map(r => r.clientId);
    const profiles = await prisma.userProfile.findMany({
      where: { chatId: { in: clientIds } },
      select: { chatId: true, preferredName: true },
    });
    const nameMap = Object.fromEntries(profiles.map(p => [p.chatId, p.preferredName]));
    const result = reviews.map(r => ({
      ...r,
      clientName: nameMap[r.clientId] ?? null,
    }));
    const avg = reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null;
    res.json({ reviews: result, avgRating: avg });
  } catch (err) {
    console.error('[reviews/trainer GET]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** PATCH /api/reviews/trainer/:id/comment — trainer adds or edits comment */
router.patch('/trainer/:id/comment', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const id = parseInt(req.params['id'] as string, 10);
  const { trainerComment } = req.body as { trainerComment?: string };
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  try {
    const review = await prisma.trainerReview.findUnique({ where: { id } });
    if (!review || review.trainerId !== chatId) {
      res.status(404).json({ error: 'Review not found' }); return;
    }
    if (!review.allowTrainerComment) {
      res.status(403).json({ error: 'Client did not allow trainer comment' }); return;
    }
    const updated = await prisma.trainerReview.update({
      where: { id },
      data: { trainerComment: trainerComment?.trim() || null },
    });
    res.json({ review: updated });
  } catch (err) {
    console.error('[reviews/trainer/:id/comment PATCH]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
