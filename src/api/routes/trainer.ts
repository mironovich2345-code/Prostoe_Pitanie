import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';
import { validateImageDataUrl, AVATAR_MAX_BYTES, validateDocumentDataUrl, DOCUMENT_MAX_BYTES } from '../utils/validateImage';

const router = Router();

// ─── userId-aware helpers ─────────────────────────────────────────────────────

/**
 * TrainerClientLink shape extended with userId fields (absent from stale Prisma
 * client; remove the interface and casts after `prisma generate` runs).
 */
interface TrainerClientLinkFull {
  id: number;
  status: string;
  fullHistoryAccess: boolean;
  canViewPhotos: boolean;
  connectedAt: Date;
  clientAlias: string | null;
  clientUserId: string | null;  // platform-independent; null until backfilled
  trainerUserId: string | null;
}

/**
 * Fetch an active/frozen trainer-client link including userId fields.
 * Uses `as any` because clientUserId / trainerUserId are absent from the
 * stale Prisma client; remove the cast after `prisma generate` runs.
 */
async function findActiveLink(
  trainerId: string,
  clientId: string,
  statuses: string[] = ['active', 'frozen'],
): Promise<TrainerClientLinkFull | null> {
  return (prisma.trainerClientLink.findFirst as (args: unknown) => Promise<TrainerClientLinkFull | null>)({
    where: { trainerId, clientId, status: { in: statuses } },
  });
}

/**
 * Build a Prisma where-filter for client data (MealEntry / WeightEntry).
 * clientUserId present → OR: [userId match (new/backfilled), chatId+userId=null (legacy)]
 * clientUserId absent  → chatId-only (safe: TG chatIds are stable)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clientDataFilter(clientId: string, clientUserId?: string | null): any {
  if (clientUserId) return { OR: [{ userId: clientUserId }, { chatId: clientId, userId: null }] };
  return { chatId: clientId };
}

// ─────────────────────────────────────────────────────────────────────────────

/** Returns true only if the caller has an active verified trainer profile. */
async function isVerifiedTrainer(chatId: string): Promise<boolean> {
  const tp = await prisma.trainerProfile.findUnique({
    where: { chatId },
    select: { verificationStatus: true },
  });
  return tp?.verificationStatus === 'verified';
}

/** Derive a human display name for a client, preferring trainer alias > preferredName > short fallback */
function clientDisplayName(alias: string | null | undefined, preferredName: string | null | undefined, chatId: string): string {
  if (alias?.trim()) return alias.trim();
  if (preferredName?.trim()) return preferredName.trim();
  return `Клиент …${chatId.slice(-4)}`;
}

