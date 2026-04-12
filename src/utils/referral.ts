import prisma from '../db';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 — easy to read

function randomCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

/** Generate a unique referral code for a user and persist it. */
export async function ensureReferralCode(chatId: string): Promise<string> {
  const existing = await prisma.userProfile.findUnique({
    where: { chatId },
    select: { referralCode: true },
  });
  if (existing?.referralCode) return existing.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    try {
      const updated = await prisma.userProfile.upsert({
        where: { chatId },
        update: { referralCode: code },
        create: { chatId, referralCode: code },
        select: { referralCode: true },
      });
      return updated.referralCode!;
    } catch {
      // unique constraint violation → try next code
    }
  }
  throw new Error('Failed to generate unique referral code');
}

/** Build a shareable client referral link. */
export function buildReferralLink(code: string): string {
  const botUsername = process.env.BOT_USERNAME ?? '';
  if (!botUsername) return `ref_${code}`;
  return `https://t.me/${botUsername}?start=ref_${code}`;
}

/**
 * Apply a client referral code (first valid referral wins).
 * Returns 'ok' | 'not_found' | 'self' | 'already_locked'.
 */
export async function applyReferral(
  chatId: string,
  rawCode: string,
): Promise<'ok' | 'not_found' | 'self' | 'already_locked'> {
  const code = rawCode.trim().toUpperCase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const referrer = await (prisma.userProfile.findFirst as (args: any) => Promise<any>)({
    where: { referralCode: code },
    select: { chatId: true, userId: true },
  });
  if (!referrer) return 'not_found';
  if (referrer.chatId === chatId) return 'self';

  const me = await prisma.userProfile.findUnique({
    where: { chatId },
    select: { referralLockedAt: true },
  });
  if (me?.referralLockedAt) return 'already_locked';

  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { chatId: referrer.chatId },
    select: { verificationStatus: true },
  });
  const role = trainerProfile?.verificationStatus === 'verified' ? 'trainer' : 'client';
  const referredByUserId: string | null = referrer.userId ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.userProfile.upsert as (args: any) => Promise<any>)({
    where: { chatId },
    update: { referredBy: referrer.chatId, referredByUserId, referredByRole: role, referralLockedAt: new Date() },
    create: { chatId, referredBy: referrer.chatId, referredByUserId, referredByRole: role, referralLockedAt: new Date() },
  });

  return 'ok';
}

// ─── Trainer offer links ────────────────────────────────────────────────────

export const TRAINER_OFFER_IDS = ['1', '2', '3'] as const;
export type TrainerOfferId = typeof TRAINER_OFFER_IDS[number];

/** Canonical offer type keys used throughout the system. */
export type TrainerOfferType = 'one_time' | 'lifetime' | 'month_1rub';

export const TRAINER_OFFERS: Record<TrainerOfferId, { key: TrainerOfferType; title: string; desc: string; emoji: string }> = {
  '1': { key: 'one_time',   title: '100% от первой оплаты', desc: 'Тренер получает 100% суммы первого платежа клиента',             emoji: '💰' },
  '2': { key: 'lifetime',   title: '20% пожизненно',        desc: 'Тренер получает 20% с каждого платежа клиента навсегда',          emoji: '♾️' },
  '3': { key: 'month_1rub', title: 'Первый месяц за 1 ₽',   desc: 'Клиент получает первый месяц за 1 рубль — мощный оффер для привлечения', emoji: '🎁' },
};

/**
 * Normalize any stored offerType string to the canonical TrainerOfferType.
 * Handles legacy keys saved before the rename (first_payment, lifetime_20, first_month_1rub).
 * Returns null for unrecognised or absent values.
 */
export function normalizeOfferType(raw: string | null | undefined): TrainerOfferType | null {
  if (!raw) return null;
  if (raw === 'one_time'   || raw === 'first_payment')    return 'one_time';
  if (raw === 'lifetime'   || raw === 'lifetime_20')      return 'lifetime';
  if (raw === 'month_1rub' || raw === 'first_month_1rub') return 'month_1rub';
  return null;
}

// ─── Shared deep-link helpers ───────────────────────────────────────────────

/** Parse a prefixed offer payload (trf_ or crf_). Returns null if invalid. */
function parseOfferPayload(
  prefix: string,
  payload: string,
): { code: string; offerId: TrainerOfferId } | null {
  if (!payload.startsWith(prefix)) return null;
  const rest = payload.slice(prefix.length); // "XXXXXXXX_1"
  const lastUnderscore = rest.lastIndexOf('_');
  if (lastUnderscore === -1) return null;
  const code = rest.slice(0, lastUnderscore).toUpperCase();
  const offerId = rest.slice(lastUnderscore + 1) as TrainerOfferId;
  if (!(TRAINER_OFFER_IDS as readonly string[]).includes(offerId)) return null;
  if (code.length !== 8) return null;
  return { code, offerId };
}

