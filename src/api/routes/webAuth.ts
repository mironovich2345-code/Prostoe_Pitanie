import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { resolveUserId } from '../utils/resolveUser';

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

export default router;
