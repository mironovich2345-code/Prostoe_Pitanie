import OpenAI from 'openai';
import { AiCostContext, logAiCost } from './aiCost';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY не задан в .env');
    client = new OpenAI({ apiKey });
  }
  return client;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'unknown';

export interface FoodAnalysisResult {
  name: string;
  mealType: MealType;
  items?: string[];            // list of main dishes/products in this meal (e.g. ["Гречка", "Котлета"])
  composition?: string;
  caloriesKcal?: number | null;
  proteinG?: number | null;
  fatG?: number | null;
  carbsG?: number | null;
  fiberG?: number | null;
  weightG?: number | null;
  ingredients?: string[];      // detailed component breakdown with weights
  confidence?: 'high' | 'medium' | 'low';
  needsClarification?: boolean;
  clarificationQuestion?: string | null;
  /** Image classification: food photo vs nutrition label / screenshot */
  imageType?: 'food_photo' | 'nutrition_screenshot' | 'product_label';
  /** What the extracted macros are based on (for labels/screenshots) */
  nutritionPer?: '100g' | 'portion' | 'package' | null;
  /** Total package weight in grams, if visible on label */
  packageWeightG?: number | null;
  /** Single serving size in grams, if visible on label */
  servingSizeG?: number | null;
}

// ─── Text analysis prompt ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `Ты — диетолог и нутрициолог. Пользователь описывает приём пищи на русском языке.

ГЛАВНОЕ ПРАВИЛО: Весь описанный приём пищи — ОДНА запись в дневнике питания.
Даже если пользователь перечислил несколько блюд или продуктов — это один приём пищи, не разделяй его.

Анализируй строго в следующем порядке:

ШАГ 0. Определи тип приёма пищи (mealType):
- "breakfast": завтрак / утренний приём / каша, яйца, кофе без обеденного контекста
- "lunch": обед / дневной приём / первое + второе, плотная еда в середине дня
- "dinner": ужин / вечерний приём
- "snack": перекус / небольшая порция / фрукт, орехи, кофе с бутербродом
- "unknown": если время и контекст не позволяют определить

ШАГ 1. Перечисли все отдельные блюда/продукты этого приёма (items[]).
items — это главные компоненты на уровне блюд, не ингредиенты. Например:
["Борщ", "Хлеб с маслом", "Компот"] — правильно.
["говядина", "картошка", "свёкла"] — неправильно (это ингредиенты, не блюда).

ШАГ 2. Для каждого блюда/продукта определи его ингредиенты и вес (ingredients[]).
Особое внимание на калорийно-плотные компоненты: соусы, сыр, масло, жареные элементы, мясо с жиром.

ШАГ 3. Посчитай КБЖУ суммированием по всем ингредиентам всего приёма пищи целиком.
НЕ считай по названию блюда — считай по ингредиентам.

Верни ТОЛЬКО валидный JSON (без markdown, без пояснений):
{
  "mealType": "breakfast" | "lunch" | "dinner" | "snack" | "unknown",
  "name": "короткое название приёма пищи на русском",
  "items": ["Блюдо 1", "Блюдо 2"],
  "ingredients": ["ингредиент 1 ~XXг", "ингредиент 2 ~XXг"],
  "composition": "краткое перечисление составляющих",
  "confidence": "high" | "medium" | "low",
  "needsClarification": false,
  "clarificationQuestion": null,
  "caloriesKcal": число,
  "proteinG": число,
  "fatG": число,
  "carbsG": число,
  "fiberG": число или null,
  "weightG": число или null
}

Правила:
- Один приём пищи = один JSON-объект. Никогда не дроби на несколько.
- Считай КБЖУ суммированием по каждому ингредиенту — не по общему названию.
- Не занижай жиры: масло, соус, сыр, мясной жир добавляют значительно.
- Не выдумывай ингредиенты при неопределённости — уменьши confidence вместо фантазии.
- name на русском, коротко и понятно. Все числа для указанной порции.

Шкала confidence — ставь честно:
- "high": все ингредиенты явно указаны, вес/порция названы или однозначно определяются. Без реальных оснований — НЕ ставь.
- "medium": 1–2 ингредиента угаданы по типу блюда, порция стандартная но не указана явно.
- "low": состав неоднозначен, вес/порция совсем непонятны, текст слишком краткий ("поел", "что-то съел").

needsClarification — ставь true если выполняется ХОТЯ БЫ ОДНО условие:
- не указан вес/объём И блюдо допускает порции от 100 г до 400 г+
- состав блюда неоднозначен: "салат", "суп", "котлета", "паста" без уточнения вида
- текст настолько краткий, что возможны 3+ кардинально разные интерпретации
- confidence = "low"
Если needsClarification=true, clarificationQuestion — ОДИН короткий вопрос на русском, помогающий уточнить самое важное.`;

// ─── Photo analysis prompt ─────────────────────────────────────────────────
const PHOTO_SYSTEM_PROMPT = `Ты — опытный диетолог. Пользователь присылает изображение — фото блюда, скриншот таблицы КБЖУ или фото этикетки продукта.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ШАГ 0. ОПРЕДЕЛИ ТИП ИЗОБРАЖЕНИЯ (imageType):

