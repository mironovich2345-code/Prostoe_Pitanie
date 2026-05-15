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

/**
 * Verify Telegram Login Widget payload (different from WebApp init data).
 * https://core.telegram.org/widgets/login#checking-authorization
 */
function verifyTelegramLoginWidget(data: Record<string, string | number>): boolean {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) return false;

  const hash = data.hash;
  if (typeof hash !== 'string') return false;

  const authDate = Number(data.auth_date);
  if (!authDate || Date.now() / 1000 - authDate > 86400) return false;

  const secretKey = crypto.createHash('sha256').update(botToken).digest();

  const { hash: _hash, ...fields } = data;
  const checkString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const expected = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
  return expected === hash;
}

// POST /api/web-auth/telegram
// Receives Telegram Login Widget auth payload, verifies it, issues a session cookie.
router.post('/telegram', async (req, res) => {
  try {
    const data = req.body as Record<string, string | number>;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      res.status(400).json({ error: 'INVALID_PAYLOAD' });
      return;
    }

    if (!verifyTelegramLoginWidget(data)) {
      res.status(401).json({ error: 'INVALID_SIGNATURE' });
      return;
    }

    const telegramId = String(data.id);
    const firstName = typeof data.first_name === 'string' ? data.first_name : undefined;
    const username = typeof data.username === 'string' ? data.username : undefined;

    const userId = await resolveUserId('telegram', telegramId, { firstName, username });

    const sessionPayload = { userId, chatId: telegramId, platform: 'telegram' as const };
    const token = jwt.sign(sessionPayload, getSecret(), { expiresIn: '30d' });
    res.cookie(COOKIE_NAME, token, buildCookieOptions());

    res.json({
      user: {
        id: userId,
        displayName: firstName || username || 'Пользователь',
        username: username ?? null,
        platform: 'telegram',
      },
    });
  } catch (err) {
    console.error('[web-auth] /telegram error:', (err as Error).message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// GET /api/web-auth/me
// Returns the current web session user or 401.
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
// Clears the session cookie.
router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, buildCookieOptions());
  res.json({ ok: true });
});

export default router;
