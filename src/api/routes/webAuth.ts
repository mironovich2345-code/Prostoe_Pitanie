import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { resolveUserId } from '../utils/resolveUser';
import { requireWebAuth, WebAuthRequest } from '../middleware/webAuth';
import { normalizePhone } from '../../utils/normalizePhone';
import { sendSmsCode } from '../../services/smsService';
import prisma from '../../db';

const router = express.Router();

const COOKIE_NAME = 'web_session';
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  return process.env.WEB_SESSION_SECRET || 'dev-secret-change-in-production';
}

function buildCookieOptions(): express.CookieOptions {
  const opts: express.CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_MS,
  };
  if (process.env.WEB_COOKIE_DOMAIN) {
    opts.domain = process.env.WEB_COOKIE_DOMAIN;
  }
  return opts;
}

type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'missing_bot_token' | 'missing_hash' | 'expired_auth_date' | 'hash_mismatch' };

/**
 * Verify Telegram Login Widget payload.
 * https://core.telegram.org/widgets/login#checking-authorization
 *
 * secret = SHA-256(BOT_TOKEN) as raw Buffer (NOT hex string)
 * dataCheckString = sorted key=value pairs (without hash) joined with \n
 * calculatedHash = HMAC-SHA256(secret, dataCheckString).digest('hex')
 */
function verifyTelegramLoginWidget(data: Record<string, string | number>): VerifyResult {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) return { ok: false, reason: 'missing_bot_token' };

  const hash = data.hash;
  if (typeof hash !== 'string' || !hash) return { ok: false, reason: 'missing_hash' };

  const authDate = Number(data.auth_date);
  if (!authDate || Date.now() / 1000 - authDate > 86400) {
    return { ok: false, reason: 'expired_auth_date' };
  }

  // Secret key: SHA-256 of the bot token, kept as raw Buffer (not hex).
  const secretKey = crypto.createHash('sha256').update(botToken).digest();

  const { hash: _h, ...fields } = data;
  const checkString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const calculated = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

  // Constant-time comparison to prevent timing attacks.
  const calcBuf = Buffer.from(calculated, 'hex');
  const hashBuf = Buffer.from(hash,       'hex');
  if (calcBuf.length !== hashBuf.length || !crypto.timingSafeEqual(calcBuf, hashBuf)) {
    return { ok: false, reason: 'hash_mismatch' };
  }

  return { ok: true };
}

// POST /api/web-auth/telegram
router.post('/telegram', async (req, res) => {
  try {
    const data = req.body as Record<string, string | number>;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      res.status(400).json({ error: 'missing_hash' });
      return;
    }

    console.log('[web-auth] /telegram payload keys:', Object.keys(data).join(', '));
    console.log('[web-auth] BOT_TOKEN present:', !!process.env.BOT_TOKEN);

    const result = verifyTelegramLoginWidget(data);
    if (!result.ok) {
      console.log('[web-auth] verification failed, reason:', result.reason);
      if (result.reason === 'missing_bot_token') {
        res.status(500).json({ error: 'web_auth_config_error' });
        return;
      }
      if (result.reason === 'missing_hash') {
        res.status(400).json({ error: 'missing_hash' });
        return;
      }
      if (result.reason === 'expired_auth_date') {
        res.status(401).json({ error: 'telegram_auth_expired' });
        return;
      }
      // hash_mismatch
      res.status(401).json({ error: 'invalid_telegram_hash' });
      return;
    }

    const telegramId = String(data.id);
    const firstName = typeof data.first_name === 'string' ? data.first_name : undefined;
    const username  = typeof data.username   === 'string' ? data.username   : undefined;

    const userId = await resolveUserId('telegram', telegramId, { firstName, username });

    const sessionPayload = { userId, chatId: telegramId, platform: 'telegram' as const };
    const token = jwt.sign(sessionPayload, getSecret(), { expiresIn: '30d' });
    res.cookie(COOKIE_NAME, token, buildCookieOptions());

    console.log('[web-auth] session issued for userId:', userId);

    res.json({
      user: {
        id: userId,
        chatId: telegramId,
        platform: 'telegram',
      },
    });
  } catch (err) {
    console.error('[web-auth] /telegram internal error:', (err as Error).message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// GET /api/web-auth/me
router.get('/me', (req, res) => {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'NOT_AUTHENTICATED' });
    return;
  }
  try {
    const payload = jwt.verify(token, getSecret()) as {
      userId: string;
      chatId: string;
      platform: string;
    };
    res.json({
      user: {
        id: payload.userId,
        chatId: payload.chatId,
        platform: payload.platform,
      },
    });
  } catch {
    res.status(401).json({ error: 'SESSION_EXPIRED' });
  }
});

