import { useEffect, useState } from 'react';

export type TelegramReadyState = 'waiting' | 'ready' | 'timeout';

const POLL_MS = 50;
const TIMEOUT_MS = 1500;

/**
 * Polls for window.Telegram.WebApp.initData to be populated.
 * On iPhone the Telegram native bridge fills initData slightly after the
 * script tag executes, so we must not fire API calls before it is ready.
 *
 * States:
 *   'waiting' — still polling (show loading)
 *   'ready'   — initData present, safe to call bootstrap
 *   'timeout' — initData never appeared (real non-Telegram context → show fallback)
 */
export function useTelegramReady(): TelegramReadyState {
  const [state, setState] = useState<TelegramReadyState>(() =>
    window.Telegram?.WebApp?.initData ? 'ready' : 'waiting',
  );

  useEffect(() => {
    if (state !== 'waiting') return;

    const start = Date.now();
    const id = setInterval(() => {
      if (window.Telegram?.WebApp?.initData) {
        clearInterval(id);
        setState('ready');
        return;
      }
      if (Date.now() - start >= TIMEOUT_MS) {
        clearInterval(id);
        console.warn(
          '[TG] useTelegramReady: initData not populated after', TIMEOUT_MS, 'ms.',
          '| window.Telegram present:', !!window.Telegram,
          '| window.Telegram.WebApp present:', !!(window.Telegram?.WebApp),
          '| initData value:', JSON.stringify(window.Telegram?.WebApp?.initData),
        );
        setState('timeout');
      }
    }, POLL_MS);

    return () => clearInterval(id);
  }, [state]);

  return state;
}
