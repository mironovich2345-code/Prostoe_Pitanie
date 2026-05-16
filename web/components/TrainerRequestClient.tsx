'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { webApi, ApiError } from '@/lib/webApi';

declare global {
  interface Window {
    __EATLYY_TG_AUTH_TRAINER_REQ__?: (user: Record<string, string | number>) => void;
  }
}

type AuthState = 'loading' | 'unauthenticated' | 'authenticated';
type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'canceled' | null;

interface Props {
  trainerSlug: string;
  botUsername: string;
}

function LogoutLink({ onLogout }: { onLogout: () => void }) {
  return (
    <button onClick={onLogout} style={{
      background: 'none', border: 'none', padding: 0,
      color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
    }}>
      Выйти
    </button>
  );
}

export default function TrainerRequestClient({ trainerSlug, botUsername }: Props) {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [isSelf, setIsSelf] = useState(false);
  const [hasPro, setHasPro] = useState<boolean | null>(null);
  const [requestStatus, setRequestStatus] = useState<RequestStatus>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const username = botUsername || 'EATLYY_bot';

  async function loadUserData() {
    const [subResp, requestsResp, profileResp] = await Promise.all([
      webApi.getWebSubscriptionStatus().catch(() => ({ hasPro: false })),
      webApi.getMyClientExpertRequests().catch(() => ({ requests: [] })),
      webApi.getExpertProfile().catch(() => null),
    ]);
    if (profileResp?.profile?.slug === trainerSlug) {
      setIsSelf(true);
      setAuthState('authenticated');
      return;
    }
    setHasPro(subResp.hasPro);
    const match = requestsResp.requests.find(r => r.expert?.slug === trainerSlug);
    setRequestStatus((match?.status as RequestStatus) ?? null);
    setAuthState('authenticated');
  }

  useEffect(() => {
    webApi.getMe()
      .then(() => loadUserData())
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setAuthState('unauthenticated');
        } else {
          setAuthState('unauthenticated');
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Telegram Login Widget mount
  useEffect(() => {
    if (authState !== 'unauthenticated') return;
    const container = widgetRef.current;
    if (!container) return;

    window.__EATLYY_TG_AUTH_TRAINER_REQ__ = async (tgUser) => {
      try {
        await webApi.telegramLogin(tgUser);
        await loadUserData();
      } catch (err) {
        const code = err instanceof ApiError ? err.code : null;
        setLoginError(code ? `Ошибка входа: ${code}` : 'Ошибка входа через Telegram.');
      }
    };

    container.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', username);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'window.__EATLYY_TG_AUTH_TRAINER_REQ__(user)');
    script.onerror = () => setLoginError('Не удалось загрузить виджет Telegram.');
    container.appendChild(script);
    return () => { container.innerHTML = ''; delete window.__EATLYY_TG_AUTH_TRAINER_REQ__; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, username]);

  async function handleLogout() {
    await webApi.logout().catch(() => {});
    setIsSelf(false);
    setHasPro(null);
    setRequestStatus(null);
    setMessage('');
    setSubmitError(null);
    setAuthState('unauthenticated');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await webApi.createClientExpertRequest(trainerSlug, message.trim() || undefined);
      setRequestStatus('pending');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'requires_pro') { setHasPro(false); return; }
        if (err.code === 'pending_exists') { setRequestStatus('pending'); return; }
        if (err.code === 'already_connected') { setRequestStatus('accepted'); return; }
        if (err.code === 'cannot_request_self') { setIsSelf(true); return; }
        setSubmitError(`Ошибка: ${err.code}`);
      } else {
        setSubmitError('Ошибка. Попробуйте ещё раз.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const boxStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-xl)',
    padding: '28px 24px',
    textAlign: 'center',
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (authState === 'loading') {
    return (
      <div style={boxStyle}>
        <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Загрузка…</div>
      </div>
    );
  }

  // ── Self-profile — expert viewing their own public card ──────────────────────
  if (isSelf) {
    return (
      <div style={{ ...boxStyle, textAlign: 'left' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'var(--accent-dim)', border: '1px solid rgba(215,255,63,0.25)',
          borderRadius: 20, padding: '6px 14px', marginBottom: 14,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>Ваша карточка</span>
        </div>
        <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: 20 }}>
          Это ваша публичная карточка эксперта. Клиенты смогут найти вас здесь и отправить заявку.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <Link href="/expert/profile" className="btn btn-accent" style={{ fontSize: 14, padding: '11px 22px' }}>
            Мой профиль
          </Link>
          <Link href="/expert/requests" className="btn btn-outline" style={{ fontSize: 14, padding: '11px 22px' }}>
            Заявки клиентов
          </Link>
        </div>
        <button onClick={handleLogout} style={{
          background: 'none', border: 'none', padding: 0,
          color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
        }}>
          Войти другим аккаунтом
        </button>
      </div>
    );
  }

  // ── Not authenticated — show Telegram Login Widget ───────────────────────────
  if (authState === 'unauthenticated') {
    return (
      <div style={boxStyle}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4, marginBottom: 8 }}>
          Выбрать эксперта
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
          Войдите через Telegram, чтобы отправить заявку эксперту.
        </p>
        <div
          ref={widgetRef}
          style={{ display: 'flex', justifyContent: 'center', minHeight: 48, marginBottom: 12 }}
        />
        {loginError && (
          <p style={{ fontSize: 13, color: '#ef5350', marginTop: 8 }}>{loginError}</p>
        )}
      </div>
    );
  }

  // ── Request status — already sent ────────────────────────────────────────────
  if (requestStatus === 'pending') {
    return (
      <div style={{ ...boxStyle, textAlign: 'left' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.25)',
          borderRadius: 20, padding: '6px 14px', marginBottom: 12,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#4caf50' }}>Заявка отправлена</span>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 14 }}>
          Ваша заявка принята — ожидайте ответа эксперта.
        </p>
        <LogoutLink onLogout={handleLogout} />
      </div>
    );
  }

  if (requestStatus === 'accepted') {
    return (
      <div style={{ ...boxStyle, textAlign: 'left' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(76,175,80,0.12)', border: '1px solid rgba(76,175,80,0.3)',
          borderRadius: 20, padding: '6px 14px', marginBottom: 12,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#4caf50' }}>Эксперт принял заявку</span>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 14 }}>
          Откройте EATLYY в Telegram, чтобы начать работу с экспертом.
        </p>
        <LogoutLink onLogout={handleLogout} />
      </div>
    );
  }

  if (requestStatus === 'rejected') {
    return (
      <div style={{ ...boxStyle, textAlign: 'left' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '6px 14px', marginBottom: 12,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>Заявка отклонена</span>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 16 }}>
          Этот эксперт не принял вашу заявку. Вы можете выбрать другого.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Link href="/trainers" className="btn btn-outline" style={{ fontSize: 14, padding: '10px 22px' }}>
            Смотреть других экспертов
          </Link>
          <LogoutLink onLogout={handleLogout} />
        </div>
      </div>
    );
  }

  // ── No Pro — paywall ─────────────────────────────────────────────────────────
  if (hasPro === false) {
    return (
      <div style={boxStyle}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4, marginBottom: 8 }}>
          Работа с экспертом
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
          Подключение эксперта доступно на Pro.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <Link href="/pricing" className="btn btn-accent" style={{ fontSize: 14, padding: '12px 26px' }}>
            Смотреть тарифы
          </Link>
          <a
            href={`https://t.me/${username}`}
            target="_blank" rel="noopener noreferrer"
            className="btn btn-ghost"
            style={{ fontSize: 14, padding: '12px 22px' }}
          >
            Открыть в Telegram
          </a>
        </div>
        <LogoutLink onLogout={handleLogout} />
      </div>
    );
  }

  // ── Pro active — request form ─────────────────────────────────────────────────
  return (
    <div style={{ ...boxStyle, textAlign: 'left' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.4, marginBottom: 6 }}>
        Выбрать эксперта
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 20 }}>
        Коротко опишите свою цель — эксперт ознакомится с заявкой и ответит вам.
      </p>
      <form onSubmit={handleSubmit}>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Например: хочу похудеть на 10 кг к лету без жёстких диет"
          maxLength={500}
          rows={3}
          style={{
            display: 'block', width: '100%', boxSizing: 'border-box',
            background: 'var(--surface-2)', border: '1px solid var(--border-2)',
            borderRadius: 'var(--r-md)', padding: '11px 14px',
            fontSize: 14, color: 'var(--text)', lineHeight: 1.6,
            fontFamily: 'inherit', outline: 'none', resize: 'vertical',
            marginBottom: 14,
          }}
        />
        {submitError && (
          <p style={{ fontSize: 13, color: '#ef5350', marginBottom: 10 }}>{submitError}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-accent"
          style={{ width: '100%', fontSize: 15, padding: '14px 20px', border: 'none', opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? 'Отправляем…' : 'Отправить заявку'}
        </button>
      </form>
      <div style={{ marginTop: 14 }}>
        <LogoutLink onLogout={handleLogout} />
      </div>
    </div>
  );
}
