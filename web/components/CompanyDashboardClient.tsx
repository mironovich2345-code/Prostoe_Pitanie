'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { webApi, ApiError, type WebCompanyProfile, type WebCompanyStats } from '@/lib/webApi';
import MaxLoginButton from '@/components/MaxLoginButton';
import CompanyNav from '@/components/CompanyNav';

declare global {
  interface Window {
    __EATLYY_TG_AUTH_COMPANY__?: (user: Record<string, string | number>) => void;
  }
}

type AuthState = 'loading' | 'unauthenticated' | 'authenticated';

const BOT_USERNAME_FALLBACK = 'EATLYY_bot';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  verified: { label: 'Подтверждена', color: '#4caf50', bg: 'rgba(76,175,80,0.08)' },
  pending:  { label: 'На проверке',  color: 'var(--accent)', bg: 'var(--accent-dim)' },
  rejected: { label: 'Отклонена',    color: '#ef5350', bg: 'rgba(239,83,80,0.08)' },
};

function fmtRub(n: number) { return n.toLocaleString('ru') + ' ₽'; }

interface Props { botUsername: string }

export default function CompanyDashboardClient({ botUsername }: Props) {
  const [authState, setAuthState]   = useState<AuthState>('loading');
  const [notCompany, setNotCompany] = useState(false);
  const [company, setCompany]       = useState<WebCompanyProfile | null>(null);
  const [stats, setStats]           = useState<WebCompanyStats | null>(null);
  const [copied, setCopied]         = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const username  = botUsername || BOT_USERNAME_FALLBACK;

  async function loadData() {
    try {
      const [profileResp, statsResp] = await Promise.all([
        webApi.getCompanyProfile(),
        webApi.getCompanyStats(),
      ]);
      setCompany(profileResp.company);
      setStats(statsResp.stats);
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

    window.__EATLYY_TG_AUTH_COMPANY__ = async (tgUser) => {
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
    script.setAttribute('data-onauth', 'window.__EATLYY_TG_AUTH_COMPANY__(user)');
    script.onerror = () => setLoginError('Не удалось загрузить виджет Telegram.');
    container.appendChild(script);
    return () => { container.innerHTML = ''; delete window.__EATLYY_TG_AUTH_COMPANY__; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, username]);

  function handleCopy() {
    if (!company?.referralCode) return;
    navigator.clipboard.writeText(company.referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => null);
  }

  async function handleLogout() {
    await webApi.logout().catch(() => {});
    setCompany(null);
    setStats(null);
    setNotCompany(false);
    setAuthState('unauthenticated');
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (authState === 'loading') {
    return <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)', fontSize: 14 }}>Загрузка…</div>;
  }

  // ── Not authenticated ──────────────────────────────────────────────────────
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

  // ── Not a company ──────────────────────────────────────────────────────────
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

  // ── Company dashboard ──────────────────────────────────────────────────────
  const st = STATUS_CONFIG[company?.status ?? 'pending'] ?? STATUS_CONFIG.pending;

  return (
    <div>
      <CompanyNav active="overview" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
          {company?.name ?? 'Кабинет компании'}
        </div>
        <button onClick={handleLogout} style={{
          background: 'none', border: 'none', padding: 0,
          color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0,
        }}>
          Выйти
        </button>
      </div>

      {/* Status + city */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)', padding: '18px 20px', marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: company?.city ? 10 : 0 }}>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
            background: st.bg, color: st.color,
          }}>
            {st.label}
          </span>
          {company?.publicStatus && company.publicStatus !== 'draft' && (
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {company.publicStatus === 'published' ? 'Опубликован' : 'Скрыт'}
            </span>
          )}
        </div>
        {company?.city && (
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{company.city}</div>
        )}
      </div>

      {/* Referral code */}
      {company?.referralCode && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl)', padding: '18px 20px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 10 }}>
            Реферальный код
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontFamily: 'monospace', fontSize: 18, fontWeight: 700,
              color: 'var(--accent)', letterSpacing: 2,
            }}>
              {company.referralCode}
            </span>
            <button
              onClick={handleCopy}
              style={{
                fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8,
                background: 'var(--accent-dim)', border: '1px solid rgba(215,255,63,0.2)',
                color: 'var(--accent)', cursor: 'pointer',
              }}
            >
              {copied ? '✓ Скопировано' : 'Копировать'}
            </button>
          </div>
        </div>
      )}

      {/* Quick stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <StatTile label="Клиентов привлечено" value={String(stats.totalReferredUsers)} />
          <StatTile label="Начислено" value={fmtRub(stats.rewardsTotal)} />
          <StatTile label="Доступно к выводу" value={fmtRub(stats.pendingRewards)} />
          <StatTile label="Экспертов привлечено" value={String(stats.expertRecruits)} />
        </div>
      )}

      {/* Navigation tiles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { href: '/company/profile',  label: 'Профиль компании',     sub: 'Редактировать данные и описание' },
          { href: '/company/offers',   label: 'Реферальные офферы',   sub: 'Ссылки для привлечения клиентов' },
          { href: '/company/stats',    label: 'Статистика',           sub: 'Привлечённые пользователи и начисления' },
          { href: '/support',          label: 'Поддержка',            sub: 'Связаться с командой EATLYY' },
        ].map(item => (
          <Link key={item.href} href={item.href} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-xl)', padding: '16px 20px', textDecoration: 'none',
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{item.sub}</div>
            </div>
            <span style={{ color: 'var(--text-3)', fontSize: 18 }}>→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-xl)', padding: '16px 18px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, color: 'var(--accent)', marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>{label}</div>
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
