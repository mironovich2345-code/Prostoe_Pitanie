'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { webApi, ApiError, type WebCompanyProfile } from '@/lib/webApi';
import MaxLoginButton from '@/components/MaxLoginButton';
import CompanyNav from '@/components/CompanyNav';

declare global {
  interface Window {
    __EATLYY_TG_AUTH_COMPANY_PROF__?: (user: Record<string, string | number>) => void;
  }
}

const BOT_USERNAME_FALLBACK = 'EATLYY_bot';

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%',
  background: 'var(--surface)', border: '1px solid var(--border-2)',
  borderRadius: 'var(--r-md)', padding: '11px 14px',
  fontSize: 15, color: 'var(--text)', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600,
  color: 'var(--text-2)', marginBottom: 6,
};

const STATUS_LABELS: Record<string, string> = {
  verified: 'Подтверждена',
  pending:  'На проверке',
  rejected: 'Отклонена',
};

const PUBLIC_STATUS_LABELS: Record<string, string> = {
  draft:     'Черновик',
  published: 'Опубликован',
  hidden:    'Скрыт из каталога',
};

interface Props { botUsername: string }

export default function CompanyProfileClient({ botUsername }: Props) {
  const [authState, setAuthState]   = useState<'loading' | 'unauthenticated' | 'authenticated'>('loading');
  const [notCompany, setNotCompany] = useState(false);
  const [company, setCompany]       = useState<WebCompanyProfile | null>(null);
  const [saving, setSaving]         = useState(false);
  const [saveOk, setSaveOk]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const username  = botUsername || BOT_USERNAME_FALLBACK;

  const [form, setForm] = useState({ name: '', city: '', bio: '', socialLink: '' });

  async function loadData() {
    try {
      const { company: c } = await webApi.getCompanyProfile();
      setCompany(c);
      setForm({
        name:       c.name       ?? '',
        city:       c.city       ?? '',
        bio:        c.bio        ?? '',
        socialLink: c.socialLink ?? '',
      });
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

    window.__EATLYY_TG_AUTH_COMPANY_PROF__ = async (tgUser) => {
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
    script.setAttribute('data-onauth', 'window.__EATLYY_TG_AUTH_COMPANY_PROF__(user)');
    script.onerror = () => setLoginError('Не удалось загрузить виджет Telegram.');
    container.appendChild(script);
    return () => { container.innerHTML = ''; delete window.__EATLYY_TG_AUTH_COMPANY_PROF__; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, username]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setSaveError(null); setSaveOk(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setSaveError(null); setSaveOk(false);
    try {
      const { company: updated } = await webApi.updateCompanyProfile({
        name:       form.name       || undefined,
        city:       form.city       || null,
        bio:        form.bio        || null,
        socialLink: form.socialLink || null,
      });
      setCompany(updated);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      const msgs: Record<string, string> = {
        invalid_name: 'Название: от 2 до 80 символов.',
        invalid_bio:  'Описание: не менее 20 символов.',
        no_fields:    'Нет изменений для сохранения.',
      };
      setSaveError(msgs[code ?? ''] ?? 'Ошибка сохранения. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  };

  async function handleLogout() {
    await webApi.logout().catch(() => {});
    setCompany(null); setNotCompany(false);
    setAuthState('unauthenticated');
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (authState === 'loading') {
    return <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)', fontSize: 14 }}>Загрузка…</div>;
  }

  // ── Not authenticated ────────────────────────────────────────────────────
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
          Кабинет компании доступен только после входа.
        </p>
        <div ref={widgetRef} style={{ minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }} />
        {loginError && <p style={{ fontSize: 13, color: '#ef5350', marginBottom: 12 }}>{loginError}</p>}
        <OrDivider />
        <MaxLoginButton onSuccess={loadData} />
      </div>
    );
  }

  // ── Not a company ────────────────────────────────────────────────────────
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

  // ── Profile form ─────────────────────────────────────────────────────────
  return (
    <div>
      <CompanyNav active="profile" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Профиль компании</div>
        <button onClick={handleLogout} style={{
          background: 'none', border: 'none', padding: 0,
          color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0,
        }}>
          Выйти
        </button>
      </div>

      {/* Read-only info */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)', padding: '16px 20px', marginBottom: 20,
        display: 'flex', flexDirection: 'column', gap: 7,
      }}>
        <InfoRow label="Статус"       value={STATUS_LABELS[company?.status ?? ''] ?? company?.status ?? '—'} />
        <InfoRow label="Публикация"   value={PUBLIC_STATUS_LABELS[company?.publicStatus ?? ''] ?? '—'} />
        {company?.referralCode && (
          <InfoRow label="Реф. код" value={
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent)' }}>
              {company.referralCode}
            </span>
          } />
        )}
        {company?.slug && (
          <InfoRow label="Публичный URL" value={
            <Link href={`/trainers/${company.slug}`} style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12 }}>
              /trainers/{company.slug} →
            </Link>
          } />
        )}
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <FormField label="Название компании *">
          <input name="name" type="text" value={form.name} onChange={handleChange}
            placeholder="ООО Здоровое питание" required maxLength={80} style={inputStyle} />
        </FormField>

        <FormField label="Город / регион">
          <input name="city" type="text" value={form.city} onChange={handleChange}
            placeholder="Москва / Онлайн" maxLength={80} style={inputStyle} />
        </FormField>

        <FormField label="Сайт или соцсеть">
          <input name="socialLink" type="text" value={form.socialLink} onChange={handleChange}
            placeholder="https://example.com или @username" maxLength={200} style={inputStyle} />
        </FormField>

        <FormField label="О компании">
          <textarea name="bio" value={form.bio} onChange={handleChange}
            placeholder="Чем занимается компания, кому помогает, почему выбирают вас… (минимум 20 символов)"
            rows={6} maxLength={2000} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
        </FormField>

        {saveError && <p style={{ fontSize: 13, color: '#ef5350', margin: 0 }}>{saveError}</p>}
        {saveOk    && <p style={{ fontSize: 13, color: '#4caf50', margin: 0 }}>✓ Профиль сохранён</p>}

        <button
          type="submit"
          disabled={saving}
          className="btn btn-accent"
          style={{ fontSize: 16, padding: '14px 20px', border: 'none', opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </form>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
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
