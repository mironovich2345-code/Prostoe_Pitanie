import express, { Response } from 'express';
import { requireWebAuth, WebAuthRequest } from '../middleware/webAuth';
import prisma from '../../db';
import { calcNorms, calcAge, deriveGoal } from '../../utils/normsCalc';

const router = express.Router();

const VALID_GOAL_TYPES = new Set(['lose', 'maintain', 'gain', 'track']);

const SAFE_SELECT = {
  preferredName:     true,
  city:              true,
  heightCm:          true,
  currentWeightKg:   true,
  desiredWeightKg:   true,
  goalType:          true,
  dailyCaloriesKcal: true,
  dailyProteinG:     true,
  dailyFatG:         true,
  dailyCarbsG:       true,
} as const;

// PATCH /api/web/profile
// Updates safe profile fields for the authenticated web user.
// Never touches: chatId, referralCode, subscription, role, admin fields.
router.patch('/profile', requireWebAuth as express.RequestHandler, async (req: WebAuthRequest, res: Response) => {
  const { userId, chatId } = req.webUser!;
  const body = req.body as Record<string, unknown>;

  const data: Record<string, unknown> = {};

  if ('preferredName' in body) {
    if (body.preferredName !== null && typeof body.preferredName !== 'string') {
      res.status(400).json({ error: 'invalid_preferredName' }); return;
    }
    data.preferredName = typeof body.preferredName === 'string'
      ? body.preferredName.trim().slice(0, 100) || null
      : null;
  }

  if ('city' in body) {
    if (body.city !== null && typeof body.city !== 'string') {
      res.status(400).json({ error: 'invalid_city' }); return;
    }
    data.city = typeof body.city === 'string' ? body.city.trim().slice(0, 100) || null : null;
  }

  if ('heightCm' in body) {
    const v = Number(body.heightCm);
    if (isNaN(v) || v < 100 || v > 250) { res.status(400).json({ error: 'invalid_heightCm' }); return; }
    data.heightCm = v;
  }

  if ('currentWeightKg' in body) {
    const v = Number(body.currentWeightKg);
    if (isNaN(v) || v < 30 || v > 300) { res.status(400).json({ error: 'invalid_currentWeightKg' }); return; }
    data.currentWeightKg = v;
  }

  if ('desiredWeightKg' in body) {
    const v = Number(body.desiredWeightKg);
    if (isNaN(v) || v < 30 || v > 300) { res.status(400).json({ error: 'invalid_desiredWeightKg' }); return; }
    data.desiredWeightKg = v;
  }

  if ('goalType' in body) {
    if (!VALID_GOAL_TYPES.has(body.goalType as string)) {
      res.status(400).json({ error: 'invalid_goalType' }); return;
    }
    data.goalType = body.goalType as string;
  }

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: 'no_fields' }); return;
  }

  try {
    // userId-first lookup; synthetic chatId for web-only users (phone login)
    const syntheticChatId = chatId ?? `web_${userId}`;

    const existing = await prisma.userProfile.findFirst({
      where: { OR: [{ userId }, ...(chatId ? [{ chatId }] : [])] },
      select: { id: true },
    });

    let savedId: number;
    if (existing) {
      savedId = existing.id;
      await prisma.userProfile.update({
        where: { id: savedId },
        data: { userId, ...data },
      });
    } else {
      const created = await prisma.userProfile.create({
        data: { chatId: syntheticChatId, userId, ...data },
        select: { id: true },
      });
      savedId = created.id;
    }

    // Attempt inline КБЖУ recalculation when all required fields exist.
    // Requires: sex + birthDate + heightCm + currentWeightKg + activityLevel
    // (sex/birthDate/activityLevel are set via the bot; not editable here).
    const freshForCalc = await prisma.userProfile.findUnique({
      where: { id: savedId },
      select: {
        sex: true, birthDate: true,
        heightCm: true, currentWeightKg: true, activityLevel: true,
        desiredWeightKg: true, goalType: true,
      },
    });

    if (
      freshForCalc?.sex && freshForCalc?.birthDate &&
      freshForCalc?.heightCm && freshForCalc?.currentWeightKg && freshForCalc?.activityLevel
    ) {
      const rawGoal = freshForCalc.desiredWeightKg != null
        ? deriveGoal(freshForCalc.currentWeightKg!, freshForCalc.desiredWeightKg)
        : (freshForCalc.goalType === 'lose' ? 'cut' : freshForCalc.goalType === 'gain' ? 'bulk' : 'maintain');

      if (['cut', 'maintain', 'bulk'].includes(rawGoal)) {
        const age = calcAge(freshForCalc.birthDate!);
        if (age >= 10 && age <= 120) {
          const norms = calcNorms(
            freshForCalc.sex!, age,
            freshForCalc.heightCm!, freshForCalc.currentWeightKg!,
            freshForCalc.activityLevel!, rawGoal,
          );
          await prisma.userProfile.update({
            where: { id: savedId },
            data: {
              dailyCaloriesKcal: norms.calories,
              dailyProteinG: norms.proteinG,
              dailyFatG: norms.fatG,
              dailyCarbsG: norms.carbsG,
              dailyFiberG: 25,
            },
          });
        }
      }
    }

    // Return only the safe subset of fields
    const profile = await prisma.userProfile.findUnique({
      where: { id: savedId },
      select: SAFE_SELECT,
    });

    res.json({ ok: true, profile });
  } catch (err) {
    console.error('[web/profile] PATCH error:', (err as Error).message);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
