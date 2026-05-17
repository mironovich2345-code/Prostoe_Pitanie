'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { webApi, ApiError, type WebExpertClientDetail, type WebExpertAccessStatus } from '@/lib/webApi';
import MaxLoginButton from '@/components/MaxLoginButton';

declare global {
  interface Window {
    __EATLYY_TG_AUTH_EXP_CARD__?: (user: Record<string, string | number>) => void;
  }
}

type AuthState = 'loading' | 'unauthenticated' | 'authenticated';

interface Props {
  botUsername: string;
  linkId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GOAL_LABELS: Record<string, string> = {
  lose: 'Похудение', maintain: 'Поддержание', gain: 'Набор веса', track: 'Контроль',
};

const ACCESS_CONFIG: Record<WebExpertAccessStatus, { label: string; color: string; bg: string; border: string; message: string }> = {
  active_pro: {
    label: 'Pro активен', color: '#4caf50', bg: 'rgba(76,175,80,0.10)', border: 'rgba(76,175,80,0.25)',
    message: 'Доступ активен. Клиент подключён к Pro.',
  },
  wrong_tariff: {
    label: 'Другой тариф', color: '#ffc107', bg: 'rgba(255,193,7,0.10)', border: 'rgba(255,193,7,0.25)',
    message: 'У клиента активен тариф без работы с экспертом. Расширенные данные ограничены.',
  },
  unpaid: {
    label: 'Не оплачено', color: '#ef5350', bg: 'rgba(239,83,80,0.10)', border: 'rgba(239,83,80,0.25)',
    message: 'Клиент не оплатил Pro. Просмотр расширенных данных ограничен.',
  },
  unknown: {
    label: 'Неизвестно', color: 'var(--text-3)', bg: 'rgba(255,255,255,0.04)', border: 'var(--border)',
    message: 'Не удалось определить статус доступа клиента.',
  },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
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

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-xl)', padding: '20px 22px', marginBottom: 12,
      ...style,
    }}>
      {children}
    </div>
  );
}

function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}

