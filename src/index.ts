import 'dotenv/config';
import { createApiServer } from './api/server';
import { Telegraf, Markup } from 'telegraf';
import prisma from './db';
import { message } from 'telegraf/filters';
import { mainMenu, BUTTONS } from './keyboards/mainMenu';
import { MEAL_BUTTONS, MEAL_TYPE_BUTTONS } from './keyboards/mealMenu';
import { setPending, getPending, clearPending, setDraft, getDraft, clearDraft, MealDraft } from './state/pendingActions';
import { addMeal, getTodayMeals, deleteLastTodayMeal, clearTodayMeals, updateMealNutrition, getMealsForDate } from './state/mealStore';
import { getProfile, upsertProfile } from './state/profileStore';
import { GOAL_BUTTONS, GOAL_TYPE_VALUES, GOAL_TYPE_LABELS, sexMenu, SEX_BUTTONS, SEX_VALUES, SEX_LABELS, activityMenu, ACTIVITY_BUTTONS, ACTIVITY_VALUES, ACTIVITY_LABELS } from './keyboards/profileMenu';
import { addWeightEntry, getRecentWeightEntries, countWeightEntries, getFirstWeightEntry } from './state/weightStore';
import { analyzeFood, analyzeFoodPhoto, NotFoodError } from './ai/analyzeFood';
import { calcAge, deriveGoal, tryAutoCalcNorms } from './utils/normsCalc';
import { resolveTimezone } from './utils/timezone';
import { pickReminderMessage } from './utils/reminderMessages';
import { ensureReferralCode, applyReferral, applyTrainerReferral } from './utils/referral';

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
};

function formatEntry(entry: { text: string; mealType: string; sourceType: string }): string {
  const typeLabel = MEAL_TYPE_LABELS[entry.mealType] ?? entry.mealType;
  const sourceLabel = entry.sourceType === 'photo' ? 'Фото' : entry.sourceType === 'voice' ? 'Голос' : 'Текст';
  return `[${typeLabel}][${sourceLabel}] ${entry.text}`;
}

// ── Inline keyboards ──────────────────────────────────────────────────
// Profile editing is now only available in the mini app
const profileViewMenu = Markup.inlineKeyboard([
  ...(process.env.MINIAPP_URL ? [[Markup.button.url('📱 Открыть приложение', process.env.MINIAPP_URL)]] : []),
  [Markup.button.callback('🏠 В меню', 'nav_main_menu')],
]);

const weightActionsMenu = Markup.inlineKeyboard([
  [Markup.button.callback('➕ Записать вес', 'weight_log')],
  [Markup.button.callback('🏠 В меню', 'nav_main_menu')],
]);

const statusActionsMenu = Markup.inlineKeyboard([
  [Markup.button.callback('❌ Удалить последнюю', 'status_delete_last'), Markup.button.callback('🗑 Очистить день', 'status_clear_today')],
  [Markup.button.callback('🏠 В меню', 'nav_main_menu')],
]);


const onboardingCancelMenu = Markup.inlineKeyboard([
  [Markup.button.callback('❌ Отмена', 'onboarding_cancel')],
]);

const draftActionsMenu = Markup.inlineKeyboard([
  [Markup.button.callback('✅ Сохранить', 'draft_save'), Markup.button.callback('❌ Отменить', 'draft_cancel')],
  [Markup.button.callback('📅 За прошлый день', 'draft_save_yesterday'), Markup.button.callback('✏️ Редактировать', 'draft_edit')],
]);

const addMoreMenu = Markup.inlineKeyboard([
  [Markup.button.callback('➕ Добавить ещё', 'progress_add_more'), Markup.button.callback('🏠 В меню', 'nav_main_menu')],
]);

const draftEditModeMenu = Markup.inlineKeyboard([
  [Markup.button.callback('📝 Текстом', 'draft_edit_text'), Markup.button.callback('📷 Фото', 'draft_edit_photo')],
  [Markup.button.callback('🎤 Голосом', 'draft_edit_voice')],
  [Markup.button.callback('◀️ Назад', 'draft_edit_back')],
]);

const draftMealTypeMenu = Markup.inlineKeyboard([
  [Markup.button.callback('🍳 Завтрак', 'draft_mt_breakfast'), Markup.button.callback('🍲 Обед', 'draft_mt_lunch')],
  [Markup.button.callback('🍽 Ужин', 'draft_mt_dinner'), Markup.button.callback('🍎 Перекус', 'draft_mt_snack')],
  [Markup.button.callback('◀️ Назад', 'draft_mt_back')],
]);

function formatDraftCard(draft: MealDraft): string {
  const sourceLabel = draft.sourceType === 'photo' ? '📷 Фото' : draft.sourceType === 'voice' ? '🎤 Голос' : '📝 Текст';
  const lines: string[] = [`📋 Анализ блюда\n`];
  lines.push(`🍽 ${draft.text}`);
  if (draft.composition) lines.push(`🥘 Состав: ${draft.composition}`);
  lines.push(`Источник: ${sourceLabel}`);
  if (draft.weightG != null) lines.push(`⚖️ Вес: ${draft.weightG} г`);
  const hasNutrition = draft.caloriesKcal != null;
  if (hasNutrition) {
    lines.push('');
    lines.push(`🔥 Калории: ${draft.caloriesKcal} ккал`);
    lines.push(`💪 Белки:    ${draft.proteinG} г`);
    lines.push(`🧈 Жиры:     ${draft.fatG} г`);
    lines.push(`🌾 Углеводы: ${draft.carbsG} г`);
    if (draft.fiberG != null) lines.push(`🥦 Клетчатка: ${draft.fiberG} г`);
  } else {
    lines.push('\nКБЖУ не рассчитано.');
  }
  lines.push('\nВыбери тип и сохрани:');
  return lines.join('\n');
}

async function buildDayProgressText(chatId: number, date: Date): Promise<string> {
  const [meals, profile] = await Promise.all([
    getMealsForDate(chatId, date),
    getProfile(chatId),
  ]);

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const dateLabel =
    date.toDateString() === today.toDateString() ? 'сегодня' :
    date.toDateString() === yesterday.toDateString() ? 'вчера' :
    date.toLocaleDateString('ru-RU');

  type MealRow = { caloriesKcal: number | null; proteinG: number | null; fatG: number | null; carbsG: number | null; fiberG: number | null; mealType: string };
  let totalCal = 0, totalProt = 0, totalFat = 0, totalCarbs = 0, totalFiber = 0;
  const counts: Record<string, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  for (const m of meals as MealRow[]) {
    totalCal += m.caloriesKcal ?? 0;
    totalProt += m.proteinG ?? 0;
    totalFat += m.fatG ?? 0;
    totalCarbs += m.carbsG ?? 0;
    totalFiber += m.fiberG ?? 0;
    if (m.mealType in counts) counts[m.mealType]++;
  }

  const mealStatus = [
    `${counts.breakfast > 0 ? '✅' : '⬜'} Завтрак`,
    `${counts.lunch > 0 ? '✅' : '⬜'} Обед`,
    `${counts.dinner > 0 ? '✅' : '⬜'} Ужин`,
    `${counts.snack > 0 ? '✅' : '⬜'} Перекус`,
  ].join('  ');

  const lines: string[] = [`📊 Прогресс за ${dateLabel}:\n`, mealStatus, ''];

  const hasNorms = profile?.dailyCaloriesKcal != null;
  if (hasNorms) {
    const p = profile!;
    const remCal = Math.max(0, p.dailyCaloriesKcal! - totalCal);
    lines.push(`Калории: ${Math.round(totalCal)} / ${p.dailyCaloriesKcal} ккал  (ост. ${Math.round(remCal)})`);
    lines.push(`Б: ${totalProt.toFixed(1)}г (ост. ${Math.max(0, p.dailyProteinG! - totalProt).toFixed(1)}г)`);
    lines.push(`Ж: ${totalFat.toFixed(1)}г (ост. ${Math.max(0, p.dailyFatG! - totalFat).toFixed(1)}г)`);
    lines.push(`У: ${totalCarbs.toFixed(1)}г (ост. ${Math.max(0, p.dailyCarbsG! - totalCarbs).toFixed(1)}г)`);
    lines.push(`Клетч: ${totalFiber.toFixed(1)}г (ост. ${Math.max(0, (p.dailyFiberG ?? 0) - totalFiber).toFixed(1)}г)`);
  } else {
    lines.push(`Калории: ${Math.round(totalCal)} ккал`);
    lines.push(`Б: ${totalProt.toFixed(1)}г  Ж: ${totalFat.toFixed(1)}г  У: ${totalCarbs.toFixed(1)}г  Клетч: ${totalFiber.toFixed(1)}г`);
    lines.push('');
    lines.push('Нормы не заданы. Добавь их в Профиле.');
  }

  return lines.join('\n');
}

