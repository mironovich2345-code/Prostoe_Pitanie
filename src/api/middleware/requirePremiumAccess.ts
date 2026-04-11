import { Response, NextFunction } from 'express';
import { AuthRequest } from './telegramAuth';
import { getSubscriptionState } from '../../services/subscriptionService';
import prisma from '../../db';

/**
 * LEGACY BRIDGE — temporary.
 * Check the old chatId-based Subscription table for still-active access.
 * Called only when the new UserSubscription check fails (no record or accessLevel='basic').
 * Remove this function once all active legacy subscriptions have been backfilled
 * into UserSubscription via scripts/backfill-subscriptions.ts.
 */
async function hasLegacyAccess(chatId: string): Promise<boolean> {
  try {
    const sub = await prisma.subscription.findUnique({ where: { chatId } });
    if (!sub) return false;
    const now = new Date();
    if (sub.status === 'active' && sub.currentPeriodEnd && sub.currentPeriodEnd > now) return true;
    if (sub.status === 'trial' && sub.trialEndsAt && sub.trialEndsAt > now) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Premium access guard for AI / nutrition insight endpoints.
 *
 * Pass through:
 *   - no userId (legacy/dev flow — chatId-only path, not yet migrated to userId)
 *   - subscription with accessLevel === 'full':
 *       active 'intro' (paid 7-day, 1 ₽) within trialEndsAt
 *       active 'client_monthly' within currentPeriodEnd
 *       'past_due' within gracePeriodEnd
 *
 * Block (HTTP 402):
 *   - userId present but no subscription record (user has not purchased access)
 *   - subscription expired, canceled, or period elapsed
 *
 * Fail-open on DB errors: if the subscription check throws (table not yet migrated,
 * connection issue) the request is allowed through rather than blocked.
 */
export async function requirePremiumAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.userId;

  // No userId → legacy/dev path not yet on userId — pass through
  if (!userId) {
    next();
    return;
  }

  try {
    const { accessLevel } = await getSubscriptionState(userId);

    if (accessLevel === 'full') {
      next();
      return;
    }

    // LEGACY BRIDGE (temporary): new record absent or expired — check old subscription
    const chatId = req.chatId;
    if (chatId && await hasLegacyAccess(chatId)) {
      next();
      return;
    }

    res.status(402).json({
      error: 'subscription_required',
      message: 'Для доступа к AI-функциям необходима активная подписка.',
      plan: 'client_monthly',
    });
  } catch {
    // Fail-open: DB unavailable, table not yet migrated, etc.
    next();
  }
}
