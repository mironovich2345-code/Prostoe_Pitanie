import { Markup } from 'telegraf';

export const GOAL_BUTTONS = {
  LOSE: '🎯 Похудение',
  MAINTAIN: '⚖️ Поддержание',
  GAIN: '💪 Набор',
  BACK: '⬅️ Назад',
} as const;

export const GOAL_TYPE_VALUES: Record<string, string> = {
  [GOAL_BUTTONS.LOSE]: 'cut',
  [GOAL_BUTTONS.MAINTAIN]: 'maintain',
  [GOAL_BUTTONS.GAIN]: 'bulk',
};

export const GOAL_TYPE_LABELS: Record<string, string> = {
  cut: 'Похудение',
  maintain: 'Поддержание',
  bulk: 'Набор',
  // legacy compatibility
  lose: 'Похудение',
  gain: 'Набор',
  track: 'Контроль',
};

export const SEX_BUTTONS = {
  MALE: '👨 Мужчина',
  FEMALE: '👩 Женщина',
  BACK: '⬅️ Назад',
} as const;

export const SEX_VALUES: Record<string, string> = {
  [SEX_BUTTONS.MALE]: 'male',
  [SEX_BUTTONS.FEMALE]: 'female',
};

export const SEX_LABELS: Record<string, string> = {
  male: 'Мужчина',
  female: 'Женщина',
};

export const ACTIVITY_BUTTONS = {
  SEDENTARY: '🛋 Почти нет',
  LIGHT: '🚶 Лёгкая',
  MODERATE: '🚴 Средняя',
  ACTIVE: '🏋 Высокая',
  VERY_ACTIVE: '⚡ Очень высокая',
  BACK: '⬅️ Назад',
} as const;

export const ACTIVITY_VALUES: Record<string, number> = {
  [ACTIVITY_BUTTONS.SEDENTARY]: 1.2,
  [ACTIVITY_BUTTONS.LIGHT]: 1.375,
  [ACTIVITY_BUTTONS.MODERATE]: 1.55,
  [ACTIVITY_BUTTONS.ACTIVE]: 1.725,
  [ACTIVITY_BUTTONS.VERY_ACTIVE]: 1.9,
};

export const ACTIVITY_LABELS: Record<number, string> = {
  1.2: 'Почти нет',
  1.375: 'Лёгкая',
  1.55: 'Средняя',
  1.725: 'Высокая',
  1.9: 'Очень высокая',
};

export const goalMenu = Markup.keyboard([
  [GOAL_BUTTONS.LOSE, GOAL_BUTTONS.MAINTAIN],
  [GOAL_BUTTONS.GAIN],
  [GOAL_BUTTONS.BACK],
]).resize();

export const sexMenu = Markup.keyboard([
  [SEX_BUTTONS.MALE, SEX_BUTTONS.FEMALE],
  [SEX_BUTTONS.BACK],
]).resize();

export const activityMenu = Markup.keyboard([
  [ACTIVITY_BUTTONS.SEDENTARY, ACTIVITY_BUTTONS.LIGHT],
  [ACTIVITY_BUTTONS.MODERATE, ACTIVITY_BUTTONS.ACTIVE],
  [ACTIVITY_BUTTONS.VERY_ACTIVE],
  [ACTIVITY_BUTTONS.BACK],
]).resize();