// ── Состояние обработки еды (защита от late result) ───────────────────
interface ProcessingEntry {
  messageId: number;
  cancelled: boolean;
}
const processingState = new Map<number, ProcessingEntry>();

// ── Чистый чат (храним последние 3 сообщения бота) ──────────────────────
const lastBotMsgs = new Map<number, number[]>();


function getNowInTimezone(tz: string): { hour: number; minute: number } {
  try {
    const fmt = new Intl.DateTimeFormat('en', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false });
    const parts = fmt.formatToParts(new Date());
    const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0');
    const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0');
    return { hour: isNaN(h) ? 0 : h, minute: isNaN(m) ? 0 : m };
  } catch {
    const now = new Date();
    return { hour: now.getHours(), minute: now.getMinutes() };
  }
}




async function buildProfileText(chatId: number): Promise<string> {
  const profile = await getProfile(chatId);
  const isEmpty = !profile || (profile.heightCm === null && profile.currentWeightKg === null && profile.sex === null);
  if (isEmpty) {
    return '👤 Профиль не заполнен.\n\nНажми кнопку ниже, чтобы настроить.';
  }
  const lines: string[] = ['👤 Твой профиль:\n'];
  if (profile.sex != null) lines.push(`👤 Пол: ${SEX_LABELS[profile.sex] ?? profile.sex}`);
  if (profile.heightCm != null) lines.push(`📏 Рост: ${profile.heightCm} см`);
  if (profile.currentWeightKg != null) lines.push(`⚖️ Вес: ${profile.currentWeightKg} кг`);
  if (profile.desiredWeightKg != null) {
    const autoGoal = profile.currentWeightKg != null
      ? ` (${GOAL_TYPE_LABELS[deriveGoal(profile.currentWeightKg, profile.desiredWeightKg)] ?? ''})`
      : '';
    lines.push(`🎯 Желаемый вес: ${profile.desiredWeightKg} кг${autoGoal}`);
  }
  if (profile.birthDate != null) {
    const age = calcAge(profile.birthDate);
    lines.push(`🎂 Возраст: ${age} лет (${profile.birthDate.toLocaleDateString('ru-RU')})`);
  }
  if (profile.activityLevel != null) lines.push(`⚡ Активность: ${ACTIVITY_LABELS[profile.activityLevel] ?? profile.activityLevel}`);
  if (profile.city != null) lines.push(`🌍 Город: ${profile.city}${profile.timezone ? ` (${profile.timezone})` : ''}`);

  const hasNorms = profile.dailyCaloriesKcal != null;
  if (hasNorms) {
    lines.push('');
    lines.push('📊 Дневные нормы:');
    lines.push(`🔥 ${profile.dailyCaloriesKcal} ккал`);
    lines.push(`💪 Белки: ${profile.dailyProteinG} г`);
    lines.push(`🧈 Жиры: ${profile.dailyFatG} г`);
    lines.push(`🌾 Углеводы: ${profile.dailyCarbsG} г`);
    if (profile.dailyFiberG) lines.push(`🥦 Клетчатка: ${profile.dailyFiberG} г`);
  } else {
    const missing: string[] = [];
    if (!profile.sex) missing.push('пол');
    if (!profile.birthDate) missing.push('дата рождения');
    if (!profile.activityLevel) missing.push('активность');
    lines.push('');
    lines.push(missing.length ? `Нормы рассчитаются автоматически после заполнения: ${missing.join(', ')}.` : 'Нормы не рассчитаны.');
  }
  return lines.join('\n');
}

async function buildWeightText(chatId: number): Promise<string> {
  const [recent, total, first] = await Promise.all([
    getRecentWeightEntries(chatId),
    countWeightEntries(chatId),
    getFirstWeightEntry(chatId),
  ]);
  if (total === 0 || recent.length === 0) {
    return `⚖️ История веса пока пуста.\n\nНажми кнопку ниже, чтобы добавить первое взвешивание.`;
  }
  const latest = recent[0].weightKg;
  const list = recent
    .map((e: { weightKg: number }, i: number) => `${i + 1}. ${e.weightKg} кг`)
    .join('\n');
  const lines: string[] = [`⚖️ Твой вес:\n`];
  lines.push(`Текущий вес: ${latest} кг`);
  lines.push(`Всего записей: ${total}`);
  if (first && total > 1) {
    const diff = latest - first.weightKg;
    const diffStr = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
    lines.push(`Изменение: ${diffStr} кг`);
  }
  lines.push(`\nПоследние записи:\n${list}`);
  return lines.join('\n');
}

async function buildStatsText(chatId: number): Promise<string> {
  const [entries, profile] = await Promise.all([
    getTodayMeals(chatId),
    getProfile(chatId),
  ]);

  const todayLabel = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  type MealRow = { mealType: string; caloriesKcal: number | null; proteinG: number | null; fatG: number | null; carbsG: number | null; fiberG: number | null };
  const counts: Record<string, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  let totalCal = 0, totalProt = 0, totalFat = 0, totalCarbs = 0, totalFiber = 0;
  for (const m of entries as MealRow[]) {
    if (m.mealType in counts) counts[m.mealType]++;
    totalCal += m.caloriesKcal ?? 0;
    totalProt += m.proteinG ?? 0;
    totalFat += m.fatG ?? 0;
    totalCarbs += m.carbsG ?? 0;
    totalFiber += m.fiberG ?? 0;
  }

  const lines: string[] = [`📊 Статистика\n`, `📅 ${todayLabel}\n`];

  lines.push(`${counts.breakfast > 0 ? '✅' : '⬜'} Завтрак`);
  lines.push(`${counts.lunch > 0 ? '✅' : '⬜'} Обед`);
  lines.push(`${counts.dinner > 0 ? '✅' : '⬜'} Ужин`);
  lines.push(`${counts.snack > 0 ? '✅' : '⬜'} Перекус`);
  lines.push('');

  const hasNorms = profile?.dailyCaloriesKcal != null;
  if (hasNorms) {
    const p = profile!;
    const pct = Math.round((totalCal / p.dailyCaloriesKcal!) * 100);
    const remCal = Math.max(0, p.dailyCaloriesKcal! - totalCal);
    lines.push(`🔥 Калории: ${Math.round(totalCal)} из ${p.dailyCaloriesKcal} ккал (${pct}%)`);
    lines.push(`   Осталось: ${Math.round(remCal)} ккал`);
    lines.push(`💪 Белки:    ${totalProt.toFixed(1)} / ${p.dailyProteinG} г`);
    lines.push(`🧈 Жиры:     ${totalFat.toFixed(1)} / ${p.dailyFatG} г`);
    lines.push(`🌾 Углеводы: ${totalCarbs.toFixed(1)} / ${p.dailyCarbsG} г`);
    lines.push(`🥦 Клетчатка: ${totalFiber.toFixed(1)} / ${p.dailyFiberG ?? 25} г`);
  } else {
    lines.push(`🔥 Калории: ${Math.round(totalCal)} ккал`);
    lines.push(`💪 Белки:    ${totalProt.toFixed(1)} г`);
    lines.push(`🧈 Жиры:     ${totalFat.toFixed(1)} г`);
    lines.push(`🌾 Углеводы: ${totalCarbs.toFixed(1)} г`);
    lines.push(`🥦 Клетчатка: ${totalFiber.toFixed(1)} г`);
    lines.push('');
    lines.push('Нормы не заданы. Добавь данные в Профиле.');
  }

  lines.push('');
  if (entries.length === 0) {
    lines.push('Сегодня записей нет. Нажми «🍽 Добавить приём пищи».');
  } else {
    lines.push(buildDayVerdict(counts, entries.length));
  }

  return lines.join('\n');
}

function formatEntryShort(e: { text: string; mealType: string; sourceType: string }): string {
  const type = MEAL_TYPE_LABELS[e.mealType] ?? e.mealType;
  if (e.sourceType === 'photo') return `${type} 📷`;
  if (e.sourceType === 'voice') return `${type} 🎤`;
  return `${type} — ${e.text}`;
}

