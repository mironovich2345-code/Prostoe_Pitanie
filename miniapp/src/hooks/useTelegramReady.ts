import { useEffect, useState } from 'react';

export type TelegramReadyState = 'waiting' | 'ready' | 'no_bridge';

export interface TgDiag {
  hasTelegram: boolean;
  hasWebApp: boolean;
  version: string | null;
  initDataLen: number;
  hasUnsafe: boolean;
  hasUser: boolean;
}

function snapshot(): TgDiag {
  const wa = window.Telegram?.WebApp;
  return {
    hasTelegram: !!window.Telegram,
    hasWebApp: !!wa,
    version: wa?.version ?? null,
    initDataLen: wa?.initData?.length ?? 0,
    hasUnsafe: !!wa?.initDataUnsafe,
    hasUser: !!wa?.initDataUnsafe?.user,
  };
}

const POLL_MS = 50;
const TIMEOUT_MS = 1500;

/**
 * Polls for window.Telegram.WebApp to be present (NOT for initData — initData
 * may arrive slightly later on iOS and is validated server-side).
 *
 * States:
 *   'waiting'   — still polling, show loading
 *   'ready'     — WebApp object present, safe to fire bootstrap
 *   'no_bridge' — no WebApp after TIMEOUT_MS, real non-Telegram context
 */
export function useTelegramReady(): { state: TelegramReadyState; diag: TgDiag } {
  const [state, setState] = useState<TelegramReadyState>(() =>
    window.Telegram?.WebApp ? 'ready' : 'waiting',
  );
  const [diag, setDiag] = useState<TgDiag>(snapshot);

  useEffect(() => {
    if (state !== 'waiting') return;

    const start = Date.now();
    const id = setInterval(() => {
      if (window.Telegram?.WebApp) {
        clearInterval(id);
        const d = snapshot();
        setDiag(d);
        console.info(
          '[TG] WebApp found.',
          '| version:', d.version,
          '| initData:', d.initDataLen > 0 ? `${d.initDataLen} chars` : 'EMPTY',
          '| user:', d.hasUser,
        );
        setState('ready');
        return;
      }
      if (Date.now() - start >= TIMEOUT_MS) {
        clearInterval(id);
        const d = snapshot();
        setDiag(d);
        console.warn(
          '[TG] No WebApp after', TIMEOUT_MS, 'ms.',
          '| hasTelegram:', d.hasTelegram,
          '| hasWebApp:', d.hasWebApp,
        );
        setState('no_bridge');
      }
    }, POLL_MS);

    return () => clearInterval(id);
  }, [state]);

  return { state, diag };
}
