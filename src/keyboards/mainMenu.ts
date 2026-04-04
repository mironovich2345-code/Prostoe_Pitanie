import { Markup } from 'telegraf';

export const BUTTONS = {
  ADD_MEAL: '🍽 Добавить приём пищи',
  PROFILE: '👤 Профиль',
  SETTINGS: '⚙️ Настройки',
} as const;

export const mainMenu = Markup.keyboard([
  [BUTTONS.ADD_MEAL],
]).resize();
