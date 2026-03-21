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

export function validateTelegramInitData(initData: string, botToken: string): TelegramUser | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (hash !== expectedHash) return null;
    const userStr = params.get('user');
    if (!userStr) return null;
    return JSON.parse(userStr) as TelegramUser;
  } catch {
    return null;
  }
}

export function telegramAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  // In dev mode with no initData, allow with mock user if DEV_CHAT_ID is set
  const initData = req.headers['x-telegram-init-data'] as string | undefined;
  const botToken = process.env.BOT_TOKEN ?? '';

  if (!initData) {
    const devChatId = process.env.DEV_CHAT_ID;
    if (devChatId && process.env.NODE_ENV !== 'production') {
      req.telegramUser = { id: Number(devChatId), first_name: 'Dev' };
      req.chatId = devChatId;
      return next();
    }
    res.status(401).json({ error: 'Missing auth' });
    return;
  }

  const user = validateTelegramInitData(initData, botToken);
  if (!user) {
    res.status(401).json({ error: 'Invalid auth' });
    return;
  }
  req.telegramUser = user;
  req.chatId = String(user.id);
  next();
}
