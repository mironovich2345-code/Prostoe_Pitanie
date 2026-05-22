import { Router } from 'express';
import type { AuthRequest } from '../middleware/telegramAuth';
import { deleteAccountByTelegramChatId } from '../../services/accountDeletionService';

const router = Router();

router.post('/delete', async (req: AuthRequest, res) => {
  if (req.platform !== 'telegram') {
    res.json({ ok: false, error: 'delete_account_supported_only_telegram' });
    return;
  }

  const chatId = req.chatId;
  if (!chatId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    await deleteAccountByTelegramChatId(chatId);
    res.json({ ok: true });
  } catch (err) {
    console.error('[account/delete] error for chatId', chatId, err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
