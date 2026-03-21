# Простое Питание

Telegram-бот для отслеживания питания. Позволяет записывать приёмы пищи текстом, фото или голосом, считает КБЖУ, напоминает о еде по расписанию и ведёт дневную статистику. Включает Mini App для клиентов и тренеров.

## Стек

- Node.js + TypeScript
- [Telegraf 4](https://telegraf.js.org/) (polling)
- Prisma ORM + PostgreSQL
- Express 5 (API + статика Mini App)
- React + Vite (Mini App)
- OpenAI GPT-4o-mini (анализ еды по тексту и фото)

## Локальная разработка

```bash
git clone <repo-url>
cd Prostoe_Pitanie
npm install
cp .env.example .env        # заполнить BOT_TOKEN, DATABASE_URL, OPENAI_API_KEY
npm run db:migrate          # создать/обновить таблицы
npm run dev                 # запуск бота с hot reload (без Mini App)
```

Для локальной разработки Mini App (отдельный процесс):
```bash
cd miniapp && npm install
npm run dev                 # Vite dev server → http://localhost:5173
                            # API проксируется на http://localhost:3000
```

### Переменные окружения

| Переменная | Описание |
|------------|----------|
| `BOT_TOKEN` | Токен бота от [@BotFather](https://t.me/BotFather) |
| `DATABASE_URL` | PostgreSQL URL (`postgresql://user:pass@host:5432/db`) |
| `OPENAI_API_KEY` | API-ключ OpenAI для анализа еды (platform.openai.com) |

## Деплой на Railway

### 1. Создать PostgreSQL базу

В Railway: **New Project → Add PostgreSQL**. Railway автоматически добавит переменную `DATABASE_URL` в окружение.

### 2. Создать сервис для бота

**New Service → Deploy from GitHub Repo**.

Настройки в Railway:
- **Build command**: `npm run build`
- **Start command**: `npm start`
- **Environment variables**: добавить `BOT_TOKEN` и `OPENAI_API_KEY`

`DATABASE_URL` подтягивается автоматически из PostgreSQL-сервиса Railway.

### 3. Миграции

При первом деплое `npm start` выполняет `prisma migrate deploy` автоматически перед запуском.

### 4. Mini App URL

После деплоя Mini App доступна по адресу: `https://<your-service>.up.railway.app/`

Зарегистрировать Mini App в боте: открыть [@BotFather](https://t.me/BotFather) → **Edit Bot → Edit Menu Button** → вставить URL сервиса Railway.

## Скрипты

```bash
npm run dev            # разработка (tsx, hot reload — бот без Mini App)
npm run build          # prisma generate + tsc + vite build → dist/ + miniapp/dist/
npm start              # prisma migrate deploy + node dist/index.js
npm run db:migrate     # создать новую миграцию (dev)
npm run db:deploy      # применить миграции (prod)
npm run db:generate    # регенерировать Prisma Client
```

## Архитектура сервиса

Один процесс запускает:
- **Telegram-бот** — polling через Telegraf
- **Express API** — `/api/*` для Mini App, порт `$PORT`
- **Статика Mini App** — собранный Vite build из `miniapp/dist/`

```
PORT (Railway) ──► Express
                    ├── /api/bootstrap      (auth + профиль)
                    ├── /api/nutrition/*    (еда, дневник, статистика)
                    ├── /api/profile/*      (профиль, уведомления)
                    ├── /api/client/*       (управление связью с тренером)
                    ├── /api/trainer/*      (тренерские endpoints)
                    ├── /api/subscription   (подписка)
                    └── /*                 (Mini App SPA fallback)
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
  ai/
    analyzeFood.ts      — анализ еды через OpenAI
  api/
    server.ts           — Express + статика Mini App
    middleware/
      telegramAuth.ts   — HMAC-валидация Telegram initData
    routes/
      bootstrap.ts      — /api/bootstrap
      nutrition.ts      — /api/nutrition/*
      profile.ts        — /api/profile/*
      client.ts         — /api/client/* (управление тренером)
      trainer.ts        — /api/trainer/*
      subscription.ts   — /api/subscription
  keyboards/            — клавиатуры бота
  state/                — in-memory state + Prisma-хелперы
miniapp/
  src/                  — React + Vite приложение
  dist/                 — production build (генерируется при npm run build)
prisma/
  schema.prisma         — схема базы данных
  migrations/           — история миграций
```
