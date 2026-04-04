import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

const router = Router();

// GET /api/nutrition/today — today's meals and totals
router.get('/today', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const meals = await prisma.mealEntry.findMany({
      where: { chatId, createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: 'asc' },
    });
    let totalCal = 0, totalProt = 0, totalFat = 0, totalCarbs = 0, totalFiber = 0;
    const counts: Record<string, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
    for (const m of meals) {
      totalCal += m.caloriesKcal ?? 0;
      totalProt += m.proteinG ?? 0;
      totalFat += m.fatG ?? 0;
      totalCarbs += m.carbsG ?? 0;
      totalFiber += m.fiberG ?? 0;
      if (m.mealType in counts) counts[m.mealType]++;
    }
    res.json({ meals, totals: { calories: Math.round(totalCal), protein: totalProt, fat: totalFat, carbs: totalCarbs, fiber: totalFiber }, counts });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/nutrition/diary?date=YYYY-MM-DD
router.get('/diary', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const dateStr = req.query.date as string;
  try {
    const date = dateStr ? new Date(dateStr) : new Date();
    const start = new Date(date); start.setHours(0,0,0,0);
    const end = new Date(date); end.setHours(23,59,59,999);
    const meals = await prisma.mealEntry.findMany({
      where: { chatId, createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ date: date.toISOString().split('T')[0], meals });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/nutrition/meals/:id/media — fetch Telegram file URL for a meal
router.get('/meals/:id/media', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  try {
    const meal = await prisma.mealEntry.findFirst({
      where: { id, chatId },
      select: { sourceType: true, photoFileId: true, voiceFileId: true },
    });
    if (!meal) { res.status(404).json({ error: 'Not found' }); return; }
    const fileId = meal.sourceType === 'photo' ? meal.photoFileId
                 : meal.sourceType === 'voice' ? meal.voiceFileId
                 : null;
    if (!fileId) { res.status(404).json({ error: 'No media source' }); return; }
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) { res.status(500).json({ error: 'Bot not configured' }); return; }
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const tgData = await tgRes.json() as { ok: boolean; result?: { file_path: string } };
    if (!tgData.ok || !tgData.result?.file_path) {
      res.status(404).json({ error: 'File not available' }); return;
    }
    res.json({ url: `https://api.telegram.org/file/bot${botToken}/${tgData.result.file_path}`, type: meal.sourceType });
  } catch (err) {
    console.error('[nutrition/meals/:id/media]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/nutrition/stats?days=7
router.get('/stats', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const days = parseInt(req.query.days as string) || 7;
  try {
    const since = new Date(); since.setDate(since.getDate() - days); since.setHours(0,0,0,0);
    const meals = await prisma.mealEntry.findMany({
      where: { chatId, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ days, meals });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
