/**
 * Expert-acquisition referral utilities.
 *
 * Completely separate from the client-referral system (ref_ / trf_ / crf_).
 * Deep-link prefix: erf_ (Expert Referral)
 *
 * Flow:
 *   1. Referrer (expert or company) calls GET /api/expert-referral/link
 *      → gets erf_{TrainerProfile.referralCode} deeplink
 *   2. Future expert clicks the bot link → bot.start fires with payload erf_CODE
 *      → applyExpertAcquisitionCode() stores it in UserProfile.expertReferralSourceCode
 *   3. Future expert submits application (POST /api/expert/apply) — no change needed here
 *   4. Admin approves → trainer_approve_ callback fires
 *      → createExpertAcquisitionRecord() resolves the code, creates ExpertAcquisition
 */

import prisma from '../db';

export const EXPERT_REFERRAL_PREFIX = 'erf_';

// ─── Deeplink ─────────────────────────────────────────────────────────────────

/** Build a shareable expert-acquisition deeplink. */
export function buildExpertAcquisitionLink(referralCode: string): string {
  const botUsername = process.env.BOT_USERNAME ?? '';
  const payload = `${EXPERT_REFERRAL_PREFIX}${referralCode}`;
  if (!botUsername) return payload;
  return `https://t.me/${botUsername}?start=${payload}`;
}

// ─── Attribution (step 2: bot start handler) ──────────────────────────────────

/**
 * Store the expert-acquisition code in the future expert's UserProfile.
 * Called from bot.start() when payload starts with 'erf_'.
 * Idempotent — re-setting the same code is a no-op.
 * Never throws.
 */
export async function applyExpertAcquisitionCode(
  chatId: string,
  payload: string, // full start_param e.g. "erf_ABCD1234"
): Promise<void> {
  if (!payload.startsWith(EXPERT_REFERRAL_PREFIX)) return;
  const code = payload.slice(EXPERT_REFERRAL_PREFIX.length).trim().toUpperCase();
  if (!code) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.userProfile.upsert as (args: any) => Promise<any>)({
      where: { chatId },
      update: { expertReferralSourceCode: code },
      create: { chatId, expertReferralSourceCode: code },
    });
  } catch {
    // Non-critical — ignore errors silently
  }
}

// ─── Attribution record creation (step 4: admin approval hook) ───────────────

type ExpertAcquisitionDb = {
  create(args: { data: object }): Promise<unknown>;
  findUnique(args: object): Promise<{ id: number } | null>;
};

function getEADb(): ExpertAcquisitionDb {
  return (prisma as unknown as { expertAcquisition: ExpertAcquisitionDb }).expertAcquisition;
}

export const PHASE1_DAYS = 30;

/**
 * Create the ExpertAcquisition attribution record when an expert is approved.
 * Looks up UserProfile.expertReferralSourceCode to find the referrer.
 *
 * Guards:
 *  - no code stored → skip (no attribution)
 *  - code resolves to no TrainerProfile → skip
 *  - record already exists for this expert → skip (idempotent)
 *
 * Never throws — call from approval handler without awaiting if needed.
 */
export async function createExpertAcquisitionRecord(
  approvedChatId: string,
  approvedUserId: string | null,
): Promise<void> {
  try {
    // Check for existing record first (idempotent)
    const existing = await getEADb().findUnique({
      where: { invitedExpertChatId: approvedChatId } as object,
    });
    if (existing) return;

    // Look up stored referral code
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const up = await (prisma.userProfile.findUnique as (args: any) => Promise<any>)({
      where: { chatId: approvedChatId },
      select: { expertReferralSourceCode: true },
    });
    const code = up?.expertReferralSourceCode as string | null;
    if (!code) return; // no expert referral attribution

    // Resolve the referrer via TrainerProfile.referralCode
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const referrerProfile = await (prisma.trainerProfile.findFirst as (args: any) => Promise<any>)({
      where: { referralCode: code, verificationStatus: 'verified' },
      select: { chatId: true, userId: true, specialization: true },
    });
    if (!referrerProfile) return;
    if (referrerProfile.chatId === approvedChatId) return; // self-referral guard

    const referrerType: 'expert' | 'company' =
      referrerProfile.specialization === 'Компания' ? 'company' : 'expert';

    const now = new Date();
    const phase1StartsAt = now;
    const phase1EndsAt = new Date(now.getTime() + PHASE1_DAYS * 24 * 60 * 60 * 1000);

    await getEADb().create({
      data: {
        invitedExpertChatId: approvedChatId,
        invitedExpertUserId: approvedUserId ?? null,
        referrerChatId: referrerProfile.chatId,
        referrerUserId: referrerProfile.userId ?? null,
        referrerType,
        referralCode: code,
        phase1StartsAt,
        phase1EndsAt,
        phase1ClientCount: 0,
        isQualified: false,
        qualifiedAt: null,
        isActive: true,
        updatedAt: now,
      },
    });
  } catch (err) {
    console.error('[expertReferral] Failed to create ExpertAcquisition record:', err);
  }
}