"food_photo"           — фото реальной еды: тарелка с блюдом, приготовленная еда, упаковка в руке
"nutrition_screenshot" — скриншот или фото таблицы КБЖУ / таблицы питательных веществ
"product_label"        — фото этикетки, карточки товара в магазине/приложении, обёртки с составом

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ЕСЛИ imageType = "nutrition_screenshot" или "product_label":

Извлеки из изображения:
1. Название продукта → name (короткое, на русском если возможно)
2. КБЖУ: caloriesKcal, proteinG, fatG, carbsG, fiberG — только значения с этикетки, не рассчитывай сам
3. Определи, за что указаны значения (nutritionPer):
   "100g"    — написано "на 100 г" / "per 100g" / "на 100 мл"
   "portion" — написано "на порцию" / "per serving" / "на 1 шт"
   "package" — написано "на упаковку" / "per pack / per container" / "вся упаковка"
4. Если видна масса упаковки (например "нетто 450 г") → packageWeightG
5. Если видна масса порции → servingSizeG
6. mealType — определи по продукту ("unknown" если неочевидно)
7. confidence = "high" если КБЖУ чётко видны; "medium" если есть сомнения; "low" если значения нечитаемы
8. needsClarification = false (данные этикетки не нуждаются в уточнении)
   ИСКЛЮЧЕНИЕ: если значения нечитаемы — needsClarification = true
9. ingredients = [] (не нужно перечислять состав с этикетки)
10. weightG = null (будет указан пользователем при добавлении)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ЕСЛИ imageType = "food_photo":

Сначала определи: это еда или нет?
Если НЕ еда — верни строго:
{"isFood": false, "imageType": "food_photo", "nutritionPer": null, "packageWeightG": null, "servingSizeG": null, "mealType": "unknown", "name": "", "items": [], "ingredients": [], "composition": "", "hasSauce": false, "hasCheese": false, "hasFattyComponent": false, "hasFried": false, "confidence": "high", "needsClarification": false, "clarificationQuestion": null, "caloriesKcal": null, "proteinG": null, "fatG": null, "carbsG": null, "fiberG": null, "weightG": null}

ГЛАВНОЕ ПРАВИЛО: Всё видимое на фото — ОДИН приём пищи, одна запись.

Если еда — анализируй строго в таком порядке:

ШАГ 1. Определи тип приёма пищи (mealType):
- "breakfast" / "lunch" / "dinner" / "snack" / "unknown" — по виду и составу блюд.
Каша + яйца = завтрак. Суп + второе = обед. Лёгкое блюдо / кофе + бутерброд = перекус.

ШАГ 2. Перечисли все видимые блюда/продукты (items[]).
items — блюда уровня тарелки, не ингредиенты. ["Паста карбонара", "Салат"] — правильно.

ШАГ 3. Что видно на фото детально?
Перечисли все компоненты каждого блюда. Особое внимание на:
- соусы (томатный, сливочный, карбонара, болоньезе, песто)
- сыр (пармезан, моцарелла, чеддер)
- жирные мясные компоненты (бекон, фарш, колбаса, мраморное мясо)
- жареные элементы (корочка, масло в жарке)
- масло (сливочное, оливковое) и кремовые добавки
- орехи, кунжут, топпинги

ШАГ 4. Оцени вес каждого компонента в граммах.
Ресторанные порции часто 350–600г — не занижай.

ШАГ 5. Посчитай КБЖУ суммированием по ВСЕМ компонентам всего приёма пищи.
НЕ считай по названию — считай по ингредиентам.

ШАГ 6. Оцени уверенность честно:
- "high": блюдо и все основные компоненты чётко видны, вес/порция оцениваются уверенно. НЕ ставь без оснований.
- "medium": основное блюдо понятно, 1–2 компонента угаданы по контексту (соус, начинка).
- "low": фото нечёткое/размытое, блюдо частично скрыто, несколько равновероятных интерпретаций.

