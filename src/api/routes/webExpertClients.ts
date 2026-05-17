import express, { Response } from 'express';
import { requireWebAuth, WebAuthRequest } from '../middleware/webAuth';
import prisma from '../../db';
import { getAccessLevel } from '../../services/subscriptionService';
import type { UserSubscription } from '../../services/subscriptionService';

const router = express.Router();
router.use(requireWebAuth as express.RequestHandler);

// ─── Types ────────────────────────────────────────────────────────────────────

type AccessStatus = 'active_pro' | 'wrong_tariff' | 'unpaid' | 'unknown';

// Batch-accessible subset of UserSubscription for access computations.
interface SubRecord {
  planId: string;
  status: string;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  gracePeriodEnd: Date | null;
}

interface LegacySubRecord {
  chatId: string;
  planId: string;
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
}

// ─── Prisma cast for UserSubscription (not yet in generated client) ───────────

const userSubDb = (prisma as unknown as {
  userSubscription: {
    findMany(args: { where: { userId: { in: string[] } } }): Promise<(SubRecord & { userId: string })[]>;
    findUnique(args: { where: { userId: string } }): Promise<(SubRecord & { userId: string }) | null>;
  };
  subscription: {
    findMany(args: { where: { chatId: { in: string[] } }; select: Record<string, boolean> }): Promise<LegacySubRecord[]>;
    findUnique(args: { where: { chatId: string }; select: Record<string, boolean> }): Promise<LegacySubRecord | null>;
  };
}).userSubscription;

const legacySubDb = (prisma as unknown as {
  subscription: {
    findMany(args: { where: { chatId: { in: string[] } }; select: Record<string, boolean> }): Promise<LegacySubRecord[]>;
    findUnique(args: { where: { chatId: string }; select: Record<string, boolean> }): Promise<LegacySubRecord | null>;
  };
}).subscription;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function findVerifiedExpertProfile(userId: string) {
  const profile = await prisma.trainerProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      chatId: true,
      userId: true,
      verificationStatus: true,
      specialization: true,
    },
  });
  if (!profile || profile.verificationStatus !== 'verified') return null;
  // Companies are excluded — they are not individual experts.
  if (profile.specialization === 'Компания') return null;
  return profile;
}

function computeAccessStatus(sub: SubRecord | null, accessLevel: 'full' | 'basic'): AccessStatus {
  if (!sub) return 'unpaid';
  if (accessLevel === 'full') {
    return sub.planId === 'pro' || sub.planId === 'intro' ? 'active_pro' : 'wrong_tariff';
  }
  return 'unpaid';
}

function computeLegacyAccessLevel(leg: LegacySubRecord | null): 'full' | 'basic' {
  if (!leg) return 'basic';
  const now = new Date();
  if (leg.status === 'trial' && leg.trialEndsAt && leg.trialEndsAt > now) return 'full';
  if (leg.status === 'active' && leg.currentPeriodEnd && leg.currentPeriodEnd > now) return 'full';
  return 'basic';
}

function computeLegacyAccessStatus(leg: LegacySubRecord | null): AccessStatus {
  const level = computeLegacyAccessLevel(leg);
  if (level !== 'full') return 'unpaid';
  return leg!.planId === 'pro' || leg!.planId === 'intro' ? 'active_pro' : 'wrong_tariff';
}

// ─── GET /api/web/expert/clients ──────────────────────────────────────────────