async function buildStatusText(chatId: number): Promise<string> {
  const [entries, profile] = await Promise.all([
    getTodayMeals(chatId),
    getProfile(chatId),
  ]);

  const goalStr = profile?.goalType ? (GOAL_TYPE_LABELS[profile.goalType] ?? profile.goalType) : 'не указана';
  const weightStr = profile?.currentWeightKg != null ? `${profile.currentWeightKg} кг` : 'не указан';

  if (entries.length === 0) {
    return [
      '📊 Сегодня — записей пока нет.',
      `\nЦель: ${goalStr}`,
      `Вес: ${weightStr}`,
      '\nНажми «🍽 Добавить приём пищи», чтобы начать.',
    ].join('\n');
  }

  const counts: Record<string, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  for (const e of entries as { mealType: string }[]) {
    if (e.mealType in counts) counts[e.mealType]++;
  }

  function checkItem(key: string, label: string): string {
    const n = counts[key];
    const mark = n > 0 ? '✅' : '⬜';
    const count = n > 1 ? ` (${n})` : '';
    return `${mark} ${label}${count}`;
  }

  const checklist = [
    checkItem('breakfast', 'Завтрак'),
    checkItem('lunch', 'Обед'),
    checkItem('dinner', 'Ужин'),
    checkItem('snack', 'Перекус'),
  ].join('\n');

  const last5 = (entries as { text: string; mealType: string; sourceType: string }[]).slice(-5);
  const list = last5.map((e) => `• ${formatEntryShort(e)}`).join('\n');

  return [
    `📊 Сегодня — записей: ${entries.length}`,
    `\n${checklist}`,
    `\nПоследние:\n${list}`,
    `\nЦель: ${goalStr} · Вес: ${weightStr}`,
  ].join('\n');
}

function buildDayVerdict(counts: Record<string, number>, total: number): string {
  if (total === 0) return 'Сегодня ещё нет записей. Начни с первого приёма пищи.';
  if (total <= 2) return 'Начало есть. Постарайся отметить основные приёмы пищи за день.';
  if (counts.breakfast > 0 && counts.lunch > 0 && counts.dinner > 0) {
    return 'День заполнен хорошо: основные приёмы пищи отмечены.';
  }
  if (counts.breakfast === 0) return 'Пока не отмечен завтрак.';
  if (counts.dinner === 0) return 'Пока не отмечен ужин.';
  return 'Продолжай отмечать приёмы пищи.';
}

async function buildDaySummaryText(chatId: number): Promise<string> {
  const [entries, profile] = await Promise.all([
    getTodayMeals(chatId),
    getProfile(chatId),
  ]);

  const goalStr = profile?.goalType ? (GOAL_TYPE_LABELS[profile.goalType] ?? profile.goalType) : 'не указана';
  const weightStr = profile?.currentWeightKg != null ? `${profile.currentWeightKg} кг` : 'не указан';

  if (entries.length === 0) {
    return `🧾 Итог дня\n\nСегодня записей нет.\n\nЦель: ${goalStr}  Вес: ${weightStr}`;
  }

  const counts: Record<string, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  for (const e of entries as { mealType: string }[]) {
    if (e.mealType in counts) counts[e.mealType]++;
  }

  const typeBlock = [
    `- Завтрак: ${counts.breakfast}`,
    `- Обед: ${counts.lunch}`,
    `- Ужин: ${counts.dinner}`,
    `- Перекус: ${counts.snack}`,
  ].join('\n');

  const checklist = [
    `${counts.breakfast > 0 ? '✅' : '⬜'} Завтрак`,
    `${counts.lunch > 0 ? '✅' : '⬜'} Обед`,
    `${counts.dinner > 0 ? '✅' : '⬜'} Ужин`,
    `${counts.snack > 0 ? '✅' : '⬜'} Перекус`,
  ].join('\n');

  const last5 = (entries as { text: string; mealType: string; sourceType: string }[]).slice(-5);
  const list = last5.map((e, i) => `${i + 1}. ${formatEntry(e)}`).join('\n');

  const verdict = buildDayVerdict(counts, entries.length);

  return [
    `🧾 Итог дня`,
    `\nВсего записей: ${entries.length}`,
    `\n${typeBlock}`,
    `\nЧто отмечено:\n${checklist}`,
    `\nЦель: ${goalStr}\nТекущий вес: ${weightStr}`,
    `\nПоследние записи:\n${list}`,
    `\n${verdict}`,
  ].join('\n');
}

function isOnboardingComplete(profile: { heightCm: number | null; currentWeightKg: number | null; desiredWeightKg?: number | null; sex?: string | null; activityLevel?: number | null } | null): boolean {
  return !!(profile?.heightCm && profile?.currentWeightKg && profile?.desiredWeightKg != null && profile?.sex && profile?.activityLevel);
}

async function startOnboarding(ctx: { message: { chat: { id: number } }; reply: Function }): Promise<void> {
  setPending(ctx.message.chat.id, { action: 'onboarding_sex' });
  await ctx.reply(
    'Привет! Давай настроим профиль за несколько шагов.\n\nШаг 1 из 7 — пол.\nВыбери из вариантов ниже.',
    sexMenu
  );
}

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error('ERROR: BOT_TOKEN не задан в .env');
  process.exit(1);
}

const bot = new Telegraf(token);

// Middleware: чистый чат — удалять предыдущее сообщение бота перед каждым новым ответом
bot.use(async (ctx, next) => {
  const chatId = ctx.chat?.id;
  if (chatId) {
    const origReply = (ctx.reply as Function).bind(ctx);
    const userMsgId: number | undefined = (ctx as any).message?.message_id;
    (ctx as any).reply = async (...args: any[]): Promise<any> => {
      const msgs = lastBotMsgs.get(chatId) ?? [];
      // Add current user message to window (it stays until aged out)
      if (userMsgId && !msgs.includes(userMsgId)) {
        msgs.push(userMsgId);
      }
      // Trim old messages to keep window at 5 after adding new bot message
      while (msgs.length >= 5) {
        const toDelete = msgs.shift()!;
        try { await ctx.telegram.deleteMessage(chatId, toDelete); } catch {}
      }
      const msg = await origReply(...args);
      if (msg?.message_id) {
        msgs.push(msg.message_id);
        lastBotMsgs.set(chatId, msgs);
      }
      return msg;
    };
  }
  return next();
});

bot.start(async (ctx) => {
  const chatId = ctx.message.chat.id;
  clearPending(chatId);

  // Ensure every user has a referral code
  await ensureReferralCode(String(chatId)).catch(() => null);

  // Apply referral from deep link
  const payload = ctx.args?.[0];
  if (payload?.startsWith('trf_')) {
    await applyTrainerReferral(String(chatId), payload).catch(() => null);
  } else if (payload?.startsWith('ref_')) {
    const code = payload.slice(4);
    await applyReferral(String(chatId), code).catch(() => null);
  }

  const profile = await getProfile(chatId);
  if (isOnboardingComplete(profile)) {
    return ctx.reply('👋 Привет! Выбери действие:', mainMenu);
  }
  return startOnboarding(ctx);
});

bot.help((ctx) => {
  return ctx.reply(
    '❓ Помощь\n\nИспользуй кнопки меню для навигации.\n\n🍽 Добавить приём пищи — записать еду\n📊 Статистика — прогресс за день\n👤 Профиль — данные и нормы\n⚙️ Настройки — уведомления',
    mainMenu
  );
});

bot.command('menu', (ctx) => {
  clearPending(ctx.message.chat.id);
  return ctx.reply('Главное меню:', mainMenu);
});

bot.command('today', async (ctx) => {
  const text = await buildStatsText(ctx.message.chat.id);
  return ctx.reply(text, statusActionsMenu);
});

bot.command('day_summary', async (ctx) => {
  const text = await buildStatsText(ctx.message.chat.id);
  return ctx.reply(text, mainMenu);
});

bot.command('delete_last', async (ctx) => {
  const deleted = await deleteLastTodayMeal(ctx.message.chat.id);
  if (!deleted) {
    return ctx.reply('На сегодня нет записей для удаления.');
  }
  return ctx.reply(`Удалил последнюю запись:\n${formatEntry(deleted)}`);
});

bot.command('clear_today', async (ctx) => {
  const count = await clearTodayMeals(ctx.message.chat.id);
  if (count === 0) {
    return ctx.reply('На сегодня нет записей для очистки.');
  }
  return ctx.reply(`Очистил все записи за сегодня.\nУдалено записей: ${count}`);
});

bot.command('cancel', (ctx) => {
  const chatId = ctx.message.chat.id;
  const state = getPending(chatId);
  clearPending(chatId);
  if (state?.action === 'awaiting_draft_edit') {
    const draft = getDraft(chatId);
    if (draft) {
      return ctx.reply('Редактирование отменено.\n\n' + formatDraftCard(draft), draftActionsMenu);
    }
  }
  clearDraft(chatId);
  return ctx.reply('Отменено.', mainMenu);
});

