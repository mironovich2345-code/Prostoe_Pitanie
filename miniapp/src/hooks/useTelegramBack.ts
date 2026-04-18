import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Shows Telegram's native BackButton for the duration the component is mounted,
 * registers navigate(-1) as its handler, and cleans up on unmount.
 *
 * Use on individual screens that need to override the centralized TelegramNavSync
 * behavior (e.g. multi-step flows with custom back logic).
 */
export function useTelegramBack(customHandler?: () => void) {
  const navigate = useNavigate();

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg?.BackButton) return;

    const handler = customHandler ?? (() => navigate(-1));
    tg.BackButton.show();
    tg.BackButton.onClick(handler);

    return () => {
      tg.BackButton.offClick(handler);
      tg.BackButton.hide();
    };
  // customHandler is expected to be stable (useCallback) at call site
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
