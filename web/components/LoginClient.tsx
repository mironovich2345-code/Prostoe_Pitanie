'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { webApi, ApiError } from '@/lib/webApi';
import MaxLoginButton from '@/components/MaxLoginButton';
import PhoneLoginForm from '@/components/PhoneLoginForm';

declare global {
  interface Window {
    __EATLYY_TG_AUTH_LOGIN__?: (user: Record<string, string | number>) => void;
  }
}

function OrDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px auto', maxWidth: 300 }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>или</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}

interface Props {
  botUsername: string;
}

export default function LoginClient({ botUsername }: Props) {
  const router = useRouter();
  const widgetRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSuccess() {
    router.push('/client');
  }

  useEffect(() => {
    const container = widgetRef.current;
    if (!container) return;

    window.__EATLYY_TG_AUTH_LOGIN__ = async (tgUser) => {
      try {
        await webApi.telegramLogin(tgUser);
        await onSuccess();
      } catch (err) {
        const code = err instanceof ApiError ? err.code : null;
        setError(code ? `Ошибка входа: ${code}` : 'Ошибка входа через Telegram.');
      }
    };

    container.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'window.__EATLYY_TG_AUTH_LOGIN__(user)');
    script.onerror = () => setError('Не удалось загрузить виджет Telegram.');
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
      delete window.__EATLYY_TG_AUTH_LOGIN__;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botUsername]);

  return (
    <div style={{ textAlign: 'center', paddingTop: 8 }}>
      <div style={{ fontSize: 36, marginBottom: 16 }}>👋</div>
      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        Войдите в кабинет EATLYY
      </p>
      <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 28, lineHeight: 1.6 }}>
        Выберите удобный способ входа.
      </p>

      {error && (
        <p style={{ fontSize: 13, color: '#ef5350', marginBottom: 16 }}>{error}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div ref={widgetRef} />
        <OrDivider />
        <MaxLoginButton onSuccess={onSuccess} />
        <OrDivider />
        <PhoneLoginForm onSuccess={onSuccess} />
      </div>
    </div>
  );
}
