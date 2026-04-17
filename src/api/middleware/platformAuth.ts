/**
 * Platform-agnostic auth middleware.
 * Routes each request to the appropriate platform-specific middleware:
 *   - x-telegram-init-data present → telegramAuthMiddleware
 *   - x-max-init-data present → maxAuthMiddleware
 *   - Neither header → telegramAuthMiddleware (handles 401 + dev mock)
 *
 * This is the single middleware applied to /api in server.ts.
 * Adding a new platform only requires: new middleware + one branch here.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './telegramAuth';
import { telegramAuthMiddleware } from './telegramAuth';
import { maxAuthMiddleware } from './maxAuth';

export async function platformAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.headers['x-max-init-data']) {
    return maxAuthMiddleware(req, res, next);
  }
  // Default: Telegram (also handles dev mode and 401 for unauthenticated requests)
  return telegramAuthMiddleware(req, res, next);
}
