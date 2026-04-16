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

export interface RequisitesData {
  type: 'ooo' | 'ip';
  // Common
  companyName?: string;
  inn?: string;
  ogrn?: string;
  legalAddress?: string;
  accountNumber?: string;
  corrAccount?: string;
  bik?: string;
  // ООО only
  kpp?: string;
  director?: string;
}

const SYSTEM_PROMPT = `Ты — бухгалтерский помощник. Пользователь загружает фото или документ с реквизитами компании (ООО или ИП).
Твоя задача — извлечь реквизиты и вернуть их в JSON.

Верни ТОЛЬКО валидный JSON строго следующей структуры (без markdown, без пояснений):
{
  "type": "ooo" или "ip",
  "companyName": "полное наименование или null",
  "inn": "ИНН или null",
  "ogrn": "ОГРН или null",
  "kpp": "КПП или null (только для ООО)",
  "legalAddress": "юридический адрес или null",
  "accountNumber": "расчётный счёт или null",
  "corrAccount": "корреспондентский счёт или null",
  "bik": "БИК банка или null",
  "director": "ФИО руководителя или null (только для ООО)"
}

Правила:
- Если документ явно относится к ИП — ставь type: "ip", иначе "ooo"
- Если поле не найдено — ставь null, не придумывай данные
- Возвращай только цифры без пробелов для ИНН, КПП, ОГРН, БИК, номеров счетов`;

export async function recognizeRequisites(imageData: string, costCtx?: AiCostContext): Promise<Partial<RequisitesData>> {
  const ai = getClient();
  const MODEL = 'gpt-4o';

  // Extract base64 content (strip data URL prefix if present)
  const base64 = imageData.includes(',') ? imageData.split(',')[1] : imageData;
  const rawMime = imageData.startsWith('data:') ? imageData.split(';')[0].slice(5) : 'image/jpeg';
  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const mimeType = ALLOWED_MIME.includes(rawMime) ? rawMime : 'image/jpeg';

  const response = await ai.chat.completions.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
              detail: 'high',
            },
          },
          { type: 'text', text: 'Извлеки реквизиты из этого документа.' },
        ],
      },
    ],
  });

  if (costCtx) logAiCost(costCtx, MODEL, response.usage);

  const text = response.choices[0]?.message?.content ?? '{}';
  try {
    const parsed = JSON.parse(text);
    // Strip nulls so only found fields are returned
    const result: Partial<RequisitesData> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v !== null && v !== undefined && v !== '') {
        (result as Record<string, unknown>)[k] = v;
      }
    }
    return result;
  } catch {
    return {};
  }
}