// POST /api/web-auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, buildCookieOptions());
  res.json({ ok: true });
});

// ─── Phone / SMS OTP web-login flow ──────────────────────────────────────────

const OTP_TTL_MS            = 10 * 60 * 1000; // 10 min
const OTP_MAX_ATTEMPTS      = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;     // 60 s between sends
const OTP_RATE_LIMIT_MAX    = 3;              // sends per phone or IP per window
const OTP_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

function getCodeHashSecret(): string {
  return process.env.PHONE_CODE_HASH_SECRET ?? process.env.WEB_SESSION_SECRET ?? 'dev-secret-change-in-production';
}

function hashOtp(code: string): string {
  return crypto.createHmac('sha256', getCodeHashSecret()).update(code).digest('hex');
}

function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

// POST /api/web-auth/phone/request-code
router.post('/phone/request-code', async (req, res) => {
  try {
    const rawPhone = typeof req.body?.phone === 'string' ? req.body.phone : '';
    let phone: string;
    try { phone = normalizePhone(rawPhone); }
    catch { res.status(400).json({ error: 'invalid_phone' }); return; }

    const ip = ((req.headers['x-forwarded-for'] as string | undefined)
      ?.split(',')[0]?.trim()) ?? (req.socket.remoteAddress ?? 'unknown');
    const now = new Date();
    const windowStart = new Date(now.getTime() - OTP_RATE_LIMIT_WINDOW_MS);

    // Rate limit — same phone
    const phoneCount = await prisma.phoneLoginCode.count({
      where: { phone, createdAt: { gte: windowStart } },
    });
    if (phoneCount >= OTP_RATE_LIMIT_MAX) {
      res.status(429).json({ error: 'rate_limit_exceeded' });
      return;
    }

    // Rate limit — same IP
    if (ip !== 'unknown') {
      const ipCount = await prisma.phoneLoginCode.count({
        where: { ip, createdAt: { gte: windowStart } },
      });
      if (ipCount >= OTP_RATE_LIMIT_MAX) {
        res.status(429).json({ error: 'rate_limit_exceeded' });
        return;
      }
    }

    // Resend cooldown
    const lastCode = await prisma.phoneLoginCode.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (lastCode && now.getTime() - lastCode.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      res.status(429).json({ error: 'resend_too_soon' });
      return;
    }

    const code     = generateOtp();
    const codeHash = hashOtp(code);
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

    await prisma.phoneLoginCode.create({
      data: {
        phone,
        codeHash,
        expiresAt,
        ip,
        userAgent: ((req.headers['user-agent'] ?? '') as string).slice(0, 512),
      },
    });

    await sendSmsCode(phone, code);

    res.json({ ok: true });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'sms_provider_not_configured') {
      res.status(503).json({ error: 'sms_provider_not_configured' });
      return;
    }
    console.error('[web-auth/phone/request-code] error:', msg);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// POST /api/web-auth/phone/verify-code
router.post('/phone/verify-code', async (req, res) => {
  try {
    const rawPhone = typeof req.body?.phone === 'string' ? req.body.phone : '';
    const rawCode  = typeof req.body?.code  === 'string' ? req.body.code.trim() : '';

    let phone: string;
    try { phone = normalizePhone(rawPhone); }
    catch { res.status(400).json({ error: 'invalid_phone' }); return; }

    if (!rawCode || !/^\d{4,6}$/.test(rawCode)) {
      res.status(400).json({ error: 'invalid_code' });
      return;
    }

    const now = new Date();
    const record = await prisma.phoneLoginCode.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });

    // Always same response shape to avoid phone enumeration
    if (!record) {
      res.status(401).json({ error: 'code_not_found_or_expired' });
      return;
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      res.status(401).json({ error: 'too_many_attempts' });
      return;
    }

    const expectedBuf = Buffer.from(hashOtp(rawCode), 'hex');
    const actualBuf   = Buffer.from(record.codeHash,  'hex');
    const match = expectedBuf.length === actualBuf.length &&
      crypto.timingSafeEqual(expectedBuf, actualBuf);

    if (!match) {
      await prisma.phoneLoginCode.update({
        where: { id: record.id },
        data:  { attempts: { increment: 1 } },
      });
      res.status(401).json({ error: 'invalid_code' });
      return;
    }

    // Mark code consumed
    await prisma.phoneLoginCode.update({
      where: { id: record.id },
      data:  { consumedAt: now },
    });

    // Resolve or create platform-independent User via UserIdentity(phone, +7...)
    const userId = await resolveUserId('phone', phone);

    const sessionPayload = { userId, platform: 'phone' as const };
    const token = jwt.sign(sessionPayload, getSecret(), { expiresIn: '30d' });
    res.cookie(COOKIE_NAME, token, buildCookieOptions());

    res.json({ ok: true, userId });
  } catch (err) {
    console.error('[web-auth/phone/verify-code] error:', (err as Error).message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── MAX web-login deeplink flow ──────────────────────────────────────────────

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateLoginToken(): string {
  return crypto.randomBytes(16).toString('hex'); // 32 hex chars — fits MAX 128-char payload limit
}

// POST /api/web-auth/max/start
// Creates a one-time login token and returns a MAX deeplink.
// No auth required — this is the first step for unauthenticated users.
router.post('/max/start', async (_req, res) => {
  const maxBotName = process.env.MAX_BOT_NAME;
  if (!maxBotName) {
    console.warn('[web-auth/max/start] MAX_BOT_NAME env var not set');
    res.status(503).json({ error: 'max_not_configured', missing: 'MAX_BOT_NAME' });
    return;
  }
  if (!process.env.MAX_BOT_TOKEN) {
    console.warn('[web-auth/max/start] MAX_BOT_TOKEN env var not set');
    res.status(503).json({ error: 'max_not_configured', missing: 'MAX_BOT_TOKEN' });
    return;
  }

  const token = generateLoginToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  try {
    await prisma.webLoginToken.create({
      data: { token, platform: 'max', status: 'pending', expiresAt },
    });

    const deeplink = `https://max.ru/${maxBotName}?start=web_login_${token}`;
    res.json({ token, deeplink, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    console.error('[web-auth/max/start] error:', (err as Error).message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// GET /api/web-auth/max/status?token=...
// Polls login token status. Issues session cookie when confirmed.
router.get('/max/status', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  if (!token) {
    res.status(400).json({ error: 'missing_token' });
    return;
  }

  try {
    const record = await prisma.webLoginToken.findUnique({ where: { token } });
    if (!record) {
      res.status(404).json({ error: 'token_not_found' });
      return;
    }

    // Treat past-expiry pending tokens as expired
    if (record.status === 'pending' && record.expiresAt < new Date()) {
      await prisma.webLoginToken.update({ where: { token }, data: { status: 'expired' } }).catch(() => {});
      res.json({ status: 'expired' });
      return;
    }

    if (record.status === 'pending') {
      res.json({ status: 'pending' });
      return;
    }

    if (record.status === 'expired' || record.status === 'canceled') {
      res.json({ status: record.status });
      return;
    }

    if (record.status === 'confirmed' && record.userId) {
      // Issue web session cookie — same params as Telegram auth
      const sessionPayload = { userId: record.userId, platform: 'max' as const };
      const jwtToken = jwt.sign(sessionPayload, getSecret(), { expiresIn: '30d' });
      res.cookie(COOKIE_NAME, jwtToken, buildCookieOptions());

      res.json({
        status: 'confirmed',
        user: {
          id: record.userId,
          platform: 'max',
          displayName: record.platformName ?? undefined,
          username: record.platformUsername ?? undefined,
        },
      });
      return;
    }

    res.json({ status: record.status });
  } catch (err) {
    console.error('[web-auth/max/status] error:', (err as Error).message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ─── Phone-link flow (authenticated user attaches a phone to their account) ────
//
// POST /api/web-auth/phone/link/request-code
// POST /api/web-auth/phone/link/verify-code
//
// Unlike the login flow, these endpoints:
//   - require an existing web session (requireWebAuth)
//   - do NOT create a new User
//   - do NOT issue / change the session cookie
//   - only create a new UserIdentity(platform='phone') for the current userId

// POST /api/web-auth/phone/link/request-code
router.post('/phone/link/request-code', requireWebAuth as express.RequestHandler, async (req: WebAuthRequest, res) => {
  try {
    const { userId } = req.webUser!;
    const rawPhone = typeof req.body?.phone === 'string' ? req.body.phone : '';
    let phone: string;
    try { phone = normalizePhone(rawPhone); }
    catch { res.status(400).json({ error: 'invalid_phone' }); return; }

    // Check if a phone identity already exists for this phone number
    const existing = await prisma.userIdentity.findUnique({
      where: { platform_platformId: { platform: 'phone', platformId: phone } },
      select: { userId: true },
    });
    if (existing) {
      if (existing.userId === userId) {
        // Already linked to this account — no SMS needed
        res.json({ ok: true, alreadyLinked: true });
        return;
      }
      // Linked to a different account — refuse
      res.status(409).json({ ok: false, error: 'phone_already_linked' });
      return;
    }

    // Apply the same rate limits as the regular request-code endpoint
    const ip = ((req.headers['x-forwarded-for'] as string | undefined)
      ?.split(',')[0]?.trim()) ?? (req.socket.remoteAddress ?? 'unknown');
    const now = new Date();
    const windowStart = new Date(now.getTime() - OTP_RATE_LIMIT_WINDOW_MS);

    const phoneCount = await prisma.phoneLoginCode.count({
      where: { phone, createdAt: { gte: windowStart } },
    });
    if (phoneCount >= OTP_RATE_LIMIT_MAX) {
      res.status(429).json({ error: 'rate_limit_exceeded' });
      return;
    }

    if (ip !== 'unknown') {
      const ipCount = await prisma.phoneLoginCode.count({
        where: { ip, createdAt: { gte: windowStart } },
      });
      if (ipCount >= OTP_RATE_LIMIT_MAX) {
        res.status(429).json({ error: 'rate_limit_exceeded' });
        return;
      }
    }

    const lastCode = await prisma.phoneLoginCode.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (lastCode && now.getTime() - lastCode.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      res.status(429).json({ error: 'resend_too_soon' });
      return;
    }

    const code     = generateOtp();
    const codeHash = hashOtp(code);
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

    await prisma.phoneLoginCode.create({
      data: {
        phone,
        codeHash,
        expiresAt,
        ip,
        userAgent: ((req.headers['user-agent'] ?? '') as string).slice(0, 512),
      },
    });

    await sendSmsCode(phone, code);

    res.json({ ok: true });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'sms_provider_not_configured') {
      res.status(503).json({ error: 'sms_provider_not_configured' });
      return;
    }
    console.error('[web-auth/phone/link/request-code] error:', msg);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// POST /api/web-auth/phone/link/verify-code
router.post('/phone/link/verify-code', requireWebAuth as express.RequestHandler, async (req: WebAuthRequest, res) => {
  try {
    const { userId } = req.webUser!;
    const rawPhone = typeof req.body?.phone === 'string' ? req.body.phone : '';
    const rawCode  = typeof req.body?.code  === 'string' ? req.body.code.trim() : '';

    let phone: string;
    try { phone = normalizePhone(rawPhone); }
    catch { res.status(400).json({ error: 'invalid_phone' }); return; }

    if (!rawCode || !/^\d{4,6}$/.test(rawCode)) {
      res.status(400).json({ error: 'invalid_code' });
      return;
    }

    const now = new Date();
    const record = await prisma.phoneLoginCode.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      res.status(401).json({ error: 'code_not_found_or_expired' });
      return;
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      res.status(401).json({ error: 'too_many_attempts' });
      return;
    }

    const expectedBuf = Buffer.from(hashOtp(rawCode), 'hex');
    const actualBuf   = Buffer.from(record.codeHash,  'hex');
    const match = expectedBuf.length === actualBuf.length &&
      crypto.timingSafeEqual(expectedBuf, actualBuf);

    if (!match) {
      await prisma.phoneLoginCode.update({
        where: { id: record.id },
        data:  { attempts: { increment: 1 } },
      });
      res.status(401).json({ error: 'invalid_code' });
      return;
    }

    // Code is correct — consume it immediately
    await prisma.phoneLoginCode.update({
      where: { id: record.id },
      data:  { consumedAt: now },
    });

    // Re-check identity state (race-safe: could have been linked in parallel)
    const existing = await prisma.userIdentity.findUnique({
      where: { platform_platformId: { platform: 'phone', platformId: phone } },
      select: { userId: true },
    });

    if (existing) {
      if (existing.userId === userId) {
        res.json({ ok: true, alreadyLinked: true });
        return;
      }
      res.status(409).json({ ok: false, error: 'phone_already_linked' });
      return;
    }

    // Create the phone identity for the current user (no new User created)
    try {
      await prisma.userIdentity.create({
        data: {
          userId,
          platform:   'phone',
          platformId: phone,
          username:   null,
          firstName:  null,
        },
      });
    } catch (createErr: unknown) {
      // P2002 = unique constraint violation (race condition)
      if ((createErr as { code?: string }).code === 'P2002') {
        res.status(409).json({ ok: false, error: 'phone_already_linked' });
        return;
      }
      throw createErr;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[web-auth/phone/link/verify-code] error:', (err as Error).message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
