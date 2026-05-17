'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { webApi, ApiError, type WebExpertClientSummary, type WebExpertAccessStatus } from '@/lib/webApi';
import MaxLoginButton from '@/components/MaxLoginButton';

declare global {
  interface Window {
    __EATLYY_TG_AUTH_EXP_CLIENTS__?: (user: Record<string, string | number>) => void;
  }
}

type AuthState = 'loading' | 'unauthenticated' | 'authenticated';

interface Props {
  botUsername: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GOAL_LABELS: Record<string, string> = {
  lose: 'Похудение', maintain: 'Поддержание', gain: 'Набор', track: 'Контроль',
};

const ACCESS_CONFIG: Record<WebExpertAccessStatus, { label: string; color: string; bg: string; border: string }> = {
  active_pro:  { label: 'Pro активен',   color: '#4caf50', bg: 'rgba(76,175,80,0.10)',   border: 'rgba(76,175,80,0.25)' },
  wrong_tariff:{ label: 'Другой тариф',  color: '#ffc107', bg: 'rgba(255,193,7,0.10)',   border: 'rgba(255,193,7,0.25)' },
  unpaid:      { label: 'Не оплачено',   color: '#ef5350', bg: 'rgba(239,83,80,0.10)',   border: 'rgba(239,83,80,0.25)' },
  unknown:     { label: 'Неизвестно',    color: 'var(--text-3)', bg: 'rgba(255,255,255,0.04)', border: 'var(--border)' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OrDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px auto', maxWidth: 280 }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>или</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}

function AccessBadge({ status }: { status: WebExpertAccessStatus }) {
  const cfg = ACCESS_CONFIG[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: 11, fontWeight: 700, letterSpacing: 0.1,
      padding: '4px 10px', borderRadius: 20,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

function ClientRow({ client }: { client: WebExpertClientSummary }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-xl)',
      padding: '18px 20px',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {client.displayName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {[client.city, client.goalType ? GOAL_LABELS[client.goalType] : null].filter(Boolean).join(' · ') || 'Данные не заполнены'}
          </div>
        </div>
        <AccessBadge status={client.accessStatus} />
      </div>

      {/* Metrics row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
        {client.currentWeightKg !== null && (
          <MetricPair
            label="Вес"
            value={`${client.currentWeightKg} кг${client.desiredWeightKg !== null ? ` → ${client.desiredWeightKg} кг` : ''}`}
          />
        )}
        {client.dailyCaloriesKcal !== null && (
          <MetricPair label="Норма" value={`${Math.round(client.dailyCaloriesKcal)} ккал`} />
        )}
        <MetricPair label="Подключён" value={fmtDate(client.connectedAt)} />
      </div>

      {/* Open button */}
      <Link
        href={`/expert/clients/${client.linkId}`}
        style={{
          display: 'inline-flex', alignItems: 'center',
          fontSize: 13, fontWeight: 600,
          color: 'var(--accent)', textDecoration: 'none',
          padding: '7px 16px',
          background: 'var(--accent-dim)',
          border: '1px solid rgba(215,255,63,0.2)',
          borderRadius: 'var(--r-md)',
        }}
      >
        Открыть →
      </Link>
    </div>
  );
}

function MetricPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-3)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>{value}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ExpertClientsClient({ botUsername }: Props) {
  const [authState, setAuthState]   = useState<AuthState>('loading');
  const [notExpert, setNotExpert]   = useState(false);
  const [clients, setClients]       = useState<WebExpertClientSummary[]>([]);
  const [loginError, setLoginError] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const username  = botUsername || 'EATLYY_bot';

  async function loadClients() {
    try {
      const { clients: list } = await webApi.getExpertClients();
      setClients(list);
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
      .then(() => loadClients())
      .catch(() => setAuthState('unauthenticated'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authState !== 'unauthenticated') return;
    const container = widgetRef.current;
    if (!container) return;

    window.__EATLYY_TG_AUTH_EXP_CLIENTS__ = async (tgUser) => {
      try {
        await webApi.telegramLogin(tgUser);
        await loadClients();
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
    script.setAttribute('data-onauth', 'window.__EATLYY_TG_AUTH_EXP_CLIENTS__(user)');
    script.onerror = () => setLoginError('Не удалось загрузить виджет Telegram.');
    container.appendChild(script);
    return () => { container.innerHTML = ''; delete window.__EATLYY_TG_AUTH_EXP_CLIENTS__; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, username]);

  async function handleLogout() {
    await webApi.logout().catch(() => {});
    setClients([]);
    setNotExpert(false);
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
        <div style={{ fontSize: 36, marginBottom: 18 }}>🔒</div>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Войдите в кабинет эксперта</h3>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 360, margin: '0 auto 28px' }}>
          Кабинет клиентов доступен только подтверждённым экспертам EATLYY.
        </p>
        <div ref={widgetRef} style={{ minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }} />
        {loginError && <p style={{ fontSize: 13, color: '#ef5350', marginBottom: 12 }}>{loginError}</p>}
        <OrDivider />
        <MaxLoginButton onSuccess={loadClients} />
      </div>
    );
  }

  // ── Not an expert ────────────────────────────────────────────────────────────

  if (notExpert) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 18 }}>⏳</div>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>
          Кабинет клиентов доступен только подтверждённым экспертам
        </h3>
        <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 420, margin: '0 auto 28px' }}>
          После одобрения вашей заявки командой EATLYY здесь появятся ваши клиенты.
        </p>
        <Link href="/experts/apply" className="btn btn-accent" style={{ fontSize: 15, padding: '14px 32px' }}>
          Подать заявку
        </Link>
        <div style={{ marginTop: 20 }}>
          <button onClick={handleLogout} style={{
            background: 'none', border: 'none', padding: 0,
            color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
          }}>
            Выйти
          </button>
        </div>
      </div>
    );
  }

  // ── Authenticated ─────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Section nav */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Клиенты</span>
        <Link href="/expert/requests" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>Заявки</Link>
        <Link href="/expert/profile"  style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>Профиль</Link>
        <button onClick={handleLogout} style={{
          marginLeft: 'auto', background: 'none', border: 'none', padding: 0,
          color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0,
        }}>
          Выйти
        </button>
      </div>

      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, marginBottom: 20 }}>
        Мои клиенты
        {clients.length > 0 && (
          <span style={{ marginLeft: 10, fontSize: 14, fontWeight: 600, color: 'var(--text-3)' }}>
            {clients.length}
          </span>
        )}
      </div>

      {clients.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 16, paddingBottom: 24 }}>
          <div style={{ fontSize: 44, marginBottom: 18 }}>👥</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Пока нет активных клиентов</h3>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 380, margin: '0 auto 24px' }}>
            Клиенты появятся здесь, когда вы примете их заявки.
          </p>
          <Link href="/expert/requests" className="btn btn-outline" style={{ fontSize: 14, padding: '12px 26px' }}>
            Перейти к заявкам
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {clients.map(c => <ClientRow key={c.linkId} client={c} />)}
        </div>
      )}
    </div>
  );
}
