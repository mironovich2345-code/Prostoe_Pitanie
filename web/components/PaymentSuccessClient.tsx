'use client';

import { useState } from 'react';
import Link from 'next/link';
import { webApi, ApiError, type WebSubscriptionInfo } from '@/lib/webApi';

const PLAN_LABELS: Record<string, string> = {
  free: 'Free', optimal: 'Оптимальный', client_monthly: 'Оптимальный',
  pro: 'Pro', intro: 'Pro Intro',
};

export default function PaymentSuccessClient() {
  const [checkState, setCheckState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [sub, setSub] = useState<WebSubscriptionInfo | null>(null);

  async function checkSubscription() {
    setCheckState('loading');
    try {
      const r = await webApi.getWebSubscription();
      setSub(r.subscription);
      setCheckState('done');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setCheckState('error');
      } else {
        setCheckState('error');
      }
    }
  }

  return (
    <div style={{ textAlign: 'center', paddingTop: 32 }}>
      <div style={{
        width: 52, height: 52, borderRadius: 16,
        background: 'rgba(76,175,80,0.12)', border: '1px solid rgba(76,175,80,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px', color: '#4caf50',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M5 12l5 5 9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: 'var(--text)', marginBottom: 10 }}>
        Платёж обрабатывается
      </h1>
      <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: 28, maxWidth: 380, margin: '0 auto 28px' }}>
        Мы обновим подписку после подтверждения оплаты. Обычно это занимает несколько секунд.
      </p>

      {checkState === 'done' && sub && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl)', padding: '16px 22px', marginBottom: 20,
          display: 'inline-block', textAlign: 'left', minWidth: 260,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 10 }}>
            Статус подписки
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: sub.accessLevel === 'full' ? '#4caf50' : 'var(--text)', marginBottom: 4 }}>
            {sub.planId ? (PLAN_LABELS[sub.planId] ?? sub.planId) : 'Free'}
            {sub.accessLevel === 'full' && ' — активна'}
          </div>
          {sub.accessLevel !== 'full' && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
              Подписка ещё не активирована. Если оплата прошла успешно, попробуйте проверить через несколько секунд.
            </div>
          )}
        </div>
      )}

      {checkState === 'error' && (
        <p style={{ fontSize: 13, color: '#ef5350', marginBottom: 16 }}>
          Не удалось загрузить статус подписки. Войдите в личный кабинет.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', marginTop: checkState === 'done' ? 16 : 0 }}>
        {checkState !== 'done' && (
          <button
            onClick={checkSubscription}
            disabled={checkState === 'loading'}
            style={{
              padding: '11px 28px', background: 'var(--accent)', border: 'none',
              borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#000',
              cursor: checkState === 'loading' ? 'default' : 'pointer',
              opacity: checkState === 'loading' ? 0.6 : 1,
            }}
          >
            {checkState === 'loading' ? 'Проверка…' : 'Проверить статус'}
          </button>
        )}
        <Link href="/client" style={{
          padding: '11px 28px',
          background: 'none', border: '1px solid var(--border-2)',
          borderRadius: 10, fontSize: 14, fontWeight: 600,
          color: 'var(--text-2)', textDecoration: 'none',
        }}>
          В личный кабинет
        </Link>
      </div>
    </div>
  );
}
