/**
 * MAX Bot API client — handles all outbound calls to the MAX messenger Bot API.
 *
 * Isolated from Telegram: uses MAX_BOT_TOKEN and MAX_API_BASE_URL only.
 * Never shares state or tokens with the Telegraf/Telegram transport.
 *
 * ─── API notes ────────────────────────────────────────────────────────────────
 * Authorization: token is sent in the `Authorization` header (per MAX docs).
 * Base URL is configurable via MAX_API_BASE_URL env var.
 *
 * ─── What to verify when MAX SDK docs are fully public ────────────────────────
 * - Exact `recipient` field name (user_id vs chat_id for personal chats)
 * - Whether the top-level `type: 'message'` field is required
 * - Button/keyboard payload format (not needed for Phase 1)
 */

const BASE_URL = process.env.MAX_API_BASE_URL ?? 'https://botapi.max.ru';

/** Minimal shape for the message recipient.
 *  For personal chats send to chat_id (which equals the user_id in 1:1 context).
 *  The `user_id` alternative is kept for convenience if the caller only has user_id. */
type MaxRecipient =
  | { chat_id: number }
  | { user_id: number };

/** Send a plain-text message to a MAX chat or user.
 *
 * @param recipient  chat_id or user_id of the target
 * @param text       UTF-8 text to send (MAX limit: 4096 chars)
 */
export async function sendMaxMessage(recipient: MaxRecipient, text: string): Promise<void> {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) {
    console.error('[maxClient] MAX_BOT_TOKEN is not configured — cannot send message');
    return;
  }

  const body = {
    recipient,
    type: 'message',
    body: { text: text.slice(0, 4096) },
  };

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error('[maxClient] sendMaxMessage network error:', err);
    throw err;
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    // Don't log the token; just status and first 200 chars of response
    console.error(`[maxClient] sendMaxMessage failed: HTTP ${res.status}`, errBody.slice(0, 200));
    throw new Error(`MAX API HTTP ${res.status}`);
  }
}

/** Register (or update) the webhook subscription for this bot.
 *
 * Call once after deploy — idempotent per MAX API contract.
 * update_types can be extended as new update types are handled.
 *
 * @param webhookUrl  Full public HTTPS URL, e.g. https://example.com/api/max/webhook
 * @param updateTypes Update types to subscribe to (default: minimum viable set)
 */
export async function registerMaxWebhook(
  webhookUrl: string,
  updateTypes: string[] = ['bot_started', 'message_created'],
): Promise<void> {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) throw new Error('MAX_BOT_TOKEN is not configured');

  const body = {
    url: webhookUrl,
    update_types: updateTypes,
  };

  const res = await fetch(`${BASE_URL}/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`MAX /subscriptions failed: HTTP ${res.status} — ${errBody.slice(0, 200)}`);
  }

  console.log(`[maxClient] Webhook registered: ${webhookUrl} → update_types: ${updateTypes.join(', ')}`);
}
