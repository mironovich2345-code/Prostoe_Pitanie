import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/telegramAuth';
import prisma from '../../db';
import { uploadObject, mimeToExt, StorageNotConfiguredError } from '../../storage/r2';

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

// ── POST /api/products/submit ─────────────────────────────────────────────────

router.post('/submit', async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const {
    barcode: rawBarcode,
    name,
    brand,
    packageWeightG,
    caloriesPer100g,
    proteinPer100g,
    fatPer100g,
    carbsPer100g,
    isHighSugar = false,
    imageData,
  } = req.body as {
    barcode?: unknown;
    name?: unknown;
    brand?: unknown;
    packageWeightG?: unknown;
    caloriesPer100g?: unknown;
    proteinPer100g?: unknown;
    fatPer100g?: unknown;
    carbsPer100g?: unknown;
    isHighSugar?: unknown;
    imageData?: unknown;
  };

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const cal  = Number(caloriesPer100g);
  const pro  = Number(proteinPer100g);
  const fat  = Number(fatPer100g);
  const carb = Number(carbsPer100g);

  if (!isFinite(cal)  || cal  < 0 || cal  > 1000) { res.status(400).json({ error: 'caloriesPer100g must be 0–1000' }); return; }
  if (!isFinite(pro)  || pro  < 0 || pro  > 100)  { res.status(400).json({ error: 'proteinPer100g must be 0–100' });  return; }
  if (!isFinite(fat)  || fat  < 0 || fat  > 100)  { res.status(400).json({ error: 'fatPer100g must be 0–100' });      return; }
  if (!isFinite(carb) || carb < 0 || carb > 100)  { res.status(400).json({ error: 'carbsPer100g must be 0–100' });   return; }

  const pkgG = packageWeightG != null ? Number(packageWeightG) : null;
  if (pkgG !== null && (!isFinite(pkgG) || pkgG <= 0 || pkgG > 10000)) {
    res.status(400).json({ error: 'packageWeightG must be 1–10000' });
    return;
  }

  const barcode = rawBarcode
    ? String(rawBarcode).replace(/\D/g, '').trim() || null
    : null;

  try {
    // Reject if barcode already in verified product catalog
    if (barcode) {
      const existing = await (prisma.product as any).findUnique({
        where: { barcode },
        select: { id: true },
      });
      if (existing) {
        res.status(409).json({ error: 'PRODUCT_ALREADY_EXISTS', message: 'Этот продукт уже есть в базе' });
        return;
      }
    }

    // Dedup: pending submission from same user + same barcode
    if (barcode) {
      const dup = await (prisma.productSubmission as any).findFirst({
        where: { userId, barcode, status: 'pending' },
        select: { id: true, status: true, name: true, barcode: true },
      });
      if (dup) {
        res.json({ ok: true, submission: dup });
        return;
      }
    }

    // Handle photo upload (R2 preferred, base64 fallback)
    let photoData: string | null = null;
    let photoStorageKey: string | null = null;
    let photoStorageProvider: string | null = null;

    if (imageData && typeof imageData === 'string') {
      const mimeMatch = imageData.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const base64 = imageData.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');

      if (buffer.length <= 5 * 1024 * 1024) {
        try {
          const ext = mimeToExt(mimeType);
          const key = `product-submissions/${userId}/${Date.now()}.${ext}`;
          await uploadObject(key, buffer, mimeType);
          photoStorageKey = key;
          photoStorageProvider = 'r2';
        } catch (r2Err) {
          if (!(r2Err instanceof StorageNotConfiguredError)) {
            console.error('[products/submit] R2 upload failed', r2Err);
          }
          // R2 unavailable → store base64 in DB
          photoData = imageData;
        }
      }
    }

    const submission = await (prisma.productSubmission as any).create({
      data: {
        userId,
        barcode,
        name: (name as string).trim(),
        brand: brand && typeof brand === 'string' ? brand.trim() || null : null,
        packageWeightG: pkgG,
        caloriesPer100g: cal,
        proteinPer100g: pro,
        fatPer100g: fat,
        carbsPer100g: carb,
        isHighSugar: !!isHighSugar,
        photoData,
        photoStorageKey,
        photoStorageProvider,
        status: 'pending',
        source: 'user',
      },
      select: { id: true, status: true, name: true, barcode: true },
    });

    res.json({ ok: true, submission });
  } catch (err) {
    console.error('[products/submit]', err);
    res.status(500).json({ error: 'Ошибка при отправке заявки' });
  }
});

export default router;
