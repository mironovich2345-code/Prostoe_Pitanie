import express, { Response } from 'express';
import { requireWebAuth, WebAuthRequest } from '../middleware/webAuth';
import prisma from '../../db';
import { getAccessLevel } from '../../services/subscriptionService';
import type { UserSubscription } from '../../services/subscriptionService';

const router = express.Router();

function getAdminIds(): Set<string> {
  const raw = process.env.ADMIN_USER_IDS ?? '';
  return new Set(raw.split(',').map(s => s.trim()).filter(Boolean));
}

// Cast for UserSubscription table (not yet fully typed in generated Prisma client)
const userSubDb = (prisma as unknown as {
  userSubscription: {
    findUnique(args: { where: { userId: string } }): Promise<UserSubscription | null>;
  };
}).userSubscription;

// GET /api/web/me
// Returns the full identity/state snapshot for the authenticated web user.
router.get('/me', requireWebAuth as express.RequestHandler, async (req: WebAuthRequest, res: Response) => {
  const { userId, chatId, platform } = req.webUser!;

  try {
    const [
      userRecord,
      allIdentities,
      profile,
      trainerProfile,
      expertApp,
      userSub,
      activeLink,
      pendingReq,
    ] = await Promise.all([
      // User record (id + createdAt)
      (prisma as unknown as {
        user: { findUnique(args: object): Promise<{ id: string; createdAt: Date } | null> };
      }).user.findUnique({
        where: { id: userId },
        select: { id: true, createdAt: true },
      }),

      // All identities — needed to build auth.identities map
      prisma.userIdentity.findMany({
        where: { userId },
        select: { platform: true, platformId: true, username: true, firstName: true },
      }),

      // UserProfile — try by userId first, fallback to legacy chatId
      prisma.userProfile.findFirst({
        where: { OR: [{ userId }, ...(chatId ? [{ chatId }] : [])] },
        select: {
          preferredName: true,
          currentWeightKg: true,
          desiredWeightKg: true,
          heightCm: true,
          goalType: true,
          dailyCaloriesKcal: true,
          dailyProteinG: true,
          dailyFatG: true,
          dailyCarbsG: true,
          city: true,
        },
      }),

      // TrainerProfile — try by userId first, fallback to legacy chatId
      prisma.trainerProfile.findFirst({
        where: { OR: [{ userId }, ...(chatId ? [{ chatId }] : [])] },
        select: {
          verificationStatus: true,
          publicStatus: true,
          slug: true,
          referralCode: true,
          fullName: true,
          specialization: true,
          city: true,
          bio: true,
          socialLink: true,
        },
      }),

      // Latest ExpertApplication (web zaявка)
      prisma.expertApplication.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { status: true, adminComment: true, createdAt: true },
      }),

      // UserSubscription (canonical, keyed by userId)
      userSubDb.findUnique({ where: { userId } }),

      // Active TrainerClientLink — this client has an expert
      prisma.trainerClientLink.findFirst({
        where: {
          status: 'active',
          OR: [
            { clientUserId: userId },
            ...(chatId ? [{ clientId: chatId }] : []),
          ],
        },
        select: { trainerId: true, trainerUserId: true },
      }),

      // Pending ClientExpertRequest (most recent)
      prisma.clientExpertRequest.findFirst({
        where: { clientUserId: userId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, trainerProfileId: true, createdAt: true },
      }),
    ]);

    const primaryIdentity = allIdentities.find(i => i.platform === 'telegram') ?? allIdentities[0] ?? null;
    const tgIdentity = allIdentities.find(i => i.platform === 'telegram') ?? null;
    const maxIdentity = allIdentities.find(i => i.platform === 'max') ?? null;

    if (!userRecord) {
      res.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }

    // ── Subscription ──────────────────────────────────────────────────────────

    const accessLevel = getAccessLevel(userSub ?? null);
    const hasOptimal = accessLevel === 'full' && !!userSub &&
      ['optimal', 'client_monthly', 'pro', 'intro'].includes(userSub.planId);
    const hasPro = accessLevel === 'full' && !!userSub &&
      ['pro', 'intro'].includes(userSub.planId);

    // ── Roles ─────────────────────────────────────────────────────────────────

    const adminIds = getAdminIds();
    const isAdmin = adminIds.has(userId) || (!!chatId && adminIds.has(chatId));
    // Company = verified TrainerProfile with specialization "Компания"
    const isCompany = !!trainerProfile &&
      trainerProfile.verificationStatus === 'verified' &&
      trainerProfile.specialization === 'Компания';
    const isExpert = !!trainerProfile &&
      trainerProfile.verificationStatus === 'verified' &&
      !isCompany;

    // ── Active expert's profile (sequential — only runs if client has a link) ─

    const TRAINER_CARD_SELECT = {
      id: true,
      fullName: true,
      specialization: true,
      slug: true,
      city: true,
      publicStatus: true,
    } as const;

    let activeExpert: {
      id: number;
      fullName: string | null;
      specialization: string | null;
      slug: string | null;
      city: string | null;
      publicStatus: string;
    } | null = null;

    if (activeLink) {
      activeExpert = activeLink.trainerUserId
        ? await prisma.trainerProfile.findUnique({
            where: { userId: activeLink.trainerUserId },
            select: TRAINER_CARD_SELECT,
          })
        : await prisma.trainerProfile.findUnique({
            where: { chatId: activeLink.trainerId },
            select: TRAINER_CARD_SELECT,
          });
    }

    // ── Pending request's expert (only when no active link) ───────────────────

    let pendingExpert: { id: number; fullName: string | null; slug: string | null } | null = null;
    if (pendingReq && !activeLink) {
      pendingExpert = await prisma.trainerProfile.findUnique({
        where: { id: pendingReq.trainerProfileId },
        select: { id: true, fullName: true, slug: true },
      });
    }

    // ── Response ──────────────────────────────────────────────────────────────

    res.json({
      ok: true,
      user: {
        id: userRecord.id,
        createdAt: userRecord.createdAt.toISOString(),
      },
      identity: primaryIdentity ? {
        platform: primaryIdentity.platform,
        platformId: primaryIdentity.platformId,
        username: primaryIdentity.username ?? null,
        firstName: primaryIdentity.firstName ?? null,
      } : null,
      profile: profile ? {
        preferredName: profile.preferredName ?? null,
        currentWeightKg: profile.currentWeightKg ?? null,
        desiredWeightKg: profile.desiredWeightKg ?? null,
        heightCm: profile.heightCm ?? null,
        goalType: profile.goalType ?? null,
        dailyCaloriesKcal: profile.dailyCaloriesKcal ?? null,
        dailyProteinG: profile.dailyProteinG ?? null,
        dailyFatG: profile.dailyFatG ?? null,
        dailyCarbsG: profile.dailyCarbsG ?? null,
        city: profile.city ?? null,
      } : null,
      subscription: {
        planId: userSub?.planId ?? null,
        status: userSub?.status ?? null,
        currentPeriodEnd: userSub?.currentPeriodEnd?.toISOString() ?? null,
        accessLevel,
        hasOptimal,
        hasPro,
      },
      roles: {
        isClient: true,
        isExpert,
        isCompany,
        isAdmin,
      },
      expert: trainerProfile ? {
        exists: true,
        status: trainerProfile.verificationStatus,
        publicStatus: trainerProfile.publicStatus,
        slug: trainerProfile.slug ?? null,
        referralCode: trainerProfile.referralCode ?? null,
        fullName: trainerProfile.fullName ?? null,
        specialization: trainerProfile.specialization ?? null,
        city: trainerProfile.city ?? null,
      } : {
        exists: false,
        status: null,
        publicStatus: null,
        slug: null,
        referralCode: null,
        fullName: null,
        specialization: null,
        city: null,
      },
      company: isCompany && trainerProfile ? {
        exists: true,
        status: trainerProfile.verificationStatus,
        publicStatus: trainerProfile.publicStatus,
        slug: trainerProfile.slug ?? null,
        referralCode: trainerProfile.referralCode ?? null,
        name: trainerProfile.fullName ?? null,
        city: trainerProfile.city ?? null,
      } : {
        exists: false,
        status: null,
        publicStatus: null,
        slug: null,
        referralCode: null,
        name: null,
        city: null,
      },
      expertApplication: expertApp ? {
        exists: true,
        status: expertApp.status,
        adminComment: expertApp.adminComment ?? null,
        createdAt: expertApp.createdAt.toISOString(),
      } : {
        exists: false,
        status: null,
        adminComment: null,
        createdAt: null,
      },
      clientExpert: {
        hasExpert: !!activeLink,
        expert: activeExpert ? {
          id: activeExpert.id,
          fullName: activeExpert.fullName ?? null,
          specialization: activeExpert.specialization ?? null,
          slug: activeExpert.slug ?? null,
          city: activeExpert.city ?? null,
          publicStatus: activeExpert.publicStatus,
        } : null,
        pendingRequest: pendingReq && !activeLink ? {
          id: pendingReq.id,
          status: pendingReq.status,
          createdAt: pendingReq.createdAt.toISOString(),
          expert: pendingExpert ? {
            id: pendingExpert.id,
            fullName: pendingExpert.fullName ?? null,
            slug: pendingExpert.slug ?? null,
          } : null,
        } : null,
      },
      auth: {
        currentMethod: platform,
        identities: {
          telegram: tgIdentity ? {
            connected: true,
            username: tgIdentity.username ?? null,
            platformId: tgIdentity.platformId,
          } : { connected: false, username: null, platformId: null },
          max: maxIdentity ? {
            connected: true,
            username: maxIdentity.username ?? null,
            platformId: maxIdentity.platformId,
          } : { connected: false, username: null, platformId: null },
          phone: { connected: false, phoneMasked: null },
        },
      },
    });
  } catch (err) {
    console.error('[web/me] error:', (err as Error).message);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;