function MacroTile({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div style={{
      flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '12px 6px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5, color: 'var(--text)', lineHeight: 1 }}>
        {value !== null ? Math.round(value) : '—'}
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-3)', marginTop: 4 }}>
        {label}
      </div>
      {value !== null && (
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{unit}</div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ExpertClientCardClient({ botUsername, linkId }: Props) {
  const [authState, setAuthState]   = useState<AuthState>('loading');
  const [notExpert, setNotExpert]   = useState(false);
  const [notFound, setNotFound]     = useState(false);
  const [client, setClient]         = useState<WebExpertClientDetail | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const username  = botUsername || 'EATLYY_bot';

  async function loadCard() {
    try {
      const { client: c } = await webApi.getExpertClient(linkId);
      setClient(c);
      setAuthState('authenticated');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'not_expert') { setNotExpert(true); setAuthState('authenticated'); return; }
        if (err.status === 404 || err.code === 'not_found') { setNotFound(true); setAuthState('authenticated'); return; }
        if (err.status === 403) { setNotFound(true); setAuthState('authenticated'); return; }
      }
      setAuthState('unauthenticated');
    }
  }

  useEffect(() => {
    webApi.getMe()
      .then(() => loadCard())
      .catch(() => setAuthState('unauthenticated'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authState !== 'unauthenticated') return;
    const container = widgetRef.current;
    if (!container) return;

    window.__EATLYY_TG_AUTH_EXP_CARD__ = async (tgUser) => {
      try {
        await webApi.telegramLogin(tgUser);
        await loadCard();
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
    script.setAttribute('data-onauth', 'window.__EATLYY_TG_AUTH_EXP_CARD__(user)');
    script.onerror = () => setLoginError('Не удалось загрузить виджет Telegram.');
    container.appendChild(script);
    return () => { container.innerHTML = ''; delete window.__EATLYY_TG_AUTH_EXP_CARD__; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, username]);

  async function handleLogout() {
    await webApi.logout().catch(() => {});
    setClient(null);
    setNotExpert(false);
    setNotFound(false);
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
          Карточка клиента доступна только подтверждённым экспертам EATLYY.
        </p>
        <div ref={widgetRef} style={{ minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }} />
        {loginError && <p style={{ fontSize: 13, color: '#ef5350', marginBottom: 12 }}>{loginError}</p>}
        <OrDivider />
        <MaxLoginButton onSuccess={loadCard} />
      </div>
    );
  }

  // ── Not expert ────────────────────────────────────────────────────────────────

  if (notExpert) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 18 }}>⏳</div>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>
          Кабинет клиентов доступен только подтверждённым экспертам
        </h3>
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

  // ── Not found / forbidden ─────────────────────────────────────────────────────

  if (notFound || !client) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 18 }}>🔍</div>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Клиент не найден</h3>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 24 }}>
          Эта карточка недоступна или соединение уже неактивно.
        </p>
        <Link href="/expert/clients" className="btn btn-outline" style={{ fontSize: 14, padding: '11px 24px' }}>
          ← Вернуться к клиентам
        </Link>
      </div>
    );
  }

  // ── Client card ───────────────────────────────────────────────────────────────

  const accessCfg = ACCESS_CONFIG[client.accessStatus];
  const hasMacros = client.dailyCaloriesKcal !== null;

  return (
    <div>
      {/* Section nav */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <Link href="/expert/clients"   style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Клиенты</Link>
        <Link href="/expert/requests"  style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>Заявки</Link>
        <Link href="/expert/profile"   style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>Профиль</Link>
        <button onClick={handleLogout} style={{
          marginLeft: 'auto', background: 'none', border: 'none', padding: 0,
          color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0,
        }}>
          Выйти
        </button>
      </div>

      {/* Client name + access badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.6, lineHeight: 1.1, marginBottom: 4 }}>
            {client.displayName}
          </div>
          {client.username && (
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>@{client.username}</div>
          )}
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          fontSize: 11, fontWeight: 700, letterSpacing: 0.1,
          padding: '5px 12px', borderRadius: 20,
          color: accessCfg.color, background: accessCfg.bg, border: `1px solid ${accessCfg.border}`,
          whiteSpace: 'nowrap', flexShrink: 0, marginTop: 4,
        }}>
          {accessCfg.label}
        </span>
      </div>

      {/* Profile data */}
      <Card>
        <SLabel>Данные клиента</SLabel>
        <Row label="Город"        value={client.city} />
        <Row label="Цель"         value={client.goalType ? (GOAL_LABELS[client.goalType] ?? client.goalType) : null} />
        <Row label="Рост"         value={client.heightCm         ? `${client.heightCm} см`        : null} />
        <Row label="Вес"          value={client.currentWeightKg  ? `${client.currentWeightKg} кг` : null} />
        <Row label="Желаемый вес" value={client.desiredWeightKg  ? `${client.desiredWeightKg} кг` : null} />
        <Row label="Подключён"    value={fmtDate(client.connectedAt)} />
        {!client.city && !client.goalType && !client.heightCm && !client.currentWeightKg && (
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Клиент ещё не заполнил анкету.</div>
        )}
      </Card>

      {/* КБЖУ */}
      <Card>
        <SLabel>Норма КБЖУ</SLabel>
        {hasMacros ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <MacroTile label="Калории"  value={client.dailyCaloriesKcal} unit="ккал" />
            <MacroTile label="Белки"    value={client.dailyProteinG}     unit="г" />
            <MacroTile label="Жиры"     value={client.dailyFatG}         unit="г" />
            <MacroTile label="Углеводы" value={client.dailyCarbsG}       unit="г" />
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Норма не рассчитана — клиент ещё не заполнил все данные профиля.
          </div>
        )}
      </Card>

      {/* Access status */}
      <Card style={{ borderColor: accessCfg.border }}>
        <SLabel>Статус доступа</SLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
            color: accessCfg.color, background: accessCfg.bg, border: `1px solid ${accessCfg.border}`,
          }}>
            {accessCfg.label}
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
          {accessCfg.message}
        </p>
        {client.subscription?.currentPeriodEnd && (
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
            Подписка до: {fmtDate(client.subscription.currentPeriodEnd)}
          </p>
        )}
      </Card>

      {/* Diary stub */}
      <Card style={{ borderStyle: 'dashed' }}>
        <SLabel>Дневник питания</SLabel>
        <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6 }}>
          Дневник питания появится на следующем этапе.
        </p>
      </Card>
    </div>
  );
}
