import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { Response, NextFunction } from 'express';
import { AuthRequest } from './telegramAuth';

// Redis client — env vars are loaded before server starts
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
});

// ─── Limiters ────────────────────────────────────────────────────────────────

// A. General API — 60 req / 1 min per user
const generalLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  prefix: 'rl:general',
});

// B. Auth / bootstrap — 20 req / 1 min per user
const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'rl:auth',
});

// C. Expensive AI routes — 5 req / 10 min per user
const aiLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '10 m'),
  prefix: 'rl:ai',
});

// D. Pre-auth IP-based — 30 req / 1 min per IP (runs before telegramAuthMiddleware)
const preAuthLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  prefix: 'rl:preauth',
});

// ─── Identifiers ─────────────────────────────────────────────────────────────

// Post-auth: chatId is already set by telegramAuthMiddleware
function getIdentifier(req: AuthRequest): string {
  return req.chatId ?? req.ip ?? 'unknown';
}

// Pre-auth: only IP is available.
// Behind Cloudflare + Railway, req.ip is the internal proxy — use CF-Connecting-IP instead.
// Fallback to X-Forwarded-For first entry, then req.ip.
function getIpIdentifier(req: AuthRequest): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf) return cf;
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

// ─── Middleware factory ───────────────────────────────────────────────────────

function makeLimitMiddleware(limiter: Ratelimit, identifier: (req: AuthRequest) => string = getIdentifier) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { success, reset } = await limiter.limit(identifier(req));
      if (!success) {
        const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
        res.status(429).json({ error: 'Too many requests', retryAfter });
        return;
      }
      next();
    } catch {
      // If Redis is unavailable, fail open — don't block legitimate traffic
      next();
    }
  };
}

export const preAuthRateLimit = makeLimitMiddleware(preAuthLimiter, getIpIdentifier);
export const generalRateLimit = makeLimitMiddleware(generalLimiter);
export const authRateLimit    = makeLimitMiddleware(authLimiter);
export const aiRateLimit      = makeLimitMiddleware(aiLimiter);
