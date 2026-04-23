/**
 * MAX (VK's MAX messenger) mini-app authentication middleware.
 *
 * ─── What is actually validated ───────────────────────────────────────────────
 * MAX mini-apps use the same HMAC-SHA256 initData pattern as Telegram:
 *   1. The client sends `x-max-init-data` header — a query string with
 *      `user=...&auth_date=...&hash=...` (and possibly other fields).
 *   2. We verify the HMAC-SHA256 signature using MAX_BOT_TOKEN.
 *      Key derivation: HMAC-SHA256("WebAppData", MAX_BOT_TOKEN) — same as Telegram.
 *   3. We check auth_date is within 1 hour to reject replayed tokens.
 *
 * ─── What is NOT yet confirmed ────────────────────────────────────────────────
 * - The exact `user` object structure from MAX (assumed similar to Telegram).
 * - Whether MAX uses a different HMAC key constant ("WebAppData" assumed).
 * - Whether MAX uses auth_date (assumed yes, same as Telegram).
 *
 * ─── Action required when MAX SDK docs are available ─────────────────────────
 * Only `validateMaxInitData` needs adjustment — the rest of the flow is stable.
 *
 * ─── chatId for MAX users ─────────────────────────────────────────────────────
 * MAX user IDs are numeric. To avoid collision with Telegram user IDs in
 * chatId-keyed tables, we prefix them: `req.chatId = 'max_' + maxUserId`.
 * This ensures legacy chatId-keyed upserts create separate, non-conflicting rows
 * until the user links their MAX account to an existing Telegram account.
 */

import crypto from 'crypto';
import { Response, NextFunction } from 'express';
import { AuthRequest } from './telegramAuth';
import { resolveUserId } from '../utils/resolveUser';

const MAX_AUTH_AGE_SECONDS = 3600;

interface MaxUser {
  /** Telegram-compat field name (may not be present in all MAX versions) */
  id?: number;
  /** MAX native field name */
  user_id?: number;
  /** Telegram-compat display name field */
  first_name?: string;
  /** MAX native display name field */
  name?: string;
  last_name?: string;
  username?: string;
}

type MaxValidationResult =
  | { ok: true; user: MaxUser }
  | { ok: false; reason: 'invalid' | 'expired' | 'no_token' };

/**
 * Validates the `x-max-init-data` header using HMAC-SHA256.
 * Assumes the same format and key-derivation as Telegram WebApp initData.
 * Adjust the HMAC constant and user-field parsing when MAX SDK docs confirm the spec.
 */
function validateMaxInitData(initData: string, botToken: string): MaxValidationResult {
  if (!botToken) return { ok: false, reason: 'no_token' };
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { ok: false, reason: 'invalid' };
    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    // Key derivation — same as Telegram; update the 'WebAppData' constant if MAX differs
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (hash !== expectedHash) return { ok: false, reason: 'invalid' };

    const authDateStr = params.get('auth_date');
    if (authDateStr) {
      const authDate = parseInt(authDateStr, 10);
      if (!isNaN(authDate)) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (nowSeconds - authDate > MAX_AUTH_AGE_SECONDS) {
          return { ok: false, reason: 'expired' };
        }
      }
    }

    const userStr = params.get('user');
    if (!userStr) return { ok: false, reason: 'invalid' };
    return { ok: true, user: JSON.parse(userStr) as MaxUser };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

export async function maxAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const initData = req.headers['x-max-init-data'] as string | undefined;
  const botToken = process.env.MAX_BOT_TOKEN ?? '';

  // Dev mode: allow mock MAX user if DEV_MAX_USER_ID is set and no initData provided
  if (!initData) {
    const devUserId = process.env.DEV_MAX_USER_ID;
    if (devUserId && process.env.NODE_ENV !== 'production') {
      req.chatId = `max_${devUserId}`;
      req.platform = 'max';
      try {
        req.userId = await resolveUserId('max', devUserId, { firstName: 'Dev MAX' });
      } catch { /* non-fatal */ }
      return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const result = validateMaxInitData(initData, botToken);
  if (!result.ok) {
    if (result.reason === 'expired') {
      res.status(401).json({ error: 'Expired auth_date' });
    } else if (result.reason === 'no_token') {
      console.error('[maxAuth] MAX_BOT_TOKEN is not configured');
      res.status(503).json({ error: 'MAX auth not configured on server' });
    } else {
      res.status(401).json({ error: 'Invalid MAX initData' });
    }
    return;
  }

  // Normalize: MAX may send user_id (native) or id (Telegram-compat)
  const rawUserId = result.user.user_id ?? result.user.id;
  if (!rawUserId) {
    res.status(401).json({ error: 'Invalid MAX initData' });
    return;
  }
  const maxUserId = String(rawUserId);
  // Prefix to avoid numeric collision with Telegram IDs in chatId-keyed tables
  req.chatId = `max_${maxUserId}`;
  req.platform = 'max';

  // Resolve platform-independent userId (non-fatal)
  try {
    req.userId = await resolveUserId('max', maxUserId, {
      // MAX may send name (native) or first_name (Telegram-compat)
      firstName: result.user.name ?? result.user.first_name,
      username: result.user.username,
    });
  } catch { /* chatId is set — legacy paths still work */ }

  next();
}
