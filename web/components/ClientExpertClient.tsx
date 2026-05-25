'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { webApi, ApiError, type ClientExpertRequest } from '@/lib/webApi';
import MaxLoginButton from '@/components/MaxLoginButton';

declare global {
  interface Window {
    __EATLYY_TG_AUTH_CLIENT_EXPERT__?: (user: Record<string, string | number>) => void;
  }
}

type AuthState = 'loading' | 'unauthenticated' | 'authenticated';

interface Props {
  botUsername: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Ожидает ответа', color: 'var(--text-2)' },
  accepted: { label: 'Принята',        color: '#4caf50' },
  rejected: { label: 'Отклонена',      color: 'var(--text-3)' },
  canceled: { label: 'Отменена',       color: 'var(--text-3)' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ClientExpertClient({ botUsername }: Props) {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [requests, setRequests] = useState<ClientExpertRequest[]>([]);
  const [loginError, setLoginError] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const username = botUsername || 'EATLYY_bot';

  async function loadData() {
    const { requests: reqs } = await webApi.getMyClientExpertRequests();
    setRequests(reqs);
    setAuthState('authenticated');
  }

  useEffect(() => {
    webApi.getMe()
      .then(() => loadData())
      .catch(() => setAuthState('unauthenticated'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authState !== 'unauthenticated') return;
    const container = widgetRef.current;
    if (!container) return;

    window.__EATLYY_TG_AUTH_CLIENT_EXPERT__ = async (tgUser) => {
      try {
        await webApi.telegramLogin(tgUser);
        await loadData();
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
    script.setAttribute('data-onauth', 'window.__EATLYY_TG_AUTH_CLIENT_EXPERT__(user)');
    script.onerror = () => setLoginError('Не удалось загрузить виджет Telegram.');
    container.appendChild(script);
    return () => { container.innerHTML = ''; delete window.__EATLYY_TG_AUTH_CLIENT_EXPERT__; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, username]);

  async function handleLogout() {
    await webApi.logout().catch(() => {});
    setRequests([]);
    setAuthState('unauthenticated');
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (authState === 'loading') {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)', fontSize: 14 }}>
        Загрузка…
      </div>
    );
  }

  // ── Not authenticated ────────────────────────────────────────────────────────
  if (authState === 'unauthenticated') {
    return (
      <div style={{ textAlign: 'center', paddingTop: 24 }}>
        <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', color: 'var(--text-3)' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="4" y="9" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Войдите через Telegram</h3>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 360, margin: '0 auto 28px' }}>
          Войдите, чтобы увидеть своего эксперта и статус заявок.
        </p>
        <div ref={widgetRef} style={{ minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }} />
        {loginError && <p style={{ fontSize: 13, color: '#ef5350', marginBottom: 12 }}>{loginError}</p>}
        <OrDivider />
        <MaxLoginButton onSuccess={loadData} />
      </div>
    );
  }

  // ── Authenticated ────────────────────────────────────────────────────────────
  // Priority: accepted → pending → latest rejected/canceled
  const accepted = requests.find(r => r.status === 'accepted');
  const pending  = requests.find(r => r.status === 'pending');
  const lastOther = requests.filter(r => r.status === 'rejected' || r.status === 'canceled')[0] ?? null;
  const primary  = accepted ?? pending ?? lastOther;

  // ── No requests ──────────────────────────────────────────────────────────────
  if (!primary) {
    return (
      <div>
        <AuthBar onLogout={handleLogout} />
        <div style={{ textAlign: 'center', paddingTop: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--text-3)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M4 20c0-4.42 3.58-8 8-8s8 3.58 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, marginBottom: 12 }}>
            У вас пока нет эксперта
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 380, margin: '0 auto 28px' }}>
            Выберите специалиста из каталога и отправьте заявку — эксперт рассмотрит её и ответит вам.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/trainers" className="btn btn-accent" style={{ fontSize: 14, padding: '12px 26px' }}>
              Найти эксперта
            </Link>
            <a
              href={`https://t.me/${username}`}
              target="_blank" rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ fontSize: 14, padding: '12px 22px' }}
            >
              Открыть EATLYY
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Has requests ─────────────────────────────────────────────────────────────
  const history = requests.filter(r => r !== primary);

  return (
    <div>
      <AuthBar onLogout={handleLogout} />

      {primary.status === 'accepted' && <AcceptedBlock req={primary} />}
      {primary.status === 'pending'  && <PendingBlock req={primary} />}
      {(primary.status === 'rejected' || primary.status === 'canceled') && <RejectedBlock req={primary} />}

      {history.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginBottom: 10, letterSpacing: 0.2 }}>
            История заявок
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(r => <HistoryRow key={r.id} req={r} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AuthBar({ onLogout }: { onLogout: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
      <button onClick={onLogout} style={{
        background: 'none', border: 'none', padding: 0,
        color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
      }}>
        Выйти
      </button>
    </div>
  );
}

function ExpertMiniCard({ expert }: { expert: NonNullable<ClientExpertRequest['expert']> }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: 'var(--surface-2)', borderRadius: 'var(--r-lg)',
      padding: '14px 16px', marginBottom: 18,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
        background: 'var(--surface)', border: '1px solid var(--border-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)',
      }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M3 15c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {expert.fullName ?? 'Эксперт'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {[expert.specialization, expert.city].filter(Boolean).join(' · ')}
        </div>
      </div>
      {expert.slug && (
        <Link href={`/trainers/${expert.slug}`} style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>
          Открыть →
        </Link>
      )}
    </div>
  );
}

function AcceptedBlock({ req }: { req: ClientExpertRequest }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-xl)', padding: '24px 22px',
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.25)',
        borderRadius: 20, padding: '6px 14px', marginBottom: 16,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#4caf50' }}>✓ Эксперт подключён</span>
      </div>
      {req.expert && <ExpertMiniCard expert={req.expert} />}
      <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
        Эксперт сможет видеть ваш дневник питания при активном Pro-доступе.
      </p>
    </div>
  );
}

