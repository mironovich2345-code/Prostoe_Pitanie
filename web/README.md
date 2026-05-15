# EATLYY Web

Публичный сайт-агрегатор EATLYY. Отдельное Next.js 15 приложение, работающее рядом с Telegram bot и Mini App.

## Стек

- **Next.js 15** (App Router, static generation)
- **TypeScript** (strict)
- **CSS** — переменные в `globals.css`, inline-стили в компонентах

## Структура

```
web/
  app/
    layout.tsx            # Root layout — Header + Footer, метаданные, metadataBase
    globals.css           # CSS-переменные (--accent, --bg, --surface, ...)
    robots.ts             # /robots.txt
    sitemap.ts            # /sitemap.xml
    page.tsx              # /
    clients/page.tsx      # /clients
    experts/page.tsx      # /experts
    trainers/
      page.tsx            # /trainers — каталог экспертов
      [slug]/page.tsx     # /trainers/:slug — карточка эксперта
    legal/page.tsx        # /legal
    support/page.tsx      # /support
  components/
    Header.tsx
    Footer.tsx
    ExpertCard.tsx
  data/
    experts.ts            # Мок-данные экспертов (Phase 1)
  lib/
    api.ts                # API-клиент (Phase 1: мок; Phase 2: реальный backend)
  railway.toml            # Конфигурация деплоя Railway
  .env.example            # Шаблон переменных окружения
```

## Локальный запуск (dev)

```bash
cd web
cp .env.example .env.local   # заполните при необходимости
npm install
npm run dev                  # → http://localhost:3002
```

## Сборка

```bash
npm run build
```

## Локальный production-запуск (после build)

```bash
npm run start:local          # → http://localhost:3002
```

## Переменные окружения

Создайте `web/.env.local` для локальной разработки:

```env
# URL бэкенда БЕЗ /api на конце. Если не задан — по умолчанию https://api.eatlyy.ru.
NEXT_PUBLIC_API_URL=https://api.eatlyy.ru
NEXT_PUBLIC_BOT_URL=https://t.me/EATLYY_bot
NEXT_PUBLIC_SUPPORT_URL=https://t.me/EATLYY_help
NEXT_PUBLIC_SITE_URL=https://eatlyy.ru
```

---

## Деплой на Railway

### Настройки сервиса

| Параметр | Значение |
|---|---|
| **Root Directory** | `web` |
| **Build Command** | `npm run build` |
| **Start Command** | `npm run start` |
| **Watch Paths** | `web/**` |

Railway автоматически читает `web/railway.toml`.

### Переменные окружения в Railway

Добавьте в панели Railway → Variables для сервиса `web`:

```
# БЕЗ /api на конце — next.config.ts сам добавляет /api/:path*
NEXT_PUBLIC_API_URL       = https://api.eatlyy.ru
NEXT_PUBLIC_BOT_URL       = https://t.me/EATLYY_bot
NEXT_PUBLIC_SUPPORT_URL   = https://t.me/EATLYY_help
NEXT_PUBLIC_SITE_URL      = https://eatlyy.ru
NEXT_PUBLIC_BOT_USERNAME  = EATLYY_bot
PORT                      # Railway проставляет автоматически — не трогать
```

### Шаги деплоя

1. Зайдите в Railway Project (тот же, что содержит backend + bot).
2. **New Service → GitHub Repo** (тот же репозиторий).
3. В настройках сервиса укажите **Root Directory: `web`**.
4. Railway подхватит `railway.toml` и выполнит `npm run build`.
5. После деплоя добавьте переменные из таблицы выше.
6. Назначьте домен (Custom Domain или Railway-generated).

### Порты

| Сервис | Dev-порт |
|---|---|
| Express backend | 3000 |
| Mini App (Vite dev) | 5173 |
| Web (Next.js dev) | 3002 |

На Railway PORT передаётся автоматически через переменную окружения `PORT`.

---

## Не трогать

- `src/` — Express backend + Telegraf bot
- `miniapp/` — Telegram Mini App (React + Vite)
- `prisma/` — схема базы данных
