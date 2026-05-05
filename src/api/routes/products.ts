import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';

const router = Router();

// Fields returned to the client — no createdAt/updatedAt/isHidden/internals
const SELECT_FIELDS = {
  id: true,
  barcode: true,
  name: true,
  brand: true,
  packageWeightG: true,
  caloriesPer100g: true,
  proteinPer100g: true,
  fatPer100g: true,
  carbsPer100g: true,
  confidence: true,
  isHighSugar: true,
  source: true,
  isVerified: true,
} as const;

function looksLikeBarcode(s: string): boolean {
  return /^\d{6,}$/.test(s);
}

async function logLookup(params: {
  userId: string | undefined;
  barcode: string | null;
  query: string | null;
  found: boolean;
  source: string;
}): Promise<void> {
  try {
    await prisma.productLookupLog.create({
      data: {
        userId: params.userId ?? null,
        barcode: params.barcode,
        query: params.query,
        found: params.found,
        source: params.source,
      },
    });
  } catch {
    // fail-open: never let logging break the API
  }
}

// ── GET /api/products/search?q=&limit= ───────────────────────────────

router.get('/search', async (req: AuthRequest, res: Response) => {
  const raw = req.query.q;
  const q = (typeof raw === 'string' ? raw : '').trim();

  if (q.length < 2) {
    res.json({ items: [] });
    return;
  }

  const rawLimit = parseInt(String(req.query.limit ?? '20'), 10);
  const limit = Math.min(isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 20, 50);

  try {
    const isBarcode = looksLikeBarcode(q);

    // Fetch a wider pool so JS-side re-ranking can surface the best matches within `limit`
    const pool = limit * 3;

    const where = {
      isHidden: false,
      OR: [
        { name: { contains: q, mode: 'insensitive' as const } },
        { brand: { contains: q, mode: 'insensitive' as const } },
        ...(isBarcode ? [{ barcode: q }] : []),
      ],
    };

    const rows = await prisma.product.findMany({
      where,
      select: SELECT_FIELDS,
      take: pool,
    });

    const ql = q.toLowerCase();

    // Sort: exact barcode > name starts-with > brand starts-with > rest
    rows.sort((a, b) => {
      const aBarcode = isBarcode && a.barcode === q ? 0 : 1;
      const bBarcode = isBarcode && b.barcode === q ? 0 : 1;
      if (aBarcode !== bBarcode) return aBarcode - bBarcode;

      const aNameStarts = a.name.toLowerCase().startsWith(ql) ? 0 : 1;
      const bNameStarts = b.name.toLowerCase().startsWith(ql) ? 0 : 1;
      if (aNameStarts !== bNameStarts) return aNameStarts - bNameStarts;

      const aBrandStarts = (a.brand ?? '').toLowerCase().startsWith(ql) ? 0 : 1;
      const bBrandStarts = (b.brand ?? '').toLowerCase().startsWith(ql) ? 0 : 1;
      return aBrandStarts - bBrandStarts;
    });

    const items = rows.slice(0, limit);

    // Log only when userId is available (anonymous requests skipped)
    if (req.userId) {
      void logLookup({ userId: req.userId, barcode: null, query: q, found: items.length > 0, source: 'local' });
    }

    res.json({ items });
  } catch (err) {
    console.error('[products/search]', err);
    res.status(500).json({ error: 'Ошибка поиска продуктов' });
  }
});

// ── GET /api/products/barcode/:barcode ───────────────────────────────

router.get('/barcode/:barcode', async (req: AuthRequest, res: Response) => {
  const normalised = String(req.params.barcode ?? '').replace(/\D/g, '').trim();

  if (!normalised) {
    res.status(400).json({ error: 'Barcode must contain at least one digit' });
    return;
  }

  try {
    const product = await prisma.product.findUnique({
      where: { barcode: normalised },
      select: { ...SELECT_FIELDS, isHidden: true },
    });

    const found = !!product && !product.isHidden;

    void logLookup({ userId: req.userId, barcode: normalised, query: null, found, source: 'local' });

    if (!found) {
      res.json({ found: false, product: null });
      return;
    }

    // Strip isHidden before sending (was only fetched for the hidden check)
    const { isHidden: _hidden, ...safeProduct } = product;
    res.json({ found: true, product: safeProduct });
  } catch (err) {
    console.error('[products/barcode]', err);
    res.status(500).json({ error: 'Ошибка поиска продукта' });
  }
});

export default router;
