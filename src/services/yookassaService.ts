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
}

export interface CreatePaymentParams {
  amountRub: number;
  description: string;
  planId: string;
  userId: string;
  returnUrl: string;
  idempotenceKey: string;
}

export interface CreatePaymentResult {
  yookassaPaymentId: string;
  confirmationUrl: string;
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
 * Create a new YooKassa payment.
 * Returns the confirmation URL the user should be redirected to.
 */
export async function createYooKassaPayment(p: CreatePaymentParams): Promise<CreatePaymentResult> {
  const body = {
    amount: { value: p.amountRub.toFixed(2), currency: 'RUB' },
    capture: true,
    confirmation: { type: 'redirect', return_url: p.returnUrl },
    description: p.description,
    metadata: { userId: p.userId, planId: p.planId },
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

  const confirmationUrl = data.confirmation?.confirmation_url;
  if (!confirmationUrl) throw new Error('YooKassa did not return a confirmation_url');

  return {
    yookassaPaymentId: data.id,
    confirmationUrl,
    status: data.status,
  };
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
