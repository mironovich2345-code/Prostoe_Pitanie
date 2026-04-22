import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';
import { validateImageDataUrl, AVATAR_MAX_BYTES, validateDocumentDataUrl, DOCUMENT_MAX_BYTES, PHOTO_MAX_BYTES } from '../utils/validateImage';
import { recognizeRequisites } from '../../ai/recognizeRequisites';
import { uploadObject, getObjectBuffer, deleteObject, trainerDocKey, mimeToExt, extToMime, StorageNotConfiguredError } from '../../storage/r2';

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
 * Uses userId-OR-chatId for the trainer side so the same trainer works
 * regardless of which platform they logged in from.
 * Uses `as any` because clientUserId / trainerUserId are absent from the
 * stale Prisma client; remove the cast after `prisma generate` runs.
 */
async function findActiveLink(
  trainerId: string,
  clientId: string,
  statuses: string[] = ['active', 'frozen'],
  trainerUserId?: string | null,
): Promise<TrainerClientLinkFull | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trainerFilter: any = trainerUserId
    ? { OR: [{ trainerId }, { trainerUserId }] }
    : { trainerId };
  return (prisma.trainerClientLink.findFirst as (args: unknown) => Promise<TrainerClientLinkFull | null>)({
    where: { ...trainerFilter, clientId, status: { in: statuses } },
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

/**
 * Find the caller's TrainerProfile using userId-OR-chatId lookup.
 * userId-first: if the same person logs in from a different platform (e.g. MAX),
 * their profile is still found via the platform-independent userId.
 * Falls back to chatId for legacy records that have not been backfilled yet.
 */
async function findTrainerProfile(
  chatId: string,
  userId?: string | null,
): Promise<{ chatId: string; userId: string | null; verificationStatus: string } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma.trainerProfile.findFirst as (args: any) => Promise<any>)({
    where: userId ? { OR: [{ chatId }, { userId }] } : { chatId },
    select: { chatId: true, userId: true, verificationStatus: true },
  });
}

/** Returns true only if the caller has an active verified trainer profile. */
async function isVerifiedTrainer(chatId: string, userId?: string | null): Promise<boolean> {
  const tp = await findTrainerProfile(chatId, userId);
  return tp?.verificationStatus === 'verified';
}

/** Derive a human display name for a client, preferring trainer alias > preferredName > short fallback */
function clientDisplayName(alias: string | null | undefined, preferredName: string | null | undefined, chatId: string): string {
  if (alias?.trim()) return alias.trim();
  if (preferredName?.trim()) return preferredName.trim();
  return `Клиент …${chatId.slice(-4)}`;
}

