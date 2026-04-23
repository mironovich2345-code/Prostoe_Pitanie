/**
 * POST /api/max/webhook
 *
 * Receives update batches from MAX Bot API.
 * Registered WITHOUT platform auth middleware — MAX sends server-to-server POST
 * requests, not user-authenticated mini app requests.
 *
 * Security:
 *   MAX does not document a cryptographic signature for webhooks (unlike Telegram).
 *   We validate an optional shared secret via `MAX_WEBHOOK_SECRET` env var.
 *   If set, the header `X-Max-Webhook-Secret` must match the value.
 *   If not set, the endpoint is open (acceptable for Phase 1; harden in Phase 2
 *   when MAX publishes their signature spec).
 *
 * ─── Update types handled ─────────────────────────────────────────────────────
 *   bot_started     → user opened the bot for the first time / after /start
 *   message_created → user sent a message to the bot
 *
 * ─── What is NOT done here ────────────────────────────────────────────────────
 *   - No UserProfile creation on webhook (avoids DB noise from bot events)
 *   - No session state, no full TG UX port
 *   - Identity linking is a separate explicit user flow
 *
 * ─── MAX update payload format (TamTam-compatible) ───────────────────────────
 *   {
 *     updates: Update[],
 *     marker: number          // use for long-polling; ignored on webhook
 *   }
 *
 *   bot_started update:
 *   {
 *     update_type: "bot_started",
 *     timestamp: number,
 *     chat_id: number,        // chat to reply to
 *     user: { user_id: number, name: string, username?: string }
 *   }
 *
 *   message_created update:
 *   {
 *     update_type: "message_created",
 *     timestamp: number,
 *     message: {
 *       sender: { user_id: number, name: string, username?: string },
 *       recipient: { user_id?: number, chat_id: number },
 *       body: { mid: string, seq: number, text?: string }
 *     }
 *   }
 */

import { Router, Request, Response } from 'express';
import { sendMaxMessage } from '../../services/maxClient';

const router = Router();

// ─── Types ────────────────────────────────────────────────────────────────────

interface MaxUser {
  user_id: number;
  name?: string;
  username?: string;
}

interface BotStartedUpdate {
  update_type: 'bot_started';
  timestamp: number;
  chat_id: number;
  user: MaxUser;
  payload?: string;
}

interface MessageCreatedUpdate {
  update_type: 'message_created';
  timestamp: number;
  message: {
    sender: MaxUser;
    recipient: { user_id?: number; chat_id: number };
    body: { mid?: string; seq?: number; text?: string };
  };
}

type MaxUpdate = BotStartedUpdate | MessageCreatedUpdate | { update_type: string };

interface MaxWebhookPayload {
  updates?: MaxUpdate[];
  // MAX may also send a single update at the top level (defensive handling)
  update_type?: string;
}

// ─── Greeting sent on bot_started ────────────────────────────────────────────

const GREETING = `Привет! 👋 Я EATLY — твой персональный дневник питания.

Здесь ты можешь отслеживать еду, считать калории и работать с нутрициологом.

🚀 Чтобы начать, открой мини-приложение с помощью кнопки ниже.`;

const ECHO_PREFIX = 'Получил твоё сообщение: ';

// ─── Secret validation ────────────────────────────────────────────────────────

function validateSecret(req: Request): boolean {
  const secret = process.env.MAX_WEBHOOK_SECRET;
  if (!secret) return true; // no secret configured — allow all (log warning in dev)
  const incoming = req.headers['x-max-webhook-secret'] as string | undefined;
  return incoming === secret;
}

// ─── Single update handler ────────────────────────────────────────────────────

async function handleUpdate(update: MaxUpdate): Promise<void> {
  const type = update.update_type;

  if (type === 'bot_started') {
    const u = update as BotStartedUpdate;
    const displayName = u.user.name ?? `Пользователь ${u.user.user_id}`;
    console.log(`[maxWebhook] bot_started  chat_id=${u.chat_id} user_id=${u.user.user_id} name="${displayName}"`);

    await sendMaxMessage({ chat_id: u.chat_id }, GREETING);
    return;
  }

  if (type === 'message_created') {
    const u = update as MessageCreatedUpdate;
    const chatId = u.message.recipient.chat_id;
    const senderId = u.message.sender.user_id;
    const text = u.message.body.text ?? '';
    console.log(`[maxWebhook] message_created  chat_id=${chatId} sender_id=${senderId} text_len=${text.length}`);

    // Phase 1: echo the message back so we can verify the integration works.
    // Phase 2: route through the full command/intent handler shared with Telegram.
    const reply = text.trim()
      ? `${ECHO_PREFIX}«${text.slice(0, 200)}»`
      : 'Получил твоё сообщение. Открой мини-приложение, чтобы начать работу с дневником питания.';

    await sendMaxMessage({ chat_id: chatId }, reply);
    return;
  }

  // Unhandled update type — log and ignore (do not return error to MAX)
  console.log(`[maxWebhook] unhandled update_type="${type}" — ignored`);
}

// ─── POST /api/max/webhook ────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  // 1. Basic secret check (optional shared secret guard)
  if (!validateSecret(req)) {
    console.warn('[maxWebhook] rejected: invalid X-Max-Webhook-Secret');
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  // 2. Always respond 200 quickly — MAX may retry on non-2xx.
  //    Processing happens async so a slow handler doesn't cause retries.
  res.json({ ok: true });

  // 3. Parse updates
  const body = req.body as MaxWebhookPayload;

  // MAX sends either { updates: [...] } or sometimes a bare update object
  const updates: MaxUpdate[] = Array.isArray(body.updates)
    ? body.updates
    : body.update_type
      ? [body as MaxUpdate]
      : [];

  if (updates.length === 0) {
    // Could be a ping / subscription confirmation — nothing to do
    return;
  }

  // 4. Process updates sequentially (avoid race conditions on rapid messages)
  for (const update of updates) {
    try {
      await handleUpdate(update);
    } catch (err) {
      // Log but don't rethrow — one failed update must not block the rest
      console.error('[maxWebhook] handleUpdate error:', err);
    }
  }
});

export default router;
