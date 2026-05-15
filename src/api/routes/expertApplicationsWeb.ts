import express from 'express';
import { requireWebAuth } from '../middleware/webAuth';
import type { WebAuthRequest } from '../middleware/webAuth';
import prisma from '../../db';

const router = express.Router();

type Status = 'pending' | 'in_review' | 'approved' | 'rejected';

const ACTIVE_STATUSES: Status[] = ['pending', 'in_review', 'approved'];

function trim(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 && t.length <= max ? t : undefined;
}

function safePublic(app: {
  id: string;
  status: string;
  fullName: string;
  specialization: string;
  city: string | null;
  workFormat: string | null;
  experienceYears: number | null;
  socialLink: string | null;
  bio: string;
  proofLink: string | null;
  adminComment: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: app.id,
    status: app.status,
    fullName: app.fullName,
    specialization: app.specialization,
    city: app.city,
    workFormat: app.workFormat,
    experienceYears: app.experienceYears,
    socialLink: app.socialLink,
    bio: app.bio,
    proofLink: app.proofLink,
    adminComment: app.status === 'rejected' ? app.adminComment : null,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  };
}

// GET /api/expert-applications/me
router.get(
  '/me',
  requireWebAuth as express.RequestHandler,
  async (req, res) => {
    const { userId } = (req as WebAuthRequest).webUser!;
    try {
      const app = await prisma.expertApplication.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ application: app ? safePublic(app) : null });
    } catch (err) {
      console.error('[expert-app] GET /me:', (err as Error).message);
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  },
);

// POST /api/expert-applications
router.post(
  '/',
  requireWebAuth as express.RequestHandler,
  async (req, res) => {
    const { userId } = (req as WebAuthRequest).webUser!;
    try {
      // Validate required fields
      const fullName = trim(req.body.fullName, 80);
      const specialization = trim(req.body.specialization, 120);
      const bio = trim(req.body.bio, 1000);

      if (!fullName || fullName.length < 2) {
        res.status(400).json({ error: 'VALIDATION_ERROR', field: 'fullName', message: 'Имя обязательно (2–80 символов)' });
        return;
      }
      if (!specialization || specialization.length < 2) {
        res.status(400).json({ error: 'VALIDATION_ERROR', field: 'specialization', message: 'Специализация обязательна (2–120 символов)' });
        return;
      }
      if (!bio || bio.length < 20) {
        res.status(400).json({ error: 'VALIDATION_ERROR', field: 'bio', message: 'О себе: минимум 20 символов' });
        return;
      }

      const city = trim(req.body.city, 80) ?? null;
      const workFormat = trim(req.body.workFormat, 80) ?? null;
      const rawYears = req.body.experienceYears;
      const experienceYears =
        typeof rawYears === 'number' && rawYears >= 0 && rawYears <= 60
          ? rawYears
          : typeof rawYears === 'string' && rawYears.trim() !== ''
          ? (() => { const n = parseInt(rawYears, 10); return !isNaN(n) && n >= 0 && n <= 60 ? n : null; })()
          : null;
      const socialLink = trim(req.body.socialLink, 200) ?? null;
      const proofLink = trim(req.body.proofLink, 300) ?? null;

      // Check for existing active application
      const existing = await prisma.expertApplication.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        if ((ACTIVE_STATUSES as string[]).includes(existing.status) && existing.status !== 'pending') {
          // in_review or approved — cannot resubmit
          res.status(409).json({ error: 'APPLICATION_EXISTS', status: existing.status });
          return;
        }
        if (existing.status === 'pending') {
          // Update the pending application instead of creating a new one
          const updated = await prisma.expertApplication.update({
            where: { id: existing.id },
            data: { fullName, specialization, city, workFormat, experienceYears, socialLink, bio, proofLink },
          });
          res.json({ application: safePublic(updated) });
          return;
        }
        // rejected → allow re-application (fall through to create)
      }

      const created = await prisma.expertApplication.create({
        data: {
          userId,
          status: 'pending',
          fullName: fullName!,
          specialization: specialization!,
          city,
          workFormat,
          experienceYears,
          socialLink,
          bio: bio!,
          proofLink,
          source: 'web',
        },
      });

      res.status(201).json({ application: safePublic(created) });
    } catch (err) {
      console.error('[expert-app] POST /:', (err as Error).message);
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  },
);

export default router;