/**
 * Resolve R2-backed meal photo data for a batch of meals.
 *
 * For each meal that has a `photoStorageKey` but no `photoData` (legacy base64),
 * fetches the bytes from R2 in parallel and injects a base64 data URL into
 * `photoData` so the trainer frontend receives the same shape it always has.
 *
 * Only call this when `canViewPhotos=true` — there is no point fetching photos
 * that will immediately be masked to null by `maskMeal`.
 *
 * Privacy note: `maskMeal` (applied AFTER this function) nulls out `photoData`
 * and `photoStorageKey` when `canViewPhotos=false`, so the storage key is never
 * exposed to the client.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveMealPhotos(meals: any[]): Promise<any[]> {
  return Promise.all(meals.map(async m => {
    const storageKey: string | null = m.photoStorageKey ?? null;
    if (!m.photoData && storageKey) {
      try {
        const buffer = await getObjectBuffer(storageKey);
        const ext = storageKey.split('.').pop() ?? 'jpg';
        return { ...m, photoData: `data:${extToMime(ext)};base64,${buffer.toString('base64')}` };
      } catch (err) {
        console.error('[resolveMealPhotos] R2 fetch failed', storageKey, err);
        // Leave photoData as null; trainer sees no photo rather than a crash
      }
    }
    return m;
  }));
}

// PATCH /api/trainer/profile — update fullName, avatarData, bio, socialLink
router.patch('/profile', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const userId = req.userId ?? null;
  const { fullName, avatarData, bio, socialLink } = req.body as { fullName?: string; avatarData?: string | null; bio?: string; socialLink?: string };
  if (avatarData != null && !validateImageDataUrl(avatarData, AVATAR_MAX_BYTES)) {
    res.status(400).json({ error: 'Invalid avatarData' });
    return;
  }
  try {
    const tp = await findTrainerProfile(chatId, userId);
    if (!tp) { res.status(404).json({ error: 'Trainer profile not found' }); return; }

    const data: Record<string, unknown> = {};
    if (fullName !== undefined) data['fullName'] = fullName?.trim() || null;
    if (avatarData !== undefined) data['avatarData'] = avatarData ?? null;
    if (bio !== undefined) data['bio'] = bio.trim() || null;
    if (socialLink !== undefined) data['socialLink'] = socialLink.trim() || null;
    // Backfill userId if the profile was created before the userId migration
    if (userId && !tp.userId) data['userId'] = userId;

    const updated = await prisma.trainerProfile.update({ where: { chatId: tp.chatId }, data });
    res.json({ ok: true, fullName: updated.fullName, avatarData: updated.avatarData, bio: updated.bio, socialLink: updated.socialLink });
  } catch (err) {
    console.error('[trainer/profile PATCH]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/trainer/clients — list trainer's clients
router.get('/clients', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const userId = req.userId ?? null;
  try {
    const trainerProfile = await findTrainerProfile(chatId, userId);
    if (!trainerProfile || trainerProfile.verificationStatus !== 'verified') {
      res.status(403).json({ error: 'Not a verified trainer' });
      return;
    }
    // Use OR on trainerUserId so clients connected from any platform are visible
    const trainerUserId = trainerProfile.userId;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const linkWhere: any = trainerUserId
      ? { OR: [{ trainerId: trainerProfile.chatId }, { trainerUserId }], status: { in: ['active', 'frozen'] } }
      : { trainerId: trainerProfile.chatId, status: { in: ['active', 'frozen'] } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const links = await (prisma.trainerClientLink.findMany as (args: any) => Promise<any[]>)({ where: linkWhere });
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
          avatarData: true,         // client profile photo
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
  const userId = req.userId ?? null;
  const clientId = req.params['clientId'] as string;
  try {
    const trainerProfile = await findTrainerProfile(chatId, userId);
    if (!trainerProfile || trainerProfile.verificationStatus !== 'verified') {
      res.status(403).json({ error: 'Not a verified trainer' });
      return;
    }
    const link = await findActiveLink(trainerProfile.chatId, clientId, ['active', 'frozen'], trainerProfile.userId);
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
          avatarData: true,         // client profile photo
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
  const userId = req.userId ?? null;
  const clientId = req.params['clientId'] as string;
  const { alias } = req.body as { alias?: string };
  try {
    const trainerProfile = await findTrainerProfile(chatId, userId);
    if (!trainerProfile || trainerProfile.verificationStatus !== 'verified') {
      res.status(403).json({ error: 'Not a verified trainer' });
      return;
    }
    const link = await findActiveLink(trainerProfile.chatId, clientId, ['active', 'frozen'], trainerProfile.userId);
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
  const userId = req.userId ?? null;
  const clientId = req.params['clientId'] as string;
  try {
    const trainerProfile = await findTrainerProfile(chatId, userId);
    if (!trainerProfile || trainerProfile.verificationStatus !== 'verified') {
      res.status(403).json({ error: 'Not a verified trainer' });
      return;
    }
    const link = await findActiveLink(trainerProfile.chatId, clientId, ['active', 'frozen'], trainerProfile.userId);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maskMeal = <T extends { photoFileId: string | null; photoData?: string | null }>(m: T): T => {
      if (!maskPhotos) return m;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { ...m, photoFileId: null, photoData: null, photoStorageKey: null } as any as T;
    };

    // Resolve R2-backed photos before applying the mask (only when trainer has photo access)
    const [resolvedToday, resolvedRecent] = maskPhotos
      ? [todayMeals, recentMeals]
      : await Promise.all([resolveMealPhotos(todayMeals), resolveMealPhotos(recentMeals)]);

    res.json({
      todayMeals: resolvedToday.map(maskMeal),
      todayCalories: Math.round(todayCal),
      recentMeals: resolvedRecent.map(maskMeal),
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
  const userId = req.userId ?? null;
  const clientId = req.params['clientId'] as string;
  const { from, to } = req.query as { from?: string; to?: string };
  if (!from || !to) { res.status(400).json({ error: 'from and to required' }); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    res.status(400).json({ error: 'from and to must be YYYY-MM-DD' }); return;
  }
  try {
    const trainerProfile = await findTrainerProfile(chatId, userId);
    if (!trainerProfile || trainerProfile.verificationStatus !== 'verified') {
      res.status(403).json({ error: 'Not a verified trainer' });
      return;
    }
    const link = await findActiveLink(trainerProfile.chatId, clientId, ['active', 'frozen'], trainerProfile.userId);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maskMeal = <T extends { photoFileId: string | null; photoData?: string | null }>(m: T): T => {
      if (!maskPhotos) return m;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { ...m, photoFileId: null, photoData: null, photoStorageKey: null } as any as T;
    };

    // Resolve R2-backed photos before applying the mask (only when trainer has photo access)
    const resolvedMeals = maskPhotos ? meals : await resolveMealPhotos(meals);

    res.json({ meals: resolvedMeals.map(maskMeal) });
  } catch (err) {
    console.error('[trainer/clients/:clientId/stats-range]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/trainer/alerts — dashboard alerts
// NOTE: meal lookups here stay on chatId (batch OR-of-ORs for N clients adds complexity; safe to harden later)
router.get('/alerts', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const userId = req.userId ?? null;
  try {
    const trainerProfile = await findTrainerProfile(chatId, userId);
    if (!trainerProfile || trainerProfile.verificationStatus !== 'verified') {
      res.status(403).json({ error: 'Not a verified trainer' });
      return;
    }
    const trainerUserId = trainerProfile.userId;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const alertLinkWhere: any = trainerUserId
      ? { OR: [{ trainerId: trainerProfile.chatId }, { trainerUserId }], status: 'active' }
      : { trainerId: trainerProfile.chatId, status: 'active' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const links = await (prisma.trainerClientLink.findMany as (args: any) => Promise<any[]>)({ where: alertLinkWhere });
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
  const userId = req.userId ?? null;
  try {
    const trainerProfile = await findTrainerProfile(chatId, userId);
    // OR on trainerUserId so rewards created from any platform are visible
    const trainerUserId = trainerProfile?.userId ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rewardWhere: any = trainerUserId
      ? { OR: [{ trainerId: trainerProfile!.chatId }, { trainerUserId }] }
      : { trainerId: chatId };
    const rewards = await prisma.trainerReward.findMany({
      where: rewardWhere,
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

// ─── Payout requests ──────────────────────────────────────────────────────────

const MIN_PAYOUT_RUB = 2500;

// Stale-cast DB accessor for PayoutRequest (not yet in generated client)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const payoutRequestDb = (prisma as unknown as { payoutRequest: any }).payoutRequest as {
  findFirst(args: { where: object; orderBy?: object }): Promise<{
    id: number; trainerId: string; trainerUserId: string | null;
    amountRub: number; requisitesSnapshot: string; rewardIds: string;
    status: string; note: string | null; createdAt: Date; updatedAt: Date;
  } | null>;
  create(args: { data: object }): Promise<{ id: number; status: string; amountRub: number; createdAt: Date }>;
};

// GET /api/trainer/payout-request — current pending/approved request for this trainer
router.get('/payout-request', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const userId = req.userId ?? null;
  try {
    const tp = await findTrainerProfile(chatId, userId);
    if (!tp) { res.status(403).json({ error: 'Trainer profile not found' }); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = userId
      ? { OR: [{ trainerId: tp.chatId }, { trainerUserId: userId }], status: { in: ['pending', 'approved'] } }
      : { trainerId: tp.chatId, status: { in: ['pending', 'approved'] } };

    const existing = await payoutRequestDb.findFirst({ where, orderBy: { createdAt: 'desc' } });
    res.json({
      request: existing ? {
        id: existing.id,
        amountRub: existing.amountRub,
        status: existing.status,
        requisitesSnapshot: JSON.parse(existing.requisitesSnapshot),
        rewardIds: JSON.parse(existing.rewardIds),
        createdAt: existing.createdAt.toISOString(),
      } : null,
    });
  } catch (err) {
    console.error('[trainer/payout-request GET]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/trainer/payout-request — create a withdrawal request
router.post('/payout-request', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const userId = req.userId ?? null;
  try {
    const tp = await findTrainerProfile(chatId, userId);
    if (!tp) { res.status(403).json({ error: 'Trainer profile not found' }); return; }
    const trainerUserId = tp.userId ?? null;

    // 1. Fetch requisites — must be filled
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trainerFull = await (prisma.trainerProfile.findUnique as (args: any) => Promise<{ requisitesData: string | null } | null>)({
      where: { chatId: tp.chatId },
      select: { requisitesData: true },
    });
    if (!trainerFull?.requisitesData) {
      res.status(422).json({ error: 'Сначала заполните реквизиты', code: 'no_requisites' });
      return;
    }
    let requisites: Record<string, string>;
    try { requisites = JSON.parse(trainerFull.requisitesData); } catch {
      res.status(422).json({ error: 'Реквизиты повреждены, заполните заново', code: 'no_requisites' });
      return;
    }
    // Require at least companyName/inn and accountNumber to be non-empty
    if (!requisites['inn'] || !requisites['accountNumber']) {
      res.status(422).json({ error: 'Реквизиты заполнены не полностью. Укажите минимум ИНН и номер расчётного счёта', code: 'incomplete_requisites' });
      return;
    }

    // 2. Fetch available rewards
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rewardWhere: any = trainerUserId
      ? { OR: [{ trainerId: tp.chatId }, { trainerUserId }], status: 'available' }
      : { trainerId: tp.chatId, status: 'available' };
    const availableRewards = await prisma.trainerReward.findMany({ where: rewardWhere });
    const totalAvailable = availableRewards.reduce((s, r) => s + r.amountRub, 0);

    if (totalAvailable < MIN_PAYOUT_RUB) {
      res.status(422).json({
        error: `Минимальная сумма для вывода — ${MIN_PAYOUT_RUB.toLocaleString('ru')} ₽. Сейчас доступно ${Math.floor(totalAvailable).toLocaleString('ru')} ₽`,
        code: 'below_minimum',
        available: totalAvailable,
      });
      return;
    }

    // 3. Check for existing active request (dedup)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dupWhere: any = trainerUserId
      ? { OR: [{ trainerId: tp.chatId }, { trainerUserId }], status: { in: ['pending', 'approved'] } }
      : { trainerId: tp.chatId, status: { in: ['pending', 'approved'] } };
    const duplicate = await payoutRequestDb.findFirst({ where: dupWhere });
    if (duplicate) {
      res.status(409).json({ error: 'У вас уже есть активная заявка на вывод', code: 'duplicate_request', requestId: duplicate.id });
      return;
    }

    // 4. Create PayoutRequest and atomically move rewards to 'requested'
    const rewardIds = availableRewards.map(r => r.id);
    const created = await payoutRequestDb.create({
      data: {
        trainerId: tp.chatId,
        trainerUserId,
        amountRub: totalAvailable,
        requisitesSnapshot: JSON.stringify(requisites),
        rewardIds: JSON.stringify(rewardIds),
        status: 'pending',
      },
    });

    // Mark rewards as 'requested' with a link to the new PayoutRequest
    await (prisma.trainerReward.updateMany as (args: any) => Promise<any>)({
      where: { id: { in: rewardIds } },
      data: { status: 'requested', payoutRequestId: created.id },
    });

    console.log(`[trainer/payout-request] created id=${created.id} trainer=${tp.chatId} amount=${totalAvailable} rewards=${rewardIds.length}`);

    res.json({
      ok: true,
      request: {
        id: created.id,
        amountRub: created.amountRub,
        status: created.status,
        createdAt: created.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('[trainer/payout-request POST]', err);
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
    const comma = fileData.indexOf(',');
    const b64 = fileData.slice(comma + 1);
    const fileBuffer = Buffer.from(b64, 'base64');
    const sizeBytes = fileBuffer.length;

    // Try R2 upload. If R2 is not configured, fall back to legacy base64 storage.
    try {
      // Create the DB record first to get a stable id for the R2 key
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const draft = await (prisma.trainerDocument as any).create({
        data: { chatId, docType, title: title?.trim() || null, fileData: null, mimeType, sizeBytes },
      }) as { id: number; docType: string; title: string | null; mimeType: string; createdAt: Date };

      const ext = mimeToExt(mimeType);
      const key = trainerDocKey(chatId, draft.id, ext);

      try {
        await uploadObject(key, fileBuffer, mimeType);
        // Update the record with the R2 key
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma.trainerDocument as any).update({
          where: { id: draft.id },
          data: { storageKey: key, storageProvider: 'r2' },
        });
        res.json({ document: { id: draft.id, docType: draft.docType, title: draft.title, mimeType: draft.mimeType, createdAt: draft.createdAt } });
        return;
      } catch (r2Err) {
        if (r2Err instanceof StorageNotConfiguredError) {
          // R2 not configured — store base64 in the existing record and continue
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (prisma.trainerDocument as any).update({
            where: { id: draft.id },
            data: { fileData },
          });
          res.json({ document: { id: draft.id, docType: draft.docType, title: draft.title, mimeType: draft.mimeType, createdAt: draft.createdAt } });
          return;
        }
        // R2 is configured but upload failed — clean up the draft record and return error
        await prisma.trainerDocument.delete({ where: { id: draft.id } });
        console.error('[trainer/documents POST] R2 upload failed', r2Err);
        res.status(502).json({ error: 'File upload failed, please try again' });
        return;
      }
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = await (prisma.trainerDocument as any).findFirst({
      where: { id, chatId },
      select: { id: true, storageKey: true },
    }) as { id: number; storageKey: string | null } | null;
    if (!doc) { res.status(404).json({ error: 'Not found' }); return; }

    // Delete R2 object before removing the DB record (fire-and-forget on error)
    if (doc.storageKey) {
      deleteObject(doc.storageKey).catch(err =>
        console.error('[trainer/documents DELETE] R2 delete failed', err)
      );
    }

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = await (prisma.trainerDocument as any).findFirst({
      where: { id, chatId },
      select: { fileData: true, mimeType: true, storageKey: true },
    }) as { fileData: string | null; mimeType: string; storageKey: string | null } | null;
    if (!doc) { res.status(404).json({ error: 'Not found' }); return; }

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', 'inline');

    if (doc.storageKey) {
      // R2-backed record
      const buffer = await getObjectBuffer(doc.storageKey);
      res.send(buffer);
    } else if (doc.fileData) {
      // Legacy base64 record
      const comma = doc.fileData.indexOf(',');
      const buffer = Buffer.from(doc.fileData.slice(comma + 1), 'base64');
      res.send(buffer);
    } else {
      res.status(404).json({ error: 'File data not found' });
    }
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/trainer/requisites — load saved requisites for this trainer/expert
router.get('/requisites', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const userId = req.userId ?? null;
  try {
    const tp = await findTrainerProfile(chatId, userId);
    if (!tp) { res.status(403).json({ error: 'Trainer profile not found' }); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const full = await (prisma.trainerProfile.findUnique as (args: any) => Promise<{ requisitesData: string | null } | null>)({
      where: { chatId: tp.chatId },
      select: { requisitesData: true },
    });
    const data = full?.requisitesData ? JSON.parse(full.requisitesData) : null;
    res.json({ requisites: data });
  } catch (err) {
    console.error('[trainer/requisites GET]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/trainer/requisites — save requisites
router.patch('/requisites', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const userId = req.userId ?? null;
  const { requisites } = req.body as { requisites: unknown };
  if (!requisites || typeof requisites !== 'object') {
    res.status(400).json({ error: 'requisites object required' });
    return;
  }
  try {
    const tp = await findTrainerProfile(chatId, userId);
    if (!tp) { res.status(403).json({ error: 'Trainer profile not found' }); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.trainerProfile.update as (args: any) => Promise<unknown>)({
      where: { chatId: tp.chatId },
      data: { requisitesData: JSON.stringify(requisites) },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[trainer/requisites PATCH]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/trainer/requisites/recognize — AI recognition from photo/document
router.post('/requisites/recognize', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const userId = req.userId ?? null;
  const { imageData } = req.body as { imageData?: string };
  if (!imageData) { res.status(400).json({ error: 'imageData required' }); return; }
  if (!validateImageDataUrl(imageData, PHOTO_MAX_BYTES)) {
    res.status(400).json({ error: 'Invalid imageData' }); return;
  }
  try {
    const tp = await findTrainerProfile(chatId, userId);
    if (!tp) { res.status(403).json({ error: 'Access denied' }); return; }
    const result = await recognizeRequisites(imageData, { userId: req.userId, chatId: req.chatId, scenario: 'requisites_ocr' });
    res.json({ recognized: result });
  } catch (err) {
    console.error('[trainer/requisites/recognize]', err);
    res.status(500).json({ error: 'Recognition failed' });
  }
});

export default router;
