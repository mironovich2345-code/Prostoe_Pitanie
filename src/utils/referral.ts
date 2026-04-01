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

  // Retry loop in case of collision (extremely unlikely with 8-char pool)
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

/** Build a shareable referral link for a code. */
export function buildReferralLink(code: string): string {
  const botUsername = process.env.BOT_USERNAME ?? '';
  if (!botUsername) return `ref_${code}`;
  return `https://t.me/${botUsername}?start=ref_${code}`;
}

/**
 * Apply a referral code to a user (first valid referral wins).
 * Returns 'ok', 'not_found', 'self', 'already_locked'.
 */
export async function applyReferral(
  chatId: string,
  rawCode: string,
): Promise<'ok' | 'not_found' | 'self' | 'already_locked'> {
  const code = rawCode.trim().toUpperCase();

  // Find referrer by their referral code
  const referrer = await prisma.userProfile.findFirst({
    where: { referralCode: code },
    select: { chatId: true },
  });
  if (!referrer) return 'not_found';
  if (referrer.chatId === chatId) return 'self';

  // Check if current user is already referred
  const me = await prisma.userProfile.findUnique({
    where: { chatId },
    select: { referralLockedAt: true },
  });
  if (me?.referralLockedAt) return 'already_locked';

  // Determine referrer role
  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { chatId: referrer.chatId },
    select: { verificationStatus: true },
  });
  const role = trainerProfile?.verificationStatus === 'verified' ? 'trainer' : 'client';

  await prisma.userProfile.upsert({
    where: { chatId },
    update: { referredBy: referrer.chatId, referredByRole: role, referralLockedAt: new Date() },
    create: { chatId, referredBy: referrer.chatId, referredByRole: role, referralLockedAt: new Date() },
  });

  return 'ok';
}
