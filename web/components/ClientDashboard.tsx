'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  webApi, ApiError,
  type WebMeResponse, type WebMeProfile, type WebClientProfileUpdatePayload,
} from '@/lib/webApi';
import MaxLoginButton from '@/components/MaxLoginButton';
import PhoneLoginForm from '@/components/PhoneLoginForm';

declare global {
  interface Window {
    __EATLYY_TG_AUTH_DASHBOARD__?: (user: Record<string, string | number>) => void;
  }
}

type AuthState = 'loading' | 'unauthenticated' | 'authenticated';

interface Props {
  botUsername: string;
  maxBotName?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  free:           'Free',
  optimal:        'Оптимальный',
  client_monthly: 'Оптимальный',
  pro:            'Pro',
  intro:          'Pro (пробный)',
};

const GOAL_LABELS: Record<string, string> = {
  lose:     'Похудение',
  maintain: 'Поддержание',
  gain:     'Набор веса',
  track:    'Контроль',
};

const APP_STATUS: Record<string, { text: string; color: string }> = {
  pending:   { text: 'Ожидает рассмотрения', color: 'var(--text-2)' },
  in_review: { text: 'На проверке',          color: 'var(--accent)' },
  approved:  { text: 'Одобрена',             color: '#4caf50' },
  rejected:  { text: 'Отклонена',            color: '#ef5350' },
};

// ─── Primitive helpers ────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-xl)',
      padding: '20px 22px',
      marginBottom: 12,
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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 11, fontWeight: 700,
      background: 'var(--accent-dim)',
      color: 'var(--accent)',
      border: '1px solid rgba(215,255,63,0.2)',
      marginRight: 6, marginBottom: 4,
    }}>
      {label}
    </span>
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