// PATCH /api/trainer/profile — update fullName, avatarData, bio, socialLink
router.patch('/profile', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { fullName, avatarData, bio, socialLink } = req.body as { fullName?: string; avatarData?: string | null; bio?: string; socialLink?: string };
  if (avatarData != null && !validateImageDataUrl(avatarData, AVATAR_MAX_BYTES)) {
    res.status(400).json({ error: 'Invalid avatarData' });
    return;
  }
  try {
    const tp = await prisma.trainerProfile.findUnique({ where: { chatId } });
    if (!tp) { res.status(404).json({ error: 'Trainer profile not found' }); return; }

    const data: Record<string, unknown> = {};
    if (fullName !== undefined) data['fullName'] = fullName?.trim() || null;
    if (avatarData !== undefined) data['avatarData'] = avatarData ?? null;
    if (bio !== undefined) data['bio'] = bio.trim() || null;
    if (socialLink !== undefined) data['socialLink'] = socialLink.trim() || null;

    const updated = await prisma.trainerProfile.update({ where: { chatId }, data });
    res.json({ ok: true, fullName: updated.fullName, avatarData: updated.avatarData, bio: updated.bio, socialLink: updated.socialLink });
  } catch (err) {
    console.error('[trainer/profile PATCH]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/trainer/clients — list trainer's clients
router.get('/clients', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const trainerProfile = await prisma.trainerProfile.findUnique({ where: { chatId } });
    if (!trainerProfile || trainerProfile.verificationStatus !== 'verified') {
      res.status(403).json({ error: 'Not a verified trainer' });
      return;
    }
    const links = await prisma.trainerClientLink.findMany({
      where: { trainerId: chatId, status: { in: ['active', 'frozen'] } },
    });
    const clientIds = links.map(l => l.clientId);
    const [profiles, subscriptions] = await Promise.all([
      prisma.userProfile.findMany({
        where: { chatId: { in: clientIds } },
        select: {
          chatId: true,
          preferredName: true,      // display name fallback
          currentWeightKg: true,    // shown in client card
          goalType: true,           // shown in client card
          dailyCaloriesKcal: true,  // shown in client card
        },
      }),
      prisma.subscription.findMany({ where: { chatId: { in: clientIds } } }),
    ]);
    const profileMap = Object.fromEntries(profiles.map(p => [p.chatId, p]));
    const subMap = Object.fromEntries(subscriptions.map(s => [s.chatId, s]));
    const clients = links.map(link => {
      const profile = profileMap[link.clientId] ?? null;
      return {
        link: {
          id: link.id,
          clientId: link.clientId,
          status: link.status,
          fullHistoryAccess: link.fullHistoryAccess,
          connectedAt: link.connectedAt,
          clientAlias: link.clientAlias ?? null,
        },
        profile: profile,
        subscription: subMap[link.clientId] ?? null,
        displayName: clientDisplayName(link.clientAlias, profile?.preferredName, link.clientId),
      };
    });
    res.json({ clients });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/trainer/clients/:clientId — client card
router.get('/clients/:clientId', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const clientId = req.params['clientId'] as string;
  try {
    if (!await isVerifiedTrainer(chatId)) {
      res.status(403).json({ error: 'Not a verified trainer' });
      return;
    }
    const link = await prisma.trainerClientLink.findFirst({
      where: { trainerId: chatId, clientId, status: { in: ['active', 'frozen'] } },
    });
    if (!link) {
      res.status(403).json({ error: 'Client not found or access denied' });
      return;
    }
    const [profile, subscription] = await Promise.all([
      prisma.userProfile.findUnique({
        where: { chatId: clientId },
        select: {
          preferredName: true,
          currentWeightKg: true,
          desiredWeightKg: true,
          dailyCaloriesKcal: true,
          goalType: true,
        },
      }),
      prisma.subscription.findUnique({ where: { chatId: clientId } }),
    ]);
    res.json({
      link: {
        id: link.id,
        status: link.status,
        fullHistoryAccess: link.fullHistoryAccess,
        connectedAt: link.connectedAt,
        clientAlias: link.clientAlias ?? null,
      },
      profile,
      subscription,
      displayName: clientDisplayName(link.clientAlias, profile?.preferredName, clientId),
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/trainer/clients/:clientId/alias — set trainer's private label for a client
router.patch('/clients/:clientId/alias', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const clientId = req.params['clientId'] as string;
  const { alias } = req.body as { alias?: string };
  try {
    if (!await isVerifiedTrainer(chatId)) {
      res.status(403).json({ error: 'Not a verified trainer' });
      return;
    }
    const link = await prisma.trainerClientLink.findFirst({
      where: { trainerId: chatId, clientId, status: { in: ['active', 'frozen'] } },
    });
    if (!link) { res.status(404).json({ error: 'Client link not found' }); return; }
    const updated = await prisma.trainerClientLink.update({
      where: { id: link.id },
      data: { clientAlias: alias?.trim() || null },
    });
    res.json({ ok: true, clientAlias: updated.clientAlias });
  } catch (err) {
    console.error('[trainer/clients/:clientId/alias PATCH]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/trainer/clients/:clientId/stats
router.get('/clients/:clientId/stats', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const clientId = req.params['clientId'] as string;
  try {
    if (!await isVerifiedTrainer(chatId)) {
      res.status(403).json({ error: 'Not a verified trainer' });
      return;
    }
    const link = await findActiveLink(chatId, clientId);
    if (!link) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const since = link.fullHistoryAccess ? undefined : link.connectedAt;
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const baseFilter = clientDataFilter(clientId, link.clientUserId);
    const [todayMeals, recentMeals, weights] = await Promise.all([
      prisma.mealEntry.findMany({ where: { ...baseFilter, createdAt: { gte: start, lte: end } } }),
      prisma.mealEntry.findMany({
        where: { ...baseFilter, ...(since ? { createdAt: { gte: since } } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.weightEntry.findMany({
        where: { ...baseFilter, ...(since ? { createdAt: { gte: since } } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    const profile = await prisma.userProfile.findUnique({
      where: { chatId: clientId },
      select: {
        preferredName: true,
        currentWeightKg: true,
        desiredWeightKg: true,
        dailyCaloriesKcal: true,
        dailyProteinG: true,
        dailyFatG: true,
        dailyCarbsG: true,
        goalType: true,
      },
    });
    let todayCal = 0;
    for (const m of todayMeals) todayCal += m.caloriesKcal ?? 0;

    const maskPhotos = !link.canViewPhotos;
    const maskMeal = <T extends { photoFileId: string | null; photoData?: string | null }>(m: T): T =>
      maskPhotos ? { ...m, photoFileId: null, photoData: null } : m;

    res.json({
      todayMeals: todayMeals.map(maskMeal),
      todayCalories: Math.round(todayCal),
      recentMeals: recentMeals.map(maskMeal),
      weightHistory: weights,
      profile,
      canViewPhotos: link.canViewPhotos,
      displayName: clientDisplayName(link.clientAlias, profile?.preferredName, clientId),
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/trainer/clients/:clientId/stats-range?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/clients/:clientId/stats-range', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const clientId = req.params['clientId'] as string;
  const { from, to } = req.query as { from?: string; to?: string };
  if (!from || !to) { res.status(400).json({ error: 'from and to required' }); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    res.status(400).json({ error: 'from and to must be YYYY-MM-DD' }); return;
  }
  try {
    if (!await isVerifiedTrainer(chatId)) {
      res.status(403).json({ error: 'Not a verified trainer' });
      return;
    }
    const link = await findActiveLink(chatId, clientId);
    if (!link) { res.status(403).json({ error: 'Access denied' }); return; }

    const since = link.fullHistoryAccess ? undefined : link.connectedAt;
    const fromDate = new Date(from + 'T00:00:00');
    const toDate = new Date(to + 'T23:59:59.999');

    // Clamp fromDate to since if fullHistoryAccess is false
    const effectiveFrom = since && fromDate < since ? since : fromDate;

    const meals = await prisma.mealEntry.findMany({
      where: { ...clientDataFilter(clientId, link.clientUserId), createdAt: { gte: effectiveFrom, lte: toDate } },
      orderBy: { createdAt: 'asc' },
    });

    const maskPhotos = !link.canViewPhotos;
    const maskMeal = <T extends { photoFileId: string | null; photoData?: string | null }>(m: T): T =>
      maskPhotos ? { ...m, photoFileId: null, photoData: null } : m;

    res.json({ meals: meals.map(maskMeal) });
  } catch (err) {
    console.error('[trainer/clients/:clientId/stats-range]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/trainer/alerts — dashboard alerts
// NOTE: meal lookups here stay on chatId (batch OR-of-ORs for N clients adds complexity; safe to harden later)
router.get('/alerts', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const trainerProfile = await prisma.trainerProfile.findUnique({ where: { chatId } });
    if (!trainerProfile || trainerProfile.verificationStatus !== 'verified') {
      res.status(403).json({ error: 'Not a verified trainer' });
      return;
    }
    const links = await prisma.trainerClientLink.findMany({
      where: { trainerId: chatId, status: 'active' },
    });
    const clientIds = links.map(l => l.clientId);
    const aliasMap = Object.fromEntries(links.map(l => [l.clientId, l.clientAlias]));

    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const [todayMeals, subscriptions, profiles] = await Promise.all([
      prisma.mealEntry.findMany({ where: { chatId: { in: clientIds }, createdAt: { gte: start, lte: end } } }),
      prisma.subscription.findMany({ where: { chatId: { in: clientIds } } }),
      prisma.userProfile.findMany({ where: { chatId: { in: clientIds } }, select: { chatId: true, preferredName: true } }),
    ]);
    const nameMap = Object.fromEntries(profiles.map(p => [p.chatId, p.preferredName]));
    const activeToday = new Set(todayMeals.map(m => m.chatId));
    const notLoggedToday = clientIds
      .filter(id => !activeToday.has(id))
      .map(id => ({ chatId: id, displayName: clientDisplayName(aliasMap[id], nameMap[id], id) }));
    const expiringSoon = subscriptions
      .filter(s => {
        if (!s.currentPeriodEnd) return false;
        const daysLeft = (s.currentPeriodEnd.getTime() - Date.now()) / 86400000;
        return daysLeft >= 0 && daysLeft <= 3;
      })
      .map(s => ({
        id: s.id,
        chatId: s.chatId,
        currentPeriodEnd: s.currentPeriodEnd,
        displayName: clientDisplayName(aliasMap[s.chatId], nameMap[s.chatId], s.chatId),
      }));
    res.json({ notLoggedToday, expiringSoon, totalClients: clientIds.length, activeToday: activeToday.size });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/trainer/rewards
router.get('/rewards', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const rewards = await prisma.trainerReward.findMany({
      where: { trainerId: chatId },
      orderBy: { createdAt: 'desc' },
    });
    const total = rewards.reduce((s, r) => s + r.amountRub, 0);
    const available = rewards.filter(r => r.status === 'available').reduce((s, r) => s + r.amountRub, 0);
    const paidOut = rewards.filter(r => r.status === 'paid_out').reduce((s, r) => s + r.amountRub, 0);
    res.json({ rewards, summary: { total, available, paidOut } });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Expert documents ─────────────────────────────────────────────────────────

const VALID_DOC_TYPES = ['diploma', 'certificate', 'other'];
const MAX_DOCUMENTS_PER_TRAINER = 10;

// GET /api/trainer/documents — list trainer's uploaded documents (metadata only, no fileData)
router.get('/documents', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const docs = await prisma.trainerDocument.findMany({
      where: { chatId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, docType: true, title: true, mimeType: true, createdAt: true },
    });
    res.json({ documents: docs });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/trainer/documents — upload a new document
router.post('/documents', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { docType, title, fileData } = req.body as { docType?: string; title?: string; fileData?: string };

  if (!docType || !VALID_DOC_TYPES.includes(docType)) {
    res.status(400).json({ error: 'Invalid docType (diploma | certificate | other)' });
    return;
  }
  if (!fileData || !validateDocumentDataUrl(fileData, DOCUMENT_MAX_BYTES)) {
    res.status(400).json({ error: 'Invalid or too large fileData (max 5 MB, formats: jpg/png/webp/pdf)' });
    return;
  }

  try {
    const count = await prisma.trainerDocument.count({ where: { chatId } });
    if (count >= MAX_DOCUMENTS_PER_TRAINER) {
      res.status(409).json({ error: `Максимум ${MAX_DOCUMENTS_PER_TRAINER} документов` });
      return;
    }

    const semi = fileData.indexOf(';');
    const mimeType = fileData.slice(5, semi); // strip 'data:'

    const doc = await prisma.trainerDocument.create({
      data: { chatId, docType, title: title?.trim() || null, fileData, mimeType },
    });
    res.json({ document: { id: doc.id, docType: doc.docType, title: doc.title, mimeType: doc.mimeType, createdAt: doc.createdAt } });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/trainer/documents/:id
router.delete('/documents/:id', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  try {
    const doc = await prisma.trainerDocument.findFirst({ where: { id, chatId } });
    if (!doc) { res.status(404).json({ error: 'Not found' }); return; }
    await prisma.trainerDocument.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/trainer/documents/:id/file — stream file bytes (auth-gated; for inline viewing)
router.get('/documents/:id/file', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  try {
    const doc = await prisma.trainerDocument.findFirst({
      where: { id, chatId },
      select: { fileData: true, mimeType: true },
    });
    if (!doc) { res.status(404).json({ error: 'Not found' }); return; }

    const comma = doc.fileData.indexOf(',');
    const b64 = doc.fileData.slice(comma + 1);
    const buffer = Buffer.from(b64, 'base64');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', 'inline');
    res.send(buffer);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