bot.command('onboarding', (ctx) => {
  clearPending(ctx.message.chat.id);
  return startOnboarding(ctx);
});

bot.command('profile', async (ctx) => {
  const text = await buildProfileText(ctx.message.chat.id);
  return ctx.reply(text + '\n\n📱 Редактировать данные профиля можно в приложении.', profileViewMenu);
});

bot.command('set_height', (ctx) => {
  return ctx.reply('📱 Редактирование роста доступно только в приложении.\nОткрой его через кнопку меню.', profileViewMenu);
});

bot.command('set_weight', (ctx) => {
  return ctx.reply('📱 Редактирование веса доступно только в приложении.\nОткрой его через кнопку меню.', profileViewMenu);
});

bot.command('set_goal', (ctx) => {
  return ctx.reply('📱 Редактирование цели доступно только в приложении.\nОткрой его через кнопку меню.', profileViewMenu);
});

bot.command('set_norms', (ctx) => {
  setPending(ctx.message.chat.id, { action: 'awaiting_norms' });
  return ctx.reply(
    'Введи дневные нормы в формате:\nккал / белки / жиры / углеводы / клетчатка\n\nПример: 2200/130/70/220/25\n\nЧтобы выйти, нажми /cancel.'
  );
});

bot.command('weight', async (ctx) => {
  const text = await buildWeightText(ctx.message.chat.id);
  return ctx.reply(text, weightActionsMenu);
});

bot.command('log_weight', (ctx) => {
  setPending(ctx.message.chat.id, { action: 'awaiting_weight_log' });
  return ctx.reply('Отправь текущий вес в килограммах.\nПример: 82 или 75.5\n\nЧтобы выйти, нажми /cancel.');
});

// Главное меню
bot.hears(BUTTONS.PROFILE, async (ctx) => {
  const text = await buildProfileText(ctx.message.chat.id);
  return ctx.reply(text + '\n\n📱 Редактировать данные профиля можно в приложении.', profileViewMenu);
});

bot.hears(BUTTONS.ADD_MEAL, (ctx) => {
  const chatId = ctx.message.chat.id;
  setPending(chatId, { action: 'awaiting_meal_input' });
  return ctx.reply(
    '🍽 Отправь блюдо — и я всё запишу.\n\nМожно:\n• написать текстом («гречка с котлетой»)\n• прислать фото тарелки\n• надиктовать голосовым',
    Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'nav_main_menu')]])
  );
});

bot.hears(BUTTONS.STATS, async (ctx) => {
  const text = await buildStatsText(ctx.message.chat.id);
  return ctx.reply(text, statusActionsMenu);
});


function buildSettingsText(profile: { notificationsEnabled: boolean | null } | null): string {
  const enabled = profile?.notificationsEnabled !== false;
  return `⚙️ Настройки\n\n🔔 Напоминания о еде: ${enabled ? 'включены ✅' : 'выключены ❌'}\n\n📱 Время и количество уведомлений настраиваются в приложении.`;
}

function buildSettingsKeyboard(profile: { notificationsEnabled: boolean | null } | null) {
  const enabled = profile?.notificationsEnabled !== false;
  return Markup.inlineKeyboard([
    [Markup.button.callback(enabled ? '🔕 Выключить уведомления' : '🔔 Включить уведомления', 'settings_toggle_notifications')],
    ...(process.env.MINIAPP_URL ? [[Markup.button.url('📱 Настроить в приложении', process.env.MINIAPP_URL)]] : []),
    [Markup.button.callback('🏠 В меню', 'nav_main_menu')],
  ]);
}

bot.hears(BUTTONS.SETTINGS, async (ctx) => {
  const chatId = ctx.message.chat.id;
  const profile = await getProfile(chatId);
  const text = buildSettingsText(profile);
  return ctx.reply(text, buildSettingsKeyboard(profile));
});

// Цели профиля
function registerGoalButton(buttonText: string, goalValue: string, goalLabel: string) {
  bot.hears(buttonText, async (ctx) => {
    const chatId = ctx.message.chat.id;
    const state = getPending(chatId);
    await upsertProfile(chatId, { goalType: goalValue });
    if (state?.action === 'onboarding_goal') {
      setPending(chatId, { action: 'onboarding_activity' });
      return ctx.reply('✅ Цель сохранена.\n\nШаг 6 из 6 — уровень активности.\nВыбери из вариантов ниже.', activityMenu);
    }
    clearPending(chatId);
    await tryAutoCalcNorms(chatId);
    return ctx.reply(`Цель сохранена: ${goalLabel}`, mainMenu);
  });
}

registerGoalButton(GOAL_BUTTONS.LOSE, GOAL_TYPE_VALUES[GOAL_BUTTONS.LOSE], GOAL_TYPE_LABELS['cut']);
registerGoalButton(GOAL_BUTTONS.MAINTAIN, GOAL_TYPE_VALUES[GOAL_BUTTONS.MAINTAIN], GOAL_TYPE_LABELS['maintain']);
registerGoalButton(GOAL_BUTTONS.GAIN, GOAL_TYPE_VALUES[GOAL_BUTTONS.GAIN], GOAL_TYPE_LABELS['bulk']);

// Пол
function registerSexButton(buttonText: string, sexValue: string) {
  bot.hears(buttonText, async (ctx) => {
    const chatId = ctx.message.chat.id;
    const state = getPending(chatId);
    await upsertProfile(chatId, { sex: sexValue });
    if (state?.action === 'onboarding_sex') {
      setPending(chatId, { action: 'onboarding_height' });
      return ctx.reply(
        `✅ Пол сохранён.\n\nШаг 2 из 7 — рост.\nОтправь число в сантиметрах.\nПример: 180`,
        onboardingCancelMenu
      );
    }
    clearPending(chatId);
    await tryAutoCalcNorms(chatId);
    return ctx.reply(`✅ Пол: ${SEX_LABELS[sexValue] ?? sexValue}`, mainMenu);
  });
}
registerSexButton(SEX_BUTTONS.MALE, SEX_VALUES[SEX_BUTTONS.MALE]);
registerSexButton(SEX_BUTTONS.FEMALE, SEX_VALUES[SEX_BUTTONS.FEMALE]);

// Активность
function registerActivityButton(buttonText: string, activityValue: number) {
  bot.hears(buttonText, async (ctx) => {
    const chatId = ctx.message.chat.id;
    const state = getPending(chatId);
    await upsertProfile(chatId, { activityLevel: activityValue });
    if (state?.action === 'onboarding_activity') {
      setPending(chatId, { action: 'onboarding_city' });
      return ctx.reply(
        `✅ Активность сохранена.\n\nШаг 7 из 7 — твой город.\nОтправь название города (например: Москва, Новосибирск).\n\nЭто нужно для правильного времени уведомлений.`,
        onboardingCancelMenu
      );
    }
    clearPending(chatId);
    await tryAutoCalcNorms(chatId);
    return ctx.reply(`✅ Активность: ${ACTIVITY_LABELS[activityValue] ?? activityValue}`, mainMenu);
  });
}
registerActivityButton(ACTIVITY_BUTTONS.SEDENTARY, ACTIVITY_VALUES[ACTIVITY_BUTTONS.SEDENTARY]);
registerActivityButton(ACTIVITY_BUTTONS.LIGHT, ACTIVITY_VALUES[ACTIVITY_BUTTONS.LIGHT]);
registerActivityButton(ACTIVITY_BUTTONS.MODERATE, ACTIVITY_VALUES[ACTIVITY_BUTTONS.MODERATE]);
registerActivityButton(ACTIVITY_BUTTONS.ACTIVE, ACTIVITY_VALUES[ACTIVITY_BUTTONS.ACTIVE]);
registerActivityButton(ACTIVITY_BUTTONS.VERY_ACTIVE, ACTIVITY_VALUES[ACTIVITY_BUTTONS.VERY_ACTIVE]);

// Подменю: выбор способа ввода
bot.hears(MEAL_BUTTONS.TEXT, (ctx) => {
  return ctx.reply('Опиши блюдо текстом.');
});

bot.hears(MEAL_BUTTONS.PHOTO, (ctx) => {
  return ctx.reply('Отправь фото блюда.');
});

bot.hears(MEAL_BUTTONS.VOICE, (ctx) => {
  return ctx.reply('Запиши голосовое сообщение о блюде.');
});

