import { Router, Response } from 'express';
import { Telegram } from 'telegraf';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';
import { validateImageDataUrl, PHOTO_MAX_BYTES } from '../utils/validateImage';

const router = Router();

// POST /api/expert/apply — submit trainer application
router.post('/apply', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  const { fullName, socialLink, verificationPhotoData, specialization, bio } = req.body as {
    fullName?: string;
    socialLink?: string;
    verificationPhotoData?: string;
    specialization?: string;
    bio?: string;
  };

  if (!fullName?.trim() || !socialLink?.trim()) {
    res.status(400).json({ error: 'fullName and socialLink are required' });
    return;
  }
  if (verificationPhotoData != null && !validateImageDataUrl(verificationPhotoData, PHOTO_MAX_BYTES)) {
    res.status(400).json({ error: 'Invalid verificationPhotoData' });
    return;
  }

  try {
    const trainerProfile = await prisma.trainerProfile.upsert({
      where: { chatId },
      create: {
        chatId,
        verificationStatus: 'pending',
        fullName: fullName.trim(),
        socialLink: socialLink.trim(),
        verificationPhotoData: verificationPhotoData ?? null,
        specialization: specialization?.trim() ?? null,
        bio: bio?.trim() ?? null,
        appliedAt: new Date(),
        rejectedAt: null,
      },
      update: {
        verificationStatus: 'pending',
        fullName: fullName.trim(),
        socialLink: socialLink.trim(),
        verificationPhotoData: verificationPhotoData ?? null,
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
        `👤 Пользователь: ${userName}`,
        `🆔 Chat ID: <code>${chatId}</code>`,
        `📛 Имя: ${fullName.trim()}`,
        `🔗 Соцсеть: ${socialLink.trim()}`,
        verificationPhotoData ? `📸 Фото верификации: прикреплено (base64)` : `📸 Фото верификации: не прикреплено`,
        specialization?.trim() ? `🏷 Специализация: ${specialization.trim()}` : null,
        bio?.trim() ? `📝 Bio: ${bio.trim()}` : null,
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
