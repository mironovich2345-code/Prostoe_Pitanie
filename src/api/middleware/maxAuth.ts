/**
 * MAX (VK's MAX messenger) mini-app authentication middleware.
 *
 * ─── Algorithm (per MAX docs) ─────────────────────────────────────────────────
 *   1. Receive WebAppData query string via x-max-init-data header.
 *      The header contains ONLY the inner WebAppData value (outer fragment params
 *      like WebAppPlatform/WebAppVersion are stripped by the frontend; the backend
 *      also strips them defensively in case of older client versions).
 *   2. Split by '&' into key=value pairs; decodeURIComponent each key and value
 *      individually (manual split, NOT URLSearchParams — avoids + → space
 *      corruption that would break HMAC verification).
 *   3. Strip known outer-fragment params (WebAppPlatform, WebAppVersion, etc.)
 *      and log them separately — they must NOT participate in the HMAC.
 *   4. Extract 'hash', remove it from the set.
 *   5. Sort remaining inner pairs by key.
 *   6. Build data_check_string: "key=value\nkey2=value2" (decoded values).
 *   7. secret_key  = HMAC-SHA256("WebAppData", MAX_BOT_TOKEN)
 *   8. expected    = hex( HMAC-SHA256(secret_key, data_check_string) )
 *   9. Compare expected with extracted hash.
 *
 * ─── chatId for MAX users ─────────────────────────────────────────────────────
 * MAX user IDs are numeric. Prefix `max_` avoids collision with Telegram IDs.
 *
 * ─── Diagnostic logging ───────────────────────────────────────────────────────
 * Logs only non-sensitive metadata: raw length, found keys, HMAC pass/fail,
 * first 8 chars of expected hash (safe — not the full secret).
 * Never logs token value or full initData.
 */

import crypto from 'crypto';
import { Response, NextFunction } from 'express';
import { AuthRequest } from './telegramAuth';
import { resolveUserId } from '../utils/resolveUser';

const MAX_AUTH_AGE_SECONDS = 3600;

interface MaxUser {
  /** Telegram-compat numeric ID field */
  id?: number;
  /** MAX native numeric ID field */
  user_id?: number;
  /** Telegram-compat display name */
  first_name?: string;
  /** MAX native display name */
  name?: string;
  last_name?: string;
  username?: string;
}

type MaxValidationResult =
  | { ok: true; user: MaxUser }
  | { ok: false; reason: 'invalid' | 'expired' | 'no_token' };

/**
 * MAX URL-fragment outer params — present in the hash fragment alongside WebAppData
 * but NOT part of the signed WebAppData payload. Must be stripped before HMAC.
 * These are Pascal-cased, start with uppercase, and are defined by MAX platform.
 */
const MAX_OUTER_FRAGMENT_PARAMS = new Set([
  'WebAppData',       // the container itself (present if front-end sent the raw hash)
  'WebAppPlatform',   // e.g. "web", "ios", "android"
  'WebAppVersion',    // e.g. "1.0"
]);

/**
 * Parse a WebAppData query string into a Map, decoding each key and value
 * individually with decodeURIComponent (not URLSearchParams, to avoid the
 * application/x-www-form-urlencoded '+' → space substitution that would
 * corrupt JSON values and break the HMAC verification).
 */
function parseWebAppData(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const segment of raw.split('&')) {
    if (!segment) continue;
    const eqIdx = segment.indexOf('=');
    if (eqIdx === -1) {
      map.set(decodeURIComponent(segment), '');
    } else {
      const key = decodeURIComponent(segment.slice(0, eqIdx));
      const val = decodeURIComponent(segment.slice(eqIdx + 1));
      map.set(key, val);
    }
  }
  return map;
}