bot.hears(MEAL_BUTTONS.BACK, (ctx) => {
  const chatId = ctx.message.chat.id;
  const state = getPending(chatId);
  if (state?.action === 'onboarding_activity') {
    setPending(chatId, { action: 'onboarding_birthdate' });
    return ctx.reply(
      'Шаг 5 из 7 — дата рождения.\nОтправь в формате ДД.ММ.ГГГГ\nПример: 15.03.1990',
      onboardingCancelMenu
    );
  }
  if (state?.action === 'onboarding_goal') {
    setPending(chatId, { action: 'onboarding_birthdate' });
    return ctx.reply(
      'Шаг 5 из 7 — дата рождения.\nОтправь в формате ДД.ММ.ГГГГ\nПример: 15.03.1990',
      onboardingCancelMenu
    );
  }
  if (state?.action === 'onboarding_sex') {
    clearPending(chatId);
    return ctx.reply('Главное меню:', mainMenu);
  }
  clearPending(chatId);
  return ctx.reply('Главное меню:', mainMenu);
});

// Подменю: выбор типа приёма пищи
function registerMealTypeButton(buttonText: string, mealType: string) {
  bot.hears(buttonText, (ctx) => {
    const chatId = ctx.message.chat.id;
    const label = MEAL_TYPE_LABELS[mealType] ?? mealType;
    setPending(chatId, { action: 'awaiting_meal_input', mealType });
    return ctx.reply(
      `${label} — опиши блюдо, отправь фото или голосовое.`
    );
  });
}

registerMealTypeButton(MEAL_TYPE_BUTTONS.BREAKFAST, 'breakfast');
registerMealTypeButton(MEAL_TYPE_BUTTONS.LUNCH, 'lunch');
registerMealTypeButton(MEAL_TYPE_BUTTONS.DINNER, 'dinner');
registerMealTypeButton(MEAL_TYPE_BUTTONS.SNACK, 'snack');

// Обработчик фото
bot.on(message('photo'), async (ctx) => {
  const chatId = ctx.message.chat.id;
  const state = getPending(chatId);

  if (state?.action === 'awaiting_meal_photo' || state?.action === 'awaiting_meal_input') {
    const processingMsg = await ctx.reply(
      '🔍 Анализирую фото...',
      Markup.inlineKeyboard([[Markup.button.callback('✖️ Отменить', 'cancel_analysis')]])
    );
    processingState.set(chatId, { messageId: processingMsg.message_id, cancelled: false });
    try {
      const photos = ctx.message.photo;
      const photo = photos[photos.length - 1];
      const ps = processingState.get(chatId);
      if (ps?.cancelled) { processingState.delete(chatId); return; }

      const fileLink = await ctx.telegram.getFileLink(photo.file_id);
      const analysis = await analyzeFoodPhoto(fileLink.href);

      const ps2 = processingState.get(chatId);
      if (ps2?.cancelled) { processingState.delete(chatId); return; }
      processingState.delete(chatId);

      const draft: MealDraft = {
        text: analysis.name,
        composition: analysis.composition,
        sourceType: 'photo',
        photoFileId: photo.file_id,
        caloriesKcal: analysis.caloriesKcal,
        proteinG: analysis.proteinG,
        fatG: analysis.fatG,
        carbsG: analysis.carbsG,
        fiberG: analysis.fiberG,
        weightG: analysis.weightG,
      };
      clearPending(chatId);
      setDraft(chatId, draft);
      await ctx.telegram.editMessageText(
        chatId, processingMsg.message_id, undefined,
        formatDraftCard(draft),
        draftActionsMenu
      );
    } catch (err: unknown) {
      processingState.delete(chatId);
      clearPending(chatId);
      const errMsg = err instanceof NotFoodError
        ? '🤔 На фото не видно еды. Пришли чёткое фото тарелки или опиши блюдо текстом.'
        : '⚠️ Не удалось проанализировать фото. Попробуй ещё раз или опиши блюдо текстом.';
      try { await ctx.telegram.editMessageText(chatId, processingMsg.message_id, undefined, errMsg); } catch {}
    }
    return;
  }

  if (state?.action === 'awaiting_draft_edit_photo') {
    const draft = getDraft(chatId);
    if (!draft) {
      clearPending(chatId);
      return ctx.reply('Черновик уже недоступен.', mainMenu);
    }
    const photos = ctx.message.photo;
    const photo = photos[photos.length - 1];
    clearPending(chatId);
    const updatedDraft: MealDraft = { ...draft, sourceType: 'photo', photoFileId: photo.file_id };
    setDraft(chatId, updatedDraft);
    return ctx.reply(formatDraftCard(updatedDraft), draftActionsMenu);
  }

  return ctx.reply('Сейчас фото не ожидается.');
});

// Обработчик голосовых сообщений
bot.on(message('voice'), async (ctx) => {
  const chatId = ctx.message.chat.id;
  const state = getPending(chatId);

  if (state?.action === 'awaiting_meal_voice' || state?.action === 'awaiting_meal_input') {
    const processingMsg = await ctx.reply(
      '🔍 Сохраняю запись...',
      Markup.inlineKeyboard([[Markup.button.callback('✖️ Отменить', 'cancel_analysis')]])
    );
    processingState.set(chatId, { messageId: processingMsg.message_id, cancelled: false });
    try {
      const ps = processingState.get(chatId);
      if (ps?.cancelled) { processingState.delete(chatId); return; }
      processingState.delete(chatId);
      const draft: MealDraft = { text: 'Голосовое описание приёма пищи', sourceType: 'voice', voiceFileId: ctx.message.voice.file_id };
      clearPending(chatId);
      setDraft(chatId, draft);
      await ctx.telegram.editMessageText(
        chatId, processingMsg.message_id, undefined,
        formatDraftCard(draft),
        draftActionsMenu
      );
    } catch {
      processingState.delete(chatId);
      clearPending(chatId);
      try { await ctx.telegram.editMessageText(chatId, processingMsg.message_id, undefined, '⚠️ Не удалось обработать запись. Попробуй ещё раз.'); } catch {}
    }
    return;
  }

  if (state?.action === 'awaiting_draft_edit_voice') {
    const draft = getDraft(chatId);
    if (!draft) {
      clearPending(chatId);
      return ctx.reply('Черновик уже недоступен.', mainMenu);
    }
    clearPending(chatId);
    const updatedDraft: MealDraft = { ...draft, sourceType: 'voice', voiceFileId: ctx.message.voice.file_id };
    setDraft(chatId, updatedDraft);
    return ctx.reply(formatDraftCard(updatedDraft), draftActionsMenu);
  }

  return ctx.reply('Сейчас голосовое не ожидается.');
});

