# Простое Питание

Telegram-бот для отслеживания питания. Позволяет записывать приёмы пищи текстом, фото или голосом, считает КБЖУ, напоминает о еде по расписанию и ведёт дневную статистику.

## Стек

- Node.js + TypeScript
- [Telegraf 4](https://telegraf.js.org/) (polling)
- Prisma ORM + SQLite

## Установка

```bash
git clone <repo-url>
cd Prostoe_Pitanie
npm install
```

## Настройка

1. Скопируй `.env.example` в `.env`:

```bash
cp .env.example .env
```

2. Заполни переменные в `.env`:

| Переменная | Описание |
|------------|----------|
| `BOT_TOKEN` | Токен бота от [@BotFather](https://t.me/BotFather) |
| `DATABASE_URL` | Путь к SQLite базе (по умолчанию `file:./prisma/dev.db`) |

## База данных

Инициализировать или обновить схему:

```bash
npm run db:migrate
```

Или только синхронизировать схему без создания migration-файла (для разработки):

```bash
npx prisma db push
```

## Запуск

```bash
# Разработка (hot reload через tsx)
npm run dev

# Сборка
npm run build

# Запуск из собранного dist/
npm start
```

## Команды бота

| Команда | Описание |
|---------|----------|
| `/start` | Запуск и онбординг профиля |
| `/menu` | Главное меню |
| `/today` | Статистика за сегодня |
| `/cancel` | Отмена текущего действия |
| `/profile` | Открыть профиль |
| `/weight` | История веса |
| `/delete_last` | Удалить последнюю запись за сегодня |
| `/clear_today` | Очистить все записи за сегодня |
| `/test_meal_reminder` | Протестировать напоминание |

## Структура проекта

```
src/
  index.ts              — основная логика бота
  db.ts                 — Prisma Client singleton
  keyboards/
    mainMenu.ts         — главное меню
    mealMenu.ts         — меню добавления еды
    profileMenu.ts      — клавиатуры профиля (пол, активность, цель)
  state/
    pendingActions.ts   — in-memory состояние диалогов
    mealStore.ts        — работа с записями еды
    profileStore.ts     — работа с профилем пользователя
    weightStore.ts      — история веса
prisma/
  schema.prisma         — схема базы данных
  migrations/           — история миграций
```