function PendingBlock({ req }: { req: ClientExpertRequest }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-xl)', padding: '24px 22px',
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'var(--accent-dim)', border: '1px solid rgba(215,255,63,0.2)',
        borderRadius: 20, padding: '6px 14px', marginBottom: 16,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>Заявка отправлена</span>
      </div>
      {req.expert && <ExpertMiniCard expert={req.expert} />}
      <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 16 }}>
        Эксперт рассмотрит заявку и ответит в ближайшее время.
        {req.message && (
          <><br /><span style={{ color: 'var(--text-3)', fontSize: 13 }}>Ваше сообщение: «{req.message}»</span></>
        )}
      </p>
      <Link href="/trainers" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'underline' }}>
        Выбрать другого эксперта
      </Link>
    </div>
  );
}

function RejectedBlock({ req }: { req: ClientExpertRequest }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-xl)', padding: '24px 22px',
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '6px 14px', marginBottom: 16,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>
          {req.status === 'canceled' ? 'Отменена' : 'Заявка отклонена'}
        </span>
      </div>
      {req.expert && <ExpertMiniCard expert={req.expert} />}
      <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 18 }}>
        {req.status === 'canceled'
          ? 'Заявка была отменена.'
          : 'Этот эксперт не принял вашу заявку. Вы можете выбрать другого специалиста.'}
      </p>
      <Link href="/trainers" className="btn btn-outline" style={{ fontSize: 14, padding: '10px 22px' }}>
        Выбрать другого эксперта
      </Link>
    </div>
  );
}

function OrDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px auto', maxWidth: 280 }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>или</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}

function HistoryRow({ req }: { req: ClientExpertRequest }) {
  const st = STATUS_LABELS[req.status] ?? { label: req.status, color: 'var(--text-3)' };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '11px 14px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)',
      gap: 12, flexWrap: 'wrap',
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
          {req.expert?.fullName ?? 'Эксперт'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{fmtDate(req.createdAt)}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: st.color }}>{st.label}</span>
        {req.expert?.slug && (
          <Link href={`/trainers/${req.expert.slug}`} style={{ fontSize: 13, color: 'var(--accent)' }}>→</Link>
        )}
      </div>
    </div>
  );
}
