import express, { Response, NextFunction } from 'express';
import { requireWebAuth, WebAuthRequest } from '../middleware/webAuth';
import prisma from '../../db';
import {
  activateSubscription,
  cancelSubscription,
  expireSubscription,
  type PlanId,
} from '../../services/subscriptionService';

const router = express.Router();
router.use(requireWebAuth as express.RequestHandler);

// ─── Admin guard ──────────────────────────────────────────────────────────────

function getAdminIds(): Set<string> {
  const raw = process.env.ADMIN_USER_IDS ?? '';
  return new Set(raw.split(',').map(s => s.trim()).filter(Boolean));
}

function requireAdmin(req: WebAuthRequest, res: Response, next: NextFunction): void {
  const { userId, chatId } = req.webUser!;
  const adminIds = getAdminIds();
  const ok = adminIds.has(userId) || (!!chatId && adminIds.has(chatId));
  if (!ok) { res.status(403).json({ ok: false, error: 'forbidden' }); return; }
  next();
}

router.use(requireAdmin as express.RequestHandler);

// ─── Prisma casts ─────────────────────────────────────────────────────────────

type SubRow = {
  userId: string; planId: string; status: string;
  currentPeriodEnd: Date | null; trialEndsAt: Date | null; gracePeriodEnd: Date | null;
  autoRenew: boolean; providerSubId: string | null; paymentProvider: string | null;
  createdAt: Date; updatedAt: Date;
};

const userSubDb = (prisma as unknown as {
  userSubscription: {
    findUnique(args: { where: { userId: string }; select?: object }): Promise<SubRow | null>;
    findMany(args: { where: object; select?: object; take?: number }): Promise<SubRow[]>;
    count(args: { where: object }): Promise<number>;
  };
}).userSubscription;

const userDb = (prisma as unknown as {
  user: {
    findUnique(args: { where: { id: string }; select: object }): Promise<{ id: string; createdAt: Date } | null>;
  };
}).user;

// ─── GET /api/web/admin/overview ──────────────────────────────────────────────

