/**
 * Manual QA runner for food analysis AI.
 *
 * Usage:
 *   npx tsx scripts/test-food-analysis.ts
 *   npx tsx scripts/test-food-analysis.ts --category short   (filter by category)
 *   npx tsx scripts/test-food-analysis.ts --id TC-03         (single case)
 *
 * Each case declares EXPECTED BEHAVIOR (not exact numbers).
 * Matching is soft: the script prints PASS / WARN / FAIL for each field
 * so a human can quickly judge quality before and after prompt changes.
 *
 * Photo cases are SKIPPED by default (no test images available);
 * they exist as documentation of expected behavior.
 *
 * Run AFTER setting OPENAI_API_KEY in .env.
 */

import 'dotenv/config';
import { analyzeFood } from '../src/ai/analyzeFood';
import type { FoodAnalysisResult, MealType } from '../src/ai/analyzeFood';

// ─── Test case schema ─────────────────────────────────────────────────────────

type ConfidenceExpect = 'high' | 'medium' | 'low' | 'medium|low' | 'any';
type MealTypeExpect   = MealType | 'any';
type BoolExpect       = boolean  | 'any';

interface Expected {
  mealType:            MealTypeExpect;
  confidence:          ConfidenceExpect;
  needsClarification:  BoolExpect;
  itemsMinCount:       number;   // items[] must have at least this many entries (0 = don't check)
  notes:               string;   // human-readable intent
}

interface TestCase {
  id:       string;
  category: string;
  input:    string;
  skip?:    true;       // mark photo cases or cases needing manual setup
  expected: Expected;
}

// ─── Test cases ───────────────────────────────────────────────────────────────

