import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    // Lazily sync Telegram username and userId (fire-and-forget)
    const tgUsername = req.telegramUser?.username ?? null;
    const userId = req.userId;
    prisma.userProfile.upsert({
      where: { chatId },
      update: { telegramUsername: tgUsername, ...(userId ? { userId } : {}) },
      create: { chatId, telegramUsername: tgUsername, ...(userId ? { userId } : {}) },
    }).catch(() => null);


    const [profile, trainerProfile, subscription, clientLink] = await Promise.all([
      prisma.userProfile.findUnique({ where: { chatId } }),
      prisma.trainerProfile.findUnique({ where: { chatId } }),
      prisma.subscription.findUnique({ where: { chatId } }),
      prisma.trainerClientLink.findFirst({
        where: { clientId: chatId, status: 'active' }
      }),
    ]);

    let connectedTrainerProfile: { fullName: string | null; avatarData: string | null } | null = null;
    if (clientLink) {
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
    console.error('[bootstrap]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
