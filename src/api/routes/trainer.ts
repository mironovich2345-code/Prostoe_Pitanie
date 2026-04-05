import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

const router = Router();

/** Derive a human display name for a client, preferring trainer alias > preferredName > short fallback */
function clientDisplayName(alias: string | null | undefined, preferredName: string | null | undefined, chatId: string): string {
  if (alias?.trim()) return alias.trim();
  if (preferredName?.trim()) return preferredName.trim();
  return `Клиент …${chatId.slice(-4)}`;
}

// PATCH /api/trainer/profile — update fullName and/or avatarData
router.patch('/profile', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { fullName, avatarData } = req.body as { fullName?: string; avatarData?: string | null };
  try {
    const tp = await prisma.trainerProfile.findUnique({ where: { chatId } });
    if (!tp) { res.status(404).json({ error: 'Trainer profile not found' }); return; }

    const data: Record<string, unknown> = {};
    if (fullName !== undefined) data['fullName'] = fullName?.trim() || null;
    if (avatarData !== undefined) data['avatarData'] = avatarData ?? null;

    const updated = await prisma.trainerProfile.update({ where: { chatId }, data });
    res.json({ ok: true, fullName: updated.fullName, avatarData: updated.avatarData });
  } catch (err) {
    console.error('[trainer/profile PATCH]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
    const clients = links.map(link => {
      const profile = profileMap[link.clientId] ?? null;
      return {
        link: {
          id: link.id,
          clientId: link.clientId,
          status: link.status,
          fullHistoryAccess: link.fullHistoryAccess,
          connectedAt: link.connectedAt,
          clientAlias: link.clientAlias ?? null,
        },
        profile: profile,
        subscription: subMap[link.clientId] ?? null,
        displayName: clientDisplayName(link.clientAlias, profile?.preferredName, link.clientId),
      };
    });
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
    res.json({
      link: {
        id: link.id,
        status: link.status,
        fullHistoryAccess: link.fullHistoryAccess,
        connectedAt: link.connectedAt,
        clientAlias: link.clientAlias ?? null,
      },
      profile,
      subscription,
      displayName: clientDisplayName(link.clientAlias, profile?.preferredName, clientId),
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/trainer/clients/:clientId/alias — set trainer's private label for a client
router.patch('/clients/:clientId/alias', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const clientId = req.params['clientId'] as string;
  const { alias } = req.body as { alias?: string };
  try {
    const link = await prisma.trainerClientLink.findFirst({
      where: { trainerId: chatId, clientId, status: { in: ['active', 'frozen'] } },
    });
    if (!link) { res.status(404).json({ error: 'Client link not found' }); return; }
    const updated = await prisma.trainerClientLink.update({
      where: { id: link.id },
      data: { clientAlias: alias?.trim() || null },
    });
    res.json({ ok: true, clientAlias: updated.clientAlias });
  } catch (err) {
    console.error('[trainer/clients/:clientId/alias PATCH]', err);
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
      displayName: clientDisplayName(link.clientAlias, profile?.preferredName, clientId),
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
    const aliasMap = Object.fromEntries(links.map(l => [l.clientId, l.clientAlias]));

    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const [todayMeals, subscriptions, profiles] = await Promise.all([
      prisma.mealEntry.findMany({ where: { chatId: { in: clientIds }, createdAt: { gte: start, lte: end } } }),
      prisma.subscription.findMany({ where: { chatId: { in: clientIds } } }),
      prisma.userProfile.findMany({ where: { chatId: { in: clientIds } }, select: { chatId: true, preferredName: true } }),
    ]);
    const nameMap = Object.fromEntries(profiles.map(p => [p.chatId, p.preferredName]));
    const activeToday = new Set(todayMeals.map(m => m.chatId));
    const notLoggedToday = clientIds
      .filter(id => !activeToday.has(id))
      .map(id => ({ chatId: id, displayName: clientDisplayName(aliasMap[id], nameMap[id], id) }));
    const expiringSoon = subscriptions
      .filter(s => {
        if (!s.currentPeriodEnd) return false;
        const daysLeft = (s.currentPeriodEnd.getTime() - Date.now()) / 86400000;
        return daysLeft >= 0 && daysLeft <= 3;
      })
      .map(s => ({
        id: s.id,
        chatId: s.chatId,
        currentPeriodEnd: s.currentPeriodEnd,
        displayName: clientDisplayName(aliasMap[s.chatId], nameMap[s.chatId], s.chatId),
      }));
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