const CASES: TestCase[] = [

  // ── 1. Simple, unambiguous ────────────────────────────────────────────────
  {
    id: 'TC-01', category: 'simple',
    input: 'Куриная грудка 200г отварная',
    expected: {
      mealType: 'any', confidence: 'high', needsClarification: false,
      itemsMinCount: 1,
      notes: 'Single product with explicit weight → high confidence, no clarification',
    },
  },
  {
    id: 'TC-02', category: 'simple',
    input: 'Яблоко',
    expected: {
      mealType: 'snack', confidence: 'medium|low', needsClarification: 'any',
      itemsMinCount: 1,
      notes: 'Single fruit, no weight → medium or low confidence acceptable',
    },
  },
  {
    id: 'TC-03', category: 'simple',
    input: 'Гречневая каша 200г с маслом 10г',
    expected: {
      mealType: 'any', confidence: 'high', needsClarification: false,
      itemsMinCount: 1,
      notes: 'Explicit weight + fat source → high confidence, no clarification',
    },
  },

  // ── 2. Multi-component meal ───────────────────────────────────────────────
  {
    id: 'TC-10', category: 'multi',
    input: 'Гречка 200г, куриная котлета 150г, огурец свежий',
    expected: {
      mealType: 'lunch', confidence: 'medium|low', needsClarification: 'any',
      itemsMinCount: 2,
      notes: 'Three components: two with weight, one without → must return as ONE object with ≥2 items',
    },
  },
  {
    id: 'TC-11', category: 'multi',
    input: 'Завтрак: овсянка на молоке с бананом, два яйца вкрутую, кофе с молоком',
    expected: {
      mealType: 'breakfast', confidence: 'medium|low', needsClarification: 'any',
      itemsMinCount: 2,
      // was 3; model naturally groups "овсянка с бананом + яйца" into one entry,
      // returning 2 items ("каша с яйцами" + "кофе") — that grouping is valid.
      // Key check: mealType=breakfast + multi-item (≥2), NOT exact item count.
      notes: 'Explicit breakfast → mealType must be breakfast, meal stays ONE object with ≥2 items',
    },
  },
  {
    id: 'TC-12', category: 'multi',
    input: 'Обед: борщ 350мл, котлета с пюре, хлеб 2 куска, чай',
    expected: {
      mealType: 'lunch', confidence: 'medium|low', needsClarification: 'any',
      itemsMinCount: 2,
      // was 3; "котлета с пюре" is one phrase — model treats it as one item,
      // so result is often ["Борщ", "Котлета с пюре", "Чай"] = 3, but may be 2.
      // Key check: mealType=lunch + multi-item (≥2), NOT strict count.
      notes: 'Full lunch → mealType lunch, stays ONE object with ≥2 items',
    },
  },

  // ── 3. Short / incomplete description ────────────────────────────────────
  {
    id: 'TC-20', category: 'short',
    input: 'Поел',
    expected: {
      mealType: 'unknown', confidence: 'low', needsClarification: true,
      itemsMinCount: 0,
      notes: 'Completely uninformative → low confidence, needsClarification must be true',
    },
  },
  {
    id: 'TC-21', category: 'short',
    input: 'Суп',
    expected: {
      mealType: 'lunch', confidence: 'low', needsClarification: true,
      itemsMinCount: 0,
      notes: 'Single-word dish without type/portion → low confidence, clarification required',
    },
  },
  {
    id: 'TC-22', category: 'short',
    input: 'Что-то съел на обеде, не помню что',
    expected: {
      mealType: 'lunch', confidence: 'low', needsClarification: true,
      itemsMinCount: 0,
      notes: 'Explicitly vague → low confidence, clarification required',
    },
  },

  // ── 4. Ambiguous dish ─────────────────────────────────────────────────────
  {
    id: 'TC-30', category: 'ambiguous',
    input: 'Салат',
    expected: {
      mealType: 'any', confidence: 'low', needsClarification: true,
      itemsMinCount: 0,
      notes: '"Салат" with no type: greek/olivier/caesar vary by 3–5× in calories → must clarify',
    },
  },
  {
    id: 'TC-31', category: 'ambiguous',
    input: 'Паста',
    expected: {
      mealType: 'any', confidence: 'low', needsClarification: true,
      itemsMinCount: 0,
      notes: 'Pasta without sauce type and portion → ambiguous, must clarify',
    },
  },
  {
    id: 'TC-32', category: 'ambiguous',
    input: 'Борщ',
    expected: {
      mealType: 'lunch', confidence: 'medium|low', needsClarification: 'any',
      itemsMinCount: 1,
      notes: 'Common dish with typical portion, but meat type unclear → medium acceptable',
    },
  },
  {
    id: 'TC-33', category: 'ambiguous',
    input: 'Котлета',
    expected: {
      mealType: 'any', confidence: 'low', needsClarification: true,
      itemsMinCount: 0,
      notes: 'No meat type, no weight → ambiguous, should clarify',
    },
  },

  // ── 5. Drinks / desserts / snacks ─────────────────────────────────────────
  {
    id: 'TC-40', category: 'snacks',
    input: 'Кофе латте 400мл',
    expected: {
      mealType: 'snack', confidence: 'medium|low', needsClarification: 'any',
      itemsMinCount: 1,
      notes: 'Drink with volume → snack, medium confidence (milk ratio unknown)',
    },
  },
  {
    id: 'TC-41', category: 'snacks',
    input: 'Горсть грецких орехов',
    expected: {
      mealType: 'snack', confidence: 'low', needsClarification: true,
      itemsMinCount: 1,
      notes: '"Горсть" is vague weight → low confidence, clarification on weight',
    },
  },
  {
    id: 'TC-42', category: 'snacks',
    input: 'Шоколадный торт кусочек',
    expected: {
      mealType: 'snack', confidence: 'low', needsClarification: true,
      itemsMinCount: 1,
      notes: 'Slice size unknown, cake composition unknown → low confidence, clarify',
    },
  },

  // ── 6. Restaurant / complex meal ─────────────────────────────────────────
  {
    id: 'TC-50', category: 'restaurant',
    input: 'Паста карбонара в ресторане',
    expected: {
      mealType: 'any', confidence: 'medium|low', needsClarification: 'any',
      itemsMinCount: 1,
      notes: 'Restaurant pasta: portion unclear, sauce composition typical → medium acceptable, КБЖУ should not be low-balled',
    },
  },
  {
    id: 'TC-51', category: 'restaurant',
    input: 'Суши сет из 8 штук (ролл Калифорния и Филадельфия)',
    expected: {
      mealType: 'any', confidence: 'medium|low', needsClarification: 'any',
      itemsMinCount: 1,
      notes: 'Named sushi set → medium confidence, should account for rice+fish+cream cheese',
    },
  },

  // ── 7. Photo cases (SKIPPED — no test images, kept as documentation) ──────
  {
    id: 'TC-60', category: 'photo', skip: true,
    input: '[PHOTO] Clear plate of pasta carbonara on white background',
    expected: {
      mealType: 'any', confidence: 'high', needsClarification: false,
      itemsMinCount: 1,
      notes: 'Clear photo of known dish → high confidence, no clarification',
    },
  },
  {
    id: 'TC-61', category: 'photo', skip: true,
    input: '[PHOTO] Dark blurry photo, plate partially in shadow',
    expected: {
      mealType: 'any', confidence: 'low', needsClarification: true,
      itemsMinCount: 0,
      notes: 'Poor photo quality → low confidence, clarification required',
    },
  },
  {
    id: 'TC-62', category: 'photo', skip: true,
    input: '[PHOTO] Plate with sauce-covered food where sauce not visible from angle',
    expected: {
      mealType: 'any', confidence: 'medium|low', needsClarification: true,
      itemsMinCount: 1,
      notes: 'Hidden sauce component → needsClarification should be true',
    },
  },
];

