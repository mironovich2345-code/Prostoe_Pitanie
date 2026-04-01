/**
 * Pool of reminder messages per meal type.
 * 6 for breakfast, 6 for lunch, 6 for dinner, 12 for snack.
 * Snack has a wider pool because it can fire from two separate reminders.
 */

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MESSAGES: Record<MealType, readonly string[]> = {
  breakfast: [
    'Утро — хорошее время записать завтрак.',
    'Отметь завтрак, пока помнишь.',
    'Запиши, что было на завтрак.',
    'Завтрак в дневник — день начат правильно.',
    'Сегодняшний завтрак — пора фиксировать.',
    'Время для записи завтрака.',
  ],
  lunch: [
    'Запиши обед, пока свежо в памяти.',
    'Отметь обед в дневнике.',
    'Время записать обед.',
    'Что было на обед? Занеси в дневник.',
    'Обед — добавь в учёт.',
    'Запиши обед — это займёт пару секунд.',
  ],
  dinner: [
    'Запиши ужин, пока не забыл.',
    'Отметь ужин в дневнике.',
    'Вечер — хорошее время зафиксировать приём пищи.',
    'Ужин в дневник — добавь.',
    'Время для записи ужина.',
    'Что было на ужин? Запиши.',
  ],
  snack: [
    'Перекус — занеси в дневник.',
    'Отметь перекус.',
    'Небольшой приём пищи? Запиши.',
    'Перекус в дневник — пара секунд.',
    'Не забудь отметить перекус.',
    'Записал перекус?',
    'Перекус учтён — дневник точнее.',
    'Зафиксируй перекус.',
    'Время для записи перекуса.',
    'Что перекусил? Занеси в дневник.',
    'Небольшой перекус — тоже в учёт.',
    'Отметь, что было в перекус.',
  ],
};

const FALLBACK_POOL: readonly string[] = [
  'Запиши приём пищи.',
  'Отметь, что ел.',
  'Время для записи в дневник.',
];

/** Tracks last 3 used indices per "chatId:mealType" key to avoid repeats. */
const recentHistory = new Map<string, number[]>();

export function pickReminderMessage(chatId: string, mealType: string): string {
  const pool: readonly string[] = MESSAGES[mealType as MealType] ?? FALLBACK_POOL;
  const key = `${chatId}:${mealType}`;
  const used = recentHistory.get(key) ?? [];

  const candidates = pool.map((_, i) => i).filter(i => !used.includes(i));
  const available = candidates.length > 0 ? candidates : pool.map((_, i) => i);

  const idx = available[Math.floor(Math.random() * available.length)];

  // Keep last 3 used indices
  const next = [...used, idx].slice(-3);
  recentHistory.set(key, next);

  return pool[idx];
}
