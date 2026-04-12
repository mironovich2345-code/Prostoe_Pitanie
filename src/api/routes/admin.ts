import { Router, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

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
    const updated = await prisma.trainerProfile.update({
      where: { chatId },
      data: { verificationStatus: 'verified', verifiedAt: new Date(), rejectedAt: null, verificationPhotoData: null },
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
      aiCosts,
    });
  } catch (err) {
    console.error('[admin/stats]', err);
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
  const { action, days } = req.body as { action?: string; days?: number };
  const VALID_ACTIONS = ['trial', 'monthly', 'extend', 'cancel', 'expire'];
  if (!action || !VALID_ACTIONS.includes(action)) {
    res.status(400).json({ error: `action must be one of: ${VALID_ACTIONS.join(', ')}` });
    return;
  }

  const extendDays = typeof days === 'number' && days > 0 && days <= 365 ? days : 30;

  try {
    const profile = await prisma.userProfile.findUnique({ where: { chatId }, select: { userId: true } });
    const userId = profile?.userId ?? null;

    const now = new Date();
    const legacyData: Record<string, unknown> = {};
    const userSubData: Record<string, unknown> = {};

    if (action === 'trial') {
      const trialEnd = new Date(now); trialEnd.setDate(trialEnd.getDate() + extendDays);
      Object.assign(legacyData, { planId: 'free', status: 'trial', trialEndsAt: trialEnd, currentPeriodEnd: null, autoRenew: true });
      Object.assign(userSubData, { planId: 'trial', status: 'active', trialEndsAt: trialEnd, currentPeriodEnd: null, autoRenew: true });

    } else if (action === 'monthly') {
      const periodEnd = new Date(now); periodEnd.setDate(periodEnd.getDate() + extendDays);
      Object.assign(legacyData, { planId: 'client_monthly', status: 'active', trialEndsAt: null, currentPeriodEnd: periodEnd, autoRenew: true });
      Object.assign(userSubData, { planId: 'client_monthly', status: 'active', trialEndsAt: null, currentPeriodEnd: periodEnd, autoRenew: true });

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
      create: { chatId, planId: 'free', status: 'trial', ...legacyData },
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

export default router;
