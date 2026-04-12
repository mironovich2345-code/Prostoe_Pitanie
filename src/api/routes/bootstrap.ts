import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';
import { normalizeOfferType } from '../../utils/referral';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    // Lazily sync Telegram username and userId (fire-and-forget, non-fatal)
    const tgUsername = req.telegramUser?.username ?? null;
    const userId = req.userId;
    prisma.userProfile.upsert({
      where: { chatId },
      update: { telegramUsername: tgUsername, ...(userId ? { userId } : {}) },
      create: { chatId, telegramUsername: tgUsername, ...(userId ? { userId } : {}) },
    }).catch((e) => console.warn('[bootstrap] fire-and-forget upsert failed:', (e as Error).message));

    // Use explicit select on every query to avoid touching new nullable columns
    // (userId, trainerUserId, clientUserId) that may not exist if migrations are pending.
    let step = 'parallel queries';
    const [profile, trainerProfile, subscription, clientLink] = await Promise.all([
      prisma.userProfile.findUnique({
        where: { chatId },
        select: {
          heightCm: true, currentWeightKg: true, desiredWeightKg: true,
          dailyCaloriesKcal: true, dailyProteinG: true, dailyFatG: true,
          dailyCarbsG: true, dailyFiberG: true, goalType: true,
          notificationsEnabled: true, notificationCount: true, notificationTimes: true,
          city: true, timezone: true, preferredName: true,
          referralCode: true, avatarData: true, trainerOfferType: true, referredByRole: true,
        },
      }),
      prisma.trainerProfile.findUnique({
        where: { chatId },
        select: {
          verificationStatus: true, bio: true, specialization: true,
          referralCode: true, fullName: true, socialLink: true,
          documentLink: true, appliedAt: true, avatarData: true,
        },
      }),
      prisma.subscription.findUnique({
        where: { chatId },
        select: {
          planId: true, status: true, trialEndsAt: true,
          currentPeriodEnd: true, autoRenew: true,
        },
      }),
      prisma.trainerClientLink.findFirst({
        where: { clientId: chatId, status: 'active' },
        select: {
          trainerId: true, fullHistoryAccess: true,
          canViewPhotos: true, connectedAt: true,
        },
      }),
    ]);

    let connectedTrainerProfile: { fullName: string | null; avatarData: string | null } | null = null;
    if (clientLink) {
      step = 'connectedTrainerProfile';
      connectedTrainerProfile = await prisma.trainerProfile.findUnique({
        where: { chatId: clientLink.trainerId },
        select: { fullName: true, avatarData: true },
      });
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
        referralCode: profile.referralCode,
        avatarData: profile.avatarData ?? null,
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
