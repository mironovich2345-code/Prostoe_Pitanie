import { Router } from 'express';
import { requireWebAuth, WebAuthRequest } from '../middleware/webAuth';
import prisma from '../../db';

const router = Router();
router.use(requireWebAuth as import('express').RequestHandler);

async function collectChatIds(userId: string): Promise<string[]> {
  const identities = await prisma.userIdentity.findMany({
    where: { userId },
    select: { platform: true, platformId: true },
  });
  const set = new Set<string>([`web_${userId}`]);
  for (const id of identities) {
    if (id.platform === 'telegram' || id.platform === 'max') {
      set.add(id.platformId);
    }
  }
  return [...set];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ownerFilter(userId: string, chatIds: string[]): any {
  return { OR: [{ userId }, { chatId: { in: chatIds }, userId: null }] };
}

async function updateCurrentWeight(
  userId: string,
  chatIdFromSession: string | undefined,
  weightKg: number,
): Promise<void> {
  const syntheticChatId = chatIdFromSession ?? `web_${userId}`;

  // Find profile by userId (fastest path for linked/phone accounts).
  // findFirst accepts userId in OR without cast; plain object form also works.
  const byUserId = await prisma.userProfile.findFirst({
    where: { OR: [{ userId }] },
    select: { chatId: true },
  });
  if (byUserId) {
    await prisma.userProfile.update({
      where: { chatId: byUserId.chatId },
      data: { currentWeightKg: weightKg },
    });
    return;
  }

  // No profile found by userId → upsert by syntheticChatId.
  // cast needed because userId may not be in generated Prisma types for create.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.userProfile as any).upsert({
    where: { chatId: syntheticChatId },
    update: { currentWeightKg: weightKg },
    create: { chatId: syntheticChatId, userId, currentWeightKg: weightKg },
  });
}

// GET /api/web/weight?limit=30
router.get('/', async (req: WebAuthRequest, res) => {
  const { userId, chatId } = req.webUser!;

  const rawLimit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 30;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 30;

  try {
    const chatIds = await collectChatIds(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = ownerFilter(userId, chatIds);

    const [profile, entries] = await Promise.all([
      prisma.userProfile.findFirst({
        where: { OR: [{ userId }, ...(chatId ? [{ chatId }] : [])] },
        select: {
          currentWeightKg: true,
          desiredWeightKg: true,
          heightCm: true,
          goalType: true,
          goalStartWeightKg: true,
        },
      }),
      prisma.weightEntry.findMany({
        where: filter,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }) as Promise<Array<{ id: number; weightKg: number; createdAt: Date }>>,
    ]);

    // Progress calculation — requires desiredWeightKg and at least one entry
    let progress: {
      startWeightKg: number;
      currentWeightKg: number;
      desiredWeightKg: number;
      totalDeltaKg: number;
      doneDeltaKg: number;
      progressPercent: number;
    } | null = null;

    if (profile?.desiredWeightKg != null && entries.length > 0) {
      const desiredWeightKg = profile.desiredWeightKg;
      const currentWeightKg = profile.currentWeightKg ?? entries[0].weightKg;
      const startWeightKg   = profile.goalStartWeightKg ?? entries[entries.length - 1].weightKg;
      const totalDeltaKg    = Math.round((desiredWeightKg - startWeightKg) * 10) / 10;
      const doneDeltaKg     = Math.round((currentWeightKg - startWeightKg) * 10) / 10;

      const progressPercent = Math.abs(totalDeltaKg) < 0.01
        ? 100
        : Math.min(100, Math.max(0, Math.round(
            (Math.abs(doneDeltaKg) / Math.abs(totalDeltaKg)) * 100,
          )));

      progress = {
        startWeightKg:   Math.round(startWeightKg   * 10) / 10,
        currentWeightKg: Math.round(currentWeightKg * 10) / 10,
        desiredWeightKg: Math.round(desiredWeightKg * 10) / 10,
        totalDeltaKg,
        doneDeltaKg,
        progressPercent,
      };
    }

    res.json({
      ok: true,
      profile: profile ? {
        currentWeightKg: profile.currentWeightKg ?? null,
        desiredWeightKg: profile.desiredWeightKg ?? null,
        heightCm:        profile.heightCm        ?? null,
        goalType:        profile.goalType        ?? null,
      } : null,
      entries: entries.map(e => ({
        id:         e.id,
        weightKg:   e.weightKg,
        measuredAt: e.createdAt,
        createdAt:  e.createdAt,
      })),
      progress,
    });
  } catch (err) {
    console.error('[web/weight GET] failed', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// POST /api/web/weight
router.post('/', async (req: WebAuthRequest, res) => {
  const { userId, chatId } = req.webUser!;
  const syntheticChatId = chatId ?? `web_${userId}`;
  const body = req.body as Record<string, unknown>;

  const w = Number(body.weightKg);
  if (!Number.isFinite(w) || w < 30 || w > 300) {
    res.status(400).json({ ok: false, error: 'invalid_weight' });
    return;
  }

  let measuredAt: Date | undefined;
  if (typeof body.measuredAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.measuredAt)) {
    const d = new Date(`${body.measuredAt}T12:00:00.000Z`);
    if (!isNaN(d.getTime())) measuredAt = d;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createData: any = {
      chatId: syntheticChatId,
      userId,
      weightKg: w,
      ...(measuredAt ? { createdAt: measuredAt } : {}),
    };

    const [entry] = await Promise.all([
      prisma.weightEntry.create({ data: createData }) as Promise<{ id: number; weightKg: number; createdAt: Date }>,
      updateCurrentWeight(userId, chatId, w),
    ]);

    res.json({
      ok: true,
      entry: {
        id:         entry.id,
        weightKg:   entry.weightKg,
        measuredAt: entry.createdAt,
        createdAt:  entry.createdAt,
      },
    });
  } catch (err) {
    console.error('[web/weight POST] failed', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// DELETE /api/web/weight/:id
router.delete('/:id', async (req: WebAuthRequest, res) => {
  const { userId, chatId } = req.webUser!;

  const entryId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(entryId) || entryId <= 0) {
    res.status(400).json({ ok: false, error: 'invalid_id' });
    return;
  }

  try {
    const chatIds = await collectChatIds(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereOwner: any = { id: entryId, ...ownerFilter(userId, chatIds) };

    const entry = await prisma.weightEntry.findFirst({
      where: whereOwner,
      select: { id: true },
    }) as { id: number } | null;

    if (!entry) {
      res.status(404).json({ ok: false, error: 'not_found' });
      return;
    }

    await prisma.weightEntry.delete({ where: { id: entryId } });

    // Update currentWeightKg to the latest remaining entry, if any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const remainingFilter: any = ownerFilter(userId, chatIds);
    const latest = await prisma.weightEntry.findFirst({
      where: remainingFilter,
      orderBy: { createdAt: 'desc' },
      select: { weightKg: true },
    }) as { weightKg: number } | null;

    if (latest) {
      await updateCurrentWeight(userId, chatId, latest.weightKg);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[web/weight DELETE] failed', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;
