import express, { Request, Response } from 'express';
import prisma from '../../db';

const router = express.Router();

// Public fields exposed in the catalog — never include chatId, userId, or internal fields.
const PUBLIC_SELECT = {
  slug: true,
  fullName: true,
  specialization: true,
  city: true,
  experienceYears: true,
  bio: true,
  suitableFor: true,
  tags: true,
  socialLink: true,
} as const;

// GET /api/public/trainers
// Returns all verified + published experts that have a slug.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const trainers = await prisma.trainerProfile.findMany({
      where: {
        verificationStatus: 'verified',
        publicStatus: 'published',
        slug: { not: null },
      },
      select: PUBLIC_SELECT,
      orderBy: { verifiedAt: 'desc' },
    });
    res.json({ trainers });
  } catch (err) {
    console.error('[public/trainers] list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/public/trainers/:slug
// Returns one expert's public card. 404 if not found, not verified, or not published.
router.get('/:slug', async (req: Request, res: Response) => {
  const slug = String(req.params.slug ?? '');
  try {
    const trainer = await prisma.trainerProfile.findUnique({
      where: { slug },
      select: { ...PUBLIC_SELECT, verificationStatus: true, publicStatus: true },
    });
    if (
      !trainer ||
      trainer.verificationStatus !== 'verified' ||
      trainer.publicStatus !== 'published'
    ) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    // Strip internal visibility fields before sending.
    const { verificationStatus: _v, publicStatus: _p, ...safe } = trainer;
    res.json({ trainer: safe });
  } catch (err) {
    console.error('[public/trainers] detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
