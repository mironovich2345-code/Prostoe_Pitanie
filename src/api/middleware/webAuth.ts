import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface WebAuthRequest extends Request {
  webUser?: {
    userId: string;
    chatId: string;
    platform: 'telegram' | 'max';
  };
}

const COOKIE_NAME = 'web_session';

function getSecret(): string {
  return process.env.WEB_SESSION_SECRET || 'dev-secret-change-in-production';
}

export function requireWebAuth(req: WebAuthRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'NOT_AUTHENTICATED' });
    return;
  }
  try {
    const payload = jwt.verify(token, getSecret()) as {
      userId: string;
      chatId: string;
      platform: 'telegram' | 'max';
    };
    req.webUser = { userId: payload.userId, chatId: payload.chatId, platform: payload.platform };
    next();
  } catch {
    res.status(401).json({ error: 'SESSION_EXPIRED' });
  }
}
