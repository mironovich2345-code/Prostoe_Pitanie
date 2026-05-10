/**
 * GET  /api/legal/consent-state   — check if user has accepted all required legal docs
 * POST /api/legal/accept-required — record user's acceptance of required legal docs
 */

import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

const router = Router();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const consentDb = (prisma as unknown as { userLegalConsent: any }).userLegalConsent as {
  findFirst(args: { where: object }): Promise<{ id: string } | null>;
  create(args: { data: object }): Promise<{ id: string }>;
};

// ─── GET /consent-state ───────────────────────────────────────────────────────

router.get('/consent-state', async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  if (!userId) { res.status(400).json({ error: 'userId not resolved' }); return; }

  const record = await consentDb.findFirst({
    where: {
      userId,
      acceptedTerms: true,
      acceptedPrivacy: true,
      acceptedPersonalData: true,
      acceptedMedicalDisclaimer: true,
    },
  });
  res.json({ accepted: record !== null });
});

// ─── POST /accept-required ────────────────────────────────────────────────────

router.post('/accept-required', async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  if (!userId) { res.status(400).json({ error: 'userId not resolved' }); return; }

  const {
    source,
    acceptedTerms,
    acceptedPrivacy,
    acceptedPersonalData,
    acceptedMedicalDisclaimer,
    platform,
  } = req.body as {
    source?: string;
    acceptedTerms?: boolean;
    acceptedPrivacy?: boolean;
    acceptedPersonalData?: boolean;
    acceptedMedicalDisclaimer?: boolean;
    platform?: string;
  };

  if (!acceptedTerms || !acceptedPrivacy || !acceptedPersonalData || !acceptedMedicalDisclaimer) {
    res.status(400).json({ error: 'ALL_REQUIRED_DOCS_MUST_BE_ACCEPTED' });
    return;
  }

  await consentDb.create({
    data: {
      userId,
      platform: platform ?? null,
      source: source ?? 'unknown',
      acceptedTerms: true,
      acceptedPrivacy: true,
      acceptedPersonalData: true,
      acceptedMedicalDisclaimer: true,
    },
  });

  console.info(`[legal/accept-required] userId=${userId} source=${source ?? 'unknown'}`);
  res.json({ ok: true });
});

export default router;
