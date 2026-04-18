import { Router, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';
import { getAiCostLogDbFull } from '../../ai/aiCost';
import { fetchYooKassaPayment } from '../../services/yookassaService';
import { activateSubscription, type PlanId } from '../../services/subscriptionService';
import { normalizeOfferType } from '../../utils/referral';

const router = Router();

// ─── Admin access guard ─────────────────────────────────────────────────────

function getAdminIds(): Set<string> {
  const raw = process.env.ADMIN_USER_IDS ?? '';
  return new Set(
    raw.split(',').map(s => s.trim()).filter(Boolean)
  );
}

function adminOnly(req: AuthRequest, res: Response, next: NextFunction): void {
  const userId = req.chatId;
  if (!userId || !getAdminIds().has(userId)) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

router.use(adminOnly as import('express').RequestHandler);

// ─── GET /api/admin/applications — pending trainer applications ─────────────

router.get('/applications', async (_req: AuthRequest, res: Response) => {
  try {
    const pending = await prisma.trainerProfile.findMany({
      where: { verificationStatus: 'pending' },
      orderBy: { appliedAt: 'desc' },
      select: {
        chatId: true,
        fullName: true,
        socialLink: true,
        specialization: true,
        bio: true,
        verificationPhotoData: true,
        appliedAt: true,
        verificationStatus: true,
      },
    });
    res.json({ applications: pending });
  } catch (err) {
    console.error('[admin/applications]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/admin/applications/:chatId/approve ──────────────────────────

router.post('/applications/:chatId/approve', async (req: AuthRequest, res: Response) => {
  const { chatId } = req.params as { chatId: string };
  try {
    // Preserve existing referralCode if already set; generate one otherwise.
    // Without a referralCode the expert cannot use the partnership/referral features.
    const [existing, identity] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma.trainerProfile.findUnique as (args: any) => Promise<{ referralCode: string | null; userId: string | null } | null>)({
        where: { chatId },
        select: { referralCode: true, userId: true },
      }),
      // Look up platform-independent userId so it gets written to TrainerProfile.
      // If the expert later logs in from MAX, we can find their profile via userId.
      (prisma as unknown as { userIdentity: { findFirst(args: unknown): Promise<{ userId: string } | null> } })
        .userIdentity.findFirst({
          where: { platformId: chatId },
          select: { userId: true },
        }),
    ]);
    const referralCode = existing?.referralCode ??
      Math.random().toString(36).substring(2, 10).toUpperCase();
    // Backfill userId only if not already set (prevents overwriting a correct value)
    const resolvedUserId = existing?.userId ?? identity?.userId ?? null;

    const updated = await prisma.trainerProfile.update({
      where: { chatId },
      data: {
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        rejectedAt: null,
        verificationPhotoData: null,
        referralCode,
        ...(resolvedUserId ? { userId: resolvedUserId } : {}),
      },
    });
    res.json({ ok: true, verificationStatus: updated.verificationStatus });
  } catch (err) {
    console.error('[admin/applications/approve]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/admin/applications/:chatId/reject ───────────────────────────

router.post('/applications/:chatId/reject', async (req: AuthRequest, res: Response) => {
  const { chatId } = req.params as { chatId: string };
  const { note } = req.body as { note?: string };
  try {
    const updated = await prisma.trainerProfile.update({
      where: { chatId },
      data: { verificationStatus: 'rejected', rejectedAt: new Date(), verificationNote: note?.trim() || null, verificationPhotoData: null },
    });
    res.json({ ok: true, verificationStatus: updated.verificationStatus });
  } catch (err) {
    console.error('[admin/applications/reject]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/admin/experts — all verified trainers/companies ───────────────

router.get('/experts', async (_req: AuthRequest, res: Response) => {
  try {
    const experts = await prisma.trainerProfile.findMany({
      where: { verificationStatus: 'verified' },
      orderBy: { verifiedAt: 'desc' },
      select: {
        chatId: true,
        fullName: true,
        specialization: true,
        verifiedAt: true,
        socialLink: true,
        verificationStatus: true,
      },
    });
    res.json({ experts });
  } catch (err) {
    console.error('[admin/experts]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/admin/experts/:chatId/revoke — revoke verification ──────────

router.post('/experts/:chatId/revoke', async (req: AuthRequest, res: Response) => {
  const { chatId } = req.params as { chatId: string };
  try {
    const updated = await prisma.trainerProfile.update({
      where: { chatId },
      data: { verificationStatus: 'blocked', blockedAt: new Date() },
    });
    res.json({ ok: true, verificationStatus: updated.verificationStatus });
  } catch (err) {
    console.error('[admin/experts/revoke]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/admin/payouts — all trainer rewards ──────────────────────────

router.get('/payouts', async (_req: AuthRequest, res: Response) => {
  try {
    const rewards = await prisma.trainerReward.findMany({
      orderBy: { createdAt: 'desc' },
    });
    // Attach trainer name for display
    const trainerIds = [...new Set(rewards.map(r => r.trainerId))];
    const trainers = trainerIds.length > 0
      ? await prisma.trainerProfile.findMany({
          where: { chatId: { in: trainerIds } },
          select: { chatId: true, fullName: true },
        })
      : [];
    const nameMap = Object.fromEntries(trainers.map(t => [t.chatId, t.fullName]));
    const enriched = rewards.map(r => ({
      ...r,
      trainerName: nameMap[r.trainerId] ?? null,
      holdUntil: r.holdUntil?.toISOString() ?? null,
      paidAt: r.paidAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
    res.json({ payouts: enriched });
  } catch (err) {
    console.error('[admin/payouts]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/admin/payouts/:id/status — update reward status ────────────

router.patch('/payouts/:id/status', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params['id'] as string, 10);
  const { status } = req.body as { status?: string };
  const VALID = ['pending_hold', 'available', 'paid_out', 'cancelled'];
  if (!status || !VALID.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${VALID.join(', ')}` });
    return;
  }
  try {
    const updated = await prisma.trainerReward.update({
      where: { id },
      data: {
        status,
        paidAt: status === 'paid_out' ? new Date() : undefined,
      },
    });
    res.json({ ok: true, reward: { id: updated.id, status: updated.status } });
  } catch (err) {
    console.error('[admin/payouts/status]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/admin/rewards/:trainerId — rewards for specific trainer ───────

router.get('/rewards/:trainerId', async (req: AuthRequest, res: Response) => {
  const { trainerId } = req.params as { trainerId: string };
  try {
    const rewards = await prisma.trainerReward.findMany({
      where: { trainerId },
      orderBy: { createdAt: 'desc' },
    });
    const summary = {
      total: rewards.reduce((s, r) => s + r.amountRub, 0),
      available: rewards.filter(r => r.status === 'available').reduce((s, r) => s + r.amountRub, 0),
      paidOut: rewards.filter(r => r.status === 'paid_out').reduce((s, r) => s + r.amountRub, 0),
    };
    const enriched = rewards.map(r => ({
      ...r,
      holdUntil: r.holdUntil?.toISOString() ?? null,
      paidAt: r.paidAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
    res.json({ rewards: enriched, summary });
  } catch (err) {
    console.error('[admin/rewards/:trainerId]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/admin/stats — platform statistics ────────────────────────────

// Stale Prisma casts for tables not yet in the generated client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const statsPaymentDb = (prisma as unknown as { payment: any }).payment as {
  aggregate(args: object): Promise<{ _sum: { amountRub: number | null } }>;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const statsUserSubDb = (prisma as unknown as { userSubscription: any }).userSubscription as {
  count(args?: object): Promise<number>;
  groupBy(args: object): Promise<Array<{ planId: string; _count: { _all: number } }>>;
};

router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now); startOfMonth.setDate(now.getDate() - 30);

    const [
      totalUsers,
      newUsersToday,
      newUsersWeek,
      newUsersMonth,
      totalVerified,
      newExpertsToday,
      newExpertsWeek,
      newExpertsMonth,
      subsTotal,
      subsActive,
      subsExpired,
      subsNeverPaid,
      // Payment revenue from the Payment table (succeeded only)
      payRevToday,
      payRevWeek,
      payRevMonth,
      // AutoRenew counts from UserSubscription (canonical source)
      autoRenewOn,
      autoRenewOff,
    ] = await Promise.all([
      prisma.userProfile.count(),
      prisma.userProfile.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.userProfile.count({ where: { createdAt: { gte: startOfWeek } } }),
      prisma.userProfile.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.trainerProfile.count({ where: { verificationStatus: 'verified' } }),
      prisma.trainerProfile.count({ where: { verificationStatus: 'verified', verifiedAt: { gte: startOfToday } } }),
      prisma.trainerProfile.count({ where: { verificationStatus: 'verified', verifiedAt: { gte: startOfWeek } } }),
      prisma.trainerProfile.count({ where: { verificationStatus: 'verified', verifiedAt: { gte: startOfMonth } } }),
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: { in: ['active', 'trial'] } } }),
      prisma.subscription.count({ where: { status: { in: ['expired', 'past_due', 'canceled'] } } }),
      // Users who exist but have no subscription row at all
      prisma.userProfile.count({
        where: { chatId: { notIn: (await prisma.subscription.findMany({ select: { chatId: true } })).map(s => s.chatId) } },
      }),
      // Payment revenue: sum amountRub where status='succeeded', by time window
      statsPaymentDb.aggregate({ where: { status: 'succeeded', createdAt: { gte: startOfToday } }, _sum: { amountRub: true } } as object),
      statsPaymentDb.aggregate({ where: { status: 'succeeded', createdAt: { gte: startOfWeek } },  _sum: { amountRub: true } } as object),
      statsPaymentDb.aggregate({ where: { status: 'succeeded', createdAt: { gte: startOfMonth } }, _sum: { amountRub: true } } as object),
      // AutoRenew: count from UserSubscription (1 row per user, canonical)
      statsUserSubDb.count({ where: { autoRenew: true } } as object),
      statsUserSubDb.count({ where: { autoRenew: false } } as object),
    ]);

    // Experts vs Companies among verified
    const verifiedProfiles = await prisma.trainerProfile.findMany({
      where: { verificationStatus: 'verified' },
      select: { specialization: true },
    });
    const expertCount = verifiedProfiles.filter(p => p.specialization !== 'Компания').length;
    const companyCount = verifiedProfiles.filter(p => p.specialization === 'Компания').length;

    // Payment counts — proxy via TrainerReward (real payment events)
    const [paymentsToday, paymentsWeek, paymentsMonth, paymentsTotal] = await Promise.all([
      prisma.trainerReward.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.trainerReward.count({ where: { createdAt: { gte: startOfWeek } } }),
      prisma.trainerReward.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.trainerReward.count(),
    ]);

    // Plan breakdown: group active/trial UserSubscriptions by planId
    // 'pro' | 'intro' (Pro 3-day) → Pro; 'optimal' | 'client_monthly' → Optimal
    // Free = all other users (no active UserSubscription)
    const activePlanGroups = await statsUserSubDb.groupBy({
      by: ['planId'],
      where: { status: { in: ['active', 'trial'] } },
      _count: { _all: true },
    } as object);
    type PlanGroup = { planId: string; _count: { _all: number } };
    const proUsersCount = (activePlanGroups as PlanGroup[])
      .filter(g => g.planId === 'pro' || g.planId === 'intro')
      .reduce((s, g) => s + g._count._all, 0);
    const optimalUsersCount = (activePlanGroups as PlanGroup[])
      .filter(g => g.planId === 'optimal' || g.planId === 'client_monthly')
      .reduce((s, g) => s + g._count._all, 0);
    // freeUsersCount = all users minus those on an active paid plan in UserSubscription
    // (users with only a legacy Subscription row are counted as free in this metric)
    const freeUsersCount = totalUsers - proUsersCount - optimalUsersCount;

    // AI costs — no historical data; structure prepared for future tracking via AiCostLog model
    // Currently 0 / no data until AiCostLog migration is applied
    const aiCosts = { today: null as number | null, week: null as number | null, month: null as number | null, note: 'Учёт ведётся с момента внедрения' };

    res.json({
      users: {
        total: totalUsers,
        experts: expertCount,
        companies: companyCount,
        clients: totalUsers - totalVerified,
        newToday: newUsersToday,
        newWeek: newUsersWeek,
        newMonth: newUsersMonth,
      },
      experts: {
        total: totalVerified,
        newToday: newExpertsToday,
        newWeek: newExpertsWeek,
        newMonth: newExpertsMonth,
      },
      subscriptions: {
        total: subsTotal,
        active: subsActive,
        expired: subsExpired,
        neverPaid: subsNeverPaid,
      },
      payments: {
        total: paymentsTotal,
        today: paymentsToday,
        week: paymentsWeek,
        month: paymentsMonth,
      },
      // ── New fields ──
      paymentRevenue: {
        today: Math.round(payRevToday._sum.amountRub ?? 0),
        week:  Math.round(payRevWeek._sum.amountRub  ?? 0),
        month: Math.round(payRevMonth._sum.amountRub ?? 0),
      },
      autoRenew: {
        on:  autoRenewOn,
        off: autoRenewOff,
      },
      plans: {
        free:    freeUsersCount,
        optimal: optimalUsersCount,
        pro:     proUsersCount,
      },
      aiCosts,
    });
  } catch (err) {
    console.error('[admin/stats]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/admin/user?q= — lookup user by chatId or @username ─────────────

router.get('/user', async (req: AuthRequest, res: Response) => {
  const q = String(req.query['q'] ?? '').trim();
  if (!q) { res.status(400).json({ error: 'q is required' }); return; }

  try {
    // Resolve profile: @username → telegramUsername field; otherwise chatId
    const isUsername = q.startsWith('@');
    const profile = await prisma.userProfile.findFirst({
      where: isUsername
        ? { telegramUsername: { equals: q.slice(1), mode: 'insensitive' } }
        : { chatId: q },
      select: {
        chatId: true, userId: true, preferredName: true, telegramUsername: true,
        heightCm: true, currentWeightKg: true, goalType: true,
        dailyCaloriesKcal: true, createdAt: true,
      },
    });

    if (!profile) { res.json({ found: false }); return; }

    const chatId = profile.chatId;
    const userId = profile.userId ?? null;

    const [sub, trainerProfile, asClientLinks, asTrainerLinks] = await Promise.all([
      prisma.subscription.findUnique({
        where: { chatId },
        select: { planId: true, status: true, currentPeriodEnd: true, trialEndsAt: true },
      }),
      prisma.trainerProfile.findUnique({
        where: { chatId },
        select: { fullName: true, verificationStatus: true, specialization: true, bio: true, appliedAt: true, verifiedAt: true },
      }),
      prisma.trainerClientLink.findMany({
        where: { clientId: chatId, status: 'active' },
        select: { trainerId: true, status: true, connectedAt: true, clientAlias: true },
        take: 10,
      }),
      prisma.trainerClientLink.findMany({
        where: { trainerId: chatId, status: 'active' },
        select: { clientId: true, clientAlias: true, status: true, connectedAt: true },
        take: 10,
      }),
    ]);

    // Enrich trainer names for asClient links
    const trainerIds = asClientLinks.map(l => l.trainerId);
    const trainerProfiles = trainerIds.length > 0
      ? await prisma.trainerProfile.findMany({
          where: { chatId: { in: trainerIds } },
          select: { chatId: true, fullName: true },
        })
      : [];
    const trainerNameMap = Object.fromEntries(trainerProfiles.map(t => [t.chatId, t.fullName]));

    res.json({
      found: true,
      chatId,
      userId,
      profile: {
        preferredName: profile.preferredName,
        telegramUsername: profile.telegramUsername,
        heightCm: profile.heightCm,
        currentWeightKg: profile.currentWeightKg,
        goalType: profile.goalType,
        dailyCaloriesKcal: profile.dailyCaloriesKcal,
        createdAt: profile.createdAt.toISOString(),
      },
      subscription: sub ? {
        planId: sub.planId,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
        trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
      } : null,
      trainerProfile: trainerProfile ? {
        fullName: trainerProfile.fullName,
        verificationStatus: trainerProfile.verificationStatus,
        specialization: trainerProfile.specialization,
        bio: trainerProfile.bio,
        appliedAt: trainerProfile.appliedAt?.toISOString() ?? null,
        verifiedAt: trainerProfile.verifiedAt?.toISOString() ?? null,
      } : null,
      asClient: asClientLinks.map(l => ({
        trainerId: l.trainerId,
        trainerName: trainerNameMap[l.trainerId] ?? null,
        connectedAt: l.connectedAt.toISOString(),
      })),
      asTrainer: asTrainerLinks.map(l => ({
        clientId: l.clientId,
        clientAlias: l.clientAlias,
        connectedAt: l.connectedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('[admin/user GET]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/admin/subscriptions/:chatId — lookup user subscription ─────────

router.get('/subscriptions/:chatId', async (req: AuthRequest, res: Response) => {
  const { chatId } = req.params as { chatId: string };
  try {
    const [profile, legacySub] = await Promise.all([
      prisma.userProfile.findUnique({ where: { chatId }, select: { userId: true } }),
      prisma.subscription.findUnique({ where: { chatId } }),
    ]);

    const userId = profile?.userId ?? null;
    let userSub = null;
    if (userId) {
      const us = await prisma.userSubscription.findUnique({ where: { userId } });
      if (us) {
        userSub = {
          planId: us.planId,
          status: us.status,
          currentPeriodEnd: us.currentPeriodEnd?.toISOString() ?? null,
          trialEndsAt: us.trialEndsAt?.toISOString() ?? null,
          autoRenew: us.autoRenew,
          createdAt: us.createdAt.toISOString(),
        };
      }
    }

    res.json({
      chatId,
      userId,
      legacySub: legacySub ? {
        planId: legacySub.planId,
        status: legacySub.status,
        currentPeriodEnd: legacySub.currentPeriodEnd?.toISOString() ?? null,
        trialEndsAt: legacySub.trialEndsAt?.toISOString() ?? null,
        autoRenew: legacySub.autoRenew,
        createdAt: legacySub.createdAt.toISOString(),
      } : null,
      userSub,
    });
  } catch (err) {
    console.error('[admin/subscriptions GET]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/admin/subscriptions/:chatId — manually update subscription ───

router.patch('/subscriptions/:chatId', async (req: AuthRequest, res: Response) => {
  const { chatId } = req.params as { chatId: string };
  const { action, days, plan } = req.body as { action?: string; days?: number; plan?: string };
  const VALID_ACTIONS = ['trial', 'monthly', 'extend', 'cancel', 'expire'];
  const VALID_PLANS   = ['intro', 'optimal', 'pro'];
  if (!action || !VALID_ACTIONS.includes(action)) {
    res.status(400).json({ error: `action must be one of: ${VALID_ACTIONS.join(', ')}` });
    return;
  }
  // Resolve plan id: intro → 'intro', optimal → 'optimal', pro → 'pro'; default optimal
  const resolvedPlan = VALID_PLANS.includes(plan ?? '') ? (plan as string) : 'optimal';

  const extendDays = typeof days === 'number' && days > 0 && days <= 365 ? days : 30;

  try {
    const profile = await prisma.userProfile.findUnique({ where: { chatId }, select: { userId: true } });
    const userId = profile?.userId ?? null;

    const now = new Date();
    const legacyData: Record<string, unknown> = {};
    const userSubData: Record<string, unknown> = {};

    if (action === 'trial') {
      // Trial period with specified plan. For Pro: intro 3 days / 1 ₽ (use extendDays=3).
      // Optimal has no intro — use 'monthly' action instead.
      const trialEnd = new Date(now); trialEnd.setDate(trialEnd.getDate() + extendDays);
      Object.assign(legacyData, { planId: resolvedPlan, status: 'trial', trialEndsAt: trialEnd, currentPeriodEnd: null, autoRenew: false });
      Object.assign(userSubData, { planId: resolvedPlan, status: 'trial', trialEndsAt: trialEnd, currentPeriodEnd: null, autoRenew: false });

    } else if (action === 'monthly') {
      // Full period activation with specified plan
      const periodEnd = new Date(now); periodEnd.setDate(periodEnd.getDate() + extendDays);
      Object.assign(legacyData, { planId: resolvedPlan, status: 'active', trialEndsAt: null, currentPeriodEnd: periodEnd, autoRenew: false });
      Object.assign(userSubData, { planId: resolvedPlan, status: 'active', trialEndsAt: null, currentPeriodEnd: periodEnd, autoRenew: false });

    } else if (action === 'extend') {
      const [existingLegacy, existingUserSub] = await Promise.all([
        prisma.subscription.findUnique({ where: { chatId } }),
        userId ? prisma.userSubscription.findUnique({ where: { userId } }) : Promise.resolve(null),
      ]);
      const legacyBase = existingLegacy?.currentPeriodEnd ?? existingLegacy?.trialEndsAt ?? now;
      const legacyNewEnd = new Date(legacyBase); legacyNewEnd.setDate(legacyNewEnd.getDate() + extendDays);
      if (existingLegacy?.status === 'trial') {
        legacyData['trialEndsAt'] = legacyNewEnd;
      } else {
        legacyData['currentPeriodEnd'] = legacyNewEnd;
      }
      const userBase = existingUserSub?.currentPeriodEnd ?? existingUserSub?.trialEndsAt ?? now;
      const userNewEnd = new Date(userBase); userNewEnd.setDate(userNewEnd.getDate() + extendDays);
      userSubData['currentPeriodEnd'] = userNewEnd;

    } else if (action === 'cancel') {
      Object.assign(legacyData, { status: 'canceled', autoRenew: false });
      Object.assign(userSubData, { status: 'canceled', autoRenew: false });

    } else if (action === 'expire') {
      legacyData['status'] = 'expired';
      userSubData['status'] = 'expired';
    }

    await prisma.subscription.upsert({
      where: { chatId },
      create: { chatId, planId: 'free', status: 'expired', ...legacyData },
      update: legacyData,
    });

    if (userId) {
      await prisma.userSubscription.upsert({
        where: { userId },
        create: { userId, planId: 'client_monthly', status: 'active', ...userSubData },
        update: userSubData,
      });
    }

    res.json({ ok: true, chatId, userId });
  } catch (err) {
    console.error('[admin/subscriptions PATCH]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/admin/ai-cost — aggregate AI cost stats [admin only] ────────────
// Query params: from, to (YYYY-MM-DD, optional — default: last 30 days)
//
// Returns:
//   totalCostUsd, totalRequests, breakdown by scenario, breakdown by model
router.get('/ai-cost', async (req: AuthRequest, res: Response) => {
  const db = getAiCostLogDbFull();
  const { from, to } = req.query as { from?: string; to?: string };

  const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const toDate   = to   ? new Date(to)   : new Date();
  // Include the entire toDate day
  toDate.setHours(23, 59, 59, 999);

  const where = { createdAt: { gte: fromDate, lte: toDate } };

  try {
    const [totals, byScenario, byModel] = await Promise.all([
      db.aggregate({ where, _sum: { costUsd: true, totalTokens: true }, _count: { id: true } }),
      db.groupBy({ by: ['scenario'], where, _sum: { costUsd: true }, _count: { id: true }, orderBy: { _sum: { costUsd: 'desc' } } }),
      db.groupBy({ by: ['model'],    where, _sum: { costUsd: true }, _count: { id: true }, orderBy: { _sum: { costUsd: 'desc' } } }),
    ]);

    res.json({
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      totalCostUsd:    Math.round((totals._sum.costUsd    ?? 0) * 1e6) / 1e6,
      totalTokens:     totals._sum.totalTokens ?? 0,
      totalRequests:   totals._count.id,
      byScenario: byScenario.map(r => ({
        scenario:  r.scenario,
        requests:  r._count.id,
        costUsd:   Math.round((r._sum.costUsd ?? 0) * 1e6) / 1e6,
      })),
      byModel: byModel.map(r => ({
        model:    r.model,
        requests: r._count.id,
        costUsd:  Math.round((r._sum.costUsd ?? 0) * 1e6) / 1e6,
      })),
    });
  } catch (err) {
    console.error('[admin/ai-cost]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/admin/ai-cost/user/:userId — AI cost for a specific user ────────
// Accepts userId (platform-independent) or chatId (legacy) via ?by=chatId
router.get('/ai-cost/user/:userId', async (req: AuthRequest, res: Response) => {
  const db = getAiCostLogDbFull();
  const { userId } = req.params as { userId: string };
  const byChatId = (req.query as { by?: string }).by === 'chatId';

  try {
    const where = byChatId ? { chatId: userId } : { userId };

    const [totals, byScenario, recent] = await Promise.all([
      db.aggregate({ where, _sum: { costUsd: true, totalTokens: true }, _count: { id: true } }),
      db.groupBy({ by: ['scenario'], where, _sum: { costUsd: true }, _count: { id: true }, orderBy: { _sum: { costUsd: 'desc' } } }),
      db.findMany({ where, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);

    res.json({
      userId: byChatId ? null : userId,
      chatId: byChatId ? userId : null,
      totalCostUsd:  Math.round((totals._sum.costUsd    ?? 0) * 1e6) / 1e6,
      totalTokens:   totals._sum.totalTokens ?? 0,
      totalRequests: totals._count.id,
      byScenario: byScenario.map(r => ({
        scenario: r.scenario,
        requests: r._count.id,
        costUsd:  Math.round((r._sum.costUsd ?? 0) * 1e6) / 1e6,
      })),
      recent: recent.map(r => ({
        id:          r.id,
        scenario:    r.scenario,
        model:       r.model,
        inputTokens: r.inputTokens,
        outputTokens:r.outputTokens,
        costUsd:     r.costUsd,
        createdAt:   r.createdAt,
      })),
    });
  } catch (err) {
    console.error('[admin/ai-cost/user]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/admin/payments/reconcile — fix stuck pending payments ──────────
//
// For payments where the webhook never arrived (e.g. wrong URL was configured in
// YooKassa). Fetches the current status from YooKassa by providerPaymentId and,
// if the payment succeeded, marks it succeeded and activates the subscription.
//
// Body: { providerPaymentId: string }
//
// Idempotent — safe to call multiple times for the same payment.
router.post('/payments/reconcile', adminOnly, async (req: AuthRequest, res: Response) => {
  const { providerPaymentId } = req.body as { providerPaymentId?: string };
  if (!providerPaymentId) {
    res.status(400).json({ error: 'providerPaymentId required' });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paymentDb = (prisma as unknown as { payment: any }).payment as {
    findFirst(args: { where: object }): Promise<{
      id: string; userId: string; planId: string; amountRub: number; status: string; periodEnd: Date | null;
    } | null>;
    update(args: { where: { id: string }; data: object }): Promise<{ id: string }>;
  };

  try {
    // 1. Re-fetch from YooKassa
    const verified = await fetchYooKassaPayment(providerPaymentId);
    console.log(`[admin/reconcile] ykId=${verified.id} status=${verified.status}`);

    // 2. Find local Payment
    const payment = await paymentDb.findFirst({ where: { providerPaymentId: verified.id } });
    if (!payment) {
      res.status(404).json({ error: 'Local Payment record not found', ykStatus: verified.status });
      return;
    }

    console.log(`[admin/reconcile] local id=${payment.id} status=${payment.status} userId=${payment.userId}`);

    if (verified.status === 'succeeded') {
      if (payment.status === 'succeeded') {
        res.json({ ok: true, action: 'already_succeeded', paymentId: payment.id });
        return;
      }

      await paymentDb.update({ where: { id: payment.id }, data: { status: 'succeeded' } });

      const periodEnd = payment.periodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await activateSubscription(payment.userId, payment.planId as PlanId, periodEnd);

      // Also create referral reward if applicable (same logic as the webhook handler)
      let rewardCreated = false;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const profile = await (prisma.userProfile.findFirst as (args: any) => Promise<{
          chatId: string; referredBy: string | null; referredByUserId: string | null;
          referredByRole: string | null; trainerOfferType: string | null;
        } | null>)({
          where: { userId: payment.userId },
          select: { chatId: true, referredBy: true, referredByUserId: true, referredByRole: true, trainerOfferType: true },
        });
        if (profile?.referredBy && (profile.referredByRole === 'trainer' || profile.referredByRole === 'company')) {
          const offerType = normalizeOfferType(profile.trainerOfferType);
          if (offerType && offerType !== 'month_1rub') {
            const rewardRub = offerType === 'one_time' ? payment.amountRub : Math.round(payment.amountRub * 0.20 * 100) / 100;
            if (rewardRub > 0) {
              const existingReward = offerType === 'one_time'
                ? await prisma.trainerReward.findFirst({ where: { trainerId: profile.referredBy, referredChatId: profile.chatId } })
                : null;
              if (!existingReward) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (prisma.trainerReward.create as (args: any) => Promise<any>)({
                  data: {
                    trainerId: profile.referredBy, trainerUserId: profile.referredByUserId ?? null,
                    referredChatId: profile.chatId, referredUserId: payment.userId,
                    planId: payment.planId, amountRub: rewardRub, status: 'pending_hold',
                    holdUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                  },
                });
                rewardCreated = true;
                console.log(`[admin/reconcile] referral reward created: ${rewardRub}₽ trainer=${profile.referredBy} offerType=${offerType}`);
              }
            }
          }
        }
      } catch (rewardErr) {
        console.error('[admin/reconcile] referral reward creation failed:', (rewardErr as Error).message);
      }

      console.log(`[admin/reconcile] activated planId=${payment.planId} userId=${payment.userId}`);
      res.json({
        ok: true,
        action: 'activated',
        paymentId: payment.id,
        userId: payment.userId,
        planId: payment.planId,
        periodEnd: periodEnd.toISOString(),
        rewardCreated,
      });
    } else if (verified.status === 'canceled') {
      if (payment.status !== 'canceled') {
        await paymentDb.update({ where: { id: payment.id }, data: { status: 'canceled' } });
      }
      res.json({ ok: true, action: 'marked_canceled', paymentId: payment.id });
    } else {
      res.json({ ok: true, action: 'no_change', ykStatus: verified.status, paymentId: payment.id });
    }
  } catch (err) {
    const msg = (err as Error).message;
    console.error('[admin/reconcile] error:', msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
