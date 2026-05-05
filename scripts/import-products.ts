/**
 * Import products from Excel into the Product table.
 *
 * Sheet: "Продукты"
 * Columns: №, Название, Бренд, Штрихкод, Вес (г), Ккал/100г, Белки (г), Жиры (г), Углеводы (г), Уверенность, Высокий сахар
 *
 * Upsert strategy:
 *   - barcode present → upsert by barcode
 *   - barcode absent  → find by (name + brand), update or create
 *
 * Safe to run multiple times (idempotent).
 *
 * Usage:
 *   npm run import:products
 *   npx tsx scripts/import-products.ts
 */

import * as path from 'path';
import * as XLSX from 'xlsx';
import prisma from '../src/db';

const FILE_PATH = path.resolve(__dirname, 'data', 'products_updated.xlsx');
const SHEET_NAME = 'Продукты';

// ── Helpers ──────────────────────────────────────────────────────────

function toStr(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return isFinite(n) ? n : null;
}

function normaliseBarcode(v: unknown): string | null {
  const s = toStr(v).replace(/\s/g, '').replace(/\D/g, '');
  return s.length > 0 ? s : null;
}

function normaliseConfidence(v: unknown): string {
  const s = toStr(v).toLowerCase();
  if (['высокая', 'высокий', 'high'].includes(s)) return 'high';
  if (['средняя', 'средний', 'medium'].includes(s)) return 'medium';
  if (['низкая', 'низкий', 'low'].includes(s)) return 'low';
  return 'medium';
}

function normaliseIsHighSugar(v: unknown): boolean {
  const s = toStr(v).toLowerCase();
  return ['да', 'yes', 'true', '1'].includes(s);
}

// ── Row type ─────────────────────────────────────────────────────────

interface ProductRow {
  name: string;
  brand: string | null;
  barcode: string | null;
  packageWeightG: number | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  confidence: string;
  isHighSugar: boolean;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const wb = XLSX.readFile(FILE_PATH);
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) {
    console.error(`Sheet "${SHEET_NAME}" not found. Available: ${wb.SheetNames.join(', ')}`);
    process.exit(1);
  }

  // Convert to array-of-arrays (raw values, no header inference)
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Skip header row (index 0)
  const dataRows = rows.slice(1);

  let read = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const errorLines: string[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const lineNum = i + 2; // 1-based, +1 for header

    // Skip fully empty rows
    if (!row || row.every(c => c == null || c === '')) {
      skipped++;
      continue;
    }

    // Column mapping (0-based): №, Название, Бренд, Штрихкод, Вес(г), Ккал/100г, Белки(г), Жиры(г), Углеводы(г), Уверенность, Высокий сахар
    const [, rawName, rawBrand, rawBarcode, rawWeight, rawKcal, rawProtein, rawFat, rawCarbs, rawConfidence, rawHighSugar] = row;

    const name = toStr(rawName);
    if (!name) {
      skipped++;
      continue;
    }

    const brand = toStr(rawBrand) || null;
    const barcode = normaliseBarcode(rawBarcode);
    const packageWeightG = toNum(rawWeight);
    const caloriesPer100g = toNum(rawKcal);
    const proteinPer100g = toNum(rawProtein);
    const fatPer100g = toNum(rawFat);
    const carbsPer100g = toNum(rawCarbs);
    const confidence = normaliseConfidence(rawConfidence);
    const isHighSugar = normaliseIsHighSugar(rawHighSugar);

    // Required numeric fields
    if (caloriesPer100g == null || proteinPer100g == null || fatPer100g == null || carbsPer100g == null) {
      errors++;
      errorLines.push(`Row ${lineNum} ("${name}"): missing required numeric field (kcal/protein/fat/carbs)`);
      continue;
    }

    read++;

    const productData: ProductRow = {
      name,
      brand,
      barcode,
      packageWeightG,
      caloriesPer100g,
      proteinPer100g,
      fatPer100g,
      carbsPer100g,
      confidence,
      isHighSugar,
    };

    const commonFields = {
      name: productData.name,
      brand: productData.brand,
      packageWeightG: productData.packageWeightG,
      caloriesPer100g: productData.caloriesPer100g,
      proteinPer100g: productData.proteinPer100g,
      fatPer100g: productData.fatPer100g,
      carbsPer100g: productData.carbsPer100g,
      confidence: productData.confidence,
      isHighSugar: productData.isHighSugar,
      source: 'seed',
      isVerified: true,
      isHidden: false,
    };

    try {
      if (barcode) {
        // Upsert by barcode
        const existing = await prisma.product.findUnique({ where: { barcode } });
        if (existing) {
          await prisma.product.update({ where: { barcode }, data: commonFields });
          updated++;
        } else {
          await prisma.product.create({ data: { ...commonFields, barcode } });
          created++;
        }
      } else {
        // Upsert by name + brand (null-safe)
        const existing = await prisma.product.findFirst({
          where: {
            name: productData.name,
            brand: productData.brand ?? null,
            barcode: null,
          },
        });
        if (existing) {
          await prisma.product.update({ where: { id: existing.id }, data: commonFields });
          updated++;
        } else {
          await prisma.product.create({ data: { ...commonFields, barcode: null } });
          created++;
        }
      }
    } catch (err: unknown) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      errorLines.push(`Row ${lineNum} ("${name}"): ${msg}`);
    }
  }

  console.log('\nProducts import finished:');
  console.log(`Rows read:  ${read}`);
  console.log(`Created:    ${created}`);
  console.log(`Updated:    ${updated}`);
  console.log(`Skipped:    ${skipped}`);
  console.log(`Errors:     ${errors}`);
  if (errorLines.length > 0) {
    console.log('\nError details:');
    errorLines.forEach(l => console.log(' ', l));
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
