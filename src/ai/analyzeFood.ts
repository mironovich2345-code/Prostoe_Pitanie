import OpenAI from 'openai';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY не задан в .env');
    client = new OpenAI({ apiKey });
  }
  return client;
}

export interface FoodAnalysisResult {
  name: string;
  composition?: string;
  caloriesKcal?: number | null;
  proteinG?: number | null;
  fatG?: number | null;
  carbsG?: number | null;
  fiberG?: number | null;
  weightG?: number | null;
  // New structured fields
  ingredients?: string[];
  confidence?: 'high' | 'medium' | 'low';
  needsClarification?: boolean;
  clarificationQuestion?: string | null;
}

// ─── Text analysis prompt ──────────────────────────────────────────────────
// For text input: gpt-4o-mini is sufficient, but improve reasoning order.
const SYSTEM_PROMPT = `Ты — диетолог и нутрициолог. Пользователь описывает блюдо или приём пищи на русском языке.

Анализируй в следующем порядке:
1. Определи каждый ингредиент и его примерный вес в граммах.
2. Отдельно выдели калорийно-плотные компоненты: соусы, сыр, масло, жареные элементы, мясо с жиром.
3. Посчитай КБЖУ суммированием по ингредиентам, а не "по названию блюда целиком".
4. Если состав неоднозначен или порция не указана, используй типичные значения для стандартной порции и укажи confidence: "medium".

Верни ТОЛЬКО валидный JSON (без markdown, без пояснений):
{
  "name": "название блюда на русском",
  "ingredients": ["ингредиент 1 ~XXг", "ингредиент 2 ~XXг"],
  "composition": "краткое перечисление ингредиентов",
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
- Считай КБЖУ суммированием по каждому ингредиенту — не по общему названию.
- Не занижай жиры: масло, соус, сыр, мясной жир добавляют значительно.
- confidence: "high" если состав однозначен, "medium" если порция типичная, "low" если много неопределённостей.
- needsClarification: true только при очень низкой уверенности, тогда clarificationQuestion — один короткий вопрос.
- name на русском, коротко и понятно.
- Все числа для указанной порции.`;

// ─── Photo analysis prompt ─────────────────────────────────────────────────
// For photo input: gpt-4o with high detail — the model needs to see textures,
// sauces, cheese layers, portions accurately.
const PHOTO_SYSTEM_PROMPT = `Ты — опытный диетолог. Пользователь присылает фото приёма пищи.

Сначала определи: это фото еды / блюда / напитка или нет?

Если НЕ еда — верни строго:
{"isFood": false, "name": "", "ingredients": [], "composition": "", "confidence": "high", "needsClarification": false, "clarificationQuestion": null, "caloriesKcal": null, "proteinG": null, "fatG": null, "carbsG": null, "fiberG": null, "weightG": null}

Если еда — анализируй строго в таком порядке:

ШАГ 1. Что видно на фото?
Перечисли все видимые компоненты. Обращай особое внимание на:
- соусы (томатный, сливочный, карбонара, болоньезе, песто и т.д.)
- сыр (пармезан, моцарелла, чеддер и т.д.)
- жирные мясные компоненты (бекон, фарш, колбаса, мраморное мясо)
- жареные элементы (корочка, масло в жарке)
- масло (сливочное, оливковое) и кремовые добавки
- орехи, кунжут, топпинги
- количество каждого компонента относительно общей тарелки

ШАГ 2. Оцени вес каждого компонента в граммах.
Используй размер тарелки / контекст / стандартные порции как ориентир.
Если блюдо ресторанное — не занижай, ресторанные порции часто 350–600г.

ШАГ 3. Посчитай КБЖУ суммированием по компонентам.
НЕ считай КБЖУ "по названию блюда" — считай по каждому ингредиенту отдельно.

ШАГ 4. Оцени уверенность:
- "high": состав и вес хорошо определяются
- "medium": что-то угадано по контексту
- "low": фото нечёткое, состав неоднозначный, несколько вариантов трактовки

Верни ТОЛЬКО валидный JSON (без markdown, без пояснений):
{
  "isFood": true,
  "name": "название блюда на русском",
  "ingredients": ["ингредиент 1 ~XXг", "ингредиент 2 ~XXг"],
  "composition": "краткое перечисление ингредиентов",
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

Критические правила:
- Не упрощай ресторанное блюдо до "паста с овощами" если виден соус, сыр, мясо.
- Соус к пасте — обычно 80–120г и добавляет 100–250 ккал в зависимости от вида.
- Тёртый сыр сверху — обычно 15–30г, добавляет 60–120 ккал.
- Если видишь корочку, поджаренные края, масло — не игнорируй жиры от жарки.
- needsClarification: true если фото совсем неоднозначное, тогда clarificationQuestion — один короткий вопрос на русском.
- Если нельзя точно определить — лучше завысить немного, чем сильно занизить.`;