router.get('/clients', async (req: WebAuthRequest, res: Response) => {
  const { userId } = req.webUser!;
  try {
    const trainer = await findVerifiedExpertProfile(userId);
    if (!trainer) { res.status(403).json({ error: 'not_expert' }); return; }

    // Build safe OR — never pass undefined to Prisma WHERE.
    // trainer.chatId is @unique NOT NULL in schema, always present.
    // trainer.userId may be null for legacy records (won't be for web-verified experts, but guard anyway).
    const trainerOr: Array<{ trainerUserId: string } | { trainerId: string }> = [];
    if (trainer.userId) trainerOr.push({ trainerUserId: trainer.userId });
    trainerOr.push({ trainerId: trainer.chatId });

    const links = await prisma.trainerClientLink.findMany({
      where: { status: 'active', OR: trainerOr },
      select: {
        id: true,
        clientId: true,
        clientUserId: true,
        connectedAt: true,
      },
      orderBy: { connectedAt: 'desc' },
    });

    if (links.length === 0) {
      res.json({ clients: [] }); return;
    }

    // Deduplicated IDs for batch queries.
    const seenUserIds = new Set<string>();
    const seenChatIds = new Set<string>();
    const profileOr: Array<{ userId: string } | { chatId: string }> = [];

    for (const link of links) {
      if (link.clientUserId && !seenUserIds.has(link.clientUserId)) {
        seenUserIds.add(link.clientUserId);
        profileOr.push({ userId: link.clientUserId });
      } else if (!link.clientUserId && link.clientId && !seenChatIds.has(link.clientId)) {
        seenChatIds.add(link.clientId);
        profileOr.push({ chatId: link.clientId });
      }
    }

    const uniqueClientUserIds = [...seenUserIds];
    const uniqueLegacyChatIds = [...seenChatIds];

    // Explicit types for batch-loaded data to avoid circular inference.
    type ProfileRow = {
      userId: string | null;
      chatId: string;
      preferredName: string | null;
      telegramUsername: string | null;
      city: string | null;
      goalType: string | null;
      currentWeightKg: number | null;
      desiredWeightKg: number | null;
      dailyCaloriesKcal: number | null;
    };
    type IdentityRow = { userId: string; platform: string; username: string | null; firstName: string | null };

    const legacySubSelect = { chatId: true, planId: true, status: true, trialEndsAt: true, currentPeriodEnd: true };

    // Batch load profiles, identities, new subs and legacy subs in parallel.
    const [profiles, identities, subscriptions, legacySubscriptions] = await Promise.all([
      profileOr.length > 0
        ? prisma.userProfile.findMany({
            where: { OR: profileOr },
            select: {
              userId: true,
              chatId: true,
              preferredName: true,
              telegramUsername: true,
              city: true,
              goalType: true,
              currentWeightKg: true,
              desiredWeightKg: true,
              dailyCaloriesKcal: true,
            },
          }) as Promise<ProfileRow[]>
        : Promise.resolve([] as ProfileRow[]),

      uniqueClientUserIds.length > 0
        ? prisma.userIdentity.findMany({
            where: { userId: { in: uniqueClientUserIds } },
            select: { userId: true, platform: true, username: true, firstName: true },
          }) as Promise<IdentityRow[]>
        : Promise.resolve([] as IdentityRow[]),

      uniqueClientUserIds.length > 0
        ? userSubDb.findMany({ where: { userId: { in: uniqueClientUserIds } } })
        : Promise.resolve([] as (SubRecord & { userId: string })[]),

      uniqueLegacyChatIds.length > 0
        ? legacySubDb.findMany({ where: { chatId: { in: uniqueLegacyChatIds } }, select: legacySubSelect })
        : Promise.resolve([] as LegacySubRecord[]),
    ]);

    // Build lookup maps.
    const profileByUserId  = new Map(profiles.filter(p => p.userId).map(p => [p.userId!, p]));
    const profileByChatId  = new Map(profiles.map(p => [p.chatId, p]));
    const subByUserId      = new Map(subscriptions.map(s => [s.userId, s]));
    const legSubByChatId   = new Map(legacySubscriptions.map(s => [s.chatId, s]));

    // Best identity per userId: prefer telegram.
    const identityByUserId = new Map<string, { username: string | null; firstName: string | null }>();
    for (const id of identities) {
      const cur = identityByUserId.get(id.userId);
      if (!cur || id.platform === 'telegram') {
        identityByUserId.set(id.userId, { username: id.username ?? null, firstName: id.firstName ?? null });
      }
    }

    const clients = links.map(link => {
      const profile = link.clientUserId
        ? profileByUserId.get(link.clientUserId)
        : profileByChatId.get(link.clientId);

      const identity = link.clientUserId ? identityByUserId.get(link.clientUserId) : null;

      const displayName =
        profile?.preferredName ??
        identity?.firstName ??
        identity?.username ??
        profile?.telegramUsername ??
        'Клиент';

      let accessStatus: AccessStatus;
      let subscriptionOut: { planId: string; status: string; accessLevel: string; currentPeriodEnd: string | null } | null;

      if (link.clientUserId) {
        const rawSub = subByUserId.get(link.clientUserId);
        const accessLevel = getAccessLevel((rawSub ?? null) as UserSubscription | null);
        accessStatus = computeAccessStatus(rawSub ?? null, accessLevel);
        subscriptionOut = rawSub ? {
          planId: rawSub.planId,
          status: rawSub.status,
          accessLevel,
          currentPeriodEnd: rawSub.currentPeriodEnd?.toISOString() ?? null,
        } : null;
      } else {
        const legSub = link.clientId ? legSubByChatId.get(link.clientId) ?? null : null;
        accessStatus = computeLegacyAccessStatus(legSub);
        const legLevel = computeLegacyAccessLevel(legSub);
        subscriptionOut = legSub ? {
          planId: legSub.planId,
          status: legSub.status,
          accessLevel: legLevel,
          currentPeriodEnd: legSub.currentPeriodEnd?.toISOString() ?? null,
        } : null;
      }

      return {
        linkId: String(link.id),
        clientUserId: link.clientUserId ?? null,
        displayName,
        username: identity?.username ?? profile?.telegramUsername ?? null,
        city: profile?.city ?? null,
        goalType: profile?.goalType ?? null,
        currentWeightKg: profile?.currentWeightKg ?? null,
        desiredWeightKg: profile?.desiredWeightKg ?? null,
        dailyCaloriesKcal: profile?.dailyCaloriesKcal ?? null,
        subscription: subscriptionOut,
        accessStatus,
        connectedAt: link.connectedAt.toISOString(),
      };
    });

    res.json({ clients });
  } catch (err) {
    console.error('[web/expert/clients] GET:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ─── GET /api/web/expert/clients/:linkId ──────────────────────────────────────

router.get('/clients/:linkId', async (req: WebAuthRequest, res: Response) => {
  const linkId = parseInt(String(req.params.linkId ?? ''), 10);
  if (isNaN(linkId)) { res.status(400).json({ error: 'invalid_link_id' }); return; }

  const { userId } = req.webUser!;
  try {
    const trainer = await findVerifiedExpertProfile(userId);
    if (!trainer) { res.status(403).json({ error: 'not_expert' }); return; }

    const link = await prisma.trainerClientLink.findUnique({
      where: { id: linkId },
      select: {
        id: true,
        clientId: true,
        clientUserId: true,
        trainerId: true,
        trainerUserId: true,
        status: true,
        connectedAt: true,
      },
    });

    if (!link || link.status !== 'active') {
      res.status(404).json({ error: 'not_found' }); return;
    }

    // Ownership check — link must belong to this expert.
    // At least one of the trainer fields must match.
    const isOwner =
      (link.trainerUserId && link.trainerUserId === trainer.userId) ||
      link.trainerId === trainer.chatId;
    if (!isOwner) { res.status(403).json({ error: 'forbidden' }); return; }

    // Build safe OR for profile lookup.
    const profileOr: Array<{ userId: string } | { chatId: string }> = [];
    if (link.clientUserId) profileOr.push({ userId: link.clientUserId });
    if (link.clientId)     profileOr.push({ chatId: link.clientId });

    if (profileOr.length === 0) {
      // Degenerate link with no client identifier — shouldn't happen.
      res.status(500).json({ error: 'link_has_no_client_id' }); return;
    }

    const legSubSelect = { chatId: true, planId: true, status: true, trialEndsAt: true, currentPeriodEnd: true };

    const [profile, identities, rawSub, rawLegSub] = await Promise.all([
      prisma.userProfile.findFirst({
        where: { OR: profileOr },
        select: {
          userId: true,
          chatId: true,
          preferredName: true,
          telegramUsername: true,
          city: true,
          goalType: true,
          currentWeightKg: true,
          desiredWeightKg: true,
          heightCm: true,
          dailyCaloriesKcal: true,
          dailyProteinG: true,
          dailyFatG: true,
          dailyCarbsG: true,
        },
      }),

      link.clientUserId
        ? prisma.userIdentity.findMany({
            where: { userId: link.clientUserId },
            select: { platform: true, username: true, firstName: true },
          })
        : Promise.resolve([] as { platform: string; username: string | null; firstName: string | null }[]),

      link.clientUserId
        ? userSubDb.findUnique({ where: { userId: link.clientUserId } })
        : Promise.resolve(null),

      (!link.clientUserId && link.clientId)
        ? legacySubDb.findUnique({ where: { chatId: link.clientId }, select: legSubSelect })
        : Promise.resolve(null),
    ]);

    const tgIdentity  = identities.find(i => i.platform === 'telegram');
    const anyIdentity = identities[0] ?? null;

    const displayName =
      profile?.preferredName ??
      tgIdentity?.firstName ?? anyIdentity?.firstName ??
      tgIdentity?.username  ?? anyIdentity?.username  ??
      profile?.telegramUsername ??
      'Клиент';

    let accessStatus: AccessStatus;
    let subscriptionOut: { planId: string; status: string; accessLevel: string; currentPeriodEnd: string | null } | null;

    if (link.clientUserId) {
      const accessLevel = getAccessLevel((rawSub ?? null) as UserSubscription | null);
      accessStatus = computeAccessStatus(rawSub ?? null, accessLevel);
      subscriptionOut = rawSub ? {
        planId: rawSub.planId,
        status: rawSub.status,
        accessLevel,
        currentPeriodEnd: rawSub.currentPeriodEnd?.toISOString() ?? null,
      } : null;
    } else {
      const legSub = rawLegSub ?? null;
      accessStatus = computeLegacyAccessStatus(legSub);
      const legLevel = computeLegacyAccessLevel(legSub);
      subscriptionOut = legSub ? {
        planId: legSub.planId,
        status: legSub.status,
        accessLevel: legLevel,
        currentPeriodEnd: legSub.currentPeriodEnd?.toISOString() ?? null,
      } : null;
    }

    res.json({
      ok: true,
      client: {
        linkId: String(link.id),
        userId: link.clientUserId ?? null,
        displayName,
        username: tgIdentity?.username ?? anyIdentity?.username ?? profile?.telegramUsername ?? null,
        city: profile?.city ?? null,
        goalType: profile?.goalType ?? null,
        currentWeightKg:  profile?.currentWeightKg  ?? null,
        desiredWeightKg:  profile?.desiredWeightKg  ?? null,
        heightCm:         profile?.heightCm         ?? null,
        dailyCaloriesKcal: profile?.dailyCaloriesKcal ?? null,
        dailyProteinG:    profile?.dailyProteinG    ?? null,
        dailyFatG:        profile?.dailyFatG        ?? null,
        dailyCarbsG:      profile?.dailyCarbsG      ?? null,
        subscription: subscriptionOut,
        accessStatus,
        connectedAt: link.connectedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('[web/expert/clients] GET /:linkId:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
