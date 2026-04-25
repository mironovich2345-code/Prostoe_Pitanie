import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';
import { normalizeOfferType } from '../../utils/referral';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const platform = req.platform ?? 'telegram';
  const userId = req.userId;

  console.info(`[bootstrap] platform=${platform} chatId_prefix=${chatId.slice(0, 10)} hasUserId=${!!userId}`);

  try {
    // ── Lazy profile sync (fire-and-forget, non-fatal) ────────────────────────
    //
    // BUG that this fixes:
    //   Old code always upserted WHERE chatId. When userId is already attached to
    //   a UserProfile row with a DIFFERENT chatId (e.g. after account linking, or
    //   a prior Telegram profile backfill), the upsert found nothing by chatId →
    //   tried CREATE with the same userId → Unique constraint failed on (userId).
    //
    // Fix: when userId is known, upsert WHERE userId (the real unique key).
    //   If a profile exists by userId (any chatId) → UPDATE it (no new row).
    //   If no profile exists by userId → CREATE at current chatId.
    //   When userId is unknown → fall back to chatId-keyed upsert (legacy path).
    //
    // Guard: never overwrite telegramUsername with null from a MAX request —
    //   a linked profile already has the Telegram username from the TG identity.
    const tgUsername = req.telegramUser?.username ?? null;
    const syncUpdate: Record<string, unknown> = {};
    // Only set telegramUsername when the request actually carries it (Telegram path)
    if (platform === 'telegram' && tgUsername !== null) {
      syncUpdate.telegramUsername = tgUsername;
    }

    if (userId) {
      prisma.userProfile.upsert({
        where: { userId },
        update: syncUpdate,
        create: { chatId, telegramUsername: tgUsername, userId },
      }).catch(async (e) => {
        const msg = (e as Error).message;
        console.warn(`[bootstrap] fire-and-forget sync failed: ${msg} | platform=${platform} hasUserId=${!!userId}`);
        // Safe post-failure diagnostic (no tokens, no full IDs)
        try {
          const [byUid, byChat] = await Promise.all([
            prisma.userProfile.findFirst({ where: { userId }, select: { chatId: true, userId: true } }).catch(() => null),
            prisma.userProfile.findUnique({ where: { chatId }, select: { chatId: true, userId: true } }).catch(() => null),
          ]);
          console.warn(
            `[bootstrap] conflict diag |`,
            `byUserId: found=${!!byUid} chatIdPrefix=${byUid?.chatId?.slice(0, 10) ?? 'none'} |`,
            `byChatId: found=${!!byChat} hasUserId=${!!byChat?.userId}`,
          );
        } catch { /* ignore secondary diagnostic errors */ }
      });
    } else {
      // Legacy path: no userId available (e.g. Telegram bot user without resolveUserId)
      prisma.userProfile.upsert({
        where: { chatId },
        update: { telegramUsername: tgUsername },
        create: { chatId, telegramUsername: tgUsername },
      }).catch((e) => console.warn('[bootstrap] fire-and-forget upsert failed:', (e as Error).message));
    }

    // Use explicit select on every query to avoid touching new nullable columns
    // (userId, trainerUserId, clientUserId) that may not exist if migrations are pending.
    // userId-first: after account linking, MAX users resolve to canonical userId and
    // must see the canonical profile — not a newly created MAX-chatId profile.
    let step = 'parallel queries';

    const profileSelect = {
      chatId: true,
      userId: true,
      heightCm: true, currentWeightKg: true, desiredWeightKg: true,
      dailyCaloriesKcal: true, dailyProteinG: true, dailyFatG: true,
      dailyCarbsG: true, dailyFiberG: true, goalType: true,
      notificationsEnabled: true, notificationCount: true, notificationTimes: true,
      city: true, timezone: true, preferredName: true,
      sex: true, birthDate: true, activityLevel: true,
      referralCode: true, avatarData: true, trainerOfferType: true, referredByRole: true,
      goalStartWeightKg: true,
    } as const;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function fetchProfile(): Promise<any> {
      if (userId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const byUserId = await (prisma.userProfile.findFirst as (args: any) => Promise<any>)({
          where: { userId },
          select: profileSelect,
        });
        if (byUserId) return byUserId;
        // Fallback: legacy chatId record (backfill userId if missing)
        const legacy = await prisma.userProfile.findUnique({ where: { chatId }, select: profileSelect });
        if (legacy && !legacy.userId) {
          prisma.userProfile.update({ where: { chatId }, data: { userId } }).catch(() => {});
        }
        return legacy;
      }
      return prisma.userProfile.findUnique({ where: { chatId }, select: profileSelect });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function fetchTrainerProfile(): Promise<any> {
      const select = {
        chatId: true, userId: true,
        verificationStatus: true, bio: true, specialization: true,
        referralCode: true, fullName: true, socialLink: true,
        documentLink: true, appliedAt: true, avatarData: true,
      };
      if (userId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const byPrimary = await (prisma.trainerProfile.findFirst as (args: any) => Promise<any>)({
          where: { OR: [{ chatId }, { userId }] },
          select,
        });
        if (byPrimary) {
          // Backfill userId on TrainerProfile if missing
          if (!byPrimary.userId) {
            prisma.trainerProfile.update({ where: { chatId: byPrimary.chatId }, data: { userId } }).catch(() => {});
          }
          return byPrimary;
        }

        // Cross-platform safety net: trainer profile was created on the OTHER platform and
        // its userId is still null (not yet backfilled after account linking).
        // Scan all UserIdentity records for this userId to find alternate chatIds.
        // This runs at most once per link event — on the first miss the update() below backfills
        // userId so every subsequent call hits the primary OR path above.
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const identities = await (prisma.userIdentity.findMany as (args: any) => Promise<any>)({
            where: { userId },
            select: { platform: true, platformId: true },
          });
          for (const id of identities) {
            const altChatId = id.platform === 'telegram' ? id.platformId : `max_${id.platformId}`;
            if (altChatId === chatId) continue; // already tried in primary query
            const found = await prisma.trainerProfile.findUnique({ where: { chatId: altChatId }, select });
            if (found) {
              // Backfill so the next bootstrap call hits the primary path
              prisma.trainerProfile.update({ where: { chatId: altChatId }, data: { userId } }).catch(() => {});
              return found;
            }
          }
        } catch (e) {
          console.warn('[bootstrap] cross-platform trainerProfile scan failed:', (e as Error).message);
        }
      }
      return prisma.trainerProfile.findUnique({ where: { chatId }, select });
    }

    // Client link — OR on clientUserId for cross-platform visibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function fetchClientLink(): Promise<any> {
      const select = {
        trainerId: true, trainerUserId: true,
        fullHistoryAccess: true, canViewPhotos: true, connectedAt: true,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const linkWhere: any = userId
        ? { OR: [{ clientId: chatId }, { clientUserId: userId }], status: 'active' }
        : { clientId: chatId, status: 'active' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (prisma.trainerClientLink.findFirst as (args: any) => Promise<any>)({
        where: linkWhere,
        select,
      });
    }

    // Fetch subscription: prefer UserSubscription (userId-keyed, written by payment webhook)
    // over the legacy Subscription (chatId-keyed, written by admin). After a successful payment,
    // the webhook calls activateSubscription() which writes ONLY to UserSubscription; the legacy
    // table is not touched. Reading legacy here would show stale "canceled" even after re-payment.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function fetchSubscription(): Promise<any> {
      if (userId) {
        const userSub = await (prisma as unknown as { userSubscription: { findUnique(a: any): Promise<any> } })
          .userSubscription.findUnique({ where: { userId } });
        if (userSub) return userSub;
      }
      // Fallback: legacy chatId-keyed table (no userId yet, or new user without UserSubscription)
      return prisma.subscription.findUnique({
        where: { chatId },
        select: { planId: true, status: true, trialEndsAt: true, currentPeriodEnd: true, autoRenew: true },
      });
    }

    const [profile, trainerProfile, subscription, clientLink] = await Promise.all([
      fetchProfile(),
      fetchTrainerProfile(),
      fetchSubscription(),
      fetchClientLink(),
    ]);

    let connectedTrainerProfile: { fullName: string | null; avatarData: string | null } | null = null;
    if (clientLink) {
      step = 'connectedTrainerProfile';
      // Use trainerUserId if available (cross-platform trainer lookup)
      const trainerSelect = { fullName: true, avatarData: true };
      if (clientLink.trainerUserId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        connectedTrainerProfile = await (prisma.trainerProfile.findFirst as (args: any) => Promise<any>)({
          where: { OR: [{ chatId: clientLink.trainerId }, { userId: clientLink.trainerUserId }] },
          select: trainerSelect,
        });
      } else {
        connectedTrainerProfile = await prisma.trainerProfile.findUnique({
          where: { chatId: clientLink.trainerId },
          select: trainerSelect,
        });
      }
    }

    res.json({
      chatId,
      telegramUser: req.telegramUser,
      profile: profile ? {
        heightCm: profile.heightCm,
        currentWeightKg: profile.currentWeightKg,
        desiredWeightKg: profile.desiredWeightKg,
        dailyCaloriesKcal: profile.dailyCaloriesKcal,
        dailyProteinG: profile.dailyProteinG,
        dailyFatG: profile.dailyFatG,
        dailyCarbsG: profile.dailyCarbsG,
        dailyFiberG: profile.dailyFiberG,
        goalType: profile.goalType,
        notificationsEnabled: profile.notificationsEnabled,
        notificationCount: profile.notificationCount,
        notificationTimes: profile.notificationTimes,
        city: profile.city,
        timezone: profile.timezone,
        preferredName: profile.preferredName,
        sex: profile.sex,
        birthDate: profile.birthDate ? profile.birthDate.toISOString() : null,
        activityLevel: profile.activityLevel,
        referralCode: profile.referralCode,
        avatarData: profile.avatarData ?? null,
        goalStartWeightKg: profile.goalStartWeightKg ?? null,
      } : null,
      trainerOfferType: normalizeOfferType(profile?.trainerOfferType),
      referralSource: (profile?.referredByRole === 'trainer' || profile?.referredByRole === 'company')
        ? (profile.referredByRole as 'trainer' | 'company')
        : null,
      trainerProfile: trainerProfile ? {
        verificationStatus: trainerProfile.verificationStatus,
        bio: trainerProfile.bio,
        specialization: trainerProfile.specialization,
        referralCode: trainerProfile.referralCode,
        fullName: trainerProfile.fullName,
        socialLink: trainerProfile.socialLink,
        documentLink: trainerProfile.documentLink,
        appliedAt: trainerProfile.appliedAt,
        avatarData: trainerProfile.avatarData,
      } : null,
      subscription: subscription ? {
        planId: subscription.planId,
        status: subscription.status,
        trialEndsAt: subscription.trialEndsAt,
        currentPeriodEnd: subscription.currentPeriodEnd,
        autoRenew: subscription.autoRenew,
        // True when YooKassa has a saved payment method for this user (providerSubId set).
        // Used by the UI to show/hide the "Disable auto-renewal" button.
        hasPaymentMethod: !!(subscription.providerSubId),
      } : null,
      connectedTrainer: clientLink ? {
        trainerId: clientLink.trainerId,
        fullName: connectedTrainerProfile?.fullName ?? null,
        avatarData: connectedTrainerProfile?.avatarData ?? null,
        fullHistoryAccess: clientLink.fullHistoryAccess,
        canViewPhotos: clientLink.canViewPhotos,
        connectedAt: clientLink.connectedAt,
      } : null,
    });
  } catch (err) {
    const e = err as Error;
    console.error('[bootstrap] 500 error:', {
      message: e.message,
      stack: e.stack?.split('\n').slice(0, 5).join(' | '),
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
