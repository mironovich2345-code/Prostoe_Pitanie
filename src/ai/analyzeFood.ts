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
}

const SYSTEM_PROMPT = `Ты — диетолог и нутрициолог. Пользователь описывает блюдо или приём пищи на русском языке.
Твоя задача — определить название блюда, состав и питательную ценность.

Верни ТОЛЬКО валидный JSON строго следующей структуры (без markdown, без пояснений):
{
  "name": "название блюда",
  "composition": "ингредиенты кратко",
  "caloriesKcal": число,
  "proteinG": число,
  "fatG": число,
  "carbsG": число,
  "fiberG": число или null,
  "weightG": число или null
}

Правила:
- Все числа — для указанной порции. Если порция не указана, считай стандартную.
- Для калорий, белков, жиров, углеводов — давай лучшую оценку, не null.
- Клетчатку и вес порции давай если можно разумно оценить, иначе null.
- name — на русском, коротко и понятно.`;

function safeNum(v: unknown): number | null {
  return typeof v === 'number' && isFinite(v) && v >= 0 ? v : null;
}

export class NotFoodError extends Error {
  constructor() { super('NOT_FOOD'); }
}

const PHOTO_SYSTEM_PROMPT = `Ты — диетолог и нутрициолог. Пользователь присылает фото.

Сначала определи: это фото еды / блюда / напитка или нет?

Если это НЕ еда — верни строго:
{"isFood": false, "name": "", "composition": "", "caloriesKcal": null, "proteinG": null, "fatG": null, "carbsG": null, "fiberG": null, "weightG": null}

Если это еда — верни ТОЛЬКО валидный JSON (без markdown, без пояснений):
{
  "isFood": true,
  "name": "название блюда на русском",
  "composition": "ингредиенты кратко",
  "caloriesKcal": число,
  "proteinG": число,
  "fatG": число,
  "carbsG": число,
  "fiberG": число или null,
  "weightG": число или null
}

Правила:
- Все числа — для видимой порции на фото.
- Для калорий, белков, жиров, углеводов — давай лучшую оценку, не null.
- Клетчатку и вес порции давай если можно разумно оценить, иначе null.
- name — на русском, коротко и понятно.`;

export async function analyzeFoodPhoto(fileUrl: string): Promise<FoodAnalysisResult> {
  const openai = getClient();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: PHOTO_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: fileUrl, detail: 'low' } },
          { type: 'text', text: 'Определи блюдо и КБЖУ.' },
        ],
      },
    ],
    max_tokens: 300,
    temperature: 0.2,
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

  return {
    name: typeof parsed.name === 'string' && parsed.name ? parsed.name : 'Блюдо на фото',
    composition: typeof parsed.composition === 'string' && parsed.composition ? parsed.composition : undefined,
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
    max_tokens: 300,
    temperature: 0.2,
  });

  const raw = response.choices[0]?.message?.content ?? '{}';
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  return {
    name: typeof parsed.name === 'string' && parsed.name ? parsed.name : userText,
    composition: typeof parsed.composition === 'string' && parsed.composition ? parsed.composition : undefined,
    caloriesKcal: safeNum(parsed.caloriesKcal) !== null ? Math.round(safeNum(parsed.caloriesKcal)!) : null,
    proteinG: safeNum(parsed.proteinG) !== null ? Math.round(safeNum(parsed.proteinG)! * 10) / 10 : null,
    fatG: safeNum(parsed.fatG) !== null ? Math.round(safeNum(parsed.fatG)! * 10) / 10 : null,
    carbsG: safeNum(parsed.carbsG) !== null ? Math.round(safeNum(parsed.carbsG)! * 10) / 10 : null,
    fiberG: safeNum(parsed.fiberG) !== null ? Math.round(safeNum(parsed.fiberG)! * 10) / 10 : null,
    weightG: safeNum(parsed.weightG) !== null ? Math.round(safeNum(parsed.weightG)!) : null,
  };
}
