'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { webApi, ApiError, type WebCompanyStats } from '@/lib/webApi';
import MaxLoginButton from '@/components/MaxLoginButton';
import CompanyNav from '@/components/CompanyNav';

declare global {
  interface Window {
    __EATLYY_TG_AUTH_COMPANY_STATS__?: (user: Record<string, string | number>) => void;
  }
}

const BOT_USERNAME_FALLBACK = 'EATLYY_bot';

function fmtRub(n: number) { return n.toLocaleString('ru') + ' ₽'; }

interface Props { botUsername: string }

export default function CompanyStatsClient({ botUsername }: Props) {
  const [authState, setAuthState]   = useState<'loading' | 'unauthenticated' | 'authenticated'>('loading');
  const [notCompany, setNotCompany] = useState(false);
  const [stats, setStats]           = useState<WebCompanyStats | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const username  = botUsername || BOT_USERNAME_FALLBACK;

  async function loadData() {
    try {
      const resp = await webApi.getCompanyStats();
      setStats(resp.stats);
      setAuthState('authenticated');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'not_company') {
        setNotCompany(true);
        setAuthState('authenticated');
      } else {
        setAuthState('unauthenticated');
      }
    }
  }

  useEffect(() => {
    webApi.getMe().then(() => loadData()).catch(() => setAuthState('unauthenticated'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authState !== 'unauthenticated') return;
    const container = widgetRef.current;
    if (!container) return;

    window.__EATLYY_TG_AUTH_COMPANY_STATS__ = async (tgUser) => {
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
    script.setAttribute('data-onauth', 'window.__EATLYY_TG_AUTH_COMPANY_STATS__(user)');
    script.onerror = () => setLoginError('Не удалось загрузить виджет Telegram.');
    container.appendChild(script);
    return () => { container.innerHTML = ''; delete window.__EATLYY_TG_AUTH_COMPANY_STATS__; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, username]);

  async function handleLogout() {
    await webApi.logout().catch(() => {});
    setStats(null); setNotCompany(false);
    setAuthState('unauthenticated');
  }

  if (authState === 'loading') {
    return <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)', fontSize: 14 }}>Загрузка…</div>;
  }

  if (authState === 'unauthenticated') {
    return (
      <div style={{ textAlign: 'center', paddingTop: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 18 }}>🔒</div>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Войдите через Telegram</h3>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 360, margin: '0 auto 28px' }}>
          Кабинет компании доступен только после входа.
        </p>
        <div ref={widgetRef} style={{ minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }} />
        {loginError && <p style={{ fontSize: 13, color: '#ef5350', marginBottom: 12 }}>{loginError}</p>}
        <OrDivider />
        <MaxLoginButton onSuccess={loadData} />
      </div>
    );
  }

  if (notCompany) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 18 }}>🏢</div>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Кабинет компании</h3>
        <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 420, margin: '0 auto 28px' }}>
          Раздел доступен только подтверждённым компаниям EATLYY.
        </p>
        <Link href="/support" className="btn btn-accent" style={{ fontSize: 15, padding: '14px 32px' }}>
          Связаться с поддержкой
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

  return (
    <div>
      <CompanyNav active="stats" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Статистика</div>
        <button onClick={handleLogout} style={{
          background: 'none', border: 'none', padding: 0,
          color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0,
        }}>
          Выйти
        </button>
      </div>

      {stats && (
        <>
          {/* Main metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <BigStat label="Клиентов привлечено" value={String(stats.totalReferredUsers)} />
            <BigStat label="Экспертов привлечено" value={String(stats.expertRecruits)} />
          </div>

          {/* Rewards */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-xl)', padding: '20px 22px', marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 14 }}>
              Начисления
            </div>
            <StatRow label="Начислено всего"      value={fmtRub(stats.rewardsTotal)} accent />
            <StatRow label="Доступно к выводу"    value={fmtRub(stats.pendingRewards)} />
            {stats.payingUsers !== null && (
              <StatRow label="Платящих клиентов"  value={String(stats.payingUsers)} />
            )}
            {stats.activeSubscriptions !== null && (
              <StatRow label="Активных подписок"  value={String(stats.activeSubscriptions)} />
            )}
          </div>

          {stats.referralCode && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-xl)', padding: '14px 20px',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Реферальный код: </span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent)', fontSize: 14, marginLeft: 6 }}>
                {stats.referralCode}
              </span>
            </div>
          )}

          {/* Limitations note */}
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 16, lineHeight: 1.6 }}>
            Статистика по платящим клиентам временно недоступна в MVP.
            Для детального отчёта обращайтесь в поддержку.
          </p>
        </>
      )}
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-xl)', padding: '20px 18px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, color: 'var(--accent)', marginBottom: 6 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>{label}</div>
    </div>
  );
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--text-2)', letterSpacing: -0.3 }}>
        {value}
      </span>
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
