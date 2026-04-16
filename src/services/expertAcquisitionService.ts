/**
 * Expert-acquisition business logic.
 *
 * Two-phase earning model for recruited experts:
 *
 *   Phase 1 (first 30 days after approval):
 *     Earning rate = PHASE1_RATE (50%) applied to confirmed client subscription
 *     payments for clients connected in this window.
 *
 *   Qualification:
 *     If phase-1 client count > QUALIFICATION_THRESHOLD (5), the expert is "qualified".
 *
 *   Phase 2 (after phase 1 ends, only if qualified):
 *     Earning rate = PHASE2_RATE (100%) for clients connected AFTER phase 1 ends.
 *     Phase-1 clients are NOT retroactively reclassified.
 *
 * Revenue base:
 *   Payment records (userId = client's userId, status = 'succeeded').
 *   Joined through UserProfile.userId to resolve client chatId → userId.
 *   Legacy clients without a userId cannot contribute earnings yet (no Payment record).
 *
 * "Client attracted":
 *   A TrainerClientLink record where trainerId = expert's chatId,
 *   connectedAt falls in the appropriate window.
 *   De-duplicated per clientId — earliest connectedAt wins for phase classification.
 */

import prisma from '../db';

export const PHASE1_DAYS             = 30;
export const PHASE1_RATE             = 0.5;   // 50%
export const PHASE2_RATE             = 1.0;   // 100%
export const QUALIFICATION_THRESHOLD = 5;     // > 5 clients in phase 1 → qualified

// ─── DB type casts ────────────────────────────────────────────────────────────

interface EARecord {
  id: number;
  invitedExpertChatId: string;
  invitedExpertUserId: string | null;
  referrerChatId: string;
  referrerUserId: string | null;
  referrerType: string;
  referralCode: string;
  phase1StartsAt: Date;
  phase1EndsAt: Date;
  phase1ClientCount: number;
  isQualified: boolean;
  qualifiedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type EADb = {
  findMany(args: object): Promise<EARecord[]>;
  findUnique(args: object): Promise<EARecord | null>;
  findFirst(args: object): Promise<EARecord | null>;
  update(args: object): Promise<EARecord>;
};

function getEADb(): EADb {
  return (prisma as unknown as { expertAcquisition: EADb }).expertAcquisition;
}

// Payment table is not in the stale Prisma client — use as-any cast.
type PaymentDb = {
  aggregate(args: object): Promise<{ _sum: { amountRub: number | null } }>;
};
function getPaymentDb(): PaymentDb {
  return (prisma as unknown as { payment: PaymentDb }).payment;
}

// ─── Phase classification ─────────────────────────────────────────────────────

export type ClientPhase = 'phase1' | 'phase2' | 'pre_phase1' | 'unrelated';

export interface PhaseClassification {
  clientChatId: string;
  connectedAt: Date;
  phase: ClientPhase;
}

/**
 * Classify each of the expert's linked clients into a phase.
 * pre_phase1: connected before the acquisition was recorded (should be rare).
 * phase1:     connected during the 30-day qualification window.
 * phase2:     connected after phase 1 ends.
 */
export function classifyClients(
  clients: Array<{ trainerId: string; clientId: string; connectedAt: Date }>,
  acquisition: Pick<EARecord, 'phase1StartsAt' | 'phase1EndsAt'>,
): PhaseClassification[] {
  return clients.map(c => {
    let phase: ClientPhase;
    if (c.connectedAt < acquisition.phase1StartsAt) {
      phase = 'pre_phase1';
    } else if (c.connectedAt < acquisition.phase1EndsAt) {
      phase = 'phase1';
    } else {
      phase = 'phase2';
    }
    return { clientChatId: c.clientId, connectedAt: c.connectedAt, phase };
  });
}

// ─── Earnings helper ──────────────────────────────────────────────────────────

/**
 * Sum all succeeded subscription payments for the given set of client chatIds.
 * Maps chatIds → userIds through UserProfile, then queries Payment.
 * Clients without a userId (legacy) contribute 0 — no Payment record exists for them.
 */
async function sumSucceededPayments(clientChatIds: string[]): Promise<number> {
  if (clientChatIds.length === 0) return 0;

  // Map client chatIds to userIds via UserProfile (userId field is new; use as-any cast)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profiles = await (prisma.userProfile.findMany as (args: any) => Promise<any[]>)({
    where: { chatId: { in: clientChatIds } },
    select: { userId: true },
  });

  const userIds: string[] = profiles
    .map((p: { userId: string | null }) => p.userId)
    .filter((uid): uid is string => uid != null);

  if (userIds.length === 0) return 0;

  // Payment is not in the stale Prisma client — use the typed cast helper
  const agg = await getPaymentDb().aggregate({
    where: { userId: { in: userIds }, status: 'succeeded' },
    _sum: { amountRub: true },
  } as object);

  return agg._sum.amountRub ?? 0;
}