// Текстовый обработчик — проверяет активный сценарий
bot.on('text', async (ctx) => {
  const chatId = ctx.message.chat.id;
  const state = getPending(chatId);

  if (state?.action === 'awaiting_draft_edit') {
    const draft = getDraft(chatId);
    if (!draft) {
      clearPending(chatId);
      return ctx.reply('Черновик уже недоступен.', mainMenu);
    }
    const parts = ctx.message.text.split('|').map((s) => s.trim());
    if (parts.length < 1 || parts.length > 4) {
      return ctx.reply(
        'Нужно от 1 до 4 блоков через |:\nНазвание | состав | ккал/б/ж/у/клетч | вес\nПропусти блок через «-».'
      );
    }
    const updated = { ...draft };
    // Name
    if (parts[0] && parts[0] !== '-') updated.text = parts[0];
    // Composition
    if (parts[1] !== undefined && parts[1] !== '-') updated.composition = parts[1] || undefined;
    // Nutrition
    if (parts[2] !== undefined && parts[2] !== '-') {
      const nums = parts[2].replace(/,/g, '.').split('/').map((s) => parseFloat(s.trim()));
      if (nums.length >= 4 && !nums.slice(0, 4).some(isNaN) && !nums.slice(0, 4).some((n) => n < 0)) {
        [updated.caloriesKcal, updated.proteinG, updated.fatG, updated.carbsG] = nums;
        if (nums[4] !== undefined && !isNaN(nums[4])) updated.fiberG = nums[4];
      } else {
        return ctx.reply('Неверный формат КБЖУ. Нужно 4–5 чисел: ккал/б/ж/у(/клетч)\nПример: 520/42/14/48/6');
      }
    }
    // Weight
    if (parts[3] !== undefined && parts[3] !== '-') {
      const w = parseFloat(parts[3].replace(',', '.'));
      if (!isNaN(w) && w > 0) updated.weightG = w;
      else return ctx.reply('Неверный вес. Введи число больше 0.');
    }
    clearPending(chatId);
    setDraft(chatId, updated);
    return ctx.reply(formatDraftCard(updated), draftActionsMenu);
  }

  if (state?.action === 'awaiting_meal_text' || state?.action === 'awaiting_meal_input') {
    const processingMsg = await ctx.reply(
      '🔍 Анализирую блюдо...',
      Markup.inlineKeyboard([[Markup.button.callback('✖️ Отменить', 'cancel_analysis')]])
    );
    processingState.set(chatId, { messageId: processingMsg.message_id, cancelled: false });
    try {
      const ps = processingState.get(chatId);
      if (ps?.cancelled) { processingState.delete(chatId); return; }

      const analysis = await analyzeFood(ctx.message.text);

      const ps2 = processingState.get(chatId);
      if (ps2?.cancelled) { processingState.delete(chatId); return; }
      processingState.delete(chatId);

      const draft: MealDraft = {
        text: analysis.name,
        composition: analysis.composition,
        sourceType: 'text',
        caloriesKcal: analysis.caloriesKcal,
        proteinG: analysis.proteinG,
        fatG: analysis.fatG,
        carbsG: analysis.carbsG,
        fiberG: analysis.fiberG,
        weightG: analysis.weightG,
      };
      clearPending(chatId);
      setDraft(chatId, draft);
      await ctx.telegram.editMessageText(
        chatId, processingMsg.message_id, undefined,
        formatDraftCard(draft),
        draftActionsMenu
      );
    } catch {
      processingState.delete(chatId);
      clearPending(chatId);
      try { await ctx.telegram.editMessageText(chatId, processingMsg.message_id, undefined, '⚠️ Не удалось проанализировать блюдо. Попробуй ещё раз или добавь вручную через редактирование.'); } catch {}
    }
    return;
  }

  if (state?.action === 'awaiting_height' || state?.action === 'awaiting_weight') {
    clearPending(chatId);
    return ctx.reply('📱 Редактирование физических данных доступно только в приложении.', profileViewMenu);
  }

  if (state?.action === 'awaiting_weight_log') {
    const value = parseFloat(ctx.message.text.trim().replace(',', '.'));
    if (isNaN(value) || value < 30 || value > 300) {
      return ctx.reply('Введи вес числом от 30 до 300 (в килограммах).\nПример: 82 или 75.5');
    }
    clearPending(chatId);
    await addWeightEntry(chatId, value);
    await upsertProfile(chatId, { currentWeightKg: value });
    await tryAutoCalcNorms(chatId);
    return ctx.reply(`✅ Вес записан: ${value} кг`, mainMenu);
  }

  if (state?.action === 'onboarding_height') {
    const value = parseInt(ctx.message.text.trim(), 10);
    if (isNaN(value) || value < 100 || value > 250) {
      return ctx.reply('Введи рост числом от 100 до 250 (в сантиметрах).\nПример: 180');
    }
    await upsertProfile(chatId, { heightCm: value });
    setPending(chatId, { action: 'onboarding_weight' });
    return ctx.reply(
      `✅ Рост: ${value} см\n\nШаг 3 из 7 — вес.\nОтправь число в килограммах.\nПример: 82 или 82.5`,
      onboardingCancelMenu
    );
  }

  if (state?.action === 'onboarding_weight') {
    const value = parseFloat(ctx.message.text.trim().replace(',', '.'));
    if (isNaN(value) || value < 30 || value > 300) {
      return ctx.reply('Введи вес числом от 30 до 300 (в килограммах).\nПример: 82 или 75.5');
    }
    await upsertProfile(chatId, { currentWeightKg: value });
    await addWeightEntry(chatId, value);
    setPending(chatId, { action: 'onboarding_desired_weight' });
    return ctx.reply(
      `✅ Вес: ${value} кг\n\nШаг 4 из 7 — желаемый вес.\nОтправь число в килограммах.\nПример: 78 или 72.5`,
      onboardingCancelMenu
    );
  }

  if (state?.action === 'onboarding_desired_weight') {
    const value = parseFloat(ctx.message.text.trim().replace(',', '.'));
    if (isNaN(value) || value < 30 || value > 300) {
      return ctx.reply('Введи желаемый вес числом от 30 до 300 (в килограммах).\nПример: 78 или 72.5');
    }
    await upsertProfile(chatId, { desiredWeightKg: value });
    setPending(chatId, { action: 'onboarding_birthdate' });
    return ctx.reply(
      `✅ Желаемый вес: ${value} кг\n\nШаг 5 из 7 — дата рождения.\nОтправь в формате ДД.ММ.ГГГГ\nПример: 15.03.1990`,
      onboardingCancelMenu
    );
  }

  if (state?.action === 'onboarding_birthdate') {
    const parts = ctx.message.text.trim().split('.');
    if (parts.length !== 3) {
      return ctx.reply('Введи дату в формате ДД.ММ.ГГГГ\nПример: 15.03.1990');
    }
    const [d, m, y] = parts.map(Number);
    const birthDate = new Date(y, m - 1, d);
    if (isNaN(birthDate.getTime()) || y < 1900 || y > new Date().getFullYear() - 5) {
      return ctx.reply('Неверная дата. Проверь формат ДД.ММ.ГГГГ\nПример: 15.03.1990');
    }
    await upsertProfile(chatId, { birthDate });
    setPending(chatId, { action: 'onboarding_activity' });
    return ctx.reply(
      `✅ Дата рождения сохранена.\n\nШаг 6 из 7 — уровень активности.\nВыбери из вариантов ниже.`,
      activityMenu
    );
  }

  if (state?.action === 'awaiting_birthdate') {
    clearPending(chatId);
    return ctx.reply('📱 Редактирование физических данных доступно только в приложении.', profileViewMenu);
  }

  if (state?.action === 'onboarding_city') {
    const cityInput = ctx.message.text.trim();
    const tz = resolveTimezone(cityInput);
    if (!tz) {
      return ctx.reply(
        `Не удалось определить часовой пояс для города «${cityInput}».\n\nПопробуй другое название или уточни (например: Москва, Екатеринбург, Новосибирск).`
      );
    }
    await upsertProfile(chatId, { city: cityInput, timezone: tz });
    clearPending(chatId);
    await tryAutoCalcNorms(chatId);
    const profile = await getProfile(chatId);
    const normsText = profile?.dailyCaloriesKcal
      ? `\n\n📊 Дневные нормы рассчитаны:\n🔥 ${profile.dailyCaloriesKcal} ккал\n💪 Белки: ${profile.dailyProteinG} г  🧈 Жиры: ${profile.dailyFatG} г  🌾 Углеводы: ${profile.dailyCarbsG} г`
      : '';
    return ctx.reply(`✅ Город: ${cityInput} (${tz})\n\nПрофиль настроен. Можно начинать!${normsText}`, mainMenu);
  }

  if (state?.action === 'awaiting_city' || state?.action === 'awaiting_desired_weight' || state?.action === 'awaiting_notif_time') {
    clearPending(chatId);
    return ctx.reply('📱 Редактирование физических данных и уведомлений доступно только в приложении.', profileViewMenu);
  }

  if (state?.action === 'awaiting_norms') {
    const parts = ctx.message.text.trim().replace(/,/g, '.').split('/').map((s) => parseFloat(s.trim()));
    if (parts.length !== 5 || parts.some(isNaN) || parts.some((n) => n < 0)) {
      return ctx.reply(
        'Неверный формат. Нужно ровно 5 значений:\nккал / белки / жиры / углеводы / клетчатка\n\nПример: 2200/130/70/220/25'
      );
    }
    const [dailyCaloriesKcal, dailyProteinG, dailyFatG, dailyCarbsG, dailyFiberG] = parts;
    clearPending(chatId);
    await upsertProfile(chatId, { dailyCaloriesKcal, dailyProteinG, dailyFatG, dailyCarbsG, dailyFiberG });
    return ctx.reply(
      `Нормы сохранены:\n${dailyCaloriesKcal} ккал · Б: ${dailyProteinG}г · Ж: ${dailyFatG}г · У: ${dailyCarbsG}г · Клетч: ${dailyFiberG}г`,
      mainMenu
    );
  }

  if (state?.action === 'awaiting_nutrition') {
    const mealEntryId = state.mealEntryId;
    if (!mealEntryId) {
      clearPending(chatId);
      return ctx.reply('Что-то пошло не так. Запись еды сохранена, КБЖУ не добавлено.', mainMenu);
    }
    const parts = ctx.message.text.trim().replace(/,/g, '.').split('/').map((s) => parseFloat(s.trim()));
    if (parts.length < 4 || parts.some(isNaN) || parts.some((n) => n < 0)) {
      return ctx.reply(
        'Неверный формат. Введи так:\nккал / белки / жиры / углеводы / клетчатка\n\nПример: 450/30/15/40/8\nКлетчатку можно не указывать: 450/30/15/40'
      );
    }
    const [caloriesKcal, proteinG, fatG, carbsG] = parts;
    const fiberG = parts[4] ?? null;
    clearPending(chatId);
    await updateMealNutrition(mealEntryId, { caloriesKcal, proteinG, fatG, carbsG, fiberG });
    const fiberStr = fiberG != null ? ` · Клетч: ${fiberG}г` : '';
    return ctx.reply(
      `КБЖУ сохранены:\n${caloriesKcal} ккал · Б: ${proteinG}г · Ж: ${fatG}г · У: ${carbsG}г${fiberStr}`,
      mainMenu
    );
  }

  if (state?.action === 'awaiting_meal_photo') {
    return ctx.reply('Жду фото. Отправь его или нажми ⬅️ Назад.');
  }

  if (state?.action === 'awaiting_meal_voice') {
    return ctx.reply('Жду голосовое сообщение. Отправь его или нажми ⬅️ Назад.');
  }

  return ctx.reply('Используй кнопки меню.');
});

