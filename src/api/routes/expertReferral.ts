/**
 * Expert-acquisition referral routes.
 * Prefix: /api/expert-referral
 *
 * Available to verified experts and companies only (must have a TrainerProfile).
 */

import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';
import { buildExpertAcquisitionLink } from '../../utils/expertReferral';
import {
  getRecruitsForReferrer,
  getAcquisitionForExpert,
  computeStats,
  refreshQualification,
  PHASE1_RATE,
  PHASE2_RATE,
  QUALIFICATION_THRESHOLD,
  PHASE1_DAYS,
} from '../../services/expertAcquisitionService';

const router = Router();

// ─── GET /api/expert-referral/link — my expert-acquisition link ───────────────
// Returns the shareable deeplink for recruiting new experts.
// Accessible to any verified expert or company.
router.get('/link', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const tp = await prisma.trainerProfile.findFirst({
      where: { chatId, verificationStatus: 'verified' },
      select: { referralCode: true, specialization: true },
    });
    if (!tp) { res.status(403).json({ error: 'Verified expert profile required' }); return; }
    if (!tp.referralCode) { res.status(503).json({ error: 'Referral code not yet assigned' }); return; }

    const link = buildExpertAcquisitionLink(tp.referralCode);
    const referrerType: 'expert' | 'company' =
      tp.specialization === 'Компания' ? 'company' : 'expert';

    res.json({
      referralCode: tp.referralCode,
      link,
      referrerType,
      model: {
        phase1Days: PHASE1_DAYS,
        phase1Rate: PHASE1_RATE,
        phase2Rate: PHASE2_RATE,
        qualificationThreshold: QUALIFICATION_THRESHOLD,
        description: `Первый месяц (${PHASE1_DAYS} дней): ${PHASE1_RATE * 100}% от доходов. ` +
          `При привлечении более ${QUALIFICATION_THRESHOLD} клиентов в первый месяц — со второго месяца ${PHASE2_RATE * 100}% с новых клиентов.`,
      },
    });
  } catch (err) {
    console.error('[expert-referral/link]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/expert-referral/recruits — list all recruited experts ───────────
// Returns recruits with per-recruit phase stats.
router.get('/recruits', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const tp = await prisma.trainerProfile.findFirst({
      where: { chatId, verificationStatus: 'verified' },
      select: { chatId: true },
    });
    if (!tp) { res.status(403).json({ error: 'Verified expert profile required' }); return; }

    const recruits = await getRecruitsForReferrer(chatId, req.userId ?? null);

    // Compute stats for each recruit in parallel
    const statsResults = await Promise.allSettled(recruits.map(r => computeStats(r)));

    const result = recruits.map((r, i) => {
      const settled = statsResults[i];
      const stats = settled.status === 'fulfilled' ? settled.value : null;
      return {
        invitedExpertChatId: r.invitedExpertChatId,
        referrerType: r.referrerType,
        attributedAt: r.createdAt,
        phase1StartsAt: r.phase1StartsAt,
        phase1EndsAt: r.phase1EndsAt,
        isPhase1Complete: stats?.isPhase1Complete ?? new Date() >= r.phase1EndsAt,
        phase1ClientCount: stats?.phase1ClientCount ?? r.phase1ClientCount,
        isQualified: r.isQualified,
        qualifiedAt: r.qualifiedAt,
        phase2ClientCount: stats?.phase2ClientCount ?? 0,
        phase1EarningsRub: stats?.phase1EarningsRub ?? 0,
        phase2EarningsRub: stats?.phase2EarningsRub ?? 0,
        totalEarningsRub: stats?.totalEarningsRub ?? 0,
      };
    });

    res.json({
      recruits: result,
      totalRecruits: result.length,
      totalQualified: result.filter(r => r.isQualified).length,
      totalEarningsRub: result.reduce((s, r) => s + r.totalEarningsRub, 0),
    });
  } catch (err) {
    console.error('[expert-referral/recruits]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/expert-referral/my-acquisition — my own acquisition record ──────
// For an invited expert to see their own phase status and earnings model.
router.get('/my-acquisition', async (req: AuthRequest, res: Response) => {
  const chatId = req.chatId!;
  try {
    const acq = await getAcquisitionForExpert(chatId, req.userId ?? null);
    if (!acq) { res.json({ acquisition: null }); return; }

    const stats = await computeStats(acq);
    res.json({
      acquisition: {
        phase1StartsAt:   acq.phase1StartsAt,
        phase1EndsAt:     acq.phase1EndsAt,
        isPhase1Complete: stats.isPhase1Complete,
        phase1ClientCount: stats.phase1ClientCount,
        isQualified:      acq.isQualified,
        qualifiedAt:      acq.qualifiedAt,
        phase2ClientCount: stats.phase2ClientCount,
        phase1EarningsRub: stats.phase1EarningsRub,
        phase2EarningsRub: stats.phase2EarningsRub,
        totalEarningsRub:  stats.totalEarningsRub,
        currentRate:      acq.isQualified ? PHASE2_RATE : PHASE1_RATE,
      },
    });
  } catch (err) {
    console.error('[expert-referral/my-acquisition]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/expert-referral/refresh-qualification/:invitedChatId ──────────
// Trigger qualification recompute for a specific recruit. Admin-facing.
router.post('/refresh-qualification/:invitedChatId', async (req: AuthRequest, res: Response) => {
  const { invitedChatId } = req.params as { invitedChatId: string };
  const chatId = req.chatId!;
  try {
    // Only allow the referrer or the invited expert themselves
    const acq = await getAcquisitionForExpert(invitedChatId, null);
    if (!acq) { res.status(404).json({ error: 'No acquisition record found' }); return; }
    if (acq.referrerChatId !== chatId && acq.invitedExpertChatId !== chatId) {
      res.status(403).json({ error: 'Access denied' }); return;
    }

    const updated = await refreshQualification(acq.id);
    res.json({
      isQualified: updated.isQualified,
      phase1ClientCount: updated.phase1ClientCount,
      qualifiedAt: updated.qualifiedAt,
    });
  } catch (err) {
    console.error('[expert-referral/refresh-qualification]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
