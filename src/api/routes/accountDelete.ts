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
    console.error('[account/delete] missing chatId — platformAuthMiddleware did not set it');
    res.status(401).json({ ok: false, error: 'missing_chat_id' });
    return;
  }

  try {
    const result = await deleteAccountByTelegramChatId(chatId);
    if (result.notes.length > 0) {
      console.info('[account/delete] completed with notes', { notes: result.notes });
    }
    res.json({ ok: true });
  } catch (err: unknown) {
    const errorName    = err instanceof Error ? err.constructor.name : typeof err;
    const errorCode    = (err as Record<string, unknown>)?.code;
    const errorMessage = err instanceof Error ? err.message.slice(0, 300) : String(err);
    const errorMeta    = (err as Record<string, unknown>)?.meta;
    console.error('[account/delete] failed', { chatId, errorName, errorCode, errorMessage, errorMeta });
    res.status(500).json({ ok: false, error: 'deletion_failed', code: errorCode ?? 'unknown' });
  }
});

export default router;