// ── Draft: сохранение / отмена / выбор типа ──────────────────────────

bot.action('draft_save', async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const draft = getDraft(chatId);
  if (!draft) {
    return ctx.reply('Запись уже была обработана.', mainMenu);
  }
  try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch {}
  return ctx.reply('Выбери тип приёма пищи:', draftMealTypeMenu);
});

bot.action('draft_save_yesterday', async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const draft = getDraft(chatId);
  if (!draft) {
    return ctx.reply('Запись уже была обработана.', mainMenu);
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(12, 0, 0, 0);
  setDraft(chatId, { ...draft, targetDate: yesterday });
  try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch {}
  return ctx.reply('Выбери тип приёма пищи — сохраним за вчера:', draftMealTypeMenu);
});

bot.action('draft_edit', async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  if (!getDraft(chatId)) {
    return ctx.reply('Черновик уже недоступен.', mainMenu);
  }
  try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch {}
  return ctx.reply('Как хочешь изменить запись?', draftEditModeMenu);
});

bot.action('draft_edit_text', async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  if (!getDraft(chatId)) {
    return ctx.reply('Черновик уже недоступен.', mainMenu);
  }
  setPending(chatId, { action: 'awaiting_draft_edit' });
  try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch {}
  return ctx.reply(
    'Введи данные (можно пропускать блоки через «-»):\nНазвание | состав | ккал/б/ж/у/клетч | вес\n\nПримеры:\n• Полная правка: Курица с рисом | курица, рис | 520/42/14/48/6 | 350\n• Только КБЖУ: - | - | 520/42/14/48/6 | -\n• Только название: Паста | - | - | -',
    Markup.inlineKeyboard([[Markup.button.callback('◀️ Назад', 'draft_edit_back')]])
  );
});

bot.action('draft_edit_photo', async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  if (!getDraft(chatId)) {
    return ctx.reply('Черновик уже недоступен.', mainMenu);
  }
  setPending(chatId, { action: 'awaiting_draft_edit_photo' });
  try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch {}
  return ctx.reply(
    'Отправь новое фото блюда.',
    Markup.inlineKeyboard([[Markup.button.callback('◀️ Назад', 'draft_edit_back')]])
  );
});

bot.action('draft_edit_voice', async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  if (!getDraft(chatId)) {
    return ctx.reply('Черновик уже недоступен.', mainMenu);
  }
  setPending(chatId, { action: 'awaiting_draft_edit_voice' });
  try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch {}
  return ctx.reply(
    'Запиши голосовое с описанием блюда.',
    Markup.inlineKeyboard([[Markup.button.callback('◀️ Назад', 'draft_edit_back')]])
  );
});

bot.action('draft_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  if (!getDraft(chatId)) {
    return ctx.reply('Запись уже была обработана.', mainMenu);
  }
  clearDraft(chatId);
  try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  } catch {}
  return ctx.reply('Запись не сохранена.', mainMenu);
});

const DRAFT_MEAL_TYPE_MAP: Record<string, string> = {
  draft_mt_breakfast: 'breakfast',
  draft_mt_lunch: 'lunch',
  draft_mt_dinner: 'dinner',
  draft_mt_snack: 'snack',
};

bot.action(/^draft_mt_(breakfast|lunch|dinner|snack)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const draft = getDraft(chatId);
  if (!draft) {
    return ctx.reply('Запись уже была обработана.', mainMenu);
  }
  const actionId = (ctx.match as RegExpMatchArray)[0];
  const mealType = DRAFT_MEAL_TYPE_MAP[actionId] ?? 'unknown';
  const isYesterday = !!draft.targetDate;
  const progressDate = isYesterday ? draft.targetDate! : new Date();
  clearDraft(chatId);
  await addMeal(chatId, {
    text: draft.text,
    mealType,
    sourceType: draft.sourceType,
    photoFileId: draft.photoFileId,
    voiceFileId: draft.voiceFileId,
    caloriesKcal: draft.caloriesKcal,
    proteinG: draft.proteinG,
    fatG: draft.fatG,
    carbsG: draft.carbsG,
    fiberG: draft.fiberG,
    ...(isYesterday ? { createdAt: progressDate } : {}),
  });
  const label = MEAL_TYPE_LABELS[mealType] ?? mealType;
  const dateStr = isYesterday ? ' (за вчера)' : '';
  const progressText = await buildDayProgressText(chatId, progressDate);
  try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  } catch {}
  return ctx.reply(`✅ Записано: ${label}${dateStr}.\n\n${progressText}`, addMoreMenu);
});

bot.action('progress_add_more', async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat?.id;
  if (chatId) setPending(chatId, { action: 'awaiting_meal_input' });
  return ctx.reply(
    '🍽 Отправь следующее блюдо.\n\nМожно текстом, фото или голосовым.',
    Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'nav_main_menu')]])
  );
});

bot.action('draft_mt_back', async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const draft = getDraft(chatId);
  if (!draft) {
    return ctx.reply('Запись уже была обработана.', mainMenu);
  }
  // Сбрасываем targetDate — возвращаем к исходной карточке
  const { targetDate: _removed, ...draftWithoutDate } = draft;
  setDraft(chatId, draftWithoutDate);
  try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  } catch {}
  return ctx.reply(formatDraftCard(draftWithoutDate), draftActionsMenu);
});

bot.action('draft_edit_back', async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  clearPending(chatId);
  const draft = getDraft(chatId);
  if (!draft) {
    return ctx.reply('Черновик уже недоступен.', mainMenu);
  }
  try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch {}
  return ctx.reply(formatDraftCard(draft), draftActionsMenu);
});

bot.action('nav_main_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat?.id;
  if (chatId) { clearPending(chatId); clearDraft(chatId); }
  return ctx.reply('Главное меню:', mainMenu);
});

// ── Отмена анализа ───────────────────────────────────────────────────
bot.action('cancel_analysis', async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) { await ctx.answerCbQuery(); return; }
  const ps = processingState.get(chatId);
  if (ps && !ps.cancelled) {
    ps.cancelled = true;
    await ctx.answerCbQuery('Отменено');
    try { await ctx.editMessageText('Анализ отменён.'); } catch {}
    clearPending(chatId);
  } else {
    await ctx.answerCbQuery('Запись уже сохранена');
  }
});

// ── КБЖУ ────────────────────────────────────────────────────────────
bot.action('nutrition_skip', async (ctx) => {
  const chatId = ctx.chat?.id;
  if (chatId) clearPending(chatId);
  await ctx.answerCbQuery();
  return ctx.reply('Запись сохранена.', mainMenu);
});

bot.action('nutrition_add', async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.reply(
    'Введи КБЖУ в формате:\nккал / белки / жиры / углеводы / клетчатка\n\nПример: 450/30/15/40/8\nКлетчатку можно не указывать: 450/30/15/40'
  );
});

