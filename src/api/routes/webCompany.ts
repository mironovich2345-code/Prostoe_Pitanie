import express, { Response } from 'express';
import { requireWebAuth, WebAuthRequest } from '../middleware/webAuth';
import prisma from '../../db';
import {
  buildCompanyOfferLink,
  TRAINER_OFFER_IDS,
  TRAINER_OFFERS,
} from '../../utils/referral';
import { buildExpertAcquisitionLink } from '../../utils/expertReferral';

const router = express.Router();
router.use(requireWebAuth as express.RequestHandler);

// ─── Types ────────────────────────────────────────────────────────────────────

const COMPANY_SELECT = {
  id: true,
  fullName: true,
  specialization: true,
  city: true,
  bio: true,
  socialLink: true,
  publicStatus: true,
  slug: true,
  referralCode: true,
  verificationStatus: true,
  chatId: true,
  userId: true,
  createdAt: true,
} as const;

// Prisma cast for tables not yet in the generated client type.
const userSubDb = (prisma as unknown as {
  userSubscription: {
    count(args: { where: object }): Promise<number>;
  };
}).userSubscription;

const eaDb = (prisma as unknown as {
  expertAcquisition: {
    count(args: { where: object }): Promise<number>;
  };
}).expertAcquisition;

// ─── Helper ───────────────────────────────────────────────────────────────────

async function findVerifiedCompany(userId: string) {
  const profile = await prisma.trainerProfile.findUnique({
    where: { userId },
    select: COMPANY_SELECT,
  });
  if (!profile || profile.verificationStatus !== 'verified') return null;
  if (profile.specialization !== 'Компания') return null;
  return profile;
}

function shapeCompany(c: Awaited<ReturnType<typeof findVerifiedCompany>> & object) {
  return {
    id: String(c.id),
    name: c.fullName ?? null,
    city: c.city ?? null,
    bio: c.bio ?? null,
    socialLink: c.socialLink ?? null,
    contactPerson: null,
    status: c.verificationStatus,
    publicStatus: c.publicStatus,
    slug: c.slug ?? null,
    referralCode: c.referralCode ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

// ─── GET /api/web/company/profile ─────────────────────────────────────────────

router.get('/profile', async (req: WebAuthRequest, res: Response) => {
  try {
    const company = await findVerifiedCompany(req.webUser!.userId);
    if (!company) { res.status(403).json({ ok: false, error: 'not_company' }); return; }
    res.json({ ok: true, company: shapeCompany(company) });
  } catch (err) {
    console.error('[web/company/profile] GET:', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// ─── PATCH /api/web/company/profile ───────────────────────────────────────────

router.patch('/profile', async (req: WebAuthRequest, res: Response) => {
  try {
    const company = await findVerifiedCompany(req.webUser!.userId);
    if (!company) { res.status(403).json({ ok: false, error: 'not_company' }); return; }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    if ('name' in body) {
      const v = String(body.name ?? '').trim();
      if (v.length < 2 || v.length > 80) {
        res.status(400).json({ ok: false, error: 'invalid_name' }); return;
      }
      data.fullName = v;
    }
    if ('city' in body) {
      const v = String(body.city ?? '').trim();
      data.city = v.length > 0 ? v.substring(0, 80) : null;
    }
    if ('bio' in body) {
      const v = String(body.bio ?? '').trim();
      if (v.length > 0 && v.length < 20) {
        res.status(400).json({ ok: false, error: 'invalid_bio' }); return;
      }
      data.bio = v.length > 0 ? v.substring(0, 2000) : null;
    }
    if ('socialLink' in body) {
      const v = String(body.socialLink ?? '').trim();
      data.socialLink = v.length > 0 ? v.substring(0, 200) : null;
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ ok: false, error: 'no_fields' }); return;
    }

    const updated = await prisma.trainerProfile.update({
      where: { userId: req.webUser!.userId },
      data,
      select: COMPANY_SELECT,
    });

    res.json({ ok: true, company: shapeCompany(updated) });
  } catch (err) {
    console.error('[web/company/profile] PATCH:', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// ─── GET /api/web/company/offers ──────────────────────────────────────────────

router.get('/offers', async (req: WebAuthRequest, res: Response) => {
  try {
    const company = await findVerifiedCompany(req.webUser!.userId);
    if (!company) { res.status(403).json({ ok: false, error: 'not_company' }); return; }

    if (!company.referralCode) {
      res.json({ ok: true, offers: [], expertAcquisitionLink: null }); return;
    }

    const code = company.referralCode;

    const offers = TRAINER_OFFER_IDS.map(offerId => {
      const meta = TRAINER_OFFERS[offerId];
      return {
        key: offerId,
        offerType: meta.key,
        title: meta.title,
        description: meta.desc,
        link: buildCompanyOfferLink(code, offerId),
      };
    });

    const expertAcquisitionLink = buildExpertAcquisitionLink(code);

    res.json({ ok: true, offers, expertAcquisitionLink });
  } catch (err) {
    console.error('[web/company/offers] GET:', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// ─── GET /api/web/company/stats ───────────────────────────────────────────────

router.get('/stats', async (req: WebAuthRequest, res: Response) => {
  try {
    const company = await findVerifiedCompany(req.webUser!.userId);
    if (!company) { res.status(403).json({ ok: false, error: 'not_company' }); return; }

    const { chatId, userId } = company;

    // Build safe OR arrays — never pass undefined.
    const referredByOr: Array<{ referredBy: string } | { referredByUserId: string }> = [];
    if (chatId) referredByOr.push({ referredBy: chatId });
    if (userId) referredByOr.push({ referredByUserId: userId });

    const rewardOr: Array<{ trainerId: string } | { trainerUserId: string }> = [];
    if (chatId) rewardOr.push({ trainerId: chatId });
    if (userId) rewardOr.push({ trainerUserId: userId });

    const eaOr: Array<{ referrerChatId: string } | { referrerUserId: string }> = [];
    if (chatId) eaOr.push({ referrerChatId: chatId });
    if (userId) eaOr.push({ referrerUserId: userId });

    type RewardRow = { amountRub: number; status: string };

    const [totalReferredUsers, rewards, expertRecruits] = await Promise.all([
      referredByOr.length > 0
        ? prisma.userProfile.count({
            where: { AND: [{ referredByRole: 'company' }, { OR: referredByOr }] },
          })
        : Promise.resolve(0),

      rewardOr.length > 0
        ? prisma.trainerReward.findMany({
            where: { OR: rewardOr },
            select: { amountRub: true, status: true },
          }) as Promise<RewardRow[]>
        : Promise.resolve([] as RewardRow[]),

      eaOr.length > 0
        ? eaDb.count({ where: { OR: eaOr } })
        : Promise.resolve(0),
    ]);

    const rewardsTotal = rewards.reduce((s, r) => s + r.amountRub, 0);
    const pendingRewards = rewards
      .filter(r => r.status === 'pending_hold' || r.status === 'available')
      .reduce((s, r) => s + r.amountRub, 0);

    res.json({
      ok: true,
      stats: {
        referralCode: company.referralCode ?? null,
        totalReferredUsers,
        payingUsers: null,
        activeSubscriptions: null,
        expertRecruits,
        rewardsTotal,
        pendingRewards,
      },
    });
  } catch (err) {
    console.error('[web/company/stats] GET:', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;
