import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const subscription = await prisma.subscription.findUnique({ where: { chatId } });
    res.json({ subscription });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
