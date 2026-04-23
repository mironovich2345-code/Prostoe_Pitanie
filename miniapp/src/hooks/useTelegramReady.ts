import { useEffect, useState } from 'react';

// Cache at module load time — React Router clears location.hash on first navigate().
// snapshot() and hasBridge() are called after navigation, so they must use the cached value.
const _initialHashHasWebAppData: boolean = (() => {
  const h = location.hash;
  if (!h.startsWith('#')) return false;
  try { return new URLSearchParams(h.slice(1)).has('WebAppData'); } catch { return false; }
})();

export type TelegramReadyState = 'waiting' | 'ready' | 'no_bridge';

export interface TgDiag {
  hasTelegram: boolean;
  hasWebApp: boolean;
  version: string | null;
  /** Length of the best available initData (backwards compat for existing consumers) */
  initDataLen: number;
  hasUnsafe: boolean;
  hasUser: boolean;
  // ── Per-source diagnostics ──────────────────────────────────────────────────
  telegramInitDataLen: number;
  maxInitDataLen: number;
  /** True when location.hash starts with #WebAppData= */
  hashWebAppData: boolean;
  selectedSource: 'telegram_bridge' | 'max_bridge' | 'hash' | 'none';
  authHeader: 'x-telegram-init-data' | 'x-max-init-data' | 'none';
}

function snapshot(): TgDiag {
  const wa = window.Telegram?.WebApp;
  const maxWa = window.WebApp;
  const tgInitDataLen = wa?.initData?.length ?? 0;
  const maxInitDataLen = maxWa?.initData?.length ?? 0;
  // Use the module-level cache — location.hash is cleared by React Router after first navigate()
  const hashWebAppData = _initialHashHasWebAppData;

  // Mirror resolveAuthSource() priority — must stay in sync with client.ts
  let selectedSource: TgDiag['selectedSource'] = 'none';
  let authHeader: TgDiag['authHeader'] = 'none';
  if (tgInitDataLen > 0) {
    selectedSource = 'telegram_bridge';
    authHeader = 'x-telegram-init-data';
  } else if (maxInitDataLen > 0) {
    selectedSource = 'max_bridge';
    authHeader = 'x-max-init-data';
  } else if (hashWebAppData) {
    selectedSource = 'hash';
    authHeader = 'x-max-init-data';
  }

  return {
    hasTelegram: !!window.Telegram,
    hasWebApp: !!(wa || maxWa),
    version: wa?.version ?? null,
    initDataLen: tgInitDataLen || maxInitDataLen,
    hasUnsafe: !!wa?.initDataUnsafe,
    hasUser: !!wa?.initDataUnsafe?.user,
    telegramInitDataLen: tgInitDataLen,
    maxInitDataLen,
    hashWebAppData,
    selectedSource,
    authHeader,
  };
}

function hasBridge(): boolean {
  return !!(window.Telegram?.WebApp || window.WebApp || _initialHashHasWebAppData);
}

const POLL_MS = 50;
const TIMEOUT_MS = 1500;

/**
 * Polls for any recognised mini-app bridge (Telegram or MAX) to be available.
 *
 * States:
 *   'waiting'   — still polling, show loading
 *   'ready'     — bridge present or hash data found, safe to fire bootstrap
 *   'no_bridge' — nothing found after TIMEOUT_MS, real browser context
 */
export function useTelegramReady(): { state: TelegramReadyState; diag: TgDiag } {
  const [state, setState] = useState<TelegramReadyState>(() =>
    hasBridge() ? 'ready' : 'waiting',
  );
  const [diag, setDiag] = useState<TgDiag>(snapshot);

  useEffect(() => {
    if (state !== 'waiting') return;

    const start = Date.now();
    const id = setInterval(() => {
      if (hasBridge()) {
        clearInterval(id);
        const d = snapshot();
        setDiag(d);
        console.info(
          `[bridge] found — source=${d.selectedSource} platform=${d.authHeader === 'x-max-init-data' ? 'MAX' : 'Telegram'}`,
          `| version: ${d.version ?? '—'}`,
          `| tgInitData: ${d.telegramInitDataLen}`,
          `| maxInitData: ${d.maxInitDataLen}`,
          `| hashData: ${d.hashWebAppData ? 'present' : 'absent'}`,
        );
        setState('ready');
        return;
      }
      if (Date.now() - start >= TIMEOUT_MS) {
        clearInterval(id);
        const d = snapshot();
        setDiag(d);
        console.warn(
          '[bridge] No bridge after', TIMEOUT_MS, 'ms.',
          '| hasTelegram:', d.hasTelegram,
          '| hasWebApp:', d.hasWebApp,
          '| hashData:', d.hashWebAppData,
        );
        setState('no_bridge');
      }
    }, POLL_MS);

    return () => clearInterval(id);
  }, [state]);

  return { state, diag };
}
