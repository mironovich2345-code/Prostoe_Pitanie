import { Router, Response } from 'express';
import { Telegram } from 'telegraf';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';
import { validateImageDataUrl, PHOTO_MAX_BYTES } from '../utils/validateImage';
import { uploadObject, mimeToExt, StorageNotConfiguredError } from '../../storage/r2';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const router = Router();

// POST /api/expert/apply — submit trainer application
router.post('/apply', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { fullName, socialLink, verificationPhotoData, specialization, bio, applicantType } = req.body as {
    fullName?: string;
    socialLink?: string;
    verificationPhotoData?: string;
    specialization?: string;
    bio?: string;
    applicantType?: 'expert' | 'company';
  };

  if (!fullName?.trim() || !socialLink?.trim()) {
    res.status(400).json({ error: 'fullName and socialLink are required' });
    return;
  }

  // Company applications are identified by applicantType='company' or specialization='Компания' (legacy)
  const isCompany = applicantType === 'company' || specialization?.trim() === 'Компания';

  // Selfie is mandatory for individual expert applications
  if (!isCompany && !verificationPhotoData) {
    res.status(400).json({ error: 'verificationPhotoData (selfie) is required for expert applications' });
    return;
  }
  if (verificationPhotoData != null && !validateImageDataUrl(verificationPhotoData, PHOTO_MAX_BYTES)) {
    res.status(400).json({ error: 'Invalid verificationPhotoData' });
    return;
  }

  try {
    const userId = req.userId;

    // ── Build verification photo storage fields ─────────────────────────────────
    // For new uploads: try R2. Fall back to base64 if R2 is not configured.
    // For company applications (no photo): all fields stay null.
    let photoFields: {
      verificationPhotoData: string | null;
      verificationPhotoStorageKey?: string;
      verificationPhotoStorageProvider?: string;
      verificationPhotoSizeBytes?: number;
    } = { verificationPhotoData: null };

    if (verificationPhotoData) {
      const comma = verificationPhotoData.indexOf(',');
      const semi  = verificationPhotoData.indexOf(';');
      const mimeType = verificationPhotoData.slice(5, semi); // strip 'data:'
      const fileBuffer = Buffer.from(verificationPhotoData.slice(comma + 1), 'base64');
      const ext = mimeToExt(mimeType);
      const storageKey = `trainer-verification-photos/${chatId}.${ext}`;

      try {
        await uploadObject(storageKey, fileBuffer, mimeType);
        photoFields = {
          verificationPhotoData: null,
          verificationPhotoStorageKey: storageKey,
          verificationPhotoStorageProvider: 'r2',
          verificationPhotoSizeBytes: fileBuffer.length,
        };
      } catch (r2Err) {
        if (r2Err instanceof StorageNotConfiguredError) {
          // R2 not configured — store legacy base64
          photoFields = { verificationPhotoData };
        } else {
          console.error('[expert/apply] R2 upload failed', r2Err);
          res.status(502).json({ error: 'Photo upload failed, please try again' });
          return;
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trainerProfile = await (prisma.trainerProfile.upsert as (args: any) => Promise<{
      verificationStatus: string; bio: string | null; specialization: string | null;
      referralCode: string | null; fullName: string | null; socialLink: string | null; appliedAt: Date | null;
    }>)({
      where: { chatId },
      create: {
        chatId,
        ...(userId ? { userId } : {}),
        verificationStatus: 'pending',
        fullName: fullName.trim(),
        socialLink: socialLink.trim(),
        ...photoFields,
        specialization: specialization?.trim() ?? null,
        bio: bio?.trim() ?? null,
        appliedAt: new Date(),
        rejectedAt: null,
      },
      update: {
        ...(userId ? { userId } : {}),
        verificationStatus: 'pending',
        fullName: fullName.trim(),
        socialLink: socialLink.trim(),
        ...photoFields,
        specialization: specialization?.trim() ?? null,
        bio: bio?.trim() ?? null,
        appliedAt: new Date(),
        rejectedAt: null,
      },
    });

    // Notify admin via Telegram bot
    const botToken = process.env.BOT_TOKEN ?? '';
    const adminChatId = process.env.ADMIN_CHAT_ID ?? '';
    if (!adminChatId) {
      console.warn('[expert/apply] ADMIN_CHAT_ID is not set — admin notification skipped.');
    }
    if (botToken && adminChatId) {
      const telegram = new Telegram(botToken);
      const user = req.telegramUser;
      const userName = user
        ? [user.first_name, user.last_name].filter(Boolean).join(' ') + (user.username ? ` (@${user.username})` : '')
        : `chatId: ${chatId}`;

      const card = [
        `<b>🎓 Новая заявка тренера</b>`,
        ``,
        `👤 Пользователь: ${escapeHtml(userName)}`,
        `🆔 Chat ID: <code>${chatId}</code>`,
        `📛 Имя: ${escapeHtml(fullName.trim())}`,
        `🔗 Соцсеть: ${escapeHtml(socialLink.trim())}`,
        verificationPhotoData ? `📸 Фото верификации: прикреплено (base64)` : `📸 Фото верификации: не прикреплено`,
        specialization?.trim() ? `🏷 Специализация: ${escapeHtml(specialization.trim())}` : null,
        bio?.trim() ? `📝 Bio: ${escapeHtml(bio.trim())}` : null,
        ``,
        `📅 Дата: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`,
      ].filter(line => line !== null).join('\n');

      await telegram.sendMessage(adminChatId, card, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Одобрить', callback_data: `trainer_approve_${chatId}` },
            { text: '❌ Отклонить', callback_data: `trainer_reject_${chatId}` },
          ]],
        },
      });
    }

    res.json({
      trainerProfile: {
        verificationStatus: trainerProfile.verificationStatus,
        bio: trainerProfile.bio,
        specialization: trainerProfile.specialization,
        referralCode: trainerProfile.referralCode,
        fullName: trainerProfile.fullName,
        socialLink: trainerProfile.socialLink,
        documentLink: null,
        appliedAt: trainerProfile.appliedAt,
      },
    });
  } catch (err) {
    console.error('[expert/apply]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
