/**
 * YooKassa API integration.
 *
 * Env vars required:
 *   YOOKASSA_SHOP_ID     — ЮKassa shopId (numeric string)
 *   YOOKASSA_SECRET_KEY  — ЮKassa secret key (sk_live_... or sk_test_...)
 *   PAYMENT_RETURN_URL   — URL to redirect user after payment (e.g. https://t.me/EATLYY_bot)
 *
 * Auth model: Basic <shopId>:<secretKey> (base64).
 * Idempotence-Key header prevents duplicate payments on retry.
 *
 * Re-fetch pattern for webhooks: always re-fetch payment from YooKassa API
 * to verify authenticity (prevents spoofed webhook calls).
 *
 * Recurring payments:
 *   First payment: pass savePaymentMethod=true → YooKassa saves the card.
 *   After payment.succeeded webhook: payment_method.id is stored in UserSubscription.providerSubId.
 *   Renewal: createRecurringPayment() uses the saved payment_method_id (no confirmation_url needed).
 */

const YOOKASSA_API = 'https://api.yookassa.ru/v3';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YKPaymentObject {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  paid: boolean;
  amount: { value: string; currency: string };
  confirmation?: { type: string; confirmation_url?: string };
  metadata?: Record<string, string>;
  created_at: string;
  expires_at?: string;
  /** Present after payment is confirmed. saved=true means it can be reused for auto-payments. */
  payment_method?: {
    id: string;
    saved: boolean;
    type: string;
    title?: string;
  };
}

export interface CreatePaymentParams {
  amountRub: number;
  description: string;
  planId: string;
  userId: string;
  returnUrl: string;
  idempotenceKey: string;
  /** Pass true to ask YooKassa to save the payment method for future auto-renewals. */
  savePaymentMethod?: boolean;
}

export interface CreatePaymentResult {
  yookassaPaymentId: string;
  confirmationUrl: string;
  status: string;
  /** Set when YooKassa already returned the saved method ID (rare at creation time). */
  paymentMethodId?: string;
}

export interface RecurringPaymentParams {
  paymentMethodId: string;
  amountRub: number;
  description: string;
  planId: string;
  userId: string;
  idempotenceKey: string;
}

export interface RecurringPaymentResult {
  yookassaPaymentId: string;
  /** 'succeeded' | 'canceled' | 'pending' */
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeader(): string {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) throw new Error('YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY not configured');
  return `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString('base64')}`;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Create a new YooKassa payment (first purchase — requires user redirect).
 * Returns the confirmation URL the user should be redirected to.
 *
 * Pass savePaymentMethod=true to ask YooKassa to save the card for future auto-renewals.
 * The actual payment_method.id becomes available after the payment succeeds (via webhook).
 */
export async function createYooKassaPayment(p: CreatePaymentParams): Promise<CreatePaymentResult> {
  const body: Record<string, unknown> = {
    amount: { value: p.amountRub.toFixed(2), currency: 'RUB' },
    capture: true,
    confirmation: { type: 'redirect', return_url: p.returnUrl },
    description: p.description,
    metadata: { userId: p.userId, planId: p.planId },
  };

  if (p.savePaymentMethod) {
    body['save_payment_method'] = true;
  }

  const res = await fetch(`${YOOKASSA_API}/payments`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader(),
      'Content-Type': 'application/json',
      'Idempotence-Key': p.idempotenceKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YooKassa ${res.status}: ${text}`);
  }

  const data = await res.json() as YKPaymentObject;

  const confirmationUrl = data.confirmation?.confirmation_url;
  if (!confirmationUrl) throw new Error('YooKassa did not return a confirmation_url');

  return {
    yookassaPaymentId: data.id,
    confirmationUrl,
    status: data.status,
    paymentMethodId: data.payment_method?.id,
  };
}

/**
 * Create a recurring (auto-renewal) payment using a previously saved payment method.
 * No confirmation_url is needed — the charge happens server-side without user interaction.
 *
 * YooKassa processes saved-card payments synchronously in most cases:
 *   status = 'succeeded' → charge went through, activate subscription immediately
 *   status = 'canceled'  → charge failed (insufficient funds, expired card, etc.)
 *   status = 'pending'   → processing; wait for payment.succeeded / payment.canceled webhook
 *
 * The idempotenceKey must be unique per (userId, period) to prevent duplicate charges.
 */
export async function createRecurringPayment(p: RecurringPaymentParams): Promise<RecurringPaymentResult> {
  const body = {
    amount: { value: p.amountRub.toFixed(2), currency: 'RUB' },
    capture: true,
    payment_method_id: p.paymentMethodId,
    description: p.description,
    metadata: { userId: p.userId, planId: p.planId, type: 'renewal' },
  };

  const res = await fetch(`${YOOKASSA_API}/payments`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader(),
      'Content-Type': 'application/json',
      'Idempotence-Key': p.idempotenceKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YooKassa ${res.status}: ${text}`);
  }

  const data = await res.json() as YKPaymentObject;
  return { yookassaPaymentId: data.id, status: data.status };
}

/**
 * Re-fetch a payment from YooKassa to verify its current status.
 * Used by the webhook handler to avoid trusting unverified webhook payloads.
 */
export async function fetchYooKassaPayment(yookassaPaymentId: string): Promise<YKPaymentObject> {
  const res = await fetch(`${YOOKASSA_API}/payments/${yookassaPaymentId}`, {
    headers: { 'Authorization': authHeader() },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YooKassa ${res.status}: ${text}`);
  }
  return res.json() as Promise<YKPaymentObject>;
}
