'use client';

import { useState, useEffect, useRef } from 'react';

type FlowState = 'idle' | 'waiting' | 'expired' | 'error';

interface Props {
  onSuccess: () => Promise<void>;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_DURATION_MS = 3 * 60 * 1000; // 3 minutes

export default function MaxLoginButton({ onSuccess }: Props) {
  const [state, setState] = useState<FlowState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    elapsedRef.current = 0;
  }

  useEffect(() => {
    return () => stopPolling();
  }, []);

  function reset() {
    stopPolling();
    setErrorMsg(null);
    setState('idle');
  }

  async function handleClick() {
    setState('waiting');
    setErrorMsg(null);

    let tokenValue: string;
    try {
      const resp = await fetch('/api/web-auth/max/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({})) as Record<string, string>;
        if (body.error === 'max_not_configured') {
          setErrorMsg('MAX-авторизация недоступна. Попробуйте войти через Telegram.');
        } else {
          setErrorMsg('Ошибка запуска входа. Попробуйте ещё раз.');
        }
        setState('error');
        return;
      }
      const data = await resp.json() as { token: string; deeplink: string };
      tokenValue = data.token;

      // Open MAX deeplink in a new tab
      window.open(data.deeplink, '_blank', 'noopener,noreferrer');
    } catch {
      setErrorMsg('Ошибка сети. Попробуйте ещё раз.');
      setState('error');
      return;
    }

    // Poll for confirmation
    elapsedRef.current = 0;
    intervalRef.current = setInterval(async () => {
      elapsedRef.current += POLL_INTERVAL_MS;
      if (elapsedRef.current > MAX_POLL_DURATION_MS) {
        stopPolling();
        setState('expired');
        return;
      }

      try {
        const statusResp = await fetch(
          `/api/web-auth/max/status?token=${encodeURIComponent(tokenValue)}`,
          { credentials: 'include' },
        );
        if (!statusResp.ok) {
          // Transient error — keep polling
          return;
        }
        const status = await statusResp.json() as { status: string };

        if (status.status === 'confirmed') {
          stopPolling();
          try {
            await onSuccess();
          } catch {
            setState('error');
            setErrorMsg('Вход подтверждён, но произошла ошибка загрузки данных. Обновите страницу.');
          }
          return;
        }

        if (status.status === 'expired' || status.status === 'canceled') {
          stopPolling();
          setState('expired');
        }
        // 'pending' → keep polling
      } catch {
        // Network error — keep polling silently
      }
    }, POLL_INTERVAL_MS);
  }

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    background: 'var(--surface)',
    border: '1px solid var(--border-2)',
    borderRadius: 8, padding: '10px 20px',
    fontSize: 14, fontWeight: 600, color: 'var(--text-2)',
    cursor: 'pointer', whiteSpace: 'nowrap',
  };

  if (state === 'idle') {
    return (
      <button onClick={handleClick} style={btnStyle}>
        <MaxLogo />
        Войти через MAX
      </button>
    );
  }

  if (state === 'waiting') {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 10 }}>
          Откройте MAX и запустите бота.
          <br />
          Вход подтвердится автоматически.
        </p>
        <button onClick={reset} style={{
          background: 'none', border: 'none', padding: 0,
          color: 'var(--text-3)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline',
        }}>
          Отмена
        </button>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8 }}>
          Ссылка устарела.
        </p>
        <button onClick={reset} style={btnStyle}>
          <MaxLogo />
          Попробовать снова
        </button>
      </div>
    );
  }

  // error
  return (
    <div style={{ textAlign: 'center' }}>
      {errorMsg && (
        <p style={{ fontSize: 13, color: '#ef5350', marginBottom: 8 }}>{errorMsg}</p>
      )}
      <button onClick={reset} style={btnStyle}>
        <MaxLogo />
        Попробовать снова
      </button>
    </div>
  );
}

function MaxLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#005FF9" />
      <path d="M6 17.5L10.5 7.5L14 13.5L17.5 7.5L19 17.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