router.get('/overview', async (_req: WebAuthRequest, res: Response) => {
  try {
    const [
      usersTotal,
      expertsTotal,
      companiesTotal,
      appsPending,
      cerPending,
      activeSubsTotal,
    ] = await Promise.all([
      prisma.userProfile.count(),
      prisma.trainerProfile.count({
        where: { verificationStatus: 'verified', NOT: { specialization: 'Компания' } },
      }),
      prisma.trainerProfile.count({
        where: { verificationStatus: 'verified', specialization: 'Компания' },
      }),
      prisma.expertApplication.count({ where: { status: 'pending' } }),
      prisma.clientExpertRequest.count({ where: { status: 'pending' } }),
      userSubDb.count({ where: { status: { in: ['active', 'trial'] } } }),
    ]);

    res.json({
      ok: true,
      overview: {
        usersTotal,
        expertsTotal,
        companiesTotal,
        expertApplicationsPending: appsPending,
        clientExpertRequestsPending: cerPending,
        activeSubscriptions: activeSubsTotal,
        paymentsTotal: null,
      },
    });
  } catch (err) {
    console.error('[web/admin/overview]', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// ─── GET /api/web/admin/users ─────────────────────────────────────────────────

router.get('/users', async (req: WebAuthRequest, res: Response) => {
  const q = String(req.query['q'] ?? '').trim();
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10) || 20));

  try {
    let userIds: string[] = [];

    if (q) {
      // Search by identity (username, platformId) and profile (preferredName, userId-exact)
      const looksLikeUserId = /^[0-9a-f-]{30,}$/i.test(q);
      const looksLikePlatformId = /^\d{5,}$/.test(q);

      const [identityRows, profileRows] = await Promise.all([
        prisma.userIdentity.findMany({
          where: {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              ...(looksLikePlatformId ? [{ platformId: q }] : []),
            ],
          },
          select: { userId: true },
          take: limit,
        }),
        prisma.userProfile.findMany({
          where: {
            OR: [
              { preferredName: { contains: q, mode: 'insensitive' } },
              ...(looksLikeUserId ? [{ userId: q }] : []),
            ],
          },
          select: { userId: true },
          take: limit,
        }),
      ]);

      const seen = new Set<string>();
      for (const r of [...identityRows, ...profileRows]) {
        if (r.userId && !seen.has(r.userId)) { seen.add(r.userId); userIds.push(r.userId); }
      }
      userIds = userIds.slice(0, limit);
    } else {
      // No query — return recent profiles
      const recent = await prisma.userProfile.findMany({
        where: { userId: { not: null } },
        select: { userId: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      userIds = recent.map(r => r.userId!).filter(Boolean);
    }

    if (userIds.length === 0) { res.json({ ok: true, users: [] }); return; }

    type IdentityRow = { userId: string; platform: string; platformId: string; username: string | null; firstName: string | null };
    type ProfileRow = { userId: string | null; preferredName: string | null; city: string | null; goalType: string | null };

    const [identities, profiles, subs] = await Promise.all([
      prisma.userIdentity.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, platform: true, platformId: true, username: true, firstName: true },
      }) as Promise<IdentityRow[]>,
      prisma.userProfile.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, preferredName: true, city: true, goalType: true },
      }) as Promise<ProfileRow[]>,
      userSubDb.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, planId: true, status: true, currentPeriodEnd: true },
        take: userIds.length,
      }),
    ]);

    // Also check expert/company roles
    const trainerProfiles = await prisma.trainerProfile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, verificationStatus: true, specialization: true },
    });

    const identityMap = new Map<string, IdentityRow[]>();
    for (const id of identities) {
      if (!identityMap.has(id.userId)) identityMap.set(id.userId, []);
      identityMap.get(id.userId)!.push(id);
    }
    const profileMap = new Map(profiles.filter(p => p.userId).map(p => [p.userId!, p]));
    const subMap = new Map(subs.map(s => [s.userId, s]));
    const trainerMap = new Map(trainerProfiles.filter(t => t.userId).map(t => [t.userId!, t]));

    const users = userIds.map(uid => {
      const ids = identityMap.get(uid) ?? [];
      const prof = profileMap.get(uid);
      const sub = subMap.get(uid);
      const trainer = trainerMap.get(uid);
      const isCompany = trainer?.verificationStatus === 'verified' && trainer?.specialization === 'Компания';
      const isExpert = trainer?.verificationStatus === 'verified' && !isCompany;
      return {
        id: uid,
        identities: ids.map(i => ({
          platform: i.platform,
          platformId: i.platform === 'phone' ? maskPhone(i.platformId) : i.platformId,
          username: i.username ?? null,
          firstName: i.firstName ?? null,
        })),
        profile: prof ? {
          preferredName: prof.preferredName ?? null,
          city: prof.city ?? null,
          goalType: prof.goalType ?? null,
        } : null,
        subscription: sub ? {
          planId: sub.planId,
          status: sub.status,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
        } : null,
        roles: { isExpert, isCompany },
      };
    });

    res.json({ ok: true, users });
  } catch (err) {
    console.error('[web/admin/users]', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// ─── GET /api/web/admin/users/:userId ─────────────────────────────────────────

router.get('/users/:userId', async (req: WebAuthRequest, res: Response) => {
  const targetId = String(req.params['userId'] ?? '');
  if (!targetId) { res.status(400).json({ ok: false, error: 'invalid_user_id' }); return; }

  try {
    const [userRecord, identities, profile, sub, trainerProfile, activeLink] = await Promise.all([
      userDb.findUnique({ where: { id: targetId }, select: { id: true, createdAt: true } }),

      prisma.userIdentity.findMany({
        where: { userId: targetId },
        select: { platform: true, platformId: true, username: true, firstName: true, linkedAt: true },
      }),

      prisma.userProfile.findFirst({
        where: { userId: targetId },
        select: {
          preferredName: true, city: true, goalType: true,
          currentWeightKg: true, desiredWeightKg: true, heightCm: true,
          dailyCaloriesKcal: true, dailyProteinG: true, dailyFatG: true, dailyCarbsG: true,
          referralCode: true, referredByRole: true,
          createdAt: true,
        },
      }),

      userSubDb.findUnique({ where: { userId: targetId } }),

      prisma.trainerProfile.findFirst({
        where: { userId: targetId },
        select: {
          id: true, fullName: true, specialization: true, city: true,
          bio: true, socialLink: true, publicStatus: true, slug: true,
          referralCode: true, verificationStatus: true, verifiedAt: true, createdAt: true,
        },
      }),

      prisma.trainerClientLink.findFirst({
        where: { clientUserId: targetId, status: 'active' },
        select: { trainerId: true, trainerUserId: true, connectedAt: true },
      }),
    ]);

    if (!userRecord) { res.status(404).json({ ok: false, error: 'user_not_found' }); return; }

    const isCompany = trainerProfile?.verificationStatus === 'verified' && trainerProfile?.specialization === 'Компания';
    const isExpert  = trainerProfile?.verificationStatus === 'verified' && !isCompany;

    // Recent payments — kept minimal (no provider payload)
    type PaymentRow = { id: string; planId: string; amountRub: number; status: string; createdAt: Date };
    const recentPayments = await (prisma.payment.findMany as (args: object) => Promise<PaymentRow[]>)({
      where: { userId: targetId },
      select: { id: true, planId: true, amountRub: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    res.json({
      ok: true,
      user: {
        id: userRecord.id,
        createdAt: userRecord.createdAt.toISOString(),
        identities: identities.map(i => ({
          platform: i.platform,
          platformId: i.platform === 'phone' ? maskPhone(i.platformId) : i.platformId,
          username: i.username ?? null,
          firstName: i.firstName ?? null,
          linkedAt: i.linkedAt.toISOString(),
        })),
        profile: profile ? {
          preferredName: profile.preferredName ?? null,
          city: profile.city ?? null,
          goalType: profile.goalType ?? null,
          currentWeightKg: profile.currentWeightKg ?? null,
          desiredWeightKg: profile.desiredWeightKg ?? null,
          heightCm: profile.heightCm ?? null,
          dailyCaloriesKcal: profile.dailyCaloriesKcal ?? null,
          dailyProteinG: profile.dailyProteinG ?? null,
          dailyFatG: profile.dailyFatG ?? null,
          dailyCarbsG: profile.dailyCarbsG ?? null,
          referralCode: profile.referralCode ?? null,
          referredByRole: profile.referredByRole ?? null,
          profileCreatedAt: profile.createdAt.toISOString(),
        } : null,
        subscription: sub ? {
          planId: sub.planId,
          status: sub.status,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
          gracePeriodEnd: sub.gracePeriodEnd?.toISOString() ?? null,
          autoRenew: sub.autoRenew,
          createdAt: sub.createdAt.toISOString(),
        } : null,
        roles: { isExpert, isCompany, isAdmin: getAdminIds().has(targetId) },
        expert: trainerProfile ? {
          id: trainerProfile.id,
          fullName: trainerProfile.fullName ?? null,
          specialization: trainerProfile.specialization ?? null,
          city: trainerProfile.city ?? null,
          publicStatus: trainerProfile.publicStatus,
          slug: trainerProfile.slug ?? null,
          referralCode: trainerProfile.referralCode ?? null,
          verificationStatus: trainerProfile.verificationStatus,
          verifiedAt: trainerProfile.verifiedAt?.toISOString() ?? null,
          createdAt: trainerProfile.createdAt.toISOString(),
        } : null,
        activeExpertLink: activeLink ? {
          trainerId: activeLink.trainerId,
          trainerUserId: activeLink.trainerUserId ?? null,
          connectedAt: activeLink.connectedAt.toISOString(),
        } : null,
        recentPayments: recentPayments.map(p => ({
          id: p.id,
          planId: p.planId,
          amountRub: p.amountRub,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    console.error('[web/admin/users/:userId]', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// ─── POST /api/web/admin/users/:userId/subscription ───────────────────────────

const VALID_PLAN_IDS: PlanId[] = ['optimal', 'pro', 'intro', 'client_monthly'];
const VALID_ACTIONS = ['activate', 'cancel', 'expire'] as const;

router.post('/users/:userId/subscription', async (req: WebAuthRequest, res: Response) => {
  const targetId = String(req.params['userId'] ?? '');
  if (!targetId) { res.status(400).json({ ok: false, error: 'invalid_user_id' }); return; }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const action = String(body.action ?? '') as typeof VALID_ACTIONS[number];

  if (!VALID_ACTIONS.includes(action)) {
    res.status(400).json({ ok: false, error: `action must be one of: ${VALID_ACTIONS.join(', ')}` }); return;
  }

  try {
    // Ensure target user exists
    const userExists = await userDb.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!userExists) { res.status(404).json({ ok: false, error: 'user_not_found' }); return; }

    if (action === 'activate') {
      const planId = String(body.planId ?? '') as PlanId;
      if (!VALID_PLAN_IDS.includes(planId)) {
        res.status(400).json({ ok: false, error: `planId must be one of: ${VALID_PLAN_IDS.join(', ')}` }); return;
      }
      const days = parseInt(String(body.days ?? '30'), 10);
      if (isNaN(days) || days < 1 || days > 365) {
        res.status(400).json({ ok: false, error: 'days must be 1-365' }); return;
      }
      const periodEnd = new Date(Date.now() + days * 86400 * 1000);
      const updated = await activateSubscription(targetId, planId, periodEnd);
      res.json({ ok: true, subscription: {
        planId: updated.planId, status: updated.status,
        currentPeriodEnd: updated.currentPeriodEnd?.toISOString() ?? null,
        trialEndsAt: updated.trialEndsAt?.toISOString() ?? null,
      }});
    } else if (action === 'cancel') {
      const updated = await cancelSubscription(targetId);
      res.json({ ok: true, subscription: {
        planId: updated.planId, status: updated.status,
        currentPeriodEnd: updated.currentPeriodEnd?.toISOString() ?? null,
      }});
    } else {
      // expire
      const updated = await expireSubscription(targetId);
      res.json({ ok: true, subscription: {
        planId: updated.planId, status: updated.status,
        currentPeriodEnd: null,
      }});
    }
  } catch (err) {
    console.error('[web/admin/users/:userId/subscription]', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// ─── GET /api/web/admin/experts ───────────────────────────────────────────────

router.get('/experts', async (req: WebAuthRequest, res: Response) => {
  const q      = String(req.query['q'] ?? '').trim();
  const status = String(req.query['status'] ?? '').trim();
  const type   = String(req.query['type'] ?? '').trim(); // 'expert' | 'company' | ''
  const limit  = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10) || 50));

  try {
    type WhereClause = Record<string, unknown>;
    const where: WhereClause = {};

    if (status && ['verified', 'pending', 'rejected', 'blocked'].includes(status)) {
      where['verificationStatus'] = status;
    }
    if (type === 'company') {
      where['specialization'] = 'Компания';
    } else if (type === 'expert') {
      where['NOT'] = { specialization: 'Компания' };
    }
    if (q) {
      where['OR'] = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
      ];
    }

    const experts = await prisma.trainerProfile.findMany({
      where,
      select: {
        id: true, userId: true, chatId: true, fullName: true, city: true,
        specialization: true, verificationStatus: true, publicStatus: true,
        slug: true, referralCode: true, createdAt: true, verifiedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({
      ok: true,
      experts: experts.map(e => ({
        id: e.id,
        userId: e.userId ?? null,
        chatId: e.chatId,
        fullName: e.fullName ?? null,
        city: e.city ?? null,
        specialization: e.specialization ?? null,
        verificationStatus: e.verificationStatus,
        publicStatus: e.publicStatus,
        slug: e.slug ?? null,
        referralCode: e.referralCode ?? null,
        createdAt: e.createdAt.toISOString(),
        verifiedAt: e.verifiedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    console.error('[web/admin/experts]', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// ─── PATCH /api/web/admin/experts/:id ────────────────────────────────────────

router.patch('/experts/:id', async (req: WebAuthRequest, res: Response) => {
  const id = parseInt(String(req.params['id'] ?? ''), 10);
  if (isNaN(id)) { res.status(400).json({ ok: false, error: 'invalid_id' }); return; }

  try {
    const existing = await prisma.trainerProfile.findUnique({ where: { id }, select: { id: true } });
    if (!existing) { res.status(404).json({ ok: false, error: 'not_found' }); return; }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    if ('fullName' in body) {
      const v = String(body.fullName ?? '').trim();
      if (v.length < 2 || v.length > 80) { res.status(400).json({ ok: false, error: 'invalid_fullName' }); return; }
      data.fullName = v;
    }
    if ('city' in body) {
      const v = String(body.city ?? '').trim();
      data.city = v.length > 0 ? v.substring(0, 80) : null;
    }
    if ('bio' in body) {
      const v = String(body.bio ?? '').trim();
      if (v.length > 0 && v.length < 20) { res.status(400).json({ ok: false, error: 'invalid_bio' }); return; }
      data.bio = v.length > 0 ? v.substring(0, 2000) : null;
    }
    if ('socialLink' in body) {
      const v = String(body.socialLink ?? '').trim();
      data.socialLink = v.length > 0 ? v.substring(0, 200) : null;
    }
    if ('publicStatus' in body) {
      const v = String(body.publicStatus ?? '').trim();
      if (!['draft', 'published', 'hidden'].includes(v)) {
        res.status(400).json({ ok: false, error: 'invalid_publicStatus' }); return;
      }
      data.publicStatus = v;
    }
    if ('verificationStatus' in body) {
      const v = String(body.verificationStatus ?? '').trim();
      if (!['verified', 'pending', 'rejected', 'blocked'].includes(v)) {
        res.status(400).json({ ok: false, error: 'invalid_verificationStatus' }); return;
      }
      data.verificationStatus = v;
      if (v === 'verified') data.verifiedAt = new Date();
      if (v === 'rejected') data.rejectedAt = new Date();
      if (v === 'blocked')  data.blockedAt  = new Date();
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ ok: false, error: 'no_fields' }); return;
    }

    const updated = await prisma.trainerProfile.update({
      where: { id },
      data,
      select: {
        id: true, userId: true, fullName: true, city: true, specialization: true,
        verificationStatus: true, publicStatus: true, slug: true, referralCode: true,
        bio: true, socialLink: true, createdAt: true, verifiedAt: true,
      },
    });

    res.json({ ok: true, expert: {
      id: updated.id,
      userId: updated.userId ?? null,
      fullName: updated.fullName ?? null,
      city: updated.city ?? null,
      specialization: updated.specialization ?? null,
      verificationStatus: updated.verificationStatus,
      publicStatus: updated.publicStatus,
      slug: updated.slug ?? null,
      referralCode: updated.referralCode ?? null,
      bio: updated.bio ?? null,
      socialLink: updated.socialLink ?? null,
      createdAt: updated.createdAt.toISOString(),
      verifiedAt: updated.verifiedAt?.toISOString() ?? null,
    }});
  } catch (err) {
    console.error('[web/admin/experts/:id]', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// ─── GET /api/web/admin/expert-applications ───────────────────────────────────

router.get('/expert-applications', async (req: WebAuthRequest, res: Response) => {
  const status = String(req.query['status'] ?? 'pending').trim();
  const validStatuses = ['pending', 'in_review', 'approved', 'rejected', 'all'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ ok: false, error: 'invalid_status' }); return;
  }

  try {
    type AppRow = {
      id: string; userId: string; status: string;
      fullName: string; specialization: string; city: string | null;
      workFormat: string | null; experienceYears: number | null;
      socialLink: string | null; bio: string; proofLink: string | null;
      adminComment: string | null; source: string; createdAt: Date; updatedAt: Date;
    };
    const apps = await (prisma.expertApplication.findMany as (args: object) => Promise<AppRow[]>)({
      where: status === 'all' ? {} : { status },
      select: {
        id: true, userId: true, status: true, fullName: true, specialization: true,
        city: true, workFormat: true, experienceYears: true, socialLink: true,
        bio: true, proofLink: true, adminComment: true, source: true,
        createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({
      ok: true,
      applications: apps.map(a => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('[web/admin/expert-applications]', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// ─── POST /api/web/admin/expert-applications/:id/approve ─────────────────────

router.post('/expert-applications/:id/approve', async (req: WebAuthRequest, res: Response) => {
  const { id } = req.params as { id: string };
  try {
    type AppRow = { id: string; status: string };
    const app = await (prisma.expertApplication.findUnique as (args: object) => Promise<AppRow | null>)({
      where: { id },
      select: { id: true, status: true },
    });
    if (!app) { res.status(404).json({ ok: false, error: 'not_found' }); return; }
    if (app.status !== 'pending' && app.status !== 'in_review') {
      res.status(400).json({ ok: false, error: 'not_pending' }); return;
    }
    await (prisma.expertApplication.update as (args: object) => Promise<unknown>)({
      where: { id },
      data: { status: 'approved' },
    });
    res.json({ ok: true, status: 'approved' });
  } catch (err) {
    console.error('[web/admin/expert-applications/approve]', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// ─── POST /api/web/admin/expert-applications/:id/reject ──────────────────────

router.post('/expert-applications/:id/reject', async (req: WebAuthRequest, res: Response) => {
  const { id } = req.params as { id: string };
  const { adminComment } = (req.body ?? {}) as { adminComment?: string };
  try {
    type AppRow = { id: string; status: string };
    const app = await (prisma.expertApplication.findUnique as (args: object) => Promise<AppRow | null>)({
      where: { id },
      select: { id: true, status: true },
    });
    if (!app) { res.status(404).json({ ok: false, error: 'not_found' }); return; }
    if (app.status !== 'pending' && app.status !== 'in_review') {
      res.status(400).json({ ok: false, error: 'not_pending' }); return;
    }
    await (prisma.expertApplication.update as (args: object) => Promise<unknown>)({
      where: { id },
      data: {
        status: 'rejected',
        adminComment: adminComment?.trim() || null,
      },
    });
    res.json({ ok: true, status: 'rejected' });
  } catch (err) {
    console.error('[web/admin/expert-applications/reject]', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// ─── GET /api/web/admin/client-expert-requests ───────────────────────────────

router.get('/client-expert-requests', async (req: WebAuthRequest, res: Response) => {
  const status = String(req.query['status'] ?? 'pending').trim();
  const validStatuses = ['pending', 'accepted', 'rejected', 'canceled', 'all'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ ok: false, error: 'invalid_status' }); return;
  }

  try {
    const requests = await prisma.clientExpertRequest.findMany({
      where: status === 'all' ? {} : { status },
      select: {
        id: true, clientUserId: true, expertUserId: true, trainerProfileId: true,
        status: true, message: true, source: true, createdAt: true, respondedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (requests.length === 0) { res.json({ ok: true, requests: [] }); return; }

    // Load client/expert names for display
    const clientUserIds = [...new Set(requests.map(r => r.clientUserId).filter(Boolean))];
    const trainerIds    = [...new Set(requests.map(r => r.trainerProfileId))];

    type ProfileRow = { userId: string | null; preferredName: string | null; telegramUsername: string | null };
    type TrainerRow = { id: number; fullName: string | null; specialization: string | null; slug: string | null };

    const [clientProfiles, trainerProfiles] = await Promise.all([
      clientUserIds.length > 0
        ? prisma.userProfile.findMany({
            where: { userId: { in: clientUserIds } },
            select: { userId: true, preferredName: true, telegramUsername: true },
          }) as Promise<ProfileRow[]>
        : Promise.resolve([] as ProfileRow[]),
      trainerIds.length > 0
        ? prisma.trainerProfile.findMany({
            where: { id: { in: trainerIds } },
            select: { id: true, fullName: true, specialization: true, slug: true },
          }) as Promise<TrainerRow[]>
        : Promise.resolve([] as TrainerRow[]),
    ]);

    const clientMap  = new Map(clientProfiles.filter(p => p.userId).map(p => [p.userId!, p]));
    const trainerMap = new Map(trainerProfiles.map(t => [t.id, t]));

    res.json({
      ok: true,
      requests: requests.map(r => {
        const cp = clientMap.get(r.clientUserId);
        const tp = trainerMap.get(r.trainerProfileId);
        return {
          id: r.id,
          status: r.status,
          source: r.source,
          createdAt: r.createdAt.toISOString(),
          respondedAt: r.respondedAt?.toISOString() ?? null,
          client: {
            userId: r.clientUserId,
            displayName: cp?.preferredName ?? null,
            username: cp?.telegramUsername ?? null,
          },
          expert: tp ? {
            id: tp.id,
            fullName: tp.fullName ?? null,
            specialization: tp.specialization ?? null,
            slug: tp.slug ?? null,
          } : { id: r.trainerProfileId, fullName: null, specialization: null, slug: null },
        };
      }),
    });
  } catch (err) {
    console.error('[web/admin/client-expert-requests]', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskPhone(phone: string): string {
  if (phone.startsWith('+7') && phone.length === 12) {
    const last4 = phone.slice(-4);
    return `+7 *** ***-${last4.slice(0, 2)}-${last4.slice(2)}`;
  }
  return `+*** ***${phone.slice(-4)}`;
}

export default router;
