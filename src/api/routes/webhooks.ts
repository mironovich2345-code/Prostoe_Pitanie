/**
 * POST /api/webhooks/yookassa
 *
 * YooKassa sends a notification for every payment status change.
 * This route is registered WITHOUT auth middleware (YooKassa is not a user).
 *
 * Security model:
 *   We do NOT trust the webhook payload blindly. After receiving a notification
 *   we re-fetch the payment directly from the YooKassa API using our credentials.
 *   This means a spoofed POST to our webhook URL cannot trigger free subscriptions.
 *
 * Handled events:
 *   payment.succeeded  → activate subscription
 *   payment.canceled   → mark payment as canceled (no subscription change)
 *
 * Unhandled events (ignored, 200 returned):
 *   payment.waiting_for_capture, refund.succeeded, etc.
 */

import { Router, Request, Response } from 'express';
import prisma from '../../db';
import { fetchYooKassaPayment } from '../../services/yookassaService';
import { activateSubscription, type PlanId } from '../../services/subscriptionService';

const router = Router();

// ─── Payment DB (stale Prisma cast) ───────────────────────────────────────────

interface PaymentRow {
  id: string;
  userId: string;
  planId: string;
  amountRub: number;
  status: string;
  periodEnd: Date | null;
  providerPaymentId: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const paymentDb = (prisma as unknown as { payment: any }).payment as {
  findFirst(args: { where: object }): Promise<PaymentRow | null>;
  update(args: { where: { id: string }; data: object }): Promise<PaymentRow>;
  create(args: { data: object }): Promise<PaymentRow>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const webhookLogDb = (prisma as unknown as { webhookLog: any }).webhookLog as {
  create(args: { data: object }): Promise<{ id: string }>;
  update(args: { where: { id: string }; data: object }): Promise<{ id: string }>;
} | null;

async function logWebhook(provider: string, eventType: string, payloadJson: string): Promise<string | null> {
  if (!webhookLogDb) return null;
  try {
    const log = await webhookLogDb.create({ data: { provider, eventType, payloadJson } });
    return log.id;
  } catch { return null; }
}

async function markLogProcessed(logId: string | null, error?: string) {
  if (!logId || !webhookLogDb) return;
  try {
    await webhookLogDb.update({
      where: { id: logId },
      data: { processedAt: new Date(), ...(error ? { error } : {}) },
    });
  } catch { /* best-effort */ }
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.post('/yookassa', async (req: Request, res: Response) => {
  const body = req.body as { event?: string; object?: { id?: string } };
  const eventType = body?.event ?? 'unknown';
  const yookassaPaymentId = body?.object?.id;

  // Always respond 200 quickly so YooKassa doesn't retry indefinitely
  res.json({ ok: true });

  const logId = await logWebhook('yookassa', eventType, JSON.stringify(body));

  if (!yookassaPaymentId) {
    await markLogProcessed(logId, 'missing payment id in payload');
    return;
  }

  // Only handle payment events we care about
  if (!eventType.startsWith('payment.')) {
    await markLogProcessed(logId);
    return;
  }

  try {
    // ── Re-fetch payment from YooKassa to verify authenticity ──────────────
    const verified = await fetchYooKassaPayment(yookassaPaymentId);

    // Find our local Payment record
    const payment = await paymentDb.findFirst({
      where: { providerPaymentId: verified.id },
    });

    if (!payment) {
      // Could be a payment created outside our app, or a race condition on first webhook
      await markLogProcessed(logId, 'payment record not found');
      return;
    }

    if (verified.status === 'succeeded') {
      // Idempotent: if already succeeded, skip
      if (payment.status === 'succeeded') {
        await markLogProcessed(logId);
        return;
      }

      await paymentDb.update({ where: { id: payment.id }, data: { status: 'succeeded' } });

      // Activate subscription
      const periodEnd = payment.periodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const planId = payment.planId as PlanId;
      await activateSubscription(payment.userId, planId, periodEnd);

      console.log(`[webhooks/yookassa] activated ${planId} for user ${payment.userId}`);

    } else if (verified.status === 'canceled') {
      if (payment.status !== 'canceled') {
        await paymentDb.update({ where: { id: payment.id }, data: { status: 'canceled' } });
      }
      console.log(`[webhooks/yookassa] payment canceled for user ${payment.userId}`);
    }

    await markLogProcessed(logId);
  } catch (err) {
    const msg = (err as Error).message;
    console.error('[webhooks/yookassa] error:', msg);
    await markLogProcessed(logId, msg);
  }
});

export default router;