// ── Напоминания ─────────────────────────────────────────────────────
async function sendReminders(): Promise<void> {
  // Fetch all enabled reminders
  const reminders = await prisma.mealReminder.findMany({ where: { enabled: true } });
  if (reminders.length === 0) return;

  const chatIds = [...new Set(reminders.map(r => r.chatId))];

  // Fetch profiles for timezone + notificationsEnabled
  const profiles = await prisma.userProfile.findMany({
    where: { chatId: { in: chatIds }, notificationsEnabled: { not: false } },
    select: { chatId: true, timezone: true, preferredName: true },
  });
  const profileMap = new Map(profiles.map(p => [p.chatId, p]));

  for (const chatId of chatIds) {
    const profile = profileMap.get(chatId);
    if (!profile) continue;

    const tz = profile.timezone ?? 'Europe/Moscow';
    const { hour, minute } = getNowInTimezone(tz);
    const nowStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    const due = reminders.filter(r => r.chatId === chatId && r.time === nowStr);
    if (due.length === 0) continue;

    const chatIdNum = Number(chatId);
    const msgs = lastBotMsgs.get(chatIdNum) ?? [];
    while (msgs.length >= 5) {
      const toDelete = msgs.shift()!;
      try { await bot.telegram.deleteMessage(chatId, toDelete); } catch {}
    }

    for (const reminder of due) {
      try {
        const text = pickReminderMessage(chatId, reminder.mealType);
        const sent = await bot.telegram.sendMessage(
          chatId,
          text,
          Markup.inlineKeyboard([
            Markup.button.callback('Добавить приём', 'reminder_add_meal'),
          ])
        );
        msgs.push(sent.message_id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[reminder] не удалось отправить ${chatId}: ${msg}`);
      }
    }

    lastBotMsgs.set(chatIdNum, msgs);
  }
}

setInterval(() => {
  sendReminders().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[reminder] ошибка рассылки:', msg);
  });
}, 60_000);

bot.action('reminder_add_meal', async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat?.id;
  if (chatId) setPending(chatId, { action: 'awaiting_meal_input' });
  return ctx.reply(
    '🍽 Отправь блюдо — и я запишу.\n\nМожно текстом, фото или голосовым.',
    Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'nav_main_menu')]])
  );
});

// ── Профиль: действия (перенесены в mini app) ────────────────────────
const miniAppHint = '📱 Редактирование профиля доступно только в приложении.\nОткрой его через кнопку меню.';

bot.action('profile_set_height', async (ctx) => { await ctx.answerCbQuery(); return ctx.reply(miniAppHint, profileViewMenu); });
bot.action('profile_set_weight', async (ctx) => { await ctx.answerCbQuery(); return ctx.reply(miniAppHint, profileViewMenu); });
bot.action('profile_set_goal', async (ctx) => { await ctx.answerCbQuery(); return ctx.reply(miniAppHint, profileViewMenu); });
bot.action('profile_set_sex', async (ctx) => { await ctx.answerCbQuery(); return ctx.reply(miniAppHint, profileViewMenu); });
bot.action('profile_set_birthdate', async (ctx) => { await ctx.answerCbQuery(); return ctx.reply(miniAppHint, profileViewMenu); });
bot.action('profile_set_activity', async (ctx) => { await ctx.answerCbQuery(); return ctx.reply(miniAppHint, profileViewMenu); });
bot.action('profile_set_desired_weight', async (ctx) => { await ctx.answerCbQuery(); return ctx.reply(miniAppHint, profileViewMenu); });
bot.action('profile_set_city', async (ctx) => { await ctx.answerCbQuery(); return ctx.reply(miniAppHint, profileViewMenu); });

// ── Вес: действия ───────────────────────────────────────────────────
bot.action('weight_log', async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  setPending(chatId, { action: 'awaiting_weight_log' });
  return ctx.reply('Отправь текущий вес в килограммах.\nПример: 82 или 75.5');
});

// ── Статус: действия ─────────────────────────────────────────────────
bot.action('status_delete_last', async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const deleted = await deleteLastTodayMeal(chatId);
  if (!deleted) {
    return ctx.reply('На сегодня нет записей для удаления.');
  }
  return ctx.reply(`Удалил последнюю запись:\n${formatEntry(deleted)}`);
});

bot.action('status_clear_today', async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const count = await clearTodayMeals(chatId);
  if (count === 0) {
    return ctx.reply('На сегодня нет записей для очистки.');
  }
  return ctx.reply(`Очистил все записи за сегодня. Удалено: ${count}`);
});

// ── Настройки: действия ──────────────────────────────────────────────
bot.action('settings_toggle_notifications', async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const profile = await getProfile(chatId);
  const current = profile?.notificationsEnabled !== false;
  await upsertProfile(chatId, { notificationsEnabled: !current });
  const updated = await getProfile(chatId);
  try {
    await ctx.editMessageText(buildSettingsText(updated), buildSettingsKeyboard(updated));
  } catch {}
});

const notifSettingsHint = '📱 Количество и время уведомлений настраиваются только в приложении.';

bot.action('settings_notif_count_dec', async (ctx) => { await ctx.answerCbQuery(); return ctx.reply(notifSettingsHint, profileViewMenu); });
bot.action('settings_notif_count_inc', async (ctx) => { await ctx.answerCbQuery(); return ctx.reply(notifSettingsHint, profileViewMenu); });
bot.action('settings_notif_time', async (ctx) => { await ctx.answerCbQuery(); return ctx.reply(notifSettingsHint, profileViewMenu); });

bot.action('noop', async (ctx) => {
  await ctx.answerCbQuery();
});

// ── Expert / Trainer verification ─────────────────────────────────────
bot.action(/^trainer_approve_(.+)$/, async (ctx) => {
  const targetChatId = ctx.match[1];
  try {
    const current = await prisma.trainerProfile.findUnique({ where: { chatId: targetChatId } });
    if (!current) {
      await ctx.answerCbQuery('⚠️ Профиль тренера не найден');
      return;
    }
    const code = current.referralCode ?? Math.random().toString(36).substring(2, 10).toUpperCase();
    await prisma.trainerProfile.update({
      where: { chatId: targetChatId },
      data: {
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        verifiedByAdminId: String(ctx.from?.id ?? ''),
        referralCode: code,
      },
    });
    await bot.telegram.sendMessage(
      targetChatId,
      '🎉 Твоя заявка тренера одобрена!\n\nТеперь ты можешь переключиться в режим Эксперта в приложении.',
    );
    await ctx.answerCbQuery('✅ Одобрено');
    // Edit admin message using plain text (no HTML parse_mode to avoid escaping issues)
    const originalText = (ctx.callbackQuery.message as { text?: string })?.text ?? '';
    await ctx.editMessageText(`${originalText}\n\n✅ Одобрено администратором (${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })})`).catch(() => null);
  } catch (err) {
    console.error('[trainer_approve]', err);
    await ctx.answerCbQuery('❌ Ошибка при одобрении').catch(() => null);
  }
});

bot.action(/^trainer_reject_(.+)$/, async (ctx) => {
  const targetChatId = ctx.match[1];
  try {
    await prisma.trainerProfile.update({
      where: { chatId: targetChatId },
      data: {
        verificationStatus: 'rejected',
        rejectedAt: new Date(),
      },
    });
    await bot.telegram.sendMessage(
      targetChatId,
      '😔 Твоя заявка тренера была отклонена.\n\nТы можешь подать повторную заявку в приложении.',
    );
    await ctx.answerCbQuery('❌ Отклонено');
    // Edit admin message using plain text
    const originalText = (ctx.callbackQuery.message as { text?: string })?.text ?? '';
    await ctx.editMessageText(`${originalText}\n\n❌ Отклонено администратором (${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })})`).catch(() => null);
  } catch (err) {
    console.error('[trainer_reject]', err);
    await ctx.answerCbQuery('❌ Ошибка при отклонении').catch(() => null);
  }
});

// ── Онбординг: отмена ────────────────────────────────────────────────
bot.action('onboarding_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat?.id;
  if (chatId) clearPending(chatId);
  return ctx.reply('Настройка отменена.', mainMenu);
});

bot.command('test_meal_reminder', async (ctx) => {
  await bot.telegram.sendMessage(
    ctx.message.chat.id,
    'Время отметить приём пищи 🍽\nЗапиши, что ел — это займёт 10 секунд.',
    Markup.inlineKeyboard([
      Markup.button.callback('➕ Добавить приём', 'reminder_add_meal'),
    ])
  );
  return ctx.reply('Тест: напоминание отправлено тебе.');
});

// Catch-all для неподдерживаемых типов сообщений в режиме ожидания еды
bot.on('message', async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const state = getPending(chatId);
  if (state?.action === 'awaiting_meal_input') {
    return ctx.reply('Отправь описание текстом, фото или голосовое сообщение.');
  }
});

createApiServer();

bot.launch()
  .then(() => {
    const username = bot.botInfo?.username;
    if (username && !process.env.BOT_USERNAME) process.env.BOT_USERNAME = username;
    console.log(`Бот @${username ?? process.env.BOT_USERNAME} запущен (polling)`);
  })
  .catch((err: Error) => {
    console.error('Ошибка запуска бота:', err.message);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
