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

export const TRAINER_OFFERS: Record<TrainerOfferId, { key: string; title: string; desc: string; emoji: string }> = {
  '1': { key: 'first_payment',    title: '100% от первой оплаты', desc: 'Тренер получает 100% суммы первого платежа клиента',             emoji: '💰' },
  '2': { key: 'lifetime_20',      title: '20% пожизненно',        desc: 'Тренер получает 20% с каждого платежа клиента навсегда',          emoji: '♾️' },
  '3': { key: 'first_month_1rub', title: 'Первый месяц за 1 ₽',   desc: 'Клиент получает первый месяц за 1 рубль — мощный оффер для привлечения', emoji: '🎁' },
};

/** Build a trainer offer deep link: trf_{code}_{offerId} */
export function buildTrainerOfferLink(referralCode: string, offerId: TrainerOfferId): string {
  const botUsername = process.env.BOT_USERNAME ?? '';
  const payload = `trf_${referralCode}_${offerId}`;
  if (!botUsername) return payload;
  return `https://t.me/${botUsername}?start=${payload}`;
}

/** Parse a trf_ payload. Returns null if invalid format. */
function parseTrainerPayload(payload: string): { code: string; offerId: TrainerOfferId } | null {
  if (!payload.startsWith('trf_')) return null;
  const rest = payload.slice(4); // "XXXXXXXX_1"
  const lastUnderscore = rest.lastIndexOf('_');
  if (lastUnderscore === -1) return null;
  const code = rest.slice(0, lastUnderscore).toUpperCase();
  const offerId = rest.slice(lastUnderscore + 1) as TrainerOfferId;
  if (!(TRAINER_OFFER_IDS as readonly string[]).includes(offerId)) return null;
  if (code.length !== 8) return null;
  return { code, offerId };
}

/**
 * Apply a trainer referral offer link (first valid trainer referral wins).
 * Returns 'ok' | 'not_found' | 'not_trainer' | 'self' | 'already_locked'.
 */
export async function applyTrainerReferral(
  chatId: string,
  payload: string,
): Promise<'ok' | 'not_found' | 'not_trainer' | 'self' | 'already_locked'> {
  const parsed = parseTrainerPayload(payload);
  if (!parsed) return 'not_found';
  const { code, offerId } = parsed;

  // Find trainer by UserProfile.referralCode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const referrer = await (prisma.userProfile.findFirst as (args: any) => Promise<any>)({
    where: { referralCode: code },
    select: { chatId: true, userId: true },
  });
  if (!referrer) return 'not_found';
  if (referrer.chatId === chatId) return 'self';

  // Must be a verified trainer
  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { chatId: referrer.chatId },
    select: { verificationStatus: true },
  });
  if (trainerProfile?.verificationStatus !== 'verified') return 'not_trainer';

  // First valid trainer referral wins
  const me = await prisma.userProfile.findUnique({
    where: { chatId },
    select: { referralLockedAt: true },
  });
  if (me?.referralLockedAt) return 'already_locked';

  const offerType = TRAINER_OFFERS[offerId].key;
  const referredByUserId: string | null = referrer.userId ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.userProfile.upsert as (args: any) => Promise<any>)({
    where: { chatId },
    update: {
      referredBy: referrer.chatId,
      referredByUserId,
      referredByRole: 'trainer',
      trainerOfferType: offerType,
      referralLockedAt: new Date(),
    },
    create: {
      chatId,
      referredBy: referrer.chatId,
      referredByUserId,
      referredByRole: 'trainer',
      trainerOfferType: offerType,
      referralLockedAt: new Date(),
    },
  });

  return 'ok';
}
