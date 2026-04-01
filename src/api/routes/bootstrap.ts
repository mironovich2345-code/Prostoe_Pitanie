import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const [profile, trainerProfile, subscription, clientLink] = await Promise.all([
      prisma.userProfile.findUnique({ where: { chatId } }),
      prisma.trainerProfile.findUnique({ where: { chatId } }),
      prisma.subscription.findUnique({ where: { chatId } }),
      prisma.trainerClientLink.findFirst({
        where: { clientId: chatId, status: 'active' }
      }),
    ]);

    let connectedTrainerName: string | null = null;
    if (clientLink) {
      const trainerUser = await prisma.userProfile.findUnique({
        where: { chatId: clientLink.trainerId },
        select: { chatId: true }
      });
      connectedTrainerName = trainerUser ? `Тренер (${clientLink.trainerId})` : null;
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
        name: connectedTrainerName,
        fullHistoryAccess: clientLink.fullHistoryAccess,
        connectedAt: clientLink.connectedAt,
      } : null,
    });
  } catch (err) {
    console.error('[bootstrap]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
