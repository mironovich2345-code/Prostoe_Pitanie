/**
 * POST /api/events/track
 *
 * Frontend behaviour event ingestion.
 * - Auth required (userId from platform middleware)
 * - Whitelist enforced — unknown event names are rejected with 400
 * - userId is taken from the authenticated context, never from the body
 * - Fire-and-forget DB write (fail-open)
 */

import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import { trackUserEvent } from '../../services/userEventService';

const router = Router();

const ALLOWED_EVENTS = new Set([
  'app_opened',
  'onboarding_started',
  'onboarding_completed',
  'diary_opened',
  'stats_day_opened',
  'stats_week_opened',
  'weight_opened',
  'subscription_opened',
  'subscription_connect_clicked',
  'support_clicked',
  'coach_client_opened',
  'coach_client_stats_opened',
]);

router.post('/track', (req: AuthRequest, res: Response): void => {
  const userId = req.userId;
  if (!userId) {
    res.status(400).json({ error: 'userId not resolved' });
    return;
  }

  const { eventName, metadata } = req.body as {
    eventName?: unknown;
    metadata?: unknown;
  };

  if (typeof eventName !== 'string' || !ALLOWED_EVENTS.has(eventName)) {
    res.status(400).json({ error: 'Unknown or missing eventName' });
    return;
  }

  // Platform is taken from the auth context set by platformAuthMiddleware — never from the body.
  // This prevents a user from spoofing another platform's attribution.
  const platform = req.platform ?? 'unknown';

  const safeMeta =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : undefined;

  // Fire-and-forget
  trackUserEvent({ userId, platform, eventName, metadata: safeMeta });

  res.json({ ok: true });
});

export default router;
