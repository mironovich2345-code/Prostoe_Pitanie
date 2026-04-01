import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

const router = Router();

// GET /api/trainer/clients — list trainer's clients
router.get('/clients', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const trainerProfile = await prisma.trainerProfile.findUnique({ where: { chatId } });
    if (!trainerProfile || trainerProfile.verificationStatus !== 'verified') {
      res.status(403).json({ error: 'Not a verified trainer' });
      return;
    }
    const links = await prisma.trainerClientLink.findMany({
      where: { trainerId: chatId, status: { in: ['active', 'frozen'] } },
    });
    const clientIds = links.map(l => l.clientId);
    const [profiles, subscriptions] = await Promise.all([
      prisma.userProfile.findMany({ where: { chatId: { in: clientIds } } }),
      prisma.subscription.findMany({ where: { chatId: { in: clientIds } } }),
    ]);
    const profileMap = Object.fromEntries(profiles.map(p => [p.chatId, p]));
    const subMap = Object.fromEntries(subscriptions.map(s => [s.chatId, s]));
    const clients = links.map(link => ({
      link: { id: link.id, clientId: link.clientId, status: link.status, fullHistoryAccess: link.fullHistoryAccess, connectedAt: link.connectedAt },
      profile: profileMap[link.clientId] ?? null,
      subscription: subMap[link.clientId] ?? null,
    }));
    res.json({ clients });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/trainer/clients/:clientId — client card
router.get('/clients/:clientId', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const clientId = req.params['clientId'] as string;
  try {
    const link = await prisma.trainerClientLink.findFirst({
      where: { trainerId: chatId, clientId, status: { in: ['active', 'frozen'] } },
    });
    if (!link) {
      res.status(403).json({ error: 'Client not found or access denied' });
      return;
    }
    const [profile, subscription] = await Promise.all([
      prisma.userProfile.findUnique({ where: { chatId: clientId } }),
      prisma.subscription.findUnique({ where: { chatId: clientId } }),
    ]);
    res.json({ link, profile, subscription });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/trainer/clients/:clientId/stats
router.get('/clients/:clientId/stats', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const clientId = req.params['clientId'] as string;
  try {
    const link = await prisma.trainerClientLink.findFirst({
      where: { trainerId: chatId, clientId, status: { in: ['active', 'frozen'] } },
    });
    if (!link) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const since = link.fullHistoryAccess ? undefined : link.connectedAt;
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const [todayMeals, recentMeals, weights] = await Promise.all([
      prisma.mealEntry.findMany({ where: { chatId: clientId, createdAt: { gte: start, lte: end } } }),
      prisma.mealEntry.findMany({
        where: { chatId: clientId, ...(since ? { createdAt: { gte: since } } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.weightEntry.findMany({
        where: { chatId: clientId, ...(since ? { createdAt: { gte: since } } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    const profile = await prisma.userProfile.findUnique({ where: { chatId: clientId } });
    let todayCal = 0;
    for (const m of todayMeals) todayCal += m.caloriesKcal ?? 0;

    const maskPhotos = !link.canViewPhotos;
    const maskMeal = <T extends { photoFileId: string | null }>(m: T): T =>
      maskPhotos ? { ...m, photoFileId: null } : m;

    res.json({
      todayMeals: todayMeals.map(maskMeal),
      todayCalories: Math.round(todayCal),
      recentMeals: recentMeals.map(maskMeal),
      weightHistory: weights,
      profile,
      canViewPhotos: link.canViewPhotos,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/trainer/alerts — dashboard alerts
router.get('/alerts', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const trainerProfile = await prisma.trainerProfile.findUnique({ where: { chatId } });
    if (!trainerProfile || trainerProfile.verificationStatus !== 'verified') {
      res.status(403).json({ error: 'Not a verified trainer' });
      return;
    }
    const links = await prisma.trainerClientLink.findMany({
      where: { trainerId: chatId, status: 'active' },
    });
    const clientIds = links.map(l => l.clientId);
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const [todayMeals, subscriptions] = await Promise.all([
      prisma.mealEntry.findMany({ where: { chatId: { in: clientIds }, createdAt: { gte: start, lte: end } } }),
      prisma.subscription.findMany({ where: { chatId: { in: clientIds } } }),
    ]);
    const activeToday = new Set(todayMeals.map(m => m.chatId));
    const notLoggedToday = clientIds.filter(id => !activeToday.has(id));
    const expiringSoon = subscriptions.filter(s => {
      if (!s.currentPeriodEnd) return false;
      const daysLeft = (s.currentPeriodEnd.getTime() - Date.now()) / 86400000;
      return daysLeft >= 0 && daysLeft <= 3;
    });
    res.json({ notLoggedToday, expiringSoon, totalClients: clientIds.length, activeToday: activeToday.size });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/trainer/rewards
router.get('/rewards', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const rewards = await prisma.trainerReward.findMany({
      where: { trainerId: chatId },
      orderBy: { createdAt: 'desc' },
    });
    const total = rewards.reduce((s, r) => s + r.amountRub, 0);
    const available = rewards.filter(r => r.status === 'available').reduce((s, r) => s + r.amountRub, 0);
    const paidOut = rewards.filter(r => r.status === 'paid_out').reduce((s, r) => s + r.amountRub, 0);
    res.json({ rewards, summary: { total, available, paidOut } });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
