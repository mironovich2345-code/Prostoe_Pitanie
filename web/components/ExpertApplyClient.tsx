'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { webApi, ApiError } from '@/lib/webApi';
import type { WebUser, ExpertApplication } from '@/lib/webApi';

const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'EATLYY_bot';
const TG_SUPPORT = process.env.NEXT_PUBLIC_SUPPORT_URL ?? 'https://t.me/EATLYY_help';

type AuthState = 'loading' | 'unauthenticated' | 'authenticated';

interface FormValues {
  fullName: string;
  specialization: string;
  city: string;
  workFormat: string;
  experienceYears: string;
  socialLink: string;
  bio: string;
  proofLink: string;
}

const STATUS_CONFIG: Record<string, { icon: string; label: string; sub: string; accent: string; bg: string }> = {
  pending: {
    icon: '⏳',
    label: 'Заявка отправлена и ожидает проверки',
    sub: 'Рассматриваем заявки в течение 1–2 рабочих дней. Ответим в Telegram.',
    accent: 'var(--text-2)',
    bg: 'var(--surface)',
  },
  in_review: {
    icon: '🔍',
    label: 'Заявка на проверке',
    sub: 'Команда EATLYY изучает вашу заявку. Ждите ответа в Telegram.',
    accent: 'var(--accent)',
    bg: 'var(--accent-dim)',
  },
  approved: {
    icon: '✅',
    label: 'Заявка одобрена — добро пожаловать!',
    sub: 'Ваш профиль эксперта скоро появится в каталоге. Следите за уведомлениями в Telegram.',
    accent: '#4caf50',
    bg: 'rgba(76,175,80,0.08)',
  },
  rejected: {
    icon: '✗',
    label: 'Заявка отклонена',
    sub: 'Вы можете подать новую заявку с уточнёнными данными.',
    accent: '#ef5350',
    bg: 'rgba(239,83,80,0.08)',
  },
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--border-2)',
  borderRadius: 'var(--r-md)',
  padding: '11px 14px',
  fontSize: 15,
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-2)',
  marginBottom: 6,
};

