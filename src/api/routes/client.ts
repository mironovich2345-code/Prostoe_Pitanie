import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';
import { triggerQualificationRefresh } from '../../services/expertAcquisitionService';

const router = Router();

// GET /api/client/trainers — list all verified individual experts (public info + avatar + avg rating)
router.get('/trainers', async (_req: AuthRequest, res: Response) => {
  try {
    const trainers = await prisma.trainerProfile.findMany({
      where: { verificationStatus: 'verified', specialization: { not: 'Компания' } },
      select: { chatId: true, fullName: true, specialization: true, bio: true, avatarData: true },
      orderBy: { verifiedAt: 'desc' },
    });

    // Batch-fetch ratings so we don't N+1 query
    const chatIds = trainers.map(t => t.chatId);
    const reviews = chatIds.length > 0
      ? await prisma.trainerReview.findMany({
          where: { trainerId: { in: chatIds } },
          select: { trainerId: true, rating: true },
        })
      : [];

    const ratingMap = new Map<string, { sum: number; count: number }>();
    for (const r of reviews) {
      const entry = ratingMap.get(r.trainerId) ?? { sum: 0, count: 0 };
      entry.sum += r.rating;
      entry.count += 1;
      ratingMap.set(r.trainerId, entry);
    }

    const result = trainers.map(t => {
      const rd = ratingMap.get(t.chatId);
      return {
        chatId: t.chatId,
        fullName: t.fullName,
        specialization: t.specialization,
        bio: t.bio,
        avatarData: t.avatarData,
        avgRating: rd ? Math.round((rd.sum / rd.count) * 10) / 10 : null,
        reviewCount: rd?.count ?? 0,
      };
    });

    res.json({ trainers: result });
  } catch (err) {
    console.error('[client/trainers]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/client/trainer/lookup-by-id?trainerId=xxx — preview a verified trainer by chatId
router.get('/trainer/lookup-by-id', async (req: AuthRequest, res: Response) => {
  const { trainerId } = req.query as { trainerId?: string };
  if (!trainerId) { res.status(400).json({ error: 'trainerId required' }); return; }
  try {
    const tp = await prisma.trainerProfile.findFirst({
      where: { chatId: trainerId, verificationStatus: 'verified' },
      select: { chatId: true, fullName: true, specialization: true, bio: true },
    });
    if (!tp) { res.status(404).json({ error: 'Trainer not found' }); return; }
    res.json({ trainerId: tp.chatId, fullName: tp.fullName, specialization: tp.specialization, bio: tp.bio });
  } catch (err) {
    console.error('[client/trainer/lookup-by-id]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/client/trainers/:trainerId — full public profile (reviews + documents metadata)
router.get('/trainers/:trainerId', async (req: AuthRequest, res: Response) => {
  const { trainerId } = req.params as { trainerId: string };
  try {
    const tp = await prisma.trainerProfile.findFirst({
      where: { chatId: trainerId, verificationStatus: 'verified', specialization: { not: 'Компания' } },
      select: { chatId: true, fullName: true, specialization: true, bio: true, avatarData: true },
    });
    if (!tp) { res.status(404).json({ error: 'Expert not found' }); return; }

    // Reviews — public fields only; clientId never exposed
    const rawReviews = await prisma.trainerReview.findMany({
      where: { trainerId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, rating: true, reviewText: true, trainerComment: true, allowTrainerComment: true, createdAt: true },
    });
    const avgRating = rawReviews.length > 0
      ? Math.round(rawReviews.reduce((s, r) => s + r.rating, 0) / rawReviews.length * 10) / 10
      : null;
    // Only include trainerComment when reviewer allowed it
    const reviews = rawReviews.map(r => ({
      id: r.id,
      rating: r.rating,
      reviewText: r.reviewText,
      trainerComment: r.allowTrainerComment ? r.trainerComment : null,
      createdAt: r.createdAt,
    }));

    // Documents — metadata only, no fileData
    const documents = await (prisma as unknown as { trainerDocument: { findMany(args: unknown): Promise<Array<{ id: number; docType: string; title: string | null; mimeType: string; createdAt: Date }>> } }).trainerDocument.findMany({
      where: { chatId: trainerId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, docType: true, title: true, mimeType: true, createdAt: true },
    }).catch(() => [] as Array<{ id: number; docType: string; title: string | null; mimeType: string; createdAt: Date }>);

    res.json({
      trainer: {
        chatId: tp.chatId,
        fullName: tp.fullName,
        specialization: tp.specialization,
        bio: tp.bio,
        avatarData: tp.avatarData,
        avgRating,
        reviewCount: rawReviews.length,
        reviews,
        documents,
      },
    });
  } catch (err) {
    console.error('[client/trainers/:trainerId]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/client/trainers/:trainerId/documents/:docId/file — stream public credential document
router.get('/trainers/:trainerId/documents/:docId/file', async (req: AuthRequest, res: Response) => {
  const { trainerId, docId } = req.params as { trainerId: string; docId: string };
  const id = parseInt(docId, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid docId' }); return; }
  try {
    const tp = await prisma.trainerProfile.findFirst({
      where: { chatId: trainerId, verificationStatus: 'verified' },
      select: { chatId: true },
    });
    if (!tp) { res.status(404).json({ error: 'Expert not found' }); return; }

    const doc = await (prisma as unknown as { trainerDocument: { findFirst(args: unknown): Promise<{ fileData: string; mimeType: string } | null> } }).trainerDocument.findFirst({
      where: { id, chatId: trainerId },
      select: { fileData: true, mimeType: true },
    }).catch(() => null);
    if (!doc) { res.status(404).json({ error: 'Document not found' }); return; }

    const comma = doc.fileData.indexOf(',');
    const b64 = doc.fileData.slice(comma + 1);
    const buffer = Buffer.from(b64, 'base64');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', 'inline');
    res.send(buffer);
  } catch (err) {
    console.error('[client/trainers/:trainerId/documents/:docId/file]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/client/trainer/connect-direct — connect by trainerId, no code required
router.post('/trainer/connect-direct', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { trainerId, fullHistoryAccess, canViewPhotos } = req.body as {
    trainerId?: string;
    fullHistoryAccess?: boolean;
    canViewPhotos?: boolean;
  };
  if (!trainerId) { res.status(400).json({ error: 'trainerId required' }); return; }
  if (trainerId === chatId) { res.status(400).json({ error: 'Cannot connect to yourself' }); return; }
  try {
    const existing = await prisma.trainerClientLink.findFirst({
      where: { clientId: chatId, status: 'active' },
    });
    if (existing) { res.status(409).json({ error: 'Already have an active trainer' }); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tp = await (prisma.trainerProfile.findFirst as (args: any) => Promise<any>)({
      where: { chatId: trainerId, verificationStatus: 'verified' },
      select: { chatId: true, fullName: true, specialization: true, userId: true },
    });
    if (!tp) { res.status(404).json({ error: 'Trainer not found or not verified' }); return; }

    const clientUserId = req.userId ?? null;
    const trainerUserId = (tp.userId as string | null) ?? null;

    const link = await prisma.trainerClientLink.upsert({
      where: { trainerId_clientId: { trainerId: tp.chatId, clientId: chatId } },
      update: {
        status: 'active',
        fullHistoryAccess: fullHistoryAccess ?? false,
        canViewPhotos: canViewPhotos ?? true,
        connectedAt: new Date(),
        disconnectedAt: { set: null },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(clientUserId ? { clientUserId } : {} as any),
        ...(trainerUserId ? { trainerUserId } : {}),
      } as any, // new fields absent from stale Prisma client; remove cast after prisma generate
      create: {
        trainerId: tp.chatId,
        clientId: chatId,
        status: 'active',
        fullHistoryAccess: fullHistoryAccess ?? false,
        canViewPhotos: canViewPhotos ?? true,
        clientUserId,
        trainerUserId,
      } as any,
    });
    // If this trainer was recruited via expert-acquisition referral, refresh their qualification count
    triggerQualificationRefresh(tp.chatId);

    res.json({
      ok: true,
      link: { trainerId: link.trainerId, fullHistoryAccess: link.fullHistoryAccess, canViewPhotos: link.canViewPhotos, connectedAt: link.connectedAt },
      trainer: { fullName: tp.fullName, specialization: tp.specialization },
    });
  } catch (err) {
    console.error('[client/trainer/connect-direct]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/client/trainer — disconnect current active trainer
router.delete('/trainer', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const link = await prisma.trainerClientLink.findFirst({
      where: { clientId: chatId, status: 'active' },
    });
    if (!link) {
      res.status(404).json({ error: 'No active trainer link' });
      return;
    }
    await prisma.trainerClientLink.update({
      where: { id: link.id },
      data: { status: 'ended', disconnectedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/client/trainer/access — update both fullHistoryAccess and canViewPhotos
router.patch('/trainer/access', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { fullHistoryAccess, canViewPhotos } = req.body as { fullHistoryAccess?: boolean; canViewPhotos?: boolean };
  try {
    const link = await prisma.trainerClientLink.findFirst({
      where: { clientId: chatId, status: 'active' },
    });
    if (!link) { res.status(404).json({ error: 'No active trainer link' }); return; }
    const data: Record<string, boolean> = {};
    if (typeof fullHistoryAccess === 'boolean') data['fullHistoryAccess'] = fullHistoryAccess;
    if (typeof canViewPhotos === 'boolean') data['canViewPhotos'] = canViewPhotos;
    await prisma.trainerClientLink.update({ where: { id: link.id }, data });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/client/trainer/history-access — grant or revoke full history access
router.patch('/trainer/history-access', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { fullAccess } = req.body as { fullAccess: boolean };
  if (typeof fullAccess !== 'boolean') {
    res.status(400).json({ error: 'fullAccess must be boolean' });
    return;
  }
  try {
    const link = await prisma.trainerClientLink.findFirst({
      where: { clientId: chatId, status: 'active' },
    });
    if (!link) {
      res.status(404).json({ error: 'No active trainer link' });
      return;
    }
    await prisma.trainerClientLink.update({
      where: { id: link.id },
      data: { fullHistoryAccess: fullAccess },
    });
    res.json({ ok: true, fullHistoryAccess: fullAccess });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/client/trainer/lookup — find trainer by 6-digit connection code (no DB write)
router.post('/trainer/lookup', async (req: AuthRequest, res: Response) => {
  const { code } = req.body as { code?: string };
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Missing code' }); return;
  }
  // Accept 6-digit numeric codes; also accept old alphanumeric for backward compatibility during migration
  const normalizedCode = code.trim();
  try {
    const tp = await prisma.trainerProfile.findFirst({
      where: {
        connectionCode: normalizedCode,
        verificationStatus: 'verified',
      },
      select: { chatId: true, fullName: true, specialization: true, bio: true },
    });
    if (!tp) {
      res.status(404).json({ error: 'Code not found or expired' }); return;
    }
    res.json({ trainerId: tp.chatId, fullName: tp.fullName, specialization: tp.specialization, bio: tp.bio });
  } catch (err) {
    console.error('[client/trainer/lookup]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/client/trainer/connect — confirm connection with access rights
router.post('/trainer/connect', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { code, fullHistoryAccess, canViewPhotos } = req.body as {
    code?: string;
    fullHistoryAccess?: boolean;
    canViewPhotos?: boolean;
  };
  if (!code) { res.status(400).json({ error: 'Missing code' }); return; }
  const normalizedCode = code.trim();

  try {
    // Only one active trainer allowed
    const existing = await prisma.trainerClientLink.findFirst({
      where: { clientId: chatId, status: 'active' },
    });
    if (existing) {
      res.status(409).json({ error: 'Already have an active trainer' }); return;
    }

    // Find trainer by permanent code (no TTL)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tp = await (prisma.trainerProfile.findFirst as (args: any) => Promise<any>)({
      where: { connectionCode: normalizedCode, verificationStatus: 'verified' },
      select: { chatId: true, fullName: true, specialization: true, userId: true },
    });
    if (!tp) { res.status(404).json({ error: 'Code not found' }); return; }
    if (tp.chatId === chatId) { res.status(400).json({ error: 'Cannot connect to yourself' }); return; }

    const clientUserId = req.userId ?? null;
    const trainerUserId = (tp.userId as string | null) ?? null;

    // Create or reactivate link
    const link = await prisma.trainerClientLink.upsert({
      where: { trainerId_clientId: { trainerId: tp.chatId, clientId: chatId } },
      update: {
        status: 'active',
        fullHistoryAccess: fullHistoryAccess ?? false,
        canViewPhotos: canViewPhotos ?? true,
        connectedAt: new Date(),
        disconnectedAt: { set: null },
        ...(clientUserId ? { clientUserId } : {}),
        ...(trainerUserId ? { trainerUserId } : {}),
      } as any, // new fields absent from stale Prisma client; remove cast after prisma generate
      create: {
        trainerId: tp.chatId,
        clientId: chatId,
        status: 'active',
        fullHistoryAccess: fullHistoryAccess ?? false,
        canViewPhotos: canViewPhotos ?? true,
        clientUserId,
        trainerUserId,
      } as any,
    });

    // If this trainer was recruited via expert-acquisition referral, refresh their qualification count
    triggerQualificationRefresh(tp.chatId);

    res.json({
      ok: true,
      link: {
        trainerId: link.trainerId,
        fullHistoryAccess: link.fullHistoryAccess,
        canViewPhotos: link.canViewPhotos,
        connectedAt: link.connectedAt,
      },
      trainer: { fullName: tp.fullName, specialization: tp.specialization },
    });
  } catch (err) {
    console.error('[client/trainer/connect]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
