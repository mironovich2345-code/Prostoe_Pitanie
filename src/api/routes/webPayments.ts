/**
 * Web subscription & payment endpoints (cookie-based auth, no Mini App dependency).
 *
 * GET  /api/web/subscription        — current subscription state + pro-intro eligibility
 * POST /api/web/payments/create     — create a YooKassa payment for web users
 *
 * Security:
 *   - requireWebAuth on every route
 *   - userId comes only from the JWT cookie — never from the request body
 *   - intro offer checked server-side (any previous succeeded payment → ineligible)
 *   - YooKassa misconfiguration returns 503 with a clear error code
 */

import express, { Response } from 'express';
import { requireWebAuth, WebAuthRequest } from '../middleware/webAuth';
import prisma from '../../db';
import { getSubscriptionState } from '../../services/subscriptionService';
import { createYooKassaPayment } from '../../services/yookassaService';

const router = express.Router();
router.use(requireWebAuth as express.RequestHandler);

// ─── Plan table ───────────────────────────────────────────────────────────────

interface WebPlanConfig {
  actualPlanId: string;
  amountRub: number;
  periodDays: number;
  description: string;
  receiptDescription: string;
}

const WEB_PLANS: Record<string, WebPlanConfig> = {
  optimal: {
    actualPlanId: 'optimal', amountRub: 399, periodDays: 30,
    description: 'Optimal — 399 ₽/мес',
    receiptDescription: 'Подписка EATLYY Optimal на 1 месяц',
  },
  pro: {
    actualPlanId: 'pro', amountRub: 499, periodDays: 30,
    description: 'Pro — 499 ₽/мес',
    receiptDescription: 'Подписка EATLYY Pro на 1 месяц',
  },
  pro_intro: {
    actualPlanId: 'intro', amountRub: 1, periodDays: 3,
    description: 'Pro — 3 дня за 1 ₽',
    receiptDescription: 'Пробный доступ EATLYY Pro на 3 дня',
  },
};

// ─── Prisma casts ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const paymentDb = (prisma as unknown as { payment: any }).payment as {
  create(args: { data: object }): Promise<{ id: string }>;
  update(args: { where: { id: string }; data: object }): Promise<{ id: string }>;
  findFirst(args: { where: object }): Promise<{ id: string } | null>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const consentDb = (prisma as unknown as { userLegalConsent: any }).userLegalConsent as {
  create(args: { data: object }): Promise<{ id: string }>;
};

// ─── GET /api/web/subscription ────────────────────────────────────────────────

router.get('/subscription', async (req: WebAuthRequest, res: Response) => {
  const { userId } = req.webUser!;

  try {
    const [{ subscription, accessLevel }, prevPayment] = await Promise.all([
      getSubscriptionState(userId),
      paymentDb.findFirst({ where: { userId, status: 'succeeded' } }),
    ]);

    const canUseProIntro = !prevPayment;

    res.json({
      ok: true,
      subscription: {
        planId: subscription?.planId ?? null,
        status: subscription?.status ?? null,
        currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
        trialEndsAt: subscription?.trialEndsAt?.toISOString() ?? null,
        accessLevel,
        hasOptimal: (subscription?.planId === 'optimal' || subscription?.planId === 'client_monthly') && accessLevel === 'full',
        hasPro: (subscription?.planId === 'pro' || subscription?.planId === 'intro') && accessLevel === 'full',
      },
      offers: {
        canUseProIntro,
        proIntro: {
          enabled: true,
          priceRub: 1,
          durationDays: 3,
          thenPriceRub: 499,
        },
      },
    });
  } catch (err) {
    console.error('[web/subscription]', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// ─── POST /api/web/payments/create ───────────────────────────────────────────

router.post('/payments/create', async (req: WebAuthRequest, res: Response) => {
  const { userId } = req.webUser!;

  const body = (req.body ?? {}) as {
    planId?: string;
    acceptedSubscriptionTerms?: boolean;
    returnUrl?: string;
    receiptEmail?: string;
  };

  const { planId, acceptedSubscriptionTerms, returnUrl: bodyReturnUrl, receiptEmail: bodyEmail } = body;

  // Validate planId
  if (!planId || !(planId in WEB_PLANS)) {
    res.status(400).json({ ok: false, error: 'invalid_plan_id' });
    return;
  }

  // Require explicit terms acceptance
  if (acceptedSubscriptionTerms !== true) {
    res.status(400).json({ ok: false, error: 'subscription_terms_required' });
    return;
  }

  // Check YooKassa is configured before doing any DB work
  if (!process.env.YOOKASSA_SHOP_ID || !process.env.YOOKASSA_SECRET_KEY) {
    res.status(503).json({ ok: false, error: 'payment_provider_not_configured' });
    return;
  }

  const plan = WEB_PLANS[planId];

  try {
    // Guard: pro_intro is first-purchase only — check server-side
    if (planId === 'pro_intro') {
      const previous = await paymentDb.findFirst({ where: { userId, status: 'succeeded' } });
      if (previous) {
        res.status(409).json({ ok: false, error: 'intro_already_used' });
        return;
      }
    }

    // Determine returnUrl — accept from body if it's an absolute https URL, otherwise fall back to env
    const webOrigin = process.env.WEB_ORIGIN ?? process.env.MINIAPP_ORIGIN ?? 'https://eatlyy.ru';
    const returnUrl =
      bodyReturnUrl && /^https?:\/\//.test(bodyReturnUrl)
        ? bodyReturnUrl
        : `${webOrigin}/payment/success`;

    // Idempotence key — scoped to user+plan+minute to prevent duplicates on rapid retry
    const minuteBucket = Math.floor(Date.now() / 60_000);
    const idempotenceKey = `web-${userId}-${plan.actualPlanId}-${minuteBucket}`;

    const now = new Date();
    const periodEnd = new Date(now.getTime() + plan.periodDays * 24 * 60 * 60 * 1000);

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
      const emailClean = bodyEmail?.trim() || undefined;
      yookassaResult = await createYooKassaPayment({
        amountRub: plan.amountRub,
        description: plan.description,
        receiptDescription: plan.receiptDescription,
        receiptEmail: emailClean,
        planId: plan.actualPlanId,
        userId,
        returnUrl,
        idempotenceKey,
        savePaymentMethod: true,
      });
    } catch (err) {
      // Mark the local record as failed so it doesn't stay orphaned
      await paymentDb.update({ where: { id: payment.id }, data: { status: 'failed' } }).catch(() => {});
      throw err;
    }

    // 3. Persist the YooKassa payment ID
    await paymentDb.update({
      where: { id: payment.id },
      data: { providerPaymentId: yookassaResult.yookassaPaymentId },
    });

    console.log(
      `[web/payments/create] payment created: id=${payment.id} userId=${userId}`,
      `planId=${plan.actualPlanId} amount=${plan.amountRub}`,
    );

    // Record legal consent fire-and-forget
    consentDb.create({
      data: { userId, source: 'web_payment', acceptedSubscriptionTerms: true },
    }).catch(() => {});

    res.json({
      ok: true,
      payment: { id: payment.id, confirmationUrl: yookassaResult.confirmationUrl },
    });
  } catch (err) {
    const e = err as Error;
    if (e.message === 'YOOKASSA_RECEIPT_ERROR') {
      res.status(400).json({ ok: false, error: 'receipt_email_required' });
      return;
    }
    console.error('[web/payments/create]', e.message);
    res.status(500).json({ ok: false, error: 'payment_creation_failed' });
  }
});

export default router;