needsClarification — ставь true если выполняется ХОТЯ БЫ ОДНО условие:
- часть блюда скрыта, не попала в кадр
- соус / начинка / состав не видны, но явно присутствуют
- размер порции нельзя оценить без контекста (нет ориентира в кадре)
- блюдо допускает кардинально разные составы
- confidence = "low"
Если needsClarification=true, clarificationQuestion — ОДИН короткий вопрос на русском.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Верни ТОЛЬКО валидный JSON (без markdown, без пояснений):
{
  "isFood": true,
  "imageType": "food_photo" | "nutrition_screenshot" | "product_label",
  "nutritionPer": "100g" | "portion" | "package" | null,
  "packageWeightG": число или null,
  "servingSizeG": число или null,
  "mealType": "breakfast" | "lunch" | "dinner" | "snack" | "unknown",
  "name": "короткое название на русском",
  "items": ["Блюдо 1"],
  "ingredients": ["ингредиент ~XXг"],
  "composition": "краткое перечисление",
  "hasSauce": true/false,
  "hasCheese": true/false,
  "hasFattyComponent": true/false,
  "hasFried": true/false,
  "confidence": "high" | "medium" | "low",
  "needsClarification": false,
  "clarificationQuestion": null,
  "caloriesKcal": число,
  "proteinG": число,
  "fatG": число,
  "carbsG": число,
  "fiberG": число или null,
  "weightG": число или null
}

