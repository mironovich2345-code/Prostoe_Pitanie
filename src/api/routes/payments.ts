/**
 * POST /api/payments/create
 *
 * Creates a YooKassa payment for the authenticated user and returns a
 * confirmation URL to redirect them to the payment page.
 *
 * Body: { planId: 'pro' | 'optimal', offer?: 'pro_3day' | 'month_1rub' }
 *
 * Offer logic:
 *   pro_3day   → Pro Intro, 3 days,  1 ₽   (first purchase, no trainer offer)
 *   month_1rub → Pro Intro, 30 days, 1 ₽   (first purchase, trainer month_1rub offer)
 *   (none)     → standard pricing (pro=499, optimal=399), 30 days
 */

import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';
import { createYooKassaPayment } from '../../services/yookassaService';

const router = Router();

// ─── Plan config ──────────────────────────────────────────────────────────────

interface PlanConfig {
  actualPlanId: string;
  amountRub: number;
  periodDays: number;
  description: string;
}

function resolvePlan(planId: string, offer?: string): PlanConfig | null {
  if (planId === 'pro') {
    if (offer === 'month_1rub') {
      return { actualPlanId: 'intro', amountRub: 1, periodDays: 30, description: 'Pro — 1 месяц за 1 ₽' };
    }
    if (offer === 'pro_3day') {
      return { actualPlanId: 'intro', amountRub: 1, periodDays: 3, description: 'Pro — 3 дня за 1 ₽' };
    }
    return { actualPlanId: 'pro', amountRub: 499, periodDays: 30, description: 'Pro — 499 ₽/мес' };
  }
  if (planId === 'optimal') {
    return { actualPlanId: 'optimal', amountRub: 399, periodDays: 30, description: 'Optimal — 399 ₽/мес' };
  }
  return null;
}

// ─── Payment DB (stale Prisma cast) ───────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const paymentDb = (prisma as unknown as { payment: any }).payment as {
  create(args: { data: object }): Promise<{ id: string }>;
  update(args: { where: { id: string }; data: object }): Promise<{ id: string }>;
};

// ─── Route ────────────────────────────────────────────────────────────────────

router.post('/create', async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.status(400).json({ error: 'userId not resolved — cannot create payment' });
    return;
  }

  const { planId, offer } = req.body as { planId?: string; offer?: string };
  if (!planId) {
    res.status(400).json({ error: 'planId required' });
    return;
  }

  const plan = resolvePlan(planId, offer);
  if (!plan) {
    res.status(400).json({ error: `Unknown planId: ${planId}` });
    return;
  }

  const returnUrl =
    process.env.PAYMENT_RETURN_URL ??
    process.env.MINIAPP_ORIGIN ??
    `https://t.me/${process.env.BOT_USERNAME ?? 'EATLYY_bot'}`;

  // Idempotence key: scoped to user + plan + offer so re-clicks within the same
  // minute reuse the same YooKassa payment rather than creating duplicates.
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const idempotenceKey = `${userId}-${plan.actualPlanId}-${offer ?? 'none'}-${minuteBucket}`;

  const now = new Date();
  const periodEnd = new Date(now.getTime() + plan.periodDays * 24 * 60 * 60 * 1000);

  try {
    // 1. Create local Payment record (status: pending)
    const payment = await paymentDb.create({
      data: {
        userId,
        provider: 'yookassa',
        planId: plan.actualPlanId,
        amountRub: plan.amountRub,
        status: 'pending',
        periodStart: now,
        periodEnd,
      },
    });

    // 2. Call YooKassa API
    let yookassaResult;
    try {
      yookassaResult = await createYooKassaPayment({
        amountRub: plan.amountRub,
        description: plan.description,
        planId: plan.actualPlanId,
        userId,
        returnUrl,
        idempotenceKey,
      });
    } catch (err) {
      // Mark the local payment as failed so it doesn't stay orphaned
      await paymentDb.update({ where: { id: payment.id }, data: { status: 'failed' } }).catch(() => {});
      throw err;
    }

    // 3. Persist the YooKassa payment ID
    await paymentDb.update({
      where: { id: payment.id },
      data: { providerPaymentId: yookassaResult.yookassaPaymentId },
    });

    res.json({
      confirmationUrl: yookassaResult.confirmationUrl,
      paymentId: payment.id,
    });
  } catch (err) {
    const e = err as Error;
    console.error('[payments/create]', e.message);
    res.status(500).json({ error: 'Не удалось создать платёж. Попробуйте позже.' });
  }
});

export default router;
