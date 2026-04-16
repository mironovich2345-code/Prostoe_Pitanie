import OpenAI from 'openai';
import { AiCostContext, logAiCost } from './aiCost';

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

export interface InsightMeal {
  mealType: string;
  title: string;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
  sourceType: string;
}

export interface InsightInput {
  currentWeight: number | null;
  targetWeight: number | null;
  normCal: number | null;
  normProtein: number | null;
  normFat: number | null;
  normCarbs: number | null;
  normFiber: number | null;
  consumedCal: number;
  consumedProtein: number;
  consumedFat: number;
  consumedCarbs: number;
  consumedFiber: number;
  currentDate: string;  // YYYY-MM-DD
  currentTime: string;  // HH:MM
  meals: InsightMeal[];
}

export interface InsightResult {
  bannerTitle: string;
  bannerText: string;
  severity: 'neutral' | 'good' | 'warning';
  nextMealSuggestion: string;
  mealAdvice: string[];
}

export const FALLBACK_INSIGHT: InsightResult = {
  bannerTitle: 'Анализ рациона',
  bannerText: 'Продолжай записывать питание — AI-рекомендации появятся здесь.',
  severity: 'neutral',
  nextMealSuggestion: '',
  mealAdvice: [],
};

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
  unknown: 'Прочее',
};

function fmtNum(v: number | null | undefined): string {
  return v != null ? String(Math.round(v)) : '—';
}

function deviation(fact: number, norm: number | null): string {
  if (!norm || norm <= 0) return '—';
  const pct = Math.round(((fact - norm) / norm) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

const SYSTEM_PROMPT = `Ты — персональный нутрициолог в premium фитнес-приложении EATLYY. Анализируешь рацион пользователя и даёшь краткие умные рекомендации.

Тон: спокойный, умный, без осуждения, без воды, без медицинских дисклеймеров. Как опытный тренер, а не робот.
Язык: русский. Обращение: на "ты".

Верни ТОЛЬКО валидный JSON без markdown, без пояснений, строго такой структуры:
{"bannerTitle":"...","bannerText":"...","severity":"neutral"|"good"|"warning","nextMealSuggestion":"...","mealAdvice":["...","..."]}

Правила:
- bannerTitle: 3–5 слов
- bannerText: 1–2 предложения, суть ситуации
- severity: good — рацион близко к плану, warning — явные отклонения, neutral — начало дня или мало данных
- nextMealSuggestion: 1 конкретное предложение — что именно съесть/выбрать в следующий приём
- mealAdvice: 1–3 конкретных совета по блюдам и приёмам пищи (не "снизи жиры", а "на ужин возьми запечённую рыбу или куриную грудку")
- Если нет записей — мягко предложи начать вести дневник
- Учитывай время: до 14:00 — советы на весь день; 14–19:00 — корректировка оставшихся приёмов; после 19:00 — итоги дня и лёгкий финал`;

// ─── Weekly Insight ─────────────────────────────────────────────────────────

export interface WeeklyInsightDaySummary {
  date: string;        // YYYY-MM-DD
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  mealCount: number;
}

export interface WeeklyInsightInput {
  currentWeight: number | null;
  targetWeight: number | null;
  normCal: number | null;
  normProtein: number | null;
  normFat: number | null;
  normCarbs: number | null;
  weekFrom: string;    // YYYY-MM-DD
  weekTo: string;      // YYYY-MM-DD
  activeDays: number;
  totalDays: number;
  totalCal: number;
  avgCal: number;
  avgProtein: number;
  avgFat: number;
  avgCarbs: number;
  days: WeeklyInsightDaySummary[];
}

const WEEKLY_SYSTEM_PROMPT = `Ты — персональный нутрициолог в premium приложении EATLYY. Анализируешь недельный рацион пользователя.

Тон: спокойный, умный, без осуждения, без воды. Как наставник, а не робот.
Язык: русский. Обращение: на "ты".

Верни ТОЛЬКО валидный JSON без markdown, без пояснений, строго такой структуры:
{"bannerTitle":"...","bannerText":"...","severity":"neutral"|"good"|"warning","nextMealSuggestion":"...","mealAdvice":["...","..."]}

Правила для недельного анализа:
- bannerTitle: 3–5 слов, про неделю (не про день)
- bannerText: 1–2 предложения — главный итог недели
- severity: good — стабильный рацион близко к нормам, warning — явные перекосы или много пропущенных дней, neutral — мало данных
- nextMealSuggestion: 1 конкретная рекомендация на следующую неделю или ближайший приём
- mealAdvice: 1–3 совета по изменению питания на следующую неделю, конкретные (блюда/подходы, не "снизь жиры")
- Если меньше 3 активных дней — мягко отметь нестабильность данных
- Смотри на стабильность: резкие скачки калорий — это тоже паттерн
- Не повторяй дневной анализ — делай недельный срез`;

function buildWeeklyPrompt(input: WeeklyInsightInput): string {
  const dayRows = input.days.map(d =>
    `  ${d.date}: ${d.mealCount > 0
      ? `${Math.round(d.kcal)} ккал, Б${Math.round(d.protein)} Ж${Math.round(d.fat)} У${Math.round(d.carbs)}`
      : '— нет записей'}`
  ).join('\n');

  const normLine = input.normCal
    ? `Дневная норма: ${Math.round(input.normCal)} ккал, Б${fmtNum(input.normProtein)} Ж${fmtNum(input.normFat)} У${fmtNum(input.normCarbs)} г`
    : 'Нормы не заданы';

  return `Неделя: ${input.weekFrom} — ${input.weekTo}
Профиль: вес ${input.currentWeight ?? '—'} кг, цель ${input.targetWeight ?? '—'} кг
${normLine}

Активных дней: ${input.activeDays} из ${input.totalDays}
Итого за неделю: ${Math.round(input.totalCal)} ккал
Среднее в активный день: ${Math.round(input.avgCal)} ккал, Б${Math.round(input.avgProtein)} Ж${Math.round(input.avgFat)} У${Math.round(input.avgCarbs)} г

По дням:
${dayRows}`;
}

export async function generateWeeklyInsight(input: WeeklyInsightInput, costCtx?: AiCostContext): Promise<InsightResult> {
  const MODEL = 'gpt-4o-mini';
  try {
    const client = getClient();
    const resp = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: WEEKLY_SYSTEM_PROMPT },
        { role: 'user', content: buildWeeklyPrompt(input) },
      ],
      temperature: 0.7,
      max_tokens: 450,
    });

    if (costCtx) logAiCost(costCtx, MODEL, resp.usage);

    const raw = resp.choices[0]?.message?.content?.trim() ?? '';
    let parsed: InsightResult;
    try {
      parsed = JSON.parse(raw) as InsightResult;
    } catch {
      console.error('[weeklyInsight] JSON parse failed, raw length:', raw.length);
      return FALLBACK_INSIGHT;
    }

    if (typeof parsed.bannerTitle !== 'string' || typeof parsed.bannerText !== 'string') {
      return FALLBACK_INSIGHT;
    }
    if (!['neutral', 'good', 'warning'].includes(parsed.severity)) parsed.severity = 'neutral';
    if (!Array.isArray(parsed.mealAdvice)) parsed.mealAdvice = [];
    if (typeof parsed.nextMealSuggestion !== 'string') parsed.nextMealSuggestion = '';

    return parsed;
  } catch (err) {
    console.error('[weeklyInsight] OpenAI error:', err);
    return FALLBACK_INSIGHT;
  }
}