function validateMaxInitData(rawInitData: string, botToken: string): MaxValidationResult {
  if (!botToken) return { ok: false, reason: 'no_token' };

  const tag = `[maxAuth] len=${rawInitData.length}`;

  try {
    const params = parseWebAppData(rawInitData);

    // ── Separate outer fragment params from inner WebAppData params ─────────
    // Defensive: strip outer params even if the frontend already did so.
    // Outer params (WebAppPlatform, WebAppVersion, …) must NOT enter the HMAC.
    const outerKeys: string[] = [];
    for (const key of [...params.keys()]) {
      if (MAX_OUTER_FRAGMENT_PARAMS.has(key)) {
        outerKeys.push(key);
        params.delete(key);
      }
    }
    if (outerKeys.length > 0) {
      console.info(`${tag} outerKeys=[${outerKeys.join(',')}] (stripped, not part of HMAC)`);
    }

    const innerKeys = [...params.keys()];
    const hash = params.get('hash');

    console.info(`${tag} innerKeys=[${innerKeys.join(',')}] hasHash=${!!hash}`);

    if (!hash) {
      console.warn(`${tag} FAIL step 3: no 'hash' field in WebAppData`);
      return { ok: false, reason: 'invalid' };
    }

    params.delete('hash');

    // Step 5: sorted data_check_string (decoded values)
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    // Steps 6–7: HMAC-SHA256("WebAppData", BOT_TOKEN) → HMAC-SHA256(secretKey, dcs)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (hash !== expectedHash) {
      console.warn(
        `${tag} FAIL step 8: HMAC mismatch`,
        `| expected prefix: ${expectedHash.slice(0, 8)}`,
        `| received prefix: ${hash.slice(0, 8)}`,
        `| dcs_len: ${dataCheckString.length}`,
        `| token_present: ${!!botToken}`,
      );
      return { ok: false, reason: 'invalid' };
    }

    console.info(`${tag} HMAC OK`);

    // Step: auth_date freshness (optional — warn but don't fail if absent)
    const authDateStr = params.get('auth_date');
    if (authDateStr) {
      const authDate = parseInt(authDateStr, 10);
      if (!isNaN(authDate)) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (nowSeconds - authDate > MAX_AUTH_AGE_SECONDS) {
          console.warn(`${tag} FAIL: auth_date expired age=${nowSeconds - authDate}s`);
          return { ok: false, reason: 'expired' };
        }
      }
    } else {
      console.warn(`${tag} no auth_date field — skipping freshness check`);
    }

    // Step: user extraction — MAX may send 'user' (JSON) or 'user_id' (direct int)
    const userStr = params.get('user');
    if (userStr) {
      let user: MaxUser;
      try {
        user = JSON.parse(userStr) as MaxUser;
      } catch {
        console.warn(`${tag} FAIL: 'user' field is not valid JSON len=${userStr.length}`);
        return { ok: false, reason: 'invalid' };
      }
      console.info(`${tag} user fields: [${Object.keys(user).join(',')}]`);
      return { ok: true, user };
    }

    // Fallback: user_id may appear as a top-level numeric param (not inside user JSON)
    const directUserId = params.get('user_id');
    if (directUserId) {
      const uid = parseInt(directUserId, 10);
      if (!isNaN(uid)) {
        console.info(`${tag} user from top-level user_id=${uid}`);
        return { ok: true, user: { user_id: uid } };
      }
    }

    console.warn(`${tag} FAIL: no 'user' or 'user_id' field. innerKeys=[${innerKeys.join(',')}]`);
    return { ok: false, reason: 'invalid' };

  } catch (err) {
    console.error(`${tag} FAIL: exception during validation:`, err);
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
    console.warn('[maxAuth] FAIL: no numeric user id after validation');
    res.status(401).json({ error: 'Invalid MAX initData' });
    return;
  }
  const maxUserId = String(rawUserId);
  req.chatId = `max_${maxUserId}`;
  req.platform = 'max';

  // Resolve platform-independent userId (non-fatal — chatId is enough for legacy paths)
  try {
    req.userId = await resolveUserId('max', maxUserId, {
      firstName: result.user.name ?? result.user.first_name,
      username: result.user.username,
    });
  } catch { /* non-fatal */ }

  next();
}
