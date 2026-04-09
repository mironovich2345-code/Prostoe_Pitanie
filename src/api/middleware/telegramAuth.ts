import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface AuthRequest extends Request {
  telegramUser?: TelegramUser;
  chatId?: string;
}

type ValidationResult =
  | { ok: true; user: TelegramUser }
  | { ok: false; reason: 'invalid' | 'expired' };

// Reject initData older than 1 hour
const MAX_AUTH_AGE_SECONDS = 3600;

export function validateTelegramInitData(initData: string, botToken: string): ValidationResult {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { ok: false, reason: 'invalid' };
    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (hash !== expectedHash) return { ok: false, reason: 'invalid' };

    // Check auth_date to reject replayed or stale tokens
    const authDateStr = params.get('auth_date');
    if (authDateStr) {
      const authDate = parseInt(authDateStr, 10);
      if (!isNaN(authDate)) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (nowSeconds - authDate > MAX_AUTH_AGE_SECONDS) {
          return { ok: false, reason: 'expired' };
        }
      }
    }

    const userStr = params.get('user');
    if (!userStr) return { ok: false, reason: 'invalid' };
    return { ok: true, user: JSON.parse(userStr) as TelegramUser };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

export function telegramAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const initData = req.headers['x-telegram-init-data'] as string | undefined;
  const botToken = process.env.BOT_TOKEN ?? '';

  // In dev mode with no initData, allow mock user if DEV_CHAT_ID is set
  if (!initData) {
    const devChatId = process.env.DEV_CHAT_ID;
    if (devChatId && process.env.NODE_ENV !== 'production') {
      req.telegramUser = { id: Number(devChatId), first_name: 'Dev' };
      req.chatId = devChatId;
      return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const result = validateTelegramInitData(initData, botToken);
  if (!result.ok) {
    if (result.reason === 'expired') {
      res.status(401).json({ error: 'Expired auth_date' });
    } else {
      res.status(401).json({ error: 'Invalid initData' });
    }
    return;
  }

  req.telegramUser = result.user;
  req.chatId = String(result.user.id);
  next();
}