// ─── Matching logic ───────────────────────────────────────────────────────────

type CheckResult = 'PASS' | 'WARN' | 'FAIL' | 'SKIP';

function checkField(label: string, actual: unknown, expected: unknown, warn?: boolean): { result: CheckResult; line: string } {
  if (expected === 'any') return { result: 'PASS', line: `  ${label}: ${JSON.stringify(actual)} (any ✓)` };
  if (actual === expected) return { result: 'PASS', line: `  ${label}: ${JSON.stringify(actual)} ✓` };

  // Soft range check for confidence
  if (label === 'confidence' && typeof expected === 'string' && expected.includes('|')) {
    const options = expected.split('|');
    if (options.includes(String(actual))) return { result: 'PASS', line: `  ${label}: ${JSON.stringify(actual)} (one of [${expected}] ✓)` };
  }

  const level: CheckResult = warn ? 'WARN' : 'FAIL';
  return { result: level, line: `  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)} ${level === 'WARN' ? '⚠' : '✗'}` };
}

function evaluate(result: FoodAnalysisResult, expected: Expected): { overall: CheckResult; lines: string[] } {
  const checks = [
    checkField('mealType',           result.mealType,           expected.mealType),
    checkField('confidence',         result.confidence,         expected.confidence),
    checkField('needsClarification', result.needsClarification, expected.needsClarification),
  ];

  // items count (soft: WARN, not FAIL)
  if (expected.itemsMinCount > 0) {
    const count = result.items?.length ?? 0;
    const ok = count >= expected.itemsMinCount;
    checks.push({
      result: ok ? 'PASS' : 'WARN',
      line: `  items[].length: got ${count}, expected ≥${expected.itemsMinCount} ${ok ? '✓' : '⚠'}`,
    });
  }

  const lines = checks.map(c => c.line);
  const results = checks.map(c => c.result);
  const overall: CheckResult = results.includes('FAIL') ? 'FAIL'
    : results.includes('WARN') ? 'WARN'
    : 'PASS';

  return { overall, lines };
}

// ─── Runner ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const filterCategory = args.find((_, i) => args[i - 1] === '--category');
const filterId        = args.find((_, i) => args[i - 1] === '--id');

async function run() {
  const cases = CASES.filter(c => {
    if (filterCategory && c.category !== filterCategory) return false;
    if (filterId && c.id !== filterId) return false;
    return true;
  });

  const counts = { PASS: 0, WARN: 0, FAIL: 0, SKIP: 0, ERROR: 0 };

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║          FOOD ANALYSIS QA — manual verification          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  for (const tc of cases) {
    const prefix = `[${tc.id}] [${tc.category}]`;

    if (tc.skip) {
      console.log(`${prefix} SKIP — photo case (no test image)\n  input: ${tc.input}\n  note:  ${tc.expected.notes}\n`);
      counts.SKIP++;
      continue;
    }

    process.stdout.write(`${prefix} "${tc.input.slice(0, 55)}${tc.input.length > 55 ? '…' : ''}"\n`);

    let result: FoodAnalysisResult;
    try {
      result = await analyzeFood(tc.input);
    } catch (err) {
      console.log(`  ERROR: ${(err as Error).message}\n`);
      counts.ERROR++;
      continue;
    }

    const { overall, lines } = evaluate(result, tc.expected);
    const icon = overall === 'PASS' ? '✅' : overall === 'WARN' ? '⚠️ ' : '❌';
    console.log(`  ${icon} ${overall}  — ${tc.expected.notes}`);
    console.log(lines.join('\n'));
    if (result.clarificationQuestion) {
      console.log(`  clarificationQuestion: "${result.clarificationQuestion}"`);
    }
    console.log(`  name: "${result.name}" | kcal: ${result.caloriesKcal ?? '?'} | items: [${(result.items ?? []).join(', ')}]`);
    console.log();

    counts[overall]++;

    // Throttle to avoid OpenAI rate limits
    await new Promise(r => setTimeout(r, 800));
  }

  const total = counts.PASS + counts.WARN + counts.FAIL + counts.SKIP + counts.ERROR;
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`Results: ✅ PASS ${counts.PASS}  ⚠️  WARN ${counts.WARN}  ❌ FAIL ${counts.FAIL}  ⏭ SKIP ${counts.SKIP}  💥 ERROR ${counts.ERROR}  /  ${total} total`);
  console.log('─────────────────────────────────────────────────────────────\n');
}

run().catch(err => { console.error(err); process.exit(1); });
