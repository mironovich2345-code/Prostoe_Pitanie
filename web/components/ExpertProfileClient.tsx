'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { webApi, ApiError } from '@/lib/webApi';
import type { ExpertProfile } from '@/lib/webApi';

declare global {
  interface Window {
    __EATLYY_TG_AUTH_PROFILE__?: (user: Record<string, string | number>) => void;
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

const PUBLIC_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Черновик',        color: 'var(--text-3)',   bg: 'var(--surface)' },
  published: { label: 'Опубликован',     color: '#4caf50',         bg: 'rgba(76,175,80,0.08)' },
  hidden:    { label: 'Скрыт из каталога', color: 'var(--text-2)', bg: 'var(--surface)' },
};

interface Props {
  botUsername: string;
}

export default function ExpertProfileClient({ botUsername }: Props) {
  const [authState, setAuthState] = useState<'loading' | 'unauthenticated' | 'authenticated'>('loading');
  const [profile, setProfile] = useState<ExpertProfile | null>(null);
  const [notExpert, setNotExpert] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const [widgetState, setWidgetState] = useState<'mounting' | 'ok' | 'error' | 'timeout' | 'no-username'>('mounting');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: '', specialization: '', bio: '', city: '',
    socialLink: '', experienceYears: '', suitableFor: '', tags: '',
  });

  useEffect(() => {
    webApi.getMe()
      .then(() => webApi.getExpertProfile())
      .then(({ profile }) => {
        setProfile(profile);
        setForm({
          fullName: profile.fullName ?? '',
          specialization: profile.specialization ?? '',
          bio: profile.bio ?? '',
          city: profile.city ?? '',
          socialLink: profile.socialLink ?? '',
          experienceYears: profile.experienceYears != null ? String(profile.experienceYears) : '',
          suitableFor: profile.suitableFor ?? '',
          tags: profile.tags ?? '',
        });
        setAuthState('authenticated');
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403 && err.code === 'not_expert') {
          setNotExpert(true);
          setAuthState('authenticated');
        } else if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setAuthState('unauthenticated');
        } else {
          setAuthState('unauthenticated');
        }
      });
  }, []);

  // Telegram Login Widget mount
  useEffect(() => {
    if (authState !== 'unauthenticated') return;
    const container = widgetRef.current;
    if (!container) return;

    const username = botUsername || BOT_USERNAME_FALLBACK;
    if (!username) { setWidgetState('no-username'); return; }

    window.__EATLYY_TG_AUTH_PROFILE__ = async (tgUser) => {
      try {
        await webApi.telegramLogin(tgUser);
        const profileResp = await webApi.getExpertProfile().catch((err) => {
          if (err instanceof ApiError && err.status === 403) return null;
          throw err;
        });
        if (!profileResp) {
          setNotExpert(true);
          setAuthState('authenticated');
          return;
        }
        const p = profileResp.profile;
        setProfile(p);
        setForm({
          fullName: p.fullName ?? '', specialization: p.specialization ?? '',
          bio: p.bio ?? '', city: p.city ?? '', socialLink: p.socialLink ?? '',
          experienceYears: p.experienceYears != null ? String(p.experienceYears) : '',
          suitableFor: p.suitableFor ?? '', tags: p.tags ?? '',
        });
        setAuthState('authenticated');
      } catch (err) {
        const code = err instanceof ApiError ? err.code : null;
        setLoginError(code ? `Ошибка входа: ${code}` : 'Ошибка входа через Telegram.');
      }
    };

    container.innerHTML = '';
    setWidgetState('mounting');
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', username);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'window.__EATLYY_TG_AUTH_PROFILE__(user)');
    script.onerror = () => setWidgetState('error');
    script.onload = () => {
      setTimeout(() => {
        setWidgetState(container.querySelector('iframe') ? 'ok' : 'timeout');
      }, 3000);
    };
    container.appendChild(script);
    return () => { container.innerHTML = ''; delete window.__EATLYY_TG_AUTH_PROFILE__; };
  }, [authState, botUsername]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setSaveError(null); setSaveOk(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setSaveError(null); setSaveOk(false);
    try {
      const years = form.experienceYears.trim();
      const { profile: updated } = await webApi.updateExpertProfile({
        fullName: form.fullName || undefined,
        specialization: form.specialization || undefined,
        bio: form.bio || undefined,
        city: form.city || undefined,
        socialLink: form.socialLink || undefined,
        experienceYears: years !== '' ? parseInt(years, 10) : null,
        suitableFor: form.suitableFor || undefined,
        tags: form.tags || undefined,
      });
      setProfile(updated);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      setSaveError(code ? `Ошибка сохранения: ${code}` : 'Ошибка сохранения. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true); setSaveError(null);
    try {
      const { publicStatus, slug } = await webApi.publishExpertProfile();
      setProfile(prev => prev ? { ...prev, publicStatus, slug: slug ?? prev.slug } : prev);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      if (code === 'incomplete_profile') {
        setSaveError('Заполните имя, специализацию и описание, чтобы опубликовать профиль.');
      } else {
        setSaveError('Ошибка публикации. Попробуйте ещё раз.');
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleHide = async () => {
    setPublishing(true); setSaveError(null);
    try {
      const { publicStatus } = await webApi.hideExpertProfile();
      setProfile(prev => prev ? { ...prev, publicStatus } : prev);
    } catch {
      setSaveError('Ошибка. Попробуйте ещё раз.');
    } finally {
      setPublishing(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (authState === 'loading') {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)', fontSize: 14 }}>
        Загрузка...
      </div>
    );
  }

  // ── Not authenticated ─────────────────────────────────────────────────────────
  if (authState === 'unauthenticated') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 18 }}>🔒</div>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Войдите через Telegram</h3>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 360, margin: '0 auto 28px' }}>
          Профиль эксперта доступен только после входа через Telegram.
        </p>
        <div ref={widgetRef} style={{ minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }} />
        {widgetState === 'error' && (
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>Не удалось загрузить Telegram Login Widget.</p>
        )}
        {widgetState === 'timeout' && (
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
            Кнопка Telegram не отобразилась. Проверьте, что домен добавлен в BotFather → Login Widget.
          </p>
        )}
        {loginError && <p style={{ fontSize: 13, color: '#ef5350', marginBottom: 8 }}>{loginError}</p>}
      </div>
    );
  }

  // ── Authenticated but not an expert ──────────────────────────────────────────
  if (notExpert) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{ fontSize: 36, marginBottom: 18 }}>⏳</div>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Профиль эксперта не активен</h3>
        <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 420, margin: '0 auto 28px' }}>
          Профиль эксперта становится доступным после одобрения заявки командой EATLYY.
        </p>
        <Link href="/experts/apply" className="btn btn-accent" style={{ fontSize: 15, padding: '14px 32px' }}>
          Подать заявку
        </Link>
      </div>
    );
  }

  // ── Expert profile form ───────────────────────────────────────────────────────
  const st = PUBLIC_STATUS_CONFIG[profile?.publicStatus ?? 'draft'] ?? PUBLIC_STATUS_CONFIG.draft;

  return (
    <div>
      {/* Status badge */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: st.bg, border: `1px solid ${st.color}30`,
          borderRadius: 20, padding: '6px 14px',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: st.color }}>{st.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {profile?.publicStatus !== 'published' && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="btn btn-accent"
              style={{ fontSize: 13, padding: '8px 18px', border: 'none', opacity: publishing ? 0.6 : 1 }}
            >
              {publishing ? '...' : 'Опубликовать'}
            </button>
          )}
          {profile?.publicStatus === 'published' && (
            <button
              onClick={handleHide}
              disabled={publishing}
              style={{
                fontSize: 13, padding: '8px 18px', borderRadius: 10,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                color: 'var(--text-2)', cursor: 'pointer', opacity: publishing ? 0.6 : 1,
              }}
            >
              {publishing ? '...' : 'Скрыть из каталога'}
            </button>
          )}
        </div>
      </div>

      {profile?.publicStatus === 'published' && (
        <div style={{
          background: 'rgba(76,175,80,0.07)', border: '1px solid rgba(76,175,80,0.2)',
          borderRadius: 'var(--r-lg)', padding: '12px 16px', marginBottom: 20, fontSize: 13,
          color: 'var(--text-2)', lineHeight: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <span>✓ Ваш профиль опубликован в каталоге экспертов.</span>
          {profile.slug && (
            <Link
              href={`/trainers/${profile.slug}`}
              style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}
            >
              Открыть публичную карточку →
            </Link>
          )}
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <FormField label="Имя и фамилия *">
          <input name="fullName" type="text" value={form.fullName} onChange={handleChange}
            placeholder="Анна Соколова" required maxLength={80} style={inputStyle} />
        </FormField>

        <FormField label="Специализация *">
          <input name="specialization" type="text" value={form.specialization} onChange={handleChange}
            placeholder="Нутрициолог, диетолог, фитнес-тренер…" required maxLength={120} style={inputStyle} />
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Город">
            <input name="city" type="text" value={form.city} onChange={handleChange}
              placeholder="Москва / Онлайн" maxLength={80} style={inputStyle} />
          </FormField>
          <FormField label="Опыт работы (лет)">
            <input name="experienceYears" type="number" value={form.experienceYears} onChange={handleChange}
              placeholder="0" min={0} max={60} style={inputStyle} />
          </FormField>
        </div>

        <FormField label="Соцсеть или сайт">
          <input name="socialLink" type="text" value={form.socialLink} onChange={handleChange}
            placeholder="instagram.com/username или сайт" maxLength={200} style={inputStyle} />
        </FormField>

        <FormField label="О себе *">
          <textarea name="bio" value={form.bio} onChange={handleChange}
            placeholder="Чем занимаетесь, кому помогаете, каких результатов достигают клиенты… (минимум 20 символов)"
            required minLength={20} maxLength={2000} rows={6}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
        </FormField>

        <FormField label="Кому подходит">
          <textarea name="suitableFor" value={form.suitableFor} onChange={handleChange}
            placeholder="Тем, кто хочет похудеть без жёстких диет, спортсменам, занятым людям…"
            rows={3} maxLength={500} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
        </FormField>

        <FormField label="Теги (через запятую)">
          <input name="tags" type="text" value={form.tags} onChange={handleChange}
            placeholder="похудение, питание, спорт, детокс" maxLength={300} style={inputStyle} />
        </FormField>

        {saveError && (
          <p style={{ fontSize: 13, color: '#ef5350', margin: 0 }}>{saveError}</p>
        )}
        {saveOk && (
          <p style={{ fontSize: 13, color: '#4caf50', margin: 0 }}>✓ Профиль сохранён</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="btn btn-accent"
          style={{ fontSize: 16, padding: '14px 20px', border: 'none', opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>

        <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.55 }}>
          {profile?.referralCode && (
            <>Реферальный код: <strong>{profile.referralCode}</strong> · </>
          )}
          Профиль виден клиентам только после публикации.
        </p>

        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          <Link href="/expert/requests" style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
            Входящие заявки клиентов →
          </Link>
        </div>
      </form>
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