// ─── Trainer offer links ─────────────────────────────────────────────────────

/** Build a trainer offer deep link: trf_{code}_{offerId} */
export function buildTrainerOfferLink(referralCode: string, offerId: TrainerOfferId): string {
  const botUsername = process.env.BOT_USERNAME ?? '';
  const payload = `trf_${referralCode}_${offerId}`;
  if (!botUsername) return payload;
  return `https://t.me/${botUsername}?start=${payload}`;
}

// ─── Company offer links ──────────────────────────────────────────────────────

/** Build a company offer deep link: crf_{code}_{offerId} */
export function buildCompanyOfferLink(referralCode: string, offerId: TrainerOfferId): string {
  const botUsername = process.env.BOT_USERNAME ?? '';
  const payload = `crf_${referralCode}_${offerId}`;
  if (!botUsername) return payload;
  return `https://t.me/${botUsername}?start=${payload}`;
}

// ─── Shared apply helper ─────────────────────────────────────────────────────

type ApplyResult = 'ok' | 'not_found' | 'not_verified' | 'self' | 'already_locked';

async function applyOfferReferral(
  chatId: string,
  code: string,
  offerId: TrainerOfferId,
  requiredSpecialization: 'trainer' | 'company',
): Promise<ApplyResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const referrer = await (prisma.userProfile.findFirst as (args: any) => Promise<any>)({
    where: { referralCode: code },
    select: { chatId: true, userId: true },
  });
  if (!referrer) return 'not_found';
  if (referrer.chatId === chatId) return 'self';

  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { chatId: referrer.chatId },
    select: { verificationStatus: true, specialization: true },
  });
  if (trainerProfile?.verificationStatus !== 'verified') return 'not_verified';

  // Trainer links must come from non-company profiles; company links from company profiles
  const isCompany = trainerProfile.specialization === 'Компания';
  if (requiredSpecialization === 'company' && !isCompany) return 'not_verified';
  if (requiredSpecialization === 'trainer' && isCompany) return 'not_verified';

  const me = await prisma.userProfile.findUnique({
    where: { chatId },
    select: { referralLockedAt: true },
  });
  if (me?.referralLockedAt) return 'already_locked';

  const offerType = TRAINER_OFFERS[offerId].key;
  const referredByUserId: string | null = referrer.userId ?? null;
  const role = requiredSpecialization; // 'trainer' | 'company'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.userProfile.upsert as (args: any) => Promise<any>)({
    where: { chatId },
    update: {
      referredBy: referrer.chatId,
      referredByUserId,
      referredByRole: role,
      trainerOfferType: offerType,
      referralLockedAt: new Date(),
    },
    create: {
      chatId,
      referredBy: referrer.chatId,
      referredByUserId,
      referredByRole: role,
      trainerOfferType: offerType,
      referralLockedAt: new Date(),
    },
  });

  return 'ok';
}

// ─── Public apply functions ───────────────────────────────────────────────────

/**
 * Apply a trainer referral offer link (first valid referral wins).
 * Returns 'ok' | 'not_found' | 'not_trainer' | 'self' | 'already_locked'.
 */
export async function applyTrainerReferral(
  chatId: string,
  payload: string,
): Promise<'ok' | 'not_found' | 'not_trainer' | 'self' | 'already_locked'> {
  const parsed = parseOfferPayload('trf_', payload);
  if (!parsed) return 'not_found';
  const result = await applyOfferReferral(chatId, parsed.code, parsed.offerId, 'trainer');
  if (result === 'not_verified') return 'not_trainer';
  return result as 'ok' | 'not_found' | 'self' | 'already_locked';
}

/**
 * Apply a company referral offer link (first valid referral wins).
 * Returns 'ok' | 'not_found' | 'not_company' | 'self' | 'already_locked'.
 */
export async function applyCompanyReferral(
  chatId: string,
  payload: string,
): Promise<'ok' | 'not_found' | 'not_company' | 'self' | 'already_locked'> {
  const parsed = parseOfferPayload('crf_', payload);
  if (!parsed) return 'not_found';
  const result = await applyOfferReferral(chatId, parsed.code, parsed.offerId, 'company');
  if (result === 'not_verified') return 'not_company';
  return result as 'ok' | 'not_found' | 'self' | 'already_locked';
}