Критические правила для food_photo:
- Один приём пищи = один JSON-объект. Никогда не дроби.
- Не упрощай ресторанное блюдо до "паста с овощами" если виден соус, сыр, мясо.
- Соус к пасте — обычно 80–120г и добавляет 100–250 ккал.
- Тёртый сыр сверху — обычно 15–30г, добавляет 60–120 ккал.
- Если видишь корочку, поджаренные края, масло — не игнорируй жиры.
- Лучше немного завысить, чем сильно занизить.
- Не фантазируй о невидимых ингредиентах: если не видно — отметь в needsClarification.`;

// ─── Helpers ───────────────────────────────────────────────────────────────

function safeNum(v: unknown): number | null {
  return typeof v === 'number' && isFinite(v) && v >= 0 ? v : null;
}

function safeConfidence(v: unknown): 'high' | 'medium' | 'low' {
  if (v === 'high' || v === 'medium' || v === 'low') return v;
  return 'low'; // conservative: unknown confidence → assume low, not medium
}

/**
 * Conservative cross-validation:
 * - low confidence always implies needsClarification
 * - needsClarification without a question gets a safe fallback question
 */
function normalizeClarity(
  confidence: 'high' | 'medium' | 'low',
  rawNeedsClarification: unknown,
  rawQuestion: unknown,
): { needsClarification: boolean; clarificationQuestion: string | null } {
  const needsClarification =
    confidence === 'low' ||         // low confidence → always ask
    rawNeedsClarification === true;  // model explicitly said so

  const clarificationQuestion = needsClarification
    ? (typeof rawQuestion === 'string' && rawQuestion.trim()
        ? rawQuestion.trim()
        : 'Уточни состав или объём порции')
    : null;

  return { needsClarification, clarificationQuestion };
}

function safeMealType(v: unknown): MealType {
  if (v === 'breakfast' || v === 'lunch' || v === 'dinner' || v === 'snack') return v;
  return 'unknown';
}

function safeImageType(v: unknown): 'food_photo' | 'nutrition_screenshot' | 'product_label' | undefined {
  if (v === 'food_photo' || v === 'nutrition_screenshot' || v === 'product_label') return v;
  return undefined;
}

function safeNutritionPer(v: unknown): '100g' | 'portion' | 'package' | null {
  if (v === '100g' || v === 'portion' || v === 'package') return v;
  return null;
}

function safeStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const result = v.filter(i => typeof i === 'string' && i.trim().length > 0).map(i => (i as string).trim());
  return result.length > 0 ? result : undefined;
}

/** Build composition string from ingredients array if composition field is missing/short */
function buildComposition(parsed: Record<string, unknown>): string | undefined {
  const raw = parsed.composition;
  if (typeof raw === 'string' && raw.trim().length > 3) return raw.trim();
  const ingr = safeStringArray(parsed.ingredients);
  if (ingr && ingr.length > 0) return ingr.join(', ');
  return undefined;
}

// ─── Shared result builder ─────────────────────────────────────────────────

function buildResult(parsed: Record<string, unknown>, fallbackName: string): FoodAnalysisResult {
  const confidence = safeConfidence(parsed.confidence);
  const { needsClarification, clarificationQuestion } = normalizeClarity(
    confidence,
    parsed.needsClarification,
    parsed.clarificationQuestion,
  );

  return {
    name: typeof parsed.name === 'string' && parsed.name ? parsed.name : fallbackName,
    mealType: safeMealType(parsed.mealType),
    items: safeStringArray(parsed.items),
    composition: buildComposition(parsed),
    ingredients: safeStringArray(parsed.ingredients),
    confidence,
    needsClarification,
    clarificationQuestion,
    caloriesKcal: safeNum(parsed.caloriesKcal) !== null ? Math.round(safeNum(parsed.caloriesKcal)!) : null,
    proteinG: safeNum(parsed.proteinG) !== null ? Math.round(safeNum(parsed.proteinG)! * 10) / 10 : null,
    fatG: safeNum(parsed.fatG) !== null ? Math.round(safeNum(parsed.fatG)! * 10) / 10 : null,
    carbsG: safeNum(parsed.carbsG) !== null ? Math.round(safeNum(parsed.carbsG)! * 10) / 10 : null,
    fiberG: safeNum(parsed.fiberG) !== null ? Math.round(safeNum(parsed.fiberG)! * 10) / 10 : null,
    weightG: safeNum(parsed.weightG) !== null ? Math.round(safeNum(parsed.weightG)!) : null,
    imageType: safeImageType(parsed.imageType),
    nutritionPer: safeNutritionPer(parsed.nutritionPer),
    packageWeightG: safeNum(parsed.packageWeightG),
    servingSizeG: safeNum(parsed.servingSizeG),
  };
}

export class NotFoodError extends Error {
  constructor() { super('NOT_FOOD'); }
}

// ─── Photo analysis — single ──────────────────────────────────────────────

export async function analyzeFoodPhoto(fileUrl: string, costCtx?: AiCostContext): Promise<FoodAnalysisResult> {
  const openai = getClient();
  const MODEL = 'gpt-4o';

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: PHOTO_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: fileUrl, detail: 'high' },
          },
          {
            type: 'text',
            text: 'Определи состав блюда по ингредиентам, оцени вес каждого, посчитай КБЖУ суммированием.',
          },
        ],
      },
    ],
    max_tokens: 800,
    temperature: 0.1,
  });

  if (costCtx) logAiCost(costCtx, MODEL, response.usage);

  const raw = response.choices[0]?.message?.content ?? '{}';
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }

  if (parsed.isFood === false) throw new NotFoodError();

  return buildResult(parsed, 'Блюдо на фото');
}

// ─── Photo analysis — multiple (2–4 photos of the same meal) ─────────────

export async function analyzeFoodPhotos(fileUrls: string[], costCtx?: AiCostContext): Promise<FoodAnalysisResult> {
  if (fileUrls.length === 1) return analyzeFoodPhoto(fileUrls[0], costCtx);

  const openai = getClient();
  const MODEL = 'gpt-4o';
  const count = Math.min(fileUrls.length, 4);

  const imageBlocks = fileUrls.slice(0, count).map(url => ({
    type: 'image_url' as const,
    image_url: { url, detail: 'high' as const },
  }));

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: PHOTO_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          ...imageBlocks,
          {
            type: 'text',
            text: `Это ${count} фото одного и того же приёма пищи. Они могут быть разными ракурсами или разными частями одной еды. Не считай один и тот же продукт дважды, если это просто другой ракурс. Определи состав по ингредиентам, оцени вес каждого, посчитай КБЖУ суммированием. Верни ОДИН JSON-объект для всего приёма пищи целиком.`,
          },
        ],
      },
    ],
    max_tokens: 800,
    temperature: 0.1,
  });

  if (costCtx) logAiCost(costCtx, MODEL, response.usage);

  const raw = response.choices[0]?.message?.content ?? '{}';
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }

  if (parsed.isFood === false) throw new NotFoodError();

  return buildResult(parsed, 'Блюдо на фото');
}

// ─── Photo re-analysis with user context ──────────────────────────────────────

/**
 * Re-analyze a photo with additional user-provided context (e.g. "это греческий йогурт").
 * Used when user clicks "Другое" after a low-confidence result.
 */
export async function analyzeFoodPhotoWithContext(
  fileUrl: string,
  userContext: string,
  costCtx?: AiCostContext,
): Promise<FoodAnalysisResult> {
  const openai = getClient();
  const MODEL = 'gpt-4o';

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: PHOTO_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: fileUrl, detail: 'high' },
          },
          {
            type: 'text',
            text: `Пользователь уточнил: "${userContext}". Определи состав и КБЖУ с учётом этого уточнения.`,
          },
        ],
      },
    ],
    max_tokens: 800,
    temperature: 0.1,
  });

  if (costCtx) logAiCost(costCtx, MODEL, response.usage);

  const raw = response.choices[0]?.message?.content ?? '{}';
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }

  if (parsed.isFood === false) throw new NotFoodError();

  return buildResult(parsed, userContext);
}

// ─── Text analysis ─────────────────────────────────────────────────────────

export async function analyzeFood(userText: string, costCtx?: AiCostContext): Promise<FoodAnalysisResult> {
  const openai = getClient();
  const MODEL = 'gpt-4o-mini';

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userText },
    ],
    max_tokens: 600,
    temperature: 0.1,
  });

  if (costCtx) logAiCost(costCtx, MODEL, response.usage);

  const raw = response.choices[0]?.message?.content ?? '{}';
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }

  return buildResult(parsed, userText);
}