export default function ExpertApplyClient() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [webUser, setWebUser] = useState<WebUser | null>(null);
  const [application, setApplication] = useState<ExpertApplication | null>(null);
  const [form, setForm] = useState<FormValues>({
    fullName: '', specialization: '', city: '', workFormat: '',
    experienceYears: '', socialLink: '', bio: '', proofLink: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Check auth + load application on mount
  useEffect(() => {
    webApi.getMe()
      .then(({ user }) => {
        setWebUser(user);
        setAuthState('authenticated');
        return webApi.getMyApplication();
      })
      .then(({ application }) => {
        setApplication(application);
      })
      .catch(() => {
        setAuthState('unauthenticated');
      });
  }, []);

  // Register Telegram Login Widget global callback
  useEffect(() => {
    (window as unknown as Record<string, unknown>).onTelegramAuth = async (tgUser: Record<string, string | number>) => {
      try {
        const { user } = await webApi.telegramLogin(tgUser);
        setWebUser(user);
        setAuthState('authenticated');
        const { application } = await webApi.getMyApplication();
        setApplication(application);
      } catch {
        setSubmitError('Ошибка входа через Telegram. Попробуйте ещё раз.');
      }
    };
    return () => {
      delete (window as unknown as Record<string, unknown>).onTelegramAuth;
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setFieldError(null);
    setSubmitError(null);
  };

  const handleLogout = async () => {
    await webApi.logout().catch(() => {});
    setWebUser(null);
    setApplication(null);
    setAuthState('unauthenticated');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    setSubmitError(null);
    setSubmitting(true);
    try {
      const yearsStr = form.experienceYears.trim();
      const years = yearsStr !== '' ? parseInt(yearsStr, 10) : undefined;
      await webApi.submitApplication({
        fullName: form.fullName,
        specialization: form.specialization,
        city: form.city || undefined,
        workFormat: form.workFormat || undefined,
        experienceYears: years !== undefined && !isNaN(years) ? years : undefined,
        socialLink: form.socialLink || undefined,
        bio: form.bio,
        proofLink: form.proofLink || undefined,
      });
      const { application } = await webApi.getMyApplication();
      setApplication(application);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400 && err.code === 'VALIDATION_ERROR') {
          const body = err.message;
          setFieldError({ field: 'form', message: body });
        } else if (err.status === 409) {
          setSubmitError('У вас уже есть активная заявка.');
        } else {
          setSubmitError('Ошибка отправки. Проверьте поля и попробуйте ещё раз.');
        }
      } else {
        setSubmitError('Ошибка сети. Попробуйте позже.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (authState === 'loading') {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)', fontSize: 14 }}>
        Загрузка...
      </div>
    );
  }

  // ── Unauthenticated ────────────────────────────────────────────────────────
  if (authState === 'unauthenticated') {
    return (
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)',
        padding: '40px 28px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 36, marginBottom: 18 }}>🔒</div>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>
          Войдите через Telegram
        </h3>
        <p style={{
          fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65,
          maxWidth: 380, margin: '0 auto 28px',
        }}>
          Так заявка будет привязана к вашему профилю EATLYY.
          Вы сможете следить за статусом проверки.
        </p>

        {/* Telegram Login Widget */}
        <Script
          src="https://telegram.org/js/telegram-widget.js?22"
          strategy="afterInteractive"
          data-telegram-login={BOT_USERNAME}
          data-size="large"
          data-onauth="onTelegramAuth(user)"
          data-request-access="write"
        />

        {submitError && (
          <p style={{ marginTop: 16, fontSize: 13, color: '#ef5350' }}>{submitError}</p>
        )}
        <p style={{ marginTop: 20, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.55 }}>
          Мы получаем только имя и Telegram ID. Ничего не публикуем от вашего имени.
        </p>
      </div>
    );
  }

  // ── Authenticated — application exists and is active ───────────────────────
  if (
    application &&
    (application.status === 'pending' ||
      application.status === 'in_review' ||
      application.status === 'approved')
  ) {
    const cfg = STATUS_CONFIG[application.status];
    return (
      <div>
        <UserBar webUser={webUser} onLogout={handleLogout} />
        <div style={{
          background: cfg.bg,
          border: `1px solid ${cfg.accent}30`,
          borderRadius: 'var(--r-xl)',
          padding: '28px 26px',
        }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>{cfg.icon}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: cfg.accent, marginBottom: 8 }}>
            {cfg.label}
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>{cfg.sub}</p>
          <p style={{ marginTop: 14, fontSize: 12, color: 'var(--text-3)' }}>
            Заявка от {new Date(application.createdAt).toLocaleDateString('ru-RU')}
          </p>
        </div>
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <a href={TG_SUPPORT} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'underline' }}>
            Задать вопрос в поддержку
          </a>
        </div>
      </div>
    );
  }

  // ── Authenticated — show form (no app, or rejected) ────────────────────────
  return (
    <div>
      <UserBar webUser={webUser} onLogout={handleLogout} />

      {application?.status === 'rejected' && (
        <div style={{
          background: 'rgba(239,83,80,0.07)',
          border: '1px solid rgba(239,83,80,0.22)',
          borderRadius: 'var(--r-lg)',
          padding: '16px 20px',
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#ef5350', marginBottom: 4 }}>
            Предыдущая заявка была отклонена
          </div>
          {application.adminComment && (
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 6 }}>
              {application.adminComment}
            </p>
          )}
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Вы можете отправить новую заявку.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <FormField label="Имя и фамилия *">
          <input
            name="fullName" type="text" value={form.fullName} onChange={handleChange}
            placeholder="Анна Соколова" required maxLength={80}
            style={inputStyle}
          />
        </FormField>

        <FormField label="Специализация *">
          <input
            name="specialization" type="text" value={form.specialization} onChange={handleChange}
            placeholder="Нутрициолог, диетолог, фитнес-тренер…" required maxLength={120}
            style={inputStyle}
          />
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Город">
            <input
              name="city" type="text" value={form.city} onChange={handleChange}
              placeholder="Москва / Онлайн" maxLength={80}
              style={inputStyle}
            />
          </FormField>
          <FormField label="Формат работы">
            <select name="workFormat" value={form.workFormat} onChange={handleChange} style={inputStyle}>
              <option value="">Не выбрано</option>
              <option value="online">Онлайн</option>
              <option value="offline">Офлайн</option>
              <option value="mixed">Смешанный</option>
            </select>
          </FormField>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Опыт работы (лет)">
            <input
              name="experienceYears" type="number" value={form.experienceYears} onChange={handleChange}
              placeholder="0" min={0} max={60}
              style={inputStyle}
            />
          </FormField>
          <FormField label="Соцсеть или сайт">
            <input
              name="socialLink" type="text" value={form.socialLink} onChange={handleChange}
              placeholder="instagram.com/username" maxLength={200}
              style={inputStyle}
            />
          </FormField>
        </div>

        <FormField label="О себе *">
          <textarea
            name="bio" value={form.bio} onChange={handleChange}
            placeholder="Чем занимаетесь, кому помогаете, каких результатов достигают клиенты… (минимум 20 символов)"
            required minLength={20} maxLength={1000} rows={5}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
          />
        </FormField>

        <FormField label="Подтверждение экспертности (ссылка на диплом, сертификат — по желанию)">
          <input
            name="proofLink" type="text" value={form.proofLink} onChange={handleChange}
            placeholder="drive.google.com/… или другая ссылка" maxLength={300}
            style={inputStyle}
          />
        </FormField>

        {(submitError || fieldError) && (
          <p style={{ fontSize: 13, color: '#ef5350', margin: 0 }}>
            {submitError || fieldError?.message}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn btn-accent"
          style={{
            fontSize: 16, padding: '14px 20px',
            opacity: submitting ? 0.6 : 1,
            cursor: submitting ? 'not-allowed' : 'pointer',
            border: 'none',
          }}
        >
          {submitting ? 'Отправляем…' : 'Отправить заявку'}
        </button>

        <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.55 }}>
          После отправки мы проверим данные и свяжемся с вами в Telegram в течение 1–2 рабочих дней.
        </p>
      </form>
    </div>
  );
}

function UserBar({ webUser, onLogout }: { webUser: WebUser | null; onLogout: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 22, flexWrap: 'wrap', gap: 10,
    }}>
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
        Вы вошли через Telegram
        {webUser?.chatId && (
          <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>· ID {webUser.chatId}</span>
        )}
      </span>
      <button onClick={onLogout} style={{
        background: 'none', border: 'none', padding: 0,
        color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
      }}>
        Выйти
      </button>
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
