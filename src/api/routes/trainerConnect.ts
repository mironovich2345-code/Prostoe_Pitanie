import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

const router = Router();

/** Generate a random 6-digit numeric string, zero-padded */
async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const existing = await prisma.trainerProfile.findFirst({
      where: { connectionCode: code },
      select: { chatId: true },
    });
    if (!existing) return code;
  }
  // Extremely unlikely — 10^6 space, fall back to timestamp-derived code
  return String(Date.now()).slice(-6);
}

function buildConnectLink(code: string): string {
  const botUsername = process.env.BOT_USERNAME ?? '';
  if (!botUsername) return `connect_${code}`;
  return `https://t.me/${botUsername}?start=connect_${code}`;
}

/** Ensure trainer has a permanent 6-digit code; migrate old-format codes lazily */
async function ensurePermanentCode(chatId: string): Promise<string> {
  const tp = await prisma.trainerProfile.findUnique({
    where: { chatId },
    select: { verificationStatus: true, connectionCode: true },
  });
  if (!tp || tp.verificationStatus !== 'verified') {
    throw Object.assign(new Error('Not a verified trainer'), { code: 403 });
  }

  // If already a valid 6-digit numeric code — return it unchanged
  if (tp.connectionCode && /^\d{6}$/.test(tp.connectionCode)) {
    return tp.connectionCode;
  }

  // First visit or old alphanumeric code: assign a permanent 6-digit code
  const newCode = await generateUniqueCode();
  await prisma.trainerProfile.update({
    where: { chatId },
    data: { connectionCode: newCode, connectionCodeExpiresAt: null },
  });
  return newCode;
}

/** GET /api/trainer/my-code — get permanent 6-digit connection code */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const code = await ensurePermanentCode(req.chatId!);
    res.json({ code, link: buildConnectLink(code) });
  } catch (err: any) {
    if (err.code === 403) { res.status(403).json({ error: err.message }); return; }
    console.error('[trainer/my-code GET]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /refresh is kept for backwards compatibility but now returns the same permanent code
router.post('/refresh', async (req: AuthRequest, res: Response) => {
  try {
    const code = await ensurePermanentCode(req.chatId!);
    res.json({ code, link: buildConnectLink(code) });
  } catch (err: any) {
    if (err.code === 403) { res.status(403).json({ error: err.message }); return; }
    console.error('[trainer/my-code POST /refresh]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
