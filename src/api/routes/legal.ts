/**
 * Public legal pages — served without auth.
 * Reads .md files from /legal/ at module load and renders styled HTML.
 * Register BEFORE platformAuthMiddleware and BEFORE express.static in server.ts.
 */

import { Router } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

// ─── Document registry ────────────────────────────────────────────────────────

interface LegalDoc {
  title: string;
  file: string;
  date: string;
}

const LEGAL_DOCS: Record<string, LegalDoc> = {
  'terms':              { title: 'Пользовательское соглашение',              file: 'terms.md',                date: '15.05.2026' },
  'privacy':            { title: 'Политика конфиденциальности',               file: 'privacy.md',               date: '15.05.2026' },
  'personal-data':      { title: 'Согласие на обработку персональных данных', file: 'personal-data-consent.md', date: '15.05.2026' },
  'subscription':       { title: 'Условия подписки и автопродления',          file: 'subscription-terms.md',    date: '15.05.2026' },
  'medical-disclaimer': { title: 'Отказ от медицинской ответственности',      file: 'medical-disclaimer.md',    date: '15.05.2026' },
  'notifications':      { title: 'Согласие на получение уведомлений',         file: 'notification-consent.md',  date: '15.05.2026' },
};

// /legal/ folder is at repo root — 3 levels up from dist/api/routes/ (or src/api/routes/)
const LEGAL_DIR = path.join(__dirname, '..', '..', '..', 'legal');

// Pre-read all docs at startup; log missing files rather than crashing.
const docCache = new Map<string, string>();
for (const [slug, meta] of Object.entries(LEGAL_DOCS)) {
  const filePath = path.join(LEGAL_DIR, meta.file);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw.trim()) {
      console.warn(`[legal] ${meta.file} is empty — slug "${slug}" will 404`);
    } else {
      docCache.set(slug, raw);
    }
  } catch {
    console.warn(`[legal] Could not read ${filePath} — slug "${slug}" will 404`);
  }
}

// ─── Markdown → HTML converter ────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Minimal plain-text-to-HTML converter tuned for EATLYY legal documents.
 * Skips the first skipLines non-empty lines (brand / title / date already in header).
 */
function renderContent(raw: string, skipLines: number): string {
  const lines = raw.split('\n');

  // Skip the first N non-empty lines (brand name, doc title, date)
  let skipped = 0;
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim()) skipped++;
    if (skipped >= skipLines) { bodyStart = i + 1; break; }
  }

  const body = lines.slice(bodyStart).join('\n');
  const chunks = body.split(/\n{2,}/);

  const html: string[] = [];
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    const escaped = escapeHtml(trimmed)
      // bold **text**
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    const chunkLines = escaped.split('\n');
    const firstLine = chunkLines[0];
    const rest = chunkLines.slice(1).join('\n');

    // Top-level section: "1. ALL CAPS TITLE"
    if (/^\d+\.\s+[А-ЯA-ZÀ-ɏ\s«»—,-]{3,}$/.test(firstLine.trim())) {
      html.push(`<div class="section">${firstLine}</div>`);
      if (rest.trim()) html.push(`<p>${rest.replace(/\n/g, '<br>')}</p>`);
      continue;
    }

    // Subsection: "1.1. text" or "1.1.1. text"
    if (/^\d+\.\d+/.test(firstLine.trim())) {
      html.push(`<p class="sub">${escaped.replace(/\n/g, '<br>')}</p>`);
      continue;
    }

    // Regular paragraph
    html.push(`<p>${escaped.replace(/\n/g, '<br>')}</p>`);
  }

  return html.join('\n');
}

// ─── HTML page template ───────────────────────────────────────────────────────

function renderPage(title: string, date: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${escapeHtml(title)} — EATLYY</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #111113;
      --surface: #1a1a1e;
      --text: #e8e8ea;
      --text-2: #a8a8b0;
      --text-3: #68686e;
      --accent: #D7FF3F;
      --border: rgba(255,255,255,0.07);
    }
    html { background: var(--bg); -webkit-text-size-adjust: 100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
      padding: 32px 20px 72px;
      max-width: 720px;
      margin: 0 auto;
    }
    header { margin-bottom: 28px; }
    .brand {
      font-size: 11px; font-weight: 800; letter-spacing: 2px;
      text-transform: uppercase; color: var(--accent); margin-bottom: 14px;
    }
    h1 {
      font-size: clamp(20px, 5vw, 26px);
      font-weight: 700; line-height: 1.3;
      letter-spacing: -0.3px; color: var(--text); margin-bottom: 8px;
    }
    .date { font-size: 13px; color: var(--text-3); margin-top: 6px; }
    .divider { height: 1px; background: var(--border); margin: 24px 0 28px; }
    .content { font-size: 15px; }
    .content p {
      color: var(--text-2); margin-bottom: 12px; line-height: 1.75;
    }
    .content .section {
      font-weight: 700; font-size: 14px; color: var(--text);
      margin-top: 28px; margin-bottom: 10px;
      padding-top: 20px; border-top: 1px solid var(--border);
    }
    .content .section:first-child { margin-top: 0; padding-top: 0; border-top: none; }
    .content .sub { color: var(--text-2); margin-bottom: 10px; font-size: 14px; }
    strong { color: var(--text); font-weight: 600; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 480px) {
      body { padding: 24px 16px 60px; }
      h1 { font-size: 20px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">EATLYY</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="date">Дата редакции: ${escapeHtml(date)}</div>
  </header>
  <div class="divider"></div>
  <div class="content">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.get('/:slug', (req, res) => {
  const { slug } = req.params;
  const meta = LEGAL_DOCS[slug];
  if (!meta) {
    res.status(404).send('<h1>404 — Not Found</h1>');
    return;
  }

  const raw = docCache.get(slug);
  if (!raw) {
    res.status(404).send('<h1>404 — Document not found</h1>');
    return;
  }

  // 3 non-empty lines to skip: brand name, document title, date line
  const bodyHtml = renderContent(raw, 3);
  const html = renderPage(meta.title, meta.date, bodyHtml);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // cache 1 hour on CDN/browser
  res.send(html);
});

export default router;