function safeNum(v: unknown): number | null {
  return typeof v === 'number' && isFinite(v) && v >= 0 ? v : null;
}

function safeConfidence(v: unknown): 'high' | 'medium' | 'low' {
  if (v === 'high' || v === 'medium' || v === 'low') return v;
  return 'medium';
}

function safeIngredients(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const result = v.filter(i => typeof i === 'string' && i.length > 0) as string[];
  return result.length > 0 ? result : undefined;
}

/** Build composition string from ingredients array if composition field is missing/short */
function buildComposition(parsed: Record<string, unknown>): string | undefined {
  const raw = parsed.composition;
  if (typeof raw === 'string' && raw.trim().length > 3) return raw.trim();
  const ingr = safeIngredients(parsed.ingredients);
  if (ingr && ingr.length > 0) return ingr.join(', ');
  return undefined;
}

export class NotFoodError extends Error {
  constructor() { super('NOT_FOOD'); }
}

export async function analyzeFoodPhoto(fileUrl: string): Promise<FoodAnalysisResult> {
  const openai = getClient();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',           // upgraded from gpt-4o-mini for photo accuracy
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: PHOTO_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: fileUrl,
              detail: 'high',  // upgraded from 'low' — needed to see sauces, cheese, textures
            },
          },
          {
            type: 'text',
            text: 'Определи состав блюда по ингредиентам, оцени вес каждого, посчитай КБЖУ суммированием.',
          },
        ],
      },
    ],
    max_tokens: 700,            // upgraded from 300 — ingredient list needs more space
    temperature: 0.1,
  });

  const raw = response.choices[0]?.message?.content ?? '{}';
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  if (parsed.isFood === false) {
    throw new NotFoodError();
  }

  const confidence = safeConfidence(parsed.confidence);
  const needsClarification = parsed.needsClarification === true;
  const clarificationQuestion =
    needsClarification && typeof parsed.clarificationQuestion === 'string' && parsed.clarificationQuestion
      ? parsed.clarificationQuestion
      : null;

  return {
    name: typeof parsed.name === 'string' && parsed.name ? parsed.name : 'Блюдо на фото',
    composition: buildComposition(parsed),
    ingredients: safeIngredients(parsed.ingredients),
    confidence,
    needsClarification,
    clarificationQuestion,
    caloriesKcal: safeNum(parsed.caloriesKcal) !== null ? Math.round(safeNum(parsed.caloriesKcal)!) : null,
    proteinG: safeNum(parsed.proteinG) !== null ? Math.round(safeNum(parsed.proteinG)! * 10) / 10 : null,
    fatG: safeNum(parsed.fatG) !== null ? Math.round(safeNum(parsed.fatG)! * 10) / 10 : null,
    carbsG: safeNum(parsed.carbsG) !== null ? Math.round(safeNum(parsed.carbsG)! * 10) / 10 : null,
    fiberG: safeNum(parsed.fiberG) !== null ? Math.round(safeNum(parsed.fiberG)! * 10) / 10 : null,
    weightG: safeNum(parsed.weightG) !== null ? Math.round(safeNum(parsed.weightG)!) : null,
  };
}

export async function analyzeFood(userText: string): Promise<FoodAnalysisResult> {
  const openai = getClient();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userText },
    ],
    max_tokens: 500,            // upgraded from 300
    temperature: 0.1,
  });

  const raw = response.choices[0]?.message?.content ?? '{}';
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  const confidence = safeConfidence(parsed.confidence);
  const needsClarification = parsed.needsClarification === true;
  const clarificationQuestion =
    needsClarification && typeof parsed.clarificationQuestion === 'string' && parsed.clarificationQuestion
      ? parsed.clarificationQuestion
      : null;

  return {
    name: typeof parsed.name === 'string' && parsed.name ? parsed.name : userText,
    composition: buildComposition(parsed),
    ingredients: safeIngredients(parsed.ingredients),
    confidence,
    needsClarification,
    clarificationQuestion,
    caloriesKcal: safeNum(parsed.caloriesKcal) !== null ? Math.round(safeNum(parsed.caloriesKcal)!) : null,
    proteinG: safeNum(parsed.proteinG) !== null ? Math.round(safeNum(parsed.proteinG)! * 10) / 10 : null,
    fatG: safeNum(parsed.fatG) !== null ? Math.round(safeNum(parsed.fatG)! * 10) / 10 : null,
    carbsG: safeNum(parsed.carbsG) !== null ? Math.round(safeNum(parsed.carbsG)! * 10) / 10 : null,
    fiberG: safeNum(parsed.fiberG) !== null ? Math.round(safeNum(parsed.fiberG)! * 10) / 10 : null,
    weightG: safeNum(parsed.weightG) !== null ? Math.round(safeNum(parsed.weightG)!) : null,
  };
}