// ─── Daily Insight ───────────────────────────────────────────────────────────

export async function generateNutritionInsight(input: InsightInput, costCtx?: AiCostContext): Promise<InsightResult> {
  const mealsList = input.meals.length === 0
    ? 'Записей за день пока нет.'
    : input.meals.map(m => {
        const label = MEAL_TYPE_LABELS[m.mealType] ?? m.mealType;
        return `  - ${label}: ${m.title} (${fmtNum(m.kcal)} ккал, Б${fmtNum(m.protein)} Ж${fmtNum(m.fat)} У${fmtNum(m.carbs)})`;
      }).join('\n');

  const deviations = [
    `Калории: ${fmtNum(input.consumedCal)} / ${fmtNum(input.normCal)} ккал (${deviation(input.consumedCal, input.normCal)})`,
    `Белок:   ${fmtNum(input.consumedProtein)} / ${fmtNum(input.normProtein)} г (${deviation(input.consumedProtein, input.normProtein)})`,
    `Жиры:    ${fmtNum(input.consumedFat)} / ${fmtNum(input.normFat)} г (${deviation(input.consumedFat, input.normFat)})`,
    `Углеводы:${fmtNum(input.consumedCarbs)} / ${fmtNum(input.normCarbs)} г (${deviation(input.consumedCarbs, input.normCarbs)})`,
  ].join('\n');

  const userPrompt = `Дата: ${input.currentDate}, время: ${input.currentTime}
Профиль: вес ${input.currentWeight ?? '—'} кг, цель ${input.targetWeight ?? '—'} кг

Нормы / Факт / Отклонение:
${deviations}

Приёмы пищи за день:
${mealsList}`;

  const MODEL = 'gpt-4o-mini';
  try {
    const client = getClient();
    const resp = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 450,
    });

    if (costCtx) logAiCost(costCtx, MODEL, resp.usage);

    const raw = resp.choices[0]?.message?.content?.trim() ?? '';
    let parsed: InsightResult;
    try {
      parsed = JSON.parse(raw) as InsightResult;
    } catch {
      console.error('[nutritionInsight] JSON parse failed, raw length:', raw.length);
      return FALLBACK_INSIGHT;
    }

    if (typeof parsed.bannerTitle !== 'string' || typeof parsed.bannerText !== 'string') {
      return FALLBACK_INSIGHT;
    }
    if (!['neutral', 'good', 'warning'].includes(parsed.severity)) {
      parsed.severity = 'neutral';
    }
    if (!Array.isArray(parsed.mealAdvice)) parsed.mealAdvice = [];
    if (typeof parsed.nextMealSuggestion !== 'string') parsed.nextMealSuggestion = '';

    return parsed;
  } catch (err) {
    console.error('[nutritionInsight] OpenAI error:', err);
    return FALLBACK_INSIGHT;
  }
}
