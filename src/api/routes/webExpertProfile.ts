import express, { Response } from 'express';
import { requireWebAuth, WebAuthRequest } from '../middleware/webAuth';
import prisma from '../../db';

const router = express.Router();
router.use(requireWebAuth as express.RequestHandler);

// Fields returned to the expert for their own profile view/edit.
const PROFILE_SELECT = {
  id: true,
  fullName: true,
  specialization: true,
  bio: true,
  socialLink: true,
  city: true,
  experienceYears: true,
  suitableFor: true,
  tags: true,
  publicStatus: true,
  slug: true,
  referralCode: true,
  verificationStatus: true,
  verifiedAt: true,
} as const;

// Transliterate Cyrillic → Latin for URL-safe slugs.
const CYR: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',
  к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
  х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
};
function toSlug(name: string): string {
  return name.toLowerCase()
    .split('').map(c => CYR[c] ?? c).join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function generateUniqueSlug(name: string, profileId: number): Promise<string> {
  const base = toSlug(name) || `expert-${profileId}`;
  const taken = await prisma.trainerProfile.findUnique({ where: { slug: base }, select: { id: true } });
  if (!taken || taken.id === profileId) return base;
  // Suffix with profile id to guarantee uniqueness.
  return `${base}-${profileId}`;
}

async function findVerifiedProfile(userId: string) {
  const profile = await prisma.trainerProfile.findUnique({
    where: { userId },
    select: PROFILE_SELECT,
  });
  if (!profile || profile.verificationStatus !== 'verified') return null;
  return profile;
}

// GET /api/web/expert/profile
router.get('/profile', async (req: WebAuthRequest, res: Response) => {
  try {
    const profile = await findVerifiedProfile(req.webUser!.userId);
    if (!profile) {
      res.status(403).json({ error: 'not_expert' });
      return;
    }
    res.json({ profile });
  } catch (err) {
    console.error('[web/expert/profile] GET error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/web/expert/profile
router.patch('/profile', async (req: WebAuthRequest, res: Response) => {
  try {
    const profile = await findVerifiedProfile(req.webUser!.userId);
    if (!profile) {
      res.status(403).json({ error: 'not_expert' });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;

    // Validate and sanitize editable fields.
    const data: Record<string, unknown> = {};

    if ('fullName' in body) {
      const v = String(body.fullName ?? '').trim();
      if (v.length < 2 || v.length > 80) { res.status(400).json({ error: 'invalid_fullName' }); return; }
      data.fullName = v;
    }
    if ('specialization' in body) {
      const v = String(body.specialization ?? '').trim();
      if (v.length < 2 || v.length > 120) { res.status(400).json({ error: 'invalid_specialization' }); return; }
      data.specialization = v;
    }
    if ('bio' in body) {
      const v = String(body.bio ?? '').trim();
      if (v.length < 20 || v.length > 2000) { res.status(400).json({ error: 'invalid_bio' }); return; }
      data.bio = v;
    }
    if ('city' in body) {
      const v = String(body.city ?? '').trim();
      data.city = v.length > 0 ? v.substring(0, 80) : null;
    }
    if ('socialLink' in body) {
      const v = String(body.socialLink ?? '').trim();
      data.socialLink = v.length > 0 ? v.substring(0, 200) : null;
    }
    if ('experienceYears' in body) {
      const n = body.experienceYears === null || body.experienceYears === '' ? null : Number(body.experienceYears);
      if (n !== null && (isNaN(n) || n < 0 || n > 60)) { res.status(400).json({ error: 'invalid_experienceYears' }); return; }
      data.experienceYears = n;
    }
    if ('suitableFor' in body) {
      const v = String(body.suitableFor ?? '').trim();
      data.suitableFor = v.length > 0 ? v.substring(0, 500) : null;
    }
    if ('tags' in body) {
      const v = String(body.tags ?? '').trim();
      data.tags = v.length > 0 ? v.substring(0, 300) : null;
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'no_fields' });
      return;
    }

    const updated = await prisma.trainerProfile.update({
      where: { userId: req.webUser!.userId },
      data,
      select: PROFILE_SELECT,
    });

    res.json({ profile: updated });
  } catch (err) {
    console.error('[web/expert/profile] PATCH error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/web/expert/profile/publish
router.post('/profile/publish', async (req: WebAuthRequest, res: Response) => {
  try {
    const profile = await findVerifiedProfile(req.webUser!.userId);
    if (!profile) {
      res.status(403).json({ error: 'not_expert' });
      return;
    }

    const missing = [];
    if (!profile.fullName?.trim())       missing.push('fullName');
    if (!profile.specialization?.trim()) missing.push('specialization');
    if (!profile.bio?.trim())            missing.push('bio');
    if (missing.length > 0) {
      res.status(400).json({ error: 'incomplete_profile', missing });
      return;
    }

    // Generate slug on first publish if not already set.
    const slug = profile.slug ?? await generateUniqueSlug(profile.fullName ?? '', profile.id);

    const updated = await prisma.trainerProfile.update({
      where: { userId: req.webUser!.userId },
      data: { publicStatus: 'published', slug },
      select: { publicStatus: true, slug: true },
    });

    res.json({ ok: true, publicStatus: updated.publicStatus, slug: updated.slug });
  } catch (err) {
    console.error('[web/expert/profile] publish error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/web/expert/profile/hide
router.post('/profile/hide', async (req: WebAuthRequest, res: Response) => {
  try {
    const profile = await findVerifiedProfile(req.webUser!.userId);
    if (!profile) {
      res.status(403).json({ error: 'not_expert' });
      return;
    }

    await prisma.trainerProfile.update({
      where: { userId: req.webUser!.userId },
      data: { publicStatus: 'hidden' },
    });

    res.json({ ok: true, publicStatus: 'hidden' });
  } catch (err) {
    console.error('[web/expert/profile] hide error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
