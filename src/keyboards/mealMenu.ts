import { Markup } from 'telegraf';

export const MEAL_BUTTONS = {
  TEXT: '📝 Текстом',
  PHOTO: '📷 Фото',
  VOICE: '🎤 Голосом',
  BACK: '⬅️ Назад',
} as const;

export const MEAL_TYPE_BUTTONS = {
  BREAKFAST: '🍳 Завтрак',
  LUNCH: '🍲 Обед',
  DINNER: '🍽 Ужин',
  SNACK: '🍎 Перекус',
} as const;

export const mealMenu = Markup.keyboard([
  [MEAL_BUTTONS.TEXT],
  [MEAL_BUTTONS.PHOTO, MEAL_BUTTONS.VOICE],
  [MEAL_BUTTONS.BACK],
]).resize();

export const mealTypeMenu = Markup.keyboard([
  [MEAL_TYPE_BUTTONS.BREAKFAST, MEAL_TYPE_BUTTONS.LUNCH],
  [MEAL_TYPE_BUTTONS.DINNER, MEAL_TYPE_BUTTONS.SNACK],
  [MEAL_BUTTONS.BACK],
]).resize();
