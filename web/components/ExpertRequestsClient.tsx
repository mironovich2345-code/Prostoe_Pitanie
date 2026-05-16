'use client';

import { useState, useEffect, useRef } from 'react';
import { webApi, ApiError, type ExpertClientRequest } from '@/lib/webApi';
import Link from 'next/link';

declare global {
  interface Window {
    __EATLYY_TG_AUTH_EXP_REQ__?: (user: Record<string, string | number>) => void;
  }
}

type AuthState = 'loading' | 'unauthenticated' | 'authenticated';
type Filter = 'pending' | 'accepted' | 'rejected';

const BOT_USERNAME_FALLBACK = 'EATLYY_bot';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface Props {
  botUsername: string;
}

export default function ExpertRequestsClient({ botUsername }: Props) {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [notExpert, setNotExpert] = useState(false);
  const [requests, setRequests] = useState<ExpertClientRequest[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const username = botUsername || BOT_USERNAME_FALLBACK;

  async function loadRequests() {
    try {
      const { requests: reqs } = await webApi.getExpertClientRequests();
      setRequests(reqs);
      setAuthState('authenticated');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'not_expert') {
        setNotExpert(true);
        setAuthState('authenticated');
      } else {
        setAuthState('unauthenticated');
      }
    }
  }

  useEffect(() => {
    webApi.getMe()
      .then(() => loadRequests())
      .catch(() => setAuthState('unauthenticated'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authState !== 'unauthenticated') return;
    const container = widgetRef.current;
    if (!container) return;

    window.__EATLYY_TG_AUTH_EXP_REQ__ = async (tgUser) => {
      try {
        await webApi.telegramLogin(tgUser);
        await loadRequests();
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
    script.setAttribute('data-onauth', 'window.__EATLYY_TG_AUTH_EXP_REQ__(user)');
    script.onerror = () => setLoginError('Не удалось загрузить виджет Telegram.');
    container.appendChild(script);
    return () => { container.innerHTML = ''; delete window.__EATLYY_TG_AUTH_EXP_REQ__; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, username]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  async function handleAccept(id: string) {
    setActionPending(id);
    try {
      await webApi.acceptExpertClientRequest(id);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'accepted' as const } : r));
      showToast('Клиент подключён');
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      showToast(code === 'not_pending' ? 'Заявка уже обработана' : 'Ошибка. Попробуйте ещё раз.');
    } finally {
      setActionPending(null);
    }
  }

  async function handleReject(id: string) {
    setActionPending(id);
    try {
      await webApi.rejectExpertClientRequest(id);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' as const } : r));
      showToast('Заявка отклонена');
    } catch {
      showToast('Ошибка. Попробуйте ещё раз.');
    } finally {
      setActionPending(null);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (authState === 'loading') {
    return <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)', fontSize: 14 }}>Загрузка…</div>;
  }

  // ── Not authenticated ────────────────────────────────────────────────────────
  if (authState === 'unauthenticated') {
    return (
      <div style={{ textAlign: 'center', paddingTop: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 18 }}>🔒</div>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Войдите через Telegram</h3>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 360, margin: '0 auto 28px' }}>
          Раздел заявок доступен только одобренным экспертам EATLYY.
        </p>
        <div ref={widgetRef} style={{ minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }} />
        {loginError && <p style={{ fontSize: 13, color: '#ef5350' }}>{loginError}</p>}
      </div>
    );
  }

  // ── Not an expert ────────────────────────────────────────────────────────────
  if (notExpert) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 18 }}>⏳</div>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Раздел доступен одобренным экспертам</h3>
        <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 420, margin: '0 auto 28px' }}>
          Заявки клиентов доступны после одобрения вашей заявки командой EATLYY.
        </p>
        <Link href="/experts/apply" className="btn btn-accent" style={{ fontSize: 15, padding: '14px 32px' }}>
          Подать заявку
        </Link>
      </div>
    );
  }

  // ── Expert view ──────────────────────────────────────────────────────────────
  const filtered = requests.filter(r => r.status === filter);
  const counts = {
    pending: requests.filter(r => r.status === 'pending').length,
    accepted: requests.filter(r => r.status === 'accepted').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, marginBottom: 20 }}>
        Заявки клиентов
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['pending', 'accepted', 'rejected'] as const).map(f => {
          const labels: Record<Filter, string> = { pending: 'Ожидают', accepted: 'Принятые', rejected: 'Отклонённые' };
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: filter === f ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: filter === f ? 'var(--accent-dim)' : 'var(--surface)',
                color: filter === f ? 'var(--accent)' : 'var(--text-2)',
              }}
            >
              {labels[f]}{counts[f] > 0 ? ` (${counts[f]})` : ''}
            </button>
          );
        })}
      </div>

      {/* Request list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(req => {
          const busy = actionPending === req.id;
          return (
            <div
              key={req.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)',
                padding: '18px 20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 3 }}>
                    {req.client.displayName}
                    {req.client.telegramUsername && (
                      <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400, marginLeft: 8 }}>
                        @{req.client.telegramUsername}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: req.message ? 10 : 0 }}>
                    {fmtDate(req.createdAt)}
                  </div>
                  {req.message && (
                    <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
                      {req.message}
                    </p>
                  )}
                </div>

                {req.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => handleAccept(req.id)}
                      disabled={busy}
                      style={{
                        padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
                        background: 'rgba(76,175,80,0.15)', color: '#4caf50',
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      {busy ? '…' : 'Принять'}
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={busy}
                      style={{
                        padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-3)',
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      {busy ? '…' : 'Отклонить'}
                    </button>
                  </div>
                )}

                {req.status === 'accepted' && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#4caf50', flexShrink: 0 }}>
                    ✓ Подключён
                  </span>
                )}
                {req.status === 'rejected' && (
                  <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>
                    Отклонено
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontSize: 14 }}>
          {filter === 'pending' ? 'Новых заявок нет' : 'Нет записей'}
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--accent)', color: '#000', fontWeight: 700,
          padding: '10px 22px', borderRadius: 24, fontSize: 14, zIndex: 999, whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
