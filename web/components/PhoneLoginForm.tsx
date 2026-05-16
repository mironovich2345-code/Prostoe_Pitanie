'use client';

import { useState, useEffect, useRef } from 'react';
import { webApi, ApiError } from '@/lib/webApi';

type Stage = 'phone' | 'code';

const RESEND_COOLDOWN_S = 60;

interface Props {
  onSuccess: () => Promise<void>;
}

export default function PhoneLoginForm({ onSuccess }: Props) {
  const [stage, setStage]     = useState<Stage>('phone');
  const [loading, setLoading] = useState(false);
  const [phone, setPhone]     = useState('');
  const [code, setCode]       = useState('');
  const [error, setError]     = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  function startCountdown() {
    setCountdown(RESEND_COOLDOWN_S);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); timerRef.current = null; return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  function errorText(err: unknown, context: 'request' | 'verify'): string {
    const code = err instanceof ApiError ? err.code : null;
    if (context === 'request') {
      if (code === 'invalid_phone')           return 'Неверный формат номера. Введите +79...';
      if (code === 'rate_limit_exceeded')     return 'Слишком много попыток. Подождите немного.';
      if (code === 'resend_too_soon')         return 'Повторная отправка доступна через минуту.';
      if (code === 'sms_provider_not_configured') return 'SMS временно недоступны. Используйте другой способ входа.';
      return 'Ошибка отправки SMS. Попробуйте ещё раз.';
    }
    if (code === 'invalid_code')              return 'Неверный код. Попробуйте ещё раз.';
    if (code === 'code_not_found_or_expired') return 'Код устарел. Запросите новый.';
    if (code === 'too_many_attempts')         return 'Слишком много попыток. Запросите новый код.';
    return 'Ошибка входа. Попробуйте ещё раз.';
  }

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await webApi.requestPhoneCode(phone);
      setCode('');
      setStage('code');
      startCountdown();
    } catch (err) {
      setError(errorText(err, 'request'));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await webApi.verifyPhoneCode(phone, code);
      await onSuccess();
    } catch (err) {
      setError(errorText(err, 'verify'));
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0 || loading) return;
    setError(null);
    setLoading(true);
    try {
      await webApi.requestPhoneCode(phone);
      setCode('');
      startCountdown();
    } catch (err) {
      setError(errorText(err, 'request'));
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--surface)',
    border: '1px solid var(--border-2)',
    borderRadius: 8,
    fontSize: 15,
    color: 'var(--text)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const btnPrimaryStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 0',
    background: 'var(--surface)',
    border: '1px solid var(--border-2)',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-2)',
    cursor: 'pointer',
    marginTop: 10,
  };

  if (stage === 'phone') {
    return (
      <form onSubmit={handleRequestCode} style={{ maxWidth: 300, margin: '0 auto' }}>
        <input
          type="tel"
          placeholder="+79990000000"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          style={inputStyle}
          autoComplete="tel"
          required
          disabled={loading}
        />
        {error && (
          <p style={{ fontSize: 12, color: '#ef5350', margin: '6px 0 0', textAlign: 'left' }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !phone.trim()}
          style={{ ...btnPrimaryStyle, opacity: (loading || !phone.trim()) ? 0.5 : 1 }}
        >
          {loading ? 'Отправка…' : 'Получить SMS-код'}
        </button>
      </form>
    );
  }

  // stage === 'code'
  return (
    <form onSubmit={handleVerifyCode} style={{ maxWidth: 300, margin: '0 auto' }}>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 10, textAlign: 'left' }}>
        Код отправлен на{' '}
        <strong style={{ color: 'var(--text-2)' }}>{phone}</strong>
        <br />
        <span style={{ fontSize: 12 }}>Код действует несколько минут.</span>
      </p>
      <input
        type="text"
        inputMode="numeric"
        pattern="\d*"
        maxLength={6}
        placeholder="000000"
        value={code}
        onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
        style={{ ...inputStyle, letterSpacing: 6, textAlign: 'center', fontSize: 22, fontWeight: 700 }}
        autoComplete="one-time-code"
        required
        disabled={loading}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />
      {error && (
        <p style={{ fontSize: 12, color: '#ef5350', margin: '6px 0 0', textAlign: 'left' }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading || code.length < 4}
        style={{ ...btnPrimaryStyle, opacity: (loading || code.length < 4) ? 0.5 : 1 }}
      >
        {loading ? 'Проверка…' : 'Войти'}
      </button>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleResend}
          disabled={countdown > 0 || loading}
          style={{
            background: 'none', border: 'none', padding: 0,
            fontSize: 12,
            color: countdown > 0 ? 'var(--text-3)' : 'var(--accent)',
            cursor: countdown > 0 ? 'default' : 'pointer',
            textDecoration: countdown > 0 ? 'none' : 'underline',
          }}
        >
          {countdown > 0 ? `Отправить снова через ${countdown} с` : 'Отправить снова'}
        </button>
        <span style={{ color: 'var(--text-3)', fontSize: 12, userSelect: 'none' }}>·</span>
        <button
          type="button"
          onClick={() => { setStage('phone'); setCode(''); setError(null); }}
          style={{
            background: 'none', border: 'none', padding: 0,
            fontSize: 12, color: 'var(--text-3)', cursor: 'pointer', textDecoration: 'underline',
          }}
        >
          Изменить номер
        </button>
      </div>
    </form>
  );
}