// ─── Stats calculator ─────────────────────────────────────────────────────────

export interface ExpertAcquisitionStats {
  acquisition: EARecord;

  // Phase 1
  phase1ClientCount: number;
  phase1ClientChatIds: string[];
  phase1EndsAt: Date;
  isPhase1Complete: boolean;     // true if current time >= phase1EndsAt

  // Qualification
  isQualified: boolean;

  // Phase 2
  phase2ClientCount: number;
  phase2ClientChatIds: string[];

  // Earnings (read model — referrer's share of client subscription revenue)
  phase1EarningsRub: number;    // sum(payments by phase-1 clients) × PHASE1_RATE
  phase2EarningsRub: number;    // sum(payments by phase-2 clients) × PHASE2_RATE (0 if not qualified)
  totalEarningsRub: number;
}

/**
 * Compute full stats for a single ExpertAcquisition record.
 *
 * Client links:
 *   Queries TrainerClientLink by trainerId (chatId) AND optionally trainerUserId.
 *   De-duplicates per clientId — earliest connectedAt wins for phase classification
 *   (avoids double-counting if a client disconnects and reconnects).
 *
 * Earnings:
 *   Based on succeeded Payment records for the relevant clients.
 *   Phase 1: 50% of gross; Phase 2: 100% of gross (only if qualified).
 */
export async function computeStats(acquisition: EARecord): Promise<ExpertAcquisitionStats> {
  const expertChatId = acquisition.invitedExpertChatId;
  const expertUserId = acquisition.invitedExpertUserId;
  const now = new Date();

  // Build OR filter to pick up links created before and after userId migration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkWhere: any = expertUserId
    ? { OR: [{ trainerId: expertChatId }, { trainerUserId: expertUserId }] }
    : { trainerId: expertChatId };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawLinks = await (prisma.trainerClientLink.findMany as (args: any) => Promise<any[]>)({
    where: linkWhere,
    select: { clientId: true, connectedAt: true, trainerId: true },
  });

  // De-duplicate by clientId: keep earliest connectedAt (first time this client appeared)
  const clientMap = new Map<string, { trainerId: string; clientId: string; connectedAt: Date }>();
  for (const l of rawLinks as Array<{ trainerId: string; clientId: string; connectedAt: Date }>) {
    const existing = clientMap.get(l.clientId);
    if (!existing || l.connectedAt < existing.connectedAt) {
      clientMap.set(l.clientId, { trainerId: l.trainerId, clientId: l.clientId, connectedAt: l.connectedAt });
    }
  }
  const uniqueLinks = Array.from(clientMap.values());

  const classified = classifyClients(uniqueLinks, acquisition);

  const phase1Clients = classified.filter(c => c.phase === 'phase1');
  const phase2Clients = classified.filter(c => c.phase === 'phase2');

  const phase1ChatIds = phase1Clients.map(c => c.clientChatId);
  const phase2ChatIds = phase2Clients.map(c => c.clientChatId);

  // Earnings from confirmed client subscription payments
  const phase1Gross = await sumSucceededPayments(phase1ChatIds);
  const phase1EarningsRub = Math.round(phase1Gross * PHASE1_RATE * 100) / 100;

  let phase2EarningsRub = 0;
  if (acquisition.isQualified) {
    const phase2Gross = await sumSucceededPayments(phase2ChatIds);
    phase2EarningsRub = Math.round(phase2Gross * PHASE2_RATE * 100) / 100;
  }

  return {
    acquisition,
    phase1ClientCount:   phase1Clients.length,
    phase1ClientChatIds: phase1ChatIds,
    phase1EndsAt:        acquisition.phase1EndsAt,
    isPhase1Complete:    now >= acquisition.phase1EndsAt,
    isQualified:         acquisition.isQualified,
    phase2ClientCount:   phase2Clients.length,
    phase2ClientChatIds: phase2ChatIds,
    phase1EarningsRub,
    phase2EarningsRub,
    totalEarningsRub: Math.round((phase1EarningsRub + phase2EarningsRub) * 100) / 100,
  };
}