function MacroTile({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div style={{
      flex: 1,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '12px 6px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.5, color: 'var(--text)', lineHeight: 1 }}>
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

function QuickLink({ href, label, external }: { href: string; label: string; external?: boolean }) {
  const style: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '12px 8px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    fontSize: 12, fontWeight: 600,
    color: 'var(--text-2)',
    textDecoration: 'none',
    textAlign: 'center',
    lineHeight: 1.3,
  };
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" style={style}>{label}</a>
    : <Link href={href} style={style}>{label}</Link>;
}

// ─── Edit Profile Form ────────────────────────────────────────────────────────

interface EditFormProps {
  profile: WebMeProfile | null;
  onSaved: (fresh: WebMeResponse) => void;
  onCancel: () => void;
}

const ACTIVITY_OPTIONS = [
  { value: 1.2,   label: 'Почти нет активности',  desc: 'Сидячая работа, < 4 000 шагов/день' },
  { value: 1.375, label: 'Лёгкая активность',      desc: 'Прогулки, 4 000–7 000 шагов/день' },
  { value: 1.55,  label: 'Средняя активность',     desc: 'Тренировки несколько раз в неделю' },
  { value: 1.725, label: 'Высокая активность',     desc: 'Интенсивные нагрузки почти ежедневно' },
  { value: 1.9,   label: 'Очень высокая',          desc: 'Профессиональный спорт' },
];

function EditProfileForm({ profile, onSaved, onCancel }: EditFormProps) {
  const [name,     setName]     = useState(profile?.preferredName    ?? '');
  const [city,     setCity]     = useState(profile?.city             ?? '');
  const [sex,      setSex]      = useState(profile?.sex              ?? '');
  const [birthDate,setBirthDate]= useState(
    profile?.birthDate ? profile.birthDate.split('T')[0] : ''
  );
  const [activity, setActivity] = useState(profile?.activityLevel?.toString() ?? '');
  const [height,   setHeight]   = useState(profile?.heightCm?.toString()        ?? '');
  const [weight,   setWeight]   = useState(profile?.currentWeightKg?.toString() ?? '');
  const [desired,  setDesired]  = useState(profile?.desiredWeightKg?.toString() ?? '');
  const [goal,     setGoal]     = useState(profile?.goalType         ?? '');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const h  = height  ? Number(height)  : undefined;
    const cw = weight  ? Number(weight)  : undefined;
    const dw = desired ? Number(desired) : undefined;

    if (h  !== undefined && (isNaN(h)  || h  < 100 || h  > 250)) { setError('Рост: 100–250 см');        return; }
    if (cw !== undefined && (isNaN(cw) || cw < 30  || cw > 300)) { setError('Вес: 30–300 кг');          return; }
    if (dw !== undefined && (isNaN(dw) || dw < 30  || dw > 300)) { setError('Желаемый вес: 30–300 кг'); return; }

    const payload: WebClientProfileUpdatePayload = {};
    const trimName = name.trim();
    const trimCity = city.trim();
    if (trimName !== (profile?.preferredName    ?? '')) payload.preferredName    = trimName || null;
    if (trimCity !== (profile?.city             ?? '')) payload.city             = trimCity || null;
    if (sex  && sex  !== (profile?.sex  ?? ''))         payload.sex              = sex;
    if (birthDate) {
      const existingBd = profile?.birthDate ? profile.birthDate.split('T')[0] : '';
      if (birthDate !== existingBd) payload.birthDate = birthDate;
    }
    const al = activity ? parseFloat(activity) : NaN;
    if (!isNaN(al) && al !== profile?.activityLevel)    payload.activityLevel    = al;
    if (h  !== undefined && h  !== profile?.heightCm)        payload.heightCm        = h;
    if (cw !== undefined && cw !== profile?.currentWeightKg) payload.currentWeightKg = cw;
    if (dw !== undefined && dw !== profile?.desiredWeightKg) payload.desiredWeightKg = dw;
    if (goal && goal !== (profile?.goalType ?? ''))           payload.goalType        = goal;

    if (Object.keys(payload).length === 0) { onCancel(); return; }

    setSaving(true);
    try {
      await webApi.updateClientProfile(payload);
      const fresh = await webApi.getMeData();
      onSaved(fresh);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      setError(
        code === 'invalid_heightCm'        ? 'Рост: 100–250 см'                          :
        code === 'invalid_currentWeightKg' ? 'Вес: 30–300 кг'                            :
        code === 'invalid_desiredWeightKg' ? 'Желаемый вес: 30–300 кг'                   :
        code === 'invalid_sex'             ? 'Выберите пол'                               :
        code === 'invalid_birthDate'       ? 'Укажите корректную дату рождения (13–100 лет)' :
        code === 'invalid_activityLevel'   ? 'Выберите уровень активности'               :
        'Ошибка сохранения. Попробуйте ещё раз.',
      );
      setSaving(false);
    }
  }

  const inp: React.CSSProperties = {
    display: 'block', width: '100%', boxSizing: 'border-box',
    padding: '9px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-2)',
    borderRadius: 8,
    fontSize: 13, color: 'var(--text)',
    outline: 'none',
  };

  const lbl: React.CSSProperties = {
    display: 'block',
    fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
    marginBottom: 4,
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>Имя</label>
        <input style={inp} type="text" value={name} onChange={e => setName(e.target.value)} maxLength={100} placeholder="Ваше имя" disabled={saving} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>Город</label>
        <input style={inp} type="text" value={city} onChange={e => setCity(e.target.value)} maxLength={100} placeholder="Москва" disabled={saving} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ ...lbl, marginBottom: 6 }}>Пол</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ v: 'male', l: 'Мужской' }, { v: 'female', l: 'Женский' }].map(opt => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setSex(opt.v)}
              disabled={saving}
              style={{
                flex: 1, padding: '9px 4px', fontSize: 13, fontWeight: 600,
                borderRadius: 8, border: 'none', cursor: saving ? 'default' : 'pointer',
                background: sex === opt.v ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                color: sex === opt.v ? '#000' : 'var(--text-2)',
              }}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>Дата рождения</label>
        <input
          style={inp} type="date" value={birthDate}
          onChange={e => setBirthDate(e.target.value)}
          disabled={saving}
          min={new Date(new Date().getFullYear() - 100, 0, 1).toISOString().split('T')[0]}
          max={new Date(new Date().getFullYear() - 13, new Date().getMonth(), new Date().getDate()).toISOString().split('T')[0]}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>Уровень активности</label>
        <select
          style={{ ...inp, cursor: 'pointer' }} value={activity}
          onChange={e => setActivity(e.target.value)} disabled={saving}
        >
          <option value="">Не выбран</option>
          {ACTIVITY_OPTIONS.map(o => (
            <option key={o.value} value={String(o.value)}>{o.label} — {o.desc}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <label style={lbl}>Рост, см</label>
          <input style={inp} type="number" value={height} onChange={e => setHeight(e.target.value)} min={100} max={250} placeholder="170" disabled={saving} />
        </div>
        <div>
          <label style={lbl}>Вес, кг</label>
          <input style={inp} type="number" value={weight} onChange={e => setWeight(e.target.value)} min={30} max={300} step={0.1} placeholder="70" disabled={saving} />
        </div>
        <div>
          <label style={lbl}>Цель, кг</label>
          <input style={inp} type="number" value={desired} onChange={e => setDesired(e.target.value)} min={30} max={300} step={0.1} placeholder="65" disabled={saving} />
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>Цель</label>
        <select style={{ ...inp, cursor: 'pointer' }} value={goal} onChange={e => setGoal(e.target.value)} disabled={saving}>
          <option value="">Не выбрана</option>
          <option value="lose">Похудение</option>
          <option value="maintain">Поддержание</option>
          <option value="gain">Набор веса</option>
          <option value="track">Контроль</option>
        </select>
      </div>

      {error && <p style={{ fontSize: 12, color: '#ef5350', margin: '0 0 10px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={saving} style={{
          flex: 1, padding: '10px 0',
          background: 'var(--accent)', border: 'none',
          borderRadius: 8, fontSize: 13, fontWeight: 700,
          color: '#000', cursor: saving ? 'default' : 'pointer',
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} style={{
          padding: '10px 18px',
          background: 'none',
          border: '1px solid var(--border-2)',
          borderRadius: 8,
          fontSize: 13, color: 'var(--text-3)',
          cursor: 'pointer',
        }}>
          Отмена
        </button>
      </div>
    </form>
  );
}

// ─── Phone Link Form ──────────────────────────────────────────────────────────

interface PhoneLinkFormProps {
  onSuccess: () => Promise<void>;
}

function PhoneLinkForm({ onSuccess }: PhoneLinkFormProps) {
  const [stage,     setStage]     = useState<'phone' | 'code'>('phone');
  const [loading,   setLoading]   = useState(false);
  const [phone,     setPhone]     = useState('');
  const [code,      setCode]      = useState('');
  const [error,     setError]     = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  function startCountdown() {
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); timerRef.current = null; return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  function linkErrorText(err: unknown, ctx: 'request' | 'verify'): string {
    const c = err instanceof ApiError ? err.code : null;
    if (c === 'phone_already_linked')
      return 'Этот телефон уже привязан к другому аккаунту. Напишите в поддержку, если хотите объединить доступы.';
    if (ctx === 'request') {
      if (c === 'invalid_phone')       return 'Неверный формат номера. Введите +79...';
      if (c === 'rate_limit_exceeded') return 'Слишком много попыток. Подождите немного.';
      if (c === 'resend_too_soon')     return 'Повторная отправка доступна через минуту.';
      if (c === 'sms_provider_not_configured') return 'SMS временно недоступны.';
      return 'Ошибка отправки SMS. Попробуйте ещё раз.';
    }
    if (c === 'invalid_code')              return 'Неверный код. Попробуйте ещё раз.';
    if (c === 'code_not_found_or_expired') return 'Код устарел. Запросите новый.';
    if (c === 'too_many_attempts')         return 'Слишком много попыток. Запросите новый код.';
    return 'Ошибка. Попробуйте ещё раз.';
  }

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await webApi.requestPhoneLinkCode(phone);
      if (result.alreadyLinked) { await onSuccess(); return; }
      setCode('');
      setStage('code');
      startCountdown();
    } catch (err) {
      setError(linkErrorText(err, 'request'));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await webApi.verifyPhoneLinkCode(phone, code);
      await onSuccess();
    } catch (err) {
      setError(linkErrorText(err, 'verify'));
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0 || loading) return;
    setError(null);
    setLoading(true);
    try {
      await webApi.requestPhoneLinkCode(phone);
      setCode('');
      startCountdown();
    } catch (err) {
      setError(linkErrorText(err, 'request'));
    } finally {
      setLoading(false);
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px',
    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-2)',
    borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none', display: 'block',
  };

  if (stage === 'phone') {
    return (
      <form onSubmit={handleRequestCode} style={{ marginTop: 10 }}>
        <input
          type="tel" placeholder="+79990000000" value={phone}
          onChange={e => setPhone(e.target.value)}
          style={inp} autoComplete="tel" required disabled={loading}
        />
        {error && <p style={{ fontSize: 12, color: '#ef5350', margin: '6px 0 0' }}>{error}</p>}
        <button type="submit" disabled={loading || !phone.trim()} style={{
          marginTop: 8, padding: '8px 16px',
          background: 'none', border: '1px solid var(--border-2)',
          borderRadius: 8, fontSize: 12, fontWeight: 600,
          color: 'var(--text-2)', cursor: loading || !phone.trim() ? 'default' : 'pointer',
          opacity: (loading || !phone.trim()) ? 0.5 : 1,
        }}>
          {loading ? 'Отправка…' : 'Получить SMS-код'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyCode} style={{ marginTop: 10 }}>
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
        Код отправлен на <strong style={{ color: 'var(--text-2)' }}>{phone}</strong>
      </p>
      <input
        type="text" inputMode="numeric" pattern="\d*" maxLength={6}
        placeholder="000000" value={code}
        onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
        style={{ ...inp, letterSpacing: 6, textAlign: 'center', fontSize: 20, fontWeight: 700 }}
        autoComplete="one-time-code" required disabled={loading}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />
      {error && <p style={{ fontSize: 12, color: '#ef5350', margin: '6px 0 0' }}>{error}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, alignItems: 'center' }}>
        <button type="submit" disabled={loading || code.length < 4} style={{
          padding: '8px 16px', background: 'var(--accent)', border: 'none',
          borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#000', cursor: 'pointer',
          opacity: (loading || code.length < 4) ? 0.5 : 1,
        }}>
          {loading ? 'Проверка…' : 'Подтвердить'}
        </button>
        <button type="button" onClick={handleResend} disabled={countdown > 0 || loading} style={{
          background: 'none', border: 'none', padding: 0, fontSize: 11,
          color: countdown > 0 ? 'var(--text-3)' : 'var(--accent)',
          cursor: countdown > 0 ? 'default' : 'pointer',
          textDecoration: countdown > 0 ? 'none' : 'underline',
        }}>
          {countdown > 0 ? `Повторно через ${countdown} с` : 'Отправить снова'}
        </button>
        <button type="button" onClick={() => { setStage('phone'); setCode(''); setError(null); }} style={{
          background: 'none', border: 'none', padding: 0,
          fontSize: 11, color: 'var(--text-3)', cursor: 'pointer', textDecoration: 'underline',
        }}>
          Изменить номер
        </button>
      </div>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClientDashboard({ botUsername, maxBotName }: Props) {
  const [authState, setAuthState]     = useState<AuthState>('loading');
  const [data, setData]               = useState<WebMeResponse | null>(null);
  const [loginError, setLoginError]   = useState<string | null>(null);
  const [editing, setEditing]         = useState(false);
  const [showPhoneLink, setShowPhoneLink] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const username  = botUsername || 'EATLYY_bot';

  async function loadData() {
    const me = await webApi.getMeData();
    setData(me);
    setAuthState('authenticated');
  }

  useEffect(() => {
    webApi.getMeData()
      .then(me => { setData(me); setAuthState('authenticated'); })
      .catch(() => setAuthState('unauthenticated'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authState !== 'unauthenticated') return;
    const container = widgetRef.current;
    if (!container) return;

    window.__EATLYY_TG_AUTH_DASHBOARD__ = async (tgUser) => {
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
    script.setAttribute('data-onauth', 'window.__EATLYY_TG_AUTH_DASHBOARD__(user)');
    script.onerror = () => setLoginError('Не удалось загрузить виджет Telegram.');
    container.appendChild(script);
    return () => { container.innerHTML = ''; delete window.__EATLYY_TG_AUTH_DASHBOARD__; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, username]);

  async function handleLogout() {
    await webApi.logout().catch(() => {});
    setData(null);
    setEditing(false);
    setAuthState('unauthenticated');
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (authState === 'loading') {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontSize: 14 }}>
        Загрузка…
      </div>
    );
  }

  // ── Unauthenticated ──────────────────────────────────────────────────────────

  if (authState === 'unauthenticated') {
    return (
      <div style={{ textAlign: 'center', paddingTop: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 18 }}>🔒</div>
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Войдите, чтобы открыть кабинет
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 28, lineHeight: 1.6 }}>
          Войдите через Telegram, MAX или телефон.
        </p>
        {loginError && (
          <p style={{ fontSize: 13, color: '#ef5350', marginBottom: 16 }}>{loginError}</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div ref={widgetRef} />
          <OrDivider />
          <MaxLoginButton onSuccess={loadData} />
          <OrDivider />
          <PhoneLoginForm onSuccess={loadData} />
        </div>
      </div>
    );
  }

  // ── Authenticated ────────────────────────────────────────────────────────────

  if (!data) return null;

  const { identity, profile, subscription, roles, expert, expertApplication, clientExpert, auth } = data;

  const displayName = profile?.preferredName ?? identity?.firstName ?? 'Кабинет';
  const tgBotUrl    = `https://t.me/${username}`;
  const maxBotUrl   = maxBotName ? `https://max.ru/${maxBotName}` : null;
  const hasProfileData = !!(profile?.heightCm || profile?.currentWeightKg || profile?.goalType || profile?.city || profile?.preferredName || profile?.sex);
  const hasMacros      = !!(profile?.dailyCaloriesKcal);

  // Which fields are still needed to calculate КБЖУ
  const missingForMacros = [
    !profile?.sex           && 'пол',
    !profile?.birthDate     && 'дата рождения',
    !profile?.heightCm      && 'рост',
    !profile?.currentWeightKg && 'текущий вес',
    !profile?.activityLevel && 'уровень активности',
  ].filter(Boolean) as string[];

  const SEX_LABELS: Record<string, string> = { male: 'Мужской', female: 'Женский' };
  const ACTIVITY_LABELS: Record<string, string> = {
    '1.2': 'Почти нет активности', '1.375': 'Лёгкая активность',
    '1.55': 'Средняя активность',  '1.725': 'Высокая активность', '1.9': 'Очень высокая',
  };

  return (
    <div>

      {/* ── A: Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
            textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
          }}>
            Личный кабинет
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: 'var(--text)', lineHeight: 1.1 }}>
            {displayName}
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 0 }}>
            <Badge label="Клиент" />
            {roles.isExpert  && <Badge label="Эксперт" />}
            {roles.isCompany && <Badge label="Компания" />}
            {roles.isAdmin   && <Badge label="Администратор" />}
          </div>
        </div>
        <button onClick={handleLogout} style={{
          marginTop: 4,
          background: 'none', border: 'none', padding: 0,
          color: 'var(--text-3)', fontSize: 12, cursor: 'pointer',
          textDecoration: 'underline', whiteSpace: 'nowrap',
        }}>
          Выйти
        </button>
      </div>

      {/* ── B: Profile card ── */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <SLabel>Мои данные</SLabel>
          {!editing && (
            <button onClick={() => setEditing(true)} style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: 12, color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, marginTop: -2,
            }}>
              Редактировать
            </button>
          )}
        </div>

        {editing ? (
          <EditProfileForm
            profile={profile}
            onSaved={(fresh) => { setData(fresh); setEditing(false); }}
            onCancel={() => setEditing(false)}
          />
        ) : hasProfileData ? (
          <>
            <Row label="Имя"          value={profile?.preferredName} />
            <Row label="Город"        value={profile?.city} />
            <Row label="Пол"          value={profile?.sex ? (SEX_LABELS[profile.sex] ?? profile.sex) : null} />
            <Row label="Дата рождения" value={profile?.birthDate
              ? new Date(profile.birthDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
              : null}
            />
            <Row label="Рост"         value={profile?.heightCm        ? `${profile.heightCm} см`        : null} />
            <Row label="Вес"          value={profile?.currentWeightKg ? `${profile.currentWeightKg} кг` : null} />
            <Row label="Желаемый вес" value={profile?.desiredWeightKg ? `${profile.desiredWeightKg} кг` : null} />
            <Row label="Цель"         value={profile?.goalType        ? (GOAL_LABELS[profile.goalType] ?? profile.goalType) : null} />
            <Row label="Активность"   value={profile?.activityLevel
              ? (ACTIVITY_LABELS[String(profile.activityLevel)] ?? String(profile.activityLevel))
              : null}
            />
          </>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 14 }}>
              Заполните данные, чтобы EATLYY рассчитал норму питания.
            </p>
            <button onClick={() => setEditing(true)} style={{
              padding: '8px 18px',
              background: 'var(--accent)', border: 'none',
              borderRadius: 8, fontSize: 13, fontWeight: 700,
              color: '#000', cursor: 'pointer',
            }}>
              Заполнить
            </button>
          </div>
        )}
      </Card>

      {/* ── C: КБЖУ card ── */}
      <Card>
        <SLabel>Цель и КБЖУ</SLabel>
        {hasMacros ? (
          <>
            {profile?.goalType && (
              <div style={{ marginBottom: 14 }}>
                <span style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontSize: 12, fontWeight: 700,
                  background: 'var(--accent-dim)',
                  color: 'var(--accent)',
                  border: '1px solid rgba(215,255,63,0.2)',
                }}>
                  {GOAL_LABELS[profile.goalType] ?? profile.goalType}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <MacroTile label="Калории"  value={profile?.dailyCaloriesKcal ?? null} unit="ккал" />
              <MacroTile label="Белки"    value={profile?.dailyProteinG     ?? null} unit="г" />
              <MacroTile label="Жиры"     value={profile?.dailyFatG         ?? null} unit="г" />
              <MacroTile label="Углеводы" value={profile?.dailyCarbsG       ?? null} unit="г" />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 12, lineHeight: 1.5 }}>
              Норма рассчитана на основе ваших данных профиля.
            </p>
          </>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 10 }}>
              КБЖУ пока не рассчитано.
            </p>
            {missingForMacros.length > 0 ? (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 14 }}>
                  Для расчёта нужно указать: <strong style={{ color: 'var(--text-2)' }}>{missingForMacros.join(', ')}</strong>.
                </p>
                <button
                  onClick={() => setEditing(true)}
                  style={{
                    padding: '9px 20px',
                    background: 'var(--accent)', border: 'none',
                    borderRadius: 8, fontSize: 13, fontWeight: 700,
                    color: '#000', cursor: 'pointer',
                  }}
                >
                  Заполнить анкету
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 14 }}>
                  Все данные есть — обновите профиль, чтобы пересчитать норму.
                </p>
                <button
                  onClick={() => setEditing(true)}
                  style={{
                    padding: '9px 20px',
                    background: 'none', border: '1px solid var(--border-2)',
                    borderRadius: 8, fontSize: 13, fontWeight: 600,
                    color: 'var(--text-2)', cursor: 'pointer',
                  }}
                >
                  Обновить профиль
                </button>
              </>
            )}
          </div>
        )}
      </Card>

      {/* ── D: Subscription card ── */}
      <Card>
        <SLabel>Подписка</SLabel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: subscription.accessLevel !== 'full' ? 12 : 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
              {subscription.planId ? (PLAN_LABELS[subscription.planId] ?? subscription.planId) : 'Free'}
            </div>
            {subscription.currentPeriodEnd && (
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                до {new Date(subscription.currentPeriodEnd).toLocaleDateString('ru-RU', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </div>
            )}
          </div>
          <span style={{
            padding: '4px 12px', borderRadius: 20,
            fontSize: 11, fontWeight: 700,
            background: subscription.accessLevel === 'full' ? 'rgba(76,175,80,0.12)' : 'rgba(255,255,255,0.05)',
            color:      subscription.accessLevel === 'full' ? '#4caf50' : 'var(--text-3)',
            border: `1px solid ${subscription.accessLevel === 'full' ? 'rgba(76,175,80,0.25)' : 'var(--border)'}`,
          }}>
            {subscription.accessLevel === 'full' ? 'Полный доступ' : 'Базовый'}
          </span>
        </div>
        {subscription.accessLevel !== 'full' && (
          <Link href="/pricing" style={{
            fontSize: 12, fontWeight: 600,
            color: 'var(--accent)', textDecoration: 'none',
          }}>
            Расширить доступ →
          </Link>
        )}
      </Card>

      {/* ── Auth methods card ── */}
      <Card>
        <SLabel>Способы входа</SLabel>

        {/* Telegram */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Telegram</span>
          {auth.identities.telegram.connected ? (
            <span style={{ fontSize: 12, color: '#4caf50', fontWeight: 600 }}>
              ✓{auth.identities.telegram.username ? ` @${auth.identities.telegram.username}` : ' подключён'}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>не подключён</span>
          )}
        </div>

        {/* MAX */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>MAX</span>
          {auth.identities.max.connected ? (
            <span style={{ fontSize: 12, color: '#4caf50', fontWeight: 600 }}>
              ✓{auth.identities.max.username ? ` @${auth.identities.max.username}` : ' подключён'}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>не подключён</span>
          )}
        </div>

        {/* Phone */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Телефон</span>
            {auth.identities.phone.connected ? (
              <span style={{ fontSize: 12, color: '#4caf50', fontWeight: 600 }}>
                ✓ {auth.identities.phone.phoneMasked}
              </span>
            ) : (
              <button
                onClick={() => setShowPhoneLink(v => !v)}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  fontSize: 12, color: 'var(--accent)', cursor: 'pointer',
                  fontWeight: 600, textDecoration: 'underline',
                }}
              >
                {showPhoneLink ? 'Отмена' : 'Привязать телефон'}
              </button>
            )}
          </div>

          {!auth.identities.phone.connected && showPhoneLink && (
            <PhoneLinkForm
              onSuccess={async () => {
                setShowPhoneLink(false);
                await loadData();
              }}
            />
          )}
        </div>
      </Card>

      {/* ── E: My Expert card ── */}
      <Card>
        <SLabel>Мой эксперт</SLabel>

        {clientExpert.hasExpert && clientExpert.expert ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              {clientExpert.expert.fullName ?? 'Эксперт'}
            </div>
            {clientExpert.expert.specialization && (
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>
                {clientExpert.expert.specialization}
                {clientExpert.expert.city ? ` · ${clientExpert.expert.city}` : ''}
              </div>
            )}
            {clientExpert.expert.slug && (
              <Link href={`/trainers/${clientExpert.expert.slug}`} style={{
                fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600,
              }}>
                Профиль эксперта →
              </Link>
            )}
          </>
        ) : clientExpert.pendingRequest ? (
          <>
            <div style={{ marginBottom: 10 }}>
              <span style={{
                display: 'inline-block',
                padding: '4px 12px', borderRadius: 20,
                fontSize: 11, fontWeight: 700,
                background: 'rgba(255,193,7,0.1)',
                color: '#ffc107',
                border: '1px solid rgba(255,193,7,0.25)',
              }}>
                Заявка отправлена
              </span>
            </div>
            {clientExpert.pendingRequest.expert?.fullName && (
              <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 6 }}>
                {clientExpert.pendingRequest.expert.fullName}
              </div>
            )}
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>
              Ожидаем ответа эксперта.
            </div>
            <Link href="/client/expert" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'underline' }}>
              Подробнее
            </Link>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 14 }}>
              У вас пока нет эксперта. Найдите специалиста в каталоге.
            </p>
            <Link href="/trainers" style={{
              display: 'inline-block',
              padding: '9px 20px',
              background: 'var(--accent)', border: 'none',
              borderRadius: 8, fontSize: 13, fontWeight: 700,
              color: '#000', textDecoration: 'none',
            }}>
              Выбрать эксперта
            </Link>
          </>
        )}
      </Card>

      {/* ── Expert application card ── */}
      {expertApplication.exists && expertApplication.status !== 'approved' && (
        <Card>
          <SLabel>Заявка эксперта</SLabel>
          {expertApplication.status && (
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: APP_STATUS[expertApplication.status]?.color ?? 'var(--text-2)',
              marginBottom: expertApplication.adminComment ? 8 : 0,
            }}>
              {APP_STATUS[expertApplication.status]?.text ?? expertApplication.status}
            </div>
          )}
          {expertApplication.adminComment && (
            <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5, marginTop: 4 }}>
              {expertApplication.adminComment}
            </p>
          )}
          {expertApplication.status === 'rejected' && (
            <Link href="/experts/apply" style={{
              display: 'inline-block', marginTop: 10,
              fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600,
            }}>
              Подать повторно →
            </Link>
          )}
        </Card>
      )}

      {/* ── Expert cabinet links ── */}
      {(roles.isExpert || roles.isCompany) && (
        <Card>
          <SLabel>Кабинет {roles.isCompany ? 'компании' : 'эксперта'}</SLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link href="/expert/profile" style={{ fontSize: 14, color: 'var(--text-2)', textDecoration: 'none', display: 'flex', justifyContent: 'space-between' }}>
              <span>Мой профиль эксперта</span>
              <span style={{ color: 'var(--text-3)' }}>→</span>
            </Link>
            <div style={{ height: 1, background: 'var(--border)' }} />
            <Link href="/expert/requests" style={{ fontSize: 14, color: 'var(--text-2)', textDecoration: 'none', display: 'flex', justifyContent: 'space-between' }}>
              <span>Заявки клиентов</span>
              <span style={{ color: 'var(--text-3)' }}>→</span>
            </Link>
            {expert.slug && (
              <>
                <div style={{ height: 1, background: 'var(--border)' }} />
                <Link href={`/trainers/${expert.slug}`} style={{ fontSize: 14, color: 'var(--text-2)', textDecoration: 'none', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Публичный профиль</span>
                  <span style={{ color: 'var(--text-3)' }}>→</span>
                </Link>
              </>
            )}
          </div>
        </Card>
      )}

      {/* ── F: Quick actions ── */}
      <Card>
        <SLabel>Быстрые действия</SLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <QuickLink href="/trainers"      label="Каталог экспертов" />
          <QuickLink href="/client/expert" label="Мой эксперт" />
          {!expertApplication.exists && !roles.isExpert && !roles.isCompany && (
            <QuickLink href="/experts/apply" label="Стать экспертом" />
          )}
          <QuickLink href="/support"  label="Поддержка" />
          <QuickLink href={tgBotUrl}  label="Telegram бот" external />
          {maxBotUrl && <QuickLink href={maxBotUrl} label="MAX бот" external />}
        </div>
      </Card>

    </div>
  );
}
