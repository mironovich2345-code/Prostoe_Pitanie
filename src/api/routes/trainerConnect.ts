import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

const router = Router();

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function buildConnectLink(code: string): string {
  const botUsername = process.env.BOT_USERNAME ?? '';
  if (!botUsername) return `connect_${code}`;
  return `https://t.me/${botUsername}?start=connect_${code}`;
}

async function getOrCreateCode(chatId: string) {
  const tp = await prisma.trainerProfile.findUnique({
    where: { chatId },
    select: { verificationStatus: true, connectionCode: true, connectionCodeExpiresAt: true },
  });
  if (!tp || tp.verificationStatus !== 'verified') throw Object.assign(new Error('Not a verified trainer'), { code: 403 });

  if (tp.connectionCode && tp.connectionCodeExpiresAt && tp.connectionCodeExpiresAt > new Date()) {
    return { code: tp.connectionCode, expiresAt: tp.connectionCodeExpiresAt };
  }
  return refreshCode(chatId);
}

async function refreshCode(chatId: string) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  await prisma.trainerProfile.update({
    where: { chatId },
    data: { connectionCode: code, connectionCodeExpiresAt: expiresAt },
  });
  return { code, expiresAt };
}

/** GET /api/trainer/my-code — get (or auto-generate) connection code */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { code, expiresAt } = await getOrCreateCode(req.chatId!);
    res.json({ code, link: buildConnectLink(code), expiresAt });
  } catch (err: any) {
    if (err.code === 403) { res.status(403).json({ error: err.message }); return; }
    console.error('[trainer/my-code GET]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/trainer/my-code/refresh — force-generate a new code */
router.post('/refresh', async (req: AuthRequest, res: Response) => {
  try {
    const tp = await prisma.trainerProfile.findUnique({
      where: { chatId: req.chatId! },
      select: { verificationStatus: true },
    });
    if (!tp || tp.verificationStatus !== 'verified') {
      res.status(403).json({ error: 'Not a verified trainer' }); return;
    }
    const { code, expiresAt } = await refreshCode(req.chatId!);
    res.json({ code, link: buildConnectLink(code), expiresAt });
  } catch (err) {
    console.error('[trainer/my-code POST /refresh]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