// ─── Qualification refresh ────────────────────────────────────────────────────

/**
 * Recompute and persist the qualification status for an ExpertAcquisition record.
 *
 * Only transitions isQualified from false → true; never reverts.
 * Counts TrainerClientLink records during the phase-1 window.
 *
 * Call after each new TrainerClientLink creation for an attributed expert,
 * or on a periodic cron, or on demand via admin endpoint.
 */
export async function refreshQualification(acquisitionId: number): Promise<EARecord> {
  const db = getEADb();
  const acq = await db.findUnique({ where: { id: acquisitionId } as object });
  if (!acq) throw new Error(`ExpertAcquisition ${acquisitionId} not found`);

  const now = new Date();
  if (acq.isQualified) return acq; // already qualified — nothing to do

  const phase1Count = await prisma.trainerClientLink.count({
    where: {
      trainerId: acq.invitedExpertChatId,
      connectedAt: { gte: acq.phase1StartsAt, lt: acq.phase1EndsAt },
    },
  });

  const updates: Record<string, unknown> = { phase1ClientCount: phase1Count, updatedAt: now };

  if (phase1Count > QUALIFICATION_THRESHOLD) {
    updates['isQualified'] = true;
    updates['qualifiedAt'] = now;
  }

  return db.update({ where: { id: acquisitionId } as object, data: updates });
}

/**
 * Fire-and-forget qualification refresh for a newly-connected client.
 * Call this immediately after a TrainerClientLink is created for this expert.
 *
 * Looks up the ExpertAcquisition record for the expert, skips if none or already qualified,
 * then calls refreshQualification. Never throws.
 */
export function triggerQualificationRefresh(expertChatId: string): void {
  getEADb()
    .findFirst({ where: { invitedExpertChatId: expertChatId, isActive: true } as object })
    .then(async (acq) => {
      if (!acq || acq.isQualified) return;
      await refreshQualification(acq.id);
    })
    .catch(err => console.error('[expertAcquisition] triggerQualificationRefresh failed:', err));
}

// ─── Referrer stats: all recruits ─────────────────────────────────────────────

/**
 * Return all active ExpertAcquisition records where the given expert/company is the referrer.
 * Queries by chatId AND (if provided) by userId so that records created before and after
 * the userId migration are both included.
 */
export async function getRecruitsForReferrer(
  referrerChatId: string,
  referrerUserId?: string | null,
): Promise<EARecord[]> {
  const db = getEADb();

  if (referrerUserId) {
    return db.findMany({
      where: {
        OR: [
          { referrerChatId, isActive: true },
          { referrerUserId, isActive: true },
        ],
      } as object,
      orderBy: { createdAt: 'desc' } as object,
    });
  }

  return db.findMany({
    where: { referrerChatId, isActive: true } as object,
    orderBy: { createdAt: 'desc' } as object,
  });
}

/**
 * Return the ExpertAcquisition record for a given invited expert, if any.
 * Tries userId first (more reliable post-migration), falls back to chatId.
 */
export async function getAcquisitionForExpert(
  invitedChatId: string,
  invitedUserId?: string | null,
): Promise<EARecord | null> {
  const db = getEADb();

  // userId-first: findFirst since invitedExpertUserId has no @unique constraint
  if (invitedUserId) {
    const byUserId = await db.findFirst({
      where: { invitedExpertUserId: invitedUserId } as object,
    }).catch(() => null);
    if (byUserId) return byUserId;
  }

  // Fallback to chatId (@unique index)
  return db.findUnique({ where: { invitedExpertChatId: invitedChatId } as object });
}
