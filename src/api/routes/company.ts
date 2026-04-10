import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';
import { recognizeRequisites } from '../../ai/recognizeRequisites';

const router = Router();

// GET /api/company/requisites — load saved requisites for this company
router.get('/requisites', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const tp = await prisma.trainerProfile.findUnique({
      where: { chatId },
      select: { requisitesData: true },
    });
    const data = tp?.requisitesData ? JSON.parse(tp.requisitesData) : null;
    res.json({ requisites: data });
  } catch (err) {
    console.error('[company/requisites GET]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/company/requisites — save requisites
router.patch('/requisites', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { requisites } = req.body as { requisites: unknown };
  if (!requisites || typeof requisites !== 'object') {
    res.status(400).json({ error: 'requisites object required' });
    return;
  }
  try {
    await prisma.trainerProfile.update({
      where: { chatId },
      data: { requisitesData: JSON.stringify(requisites) },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[company/requisites PATCH]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/company/requisites/recognize — AI recognition from photo/document
// Requires caller to have a trainerProfile (trainers and companies only)
router.post('/requisites/recognize', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { imageData } = req.body as { imageData?: string };
  if (!imageData) { res.status(400).json({ error: 'imageData required' }); return; }
  try {
    const tp = await prisma.trainerProfile.findUnique({
      where: { chatId },
      select: { chatId: true },
    });
    if (!tp) { res.status(403).json({ error: 'Access denied' }); return; }

    const result = await recognizeRequisites(imageData);
    res.json({ recognized: result });
  } catch (err) {
    console.error('[company/requisites/recognize]', err);
    res.status(500).json({ error: 'Recognition failed' });
  }
});

export default router;
