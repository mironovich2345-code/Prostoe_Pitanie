import { Router } from 'express';
import { requireWebAuth, WebAuthRequest } from '../middleware/webAuth';
import prisma from '../../db';

const router = Router();
router.use(requireWebAuth as import('express').RequestHandler);

// Safe subset of product fields — no internal metadata, no isHidden
const SELECT_WEB = {
  id:              true,
  barcode:         true,
  name:            true,
  brand:           true,
  packageWeightG:  true,
  caloriesPer100g: true,
  proteinPer100g:  true,
  fatPer100g:      true,
  carbsPer100g:    true,
  confidence:      true,
  isVerified:      true,
} as const;

function looksLikeBarcode(s: string): boolean {
  return /^\d{6,}$/.test(s);
}

// GET /api/web/products/search?q=&limit=
router.get('/search', async (req: WebAuthRequest, res) => {
  const raw = req.query.q;
  const q   = (typeof raw === 'string' ? raw : '').trim();

  if (q.length < 2) {
    res.json({ items: [] });
    return;
  }

  const rawLimit = parseInt(String(req.query.limit ?? '10'), 10);
  const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 10, 20);

  try {
    const isBarcode = looksLikeBarcode(q);
    const pool = limit * 3;

    const where = {
      isHidden: false,
      OR: [
        { name:  { contains: q, mode: 'insensitive' as const } },
        { brand: { contains: q, mode: 'insensitive' as const } },
        ...(isBarcode ? [{ barcode: q }] : []),
      ],
    };

    const rows = await prisma.product.findMany({ where, select: SELECT_WEB, take: pool });

    const ql = q.toLowerCase();
    rows.sort((a, b) => {
      if (isBarcode) {
        const diff = (a.barcode === q ? 0 : 1) - (b.barcode === q ? 0 : 1);
        if (diff !== 0) return diff;
      }
      const nameScore = (a.name.toLowerCase().startsWith(ql) ? 0 : 1) -
                        (b.name.toLowerCase().startsWith(ql) ? 0 : 1);
      if (nameScore !== 0) return nameScore;
      return ((a.brand ?? '').toLowerCase().startsWith(ql) ? 0 : 1) -
             ((b.brand ?? '').toLowerCase().startsWith(ql) ? 0 : 1);
    });

    res.json({ items: rows.slice(0, limit) });
  } catch (err) {
    console.error('[web/products/search] failed', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

export default router;
