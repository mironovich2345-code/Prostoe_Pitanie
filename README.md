# Простое Питание

Telegram-бот для отслеживания питания. Позволяет записывать приёмы пищи текстом, фото или голосом, считает КБЖУ, напоминает о еде по расписанию и ведёт дневную статистику.

## Стек

- Node.js + TypeScript
- [Telegraf 4](https://telegraf.js.org/) (polling)
- Prisma ORM + PostgreSQL

## Локальная разработка

```bash
git clone <repo-url>
cd Prostoe_Pitanie
npm install
cp .env.example .env   # заполнить BOT_TOKEN и DATABASE_URL
npm run db:migrate     # создать/обновить таблицы
npm run dev            # запуск с hot reload
```

### Переменные окружения

| Переменная | Описание |
|------------|----------|
| `BOT_TOKEN` | Токен бота от [@BotFather](https://t.me/BotFather) |
| `DATABASE_URL` | PostgreSQL URL (`postgresql://user:pass@host:5432/db`) |

## Деплой на Railway

### 1. Создать PostgreSQL базу

В Railway: **New Project → Add PostgreSQL**. Railway автоматически добавит переменную `DATABASE_URL` в окружение.

### 2. Создать сервис для бота

**New Service → Deploy from GitHub Repo**.

Настройки в Railway:
- **Build command**: `npm run build`
- **Start command**: `npm start`
- **Environment variable**: добавить `BOT_TOKEN`

`DATABASE_URL` подтягивается автоматически из PostgreSQL-сервиса Railway.

### 3. Миграции

При первом деплое `npm start` выполняет `prisma migrate deploy` автоматически перед запуском бота.

## Скрипты

```bash
npm run dev          # разработка (tsx, hot reload)
npm run build        # prisma generate + tsc → dist/
npm start            # migrate deploy + запуск dist/index.js
npm run db:migrate   # создать новую миграцию (dev)
npm run db:deploy    # применить миграции (prod)
npm run db:generate  # регенерировать Prisma Client
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
