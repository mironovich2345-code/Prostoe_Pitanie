'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  webApi, ApiError,
  type WebSubscriptionInfo, type WebSubscriptionOffers,
} from '@/lib/webApi';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanKey = 'optimal' | 'pro' | 'pro_intro';

interface PlanCard {
  key: PlanKey;
  name: string;
  price: string;
  period: string;
  badge: string | null;
  desc: string;
  accent: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  free: 'Free', optimal: 'Оптимальный', client_monthly: 'Оптимальный',
  pro: 'Pro', intro: 'Pro Intro',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Активна', trial: 'Пробный период', past_due: 'Просрочена',
  canceled: 'Отменена', expired: 'Истекла',
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Plan error messages ──────────────────────────────────────────────────────

function paymentErrorText(code: string): string {
  if (code === 'subscription_terms_required') return 'Примите условия подписки.';
  if (code === 'intro_already_used') return 'Пробный период уже был использован.';
  if (code === 'payment_provider_not_configured') return 'Онлайн-оплата временно недоступна. Пожалуйста, попробуйте позже.';
  if (code === 'receipt_email_required') return 'Ваш магазин требует email для чека. Введите email и попробуйте снова.';
  if (code === 'invalid_plan_id') return 'Неверный тариф. Обновите страницу и попробуйте снова.';
  if (code === 'payment_creation_failed') return 'Не удалось создать платёж. Попробуйте ещё раз.';
  return `Ошибка: ${code}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

// ─── Current subscription display ────────────────────────────────────────────

function CurrentSubCard({ sub }: { sub: WebSubscriptionInfo }) {
  const planName = sub.planId ? (PLAN_LABELS[sub.planId] ?? sub.planId) : 'Free';
  const statusLabel = sub.status ? (STATUS_LABELS[sub.status] ?? sub.status) : null;
  const endDate = formatDate(sub.trialEndsAt ?? sub.currentPeriodEnd);

  return (
    <Card>
      <SLabel>Текущая подписка</SLabel>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>
            {planName}
          </div>
          {statusLabel && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 2 }}>{statusLabel}</div>
          )}
          {endDate && (
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>до {endDate}</div>
          )}
        </div>
        <span style={{
          padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
          background: sub.accessLevel === 'full' ? 'rgba(76,175,80,0.12)' : 'rgba(255,255,255,0.05)',
          color: sub.accessLevel === 'full' ? '#4caf50' : 'var(--text-3)',
          border: `1px solid ${sub.accessLevel === 'full' ? 'rgba(76,175,80,0.25)' : 'var(--border)'}`,
        }}>
          {sub.accessLevel === 'full' ? 'Полный доступ' : 'Базовый'}
        </span>
      </div>
    </Card>
  );
}

// ─── Checkout panel ───────────────────────────────────────────────────────────

interface CheckoutPanelProps {
  selected: PlanKey | null;
  sub: WebSubscriptionInfo;
  onSelectPlan: (p: PlanKey | null) => void;
}

function CheckoutPanel({ selected, sub, onSelectPlan }: CheckoutPanelProps) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [email, setEmail] = useState('');
  const [payState, setPayState] = useState<'idle' | 'creating' | 'error'>('idle');
  const [payError, setPayError] = useState<string | null>(null);
  const [needEmail, setNeedEmail] = useState(false);

  const PLAN_DISPLAY: Record<PlanKey, { name: string; price: string }> = {
    optimal: { name: 'Оптимальный', price: '399 ₽/мес' },
    pro: { name: 'Pro', price: '499 ₽/мес' },
    pro_intro: { name: 'Pro Intro', price: '1 ₽ / 3 дня, затем 499 ₽/мес' },
  };

  async function handlePay() {
    if (!selected || !termsAccepted) return;
    setPayState('creating');
    setPayError(null);

    const returnUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/payment/success`
      : undefined;

    try {
      const result = await webApi.createWebPayment({
        planId: selected,
        acceptedSubscriptionTerms: true,
        returnUrl,
        receiptEmail: email.trim() || undefined,
      });
      if (result.ok) {
        window.location.href = result.payment.confirmationUrl;
      }
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'payment_creation_failed';
      if (code === 'receipt_email_required') {
        setNeedEmail(true);
      }
      setPayError(paymentErrorText(code));
      setPayState('error');
    }
  }

  if (!selected) {
    return (
      <Card style={{ background: 'rgba(255,255,255,0.02)', borderStyle: 'dashed' }}>
        <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', margin: 0 }}>
          Выберите тариф выше
        </p>
      </Card>
    );
  }

  const display = PLAN_DISPLAY[selected];
  const isAlreadyOnPlan =
    (selected === 'optimal' && sub.hasOptimal) ||
    (selected === 'pro' && sub.hasPro);

  if (isAlreadyOnPlan) {
    return (
      <Card>
        <p style={{ fontSize: 13, color: '#4caf50', margin: 0 }}>
          У вас уже активен этот тариф.
        </p>
      </Card>
    );
  }

  const inp: React.CSSProperties = {
    display: 'block', width: '100%', boxSizing: 'border-box',
    padding: '9px 12px', background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-2)', borderRadius: 8,
    fontSize: 13, color: 'var(--text)', outline: 'none',
  };

  return (
    <Card>
      <SLabel>Оформление</SLabel>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{display.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{display.price}</div>
        </div>
        <button onClick={() => onSelectPlan(null)} style={{
          background: 'none', border: 'none', fontSize: 12, color: 'var(--text-3)', cursor: 'pointer',
        }}>
          Изменить
        </button>
      </div>

      {/* Terms */}
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 14 }}>
        <input
          type="checkbox" checked={termsAccepted}
          onChange={e => setTermsAccepted(e.target.checked)}
          disabled={payState === 'creating'}
          style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--accent)', width: 16, height: 16 }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
          Я принимаю{' '}
          <a href="/legal" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            условия подписки и документы сервиса
          </a>
          , в том числе условия автопродления.
        </span>
      </label>

      {/* Email (shown always if needEmail=true, otherwise optional) */}
      <div style={{ marginBottom: 14 }}>
        <label style={{
          display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4,
        }}>
          Email для чека{needEmail ? '' : ' (необязательно)'}
        </label>
        <input
          type="email" value={email}
          onChange={e => { setEmail(e.target.value); if (payState === 'error') { setPayState('idle'); setPayError(null); } }}
          placeholder="example@mail.ru"
          style={{ ...inp, borderColor: needEmail && !email.trim() ? '#ef5350' : undefined }}
          disabled={payState === 'creating'}
        />
      </div>

      {payError && (
        <p style={{ fontSize: 12, color: '#ef5350', marginBottom: 10 }}>{payError}</p>
      )}

      <button
        onClick={handlePay}
        disabled={!termsAccepted || payState === 'creating'}
        style={{
          display: 'block', width: '100%',
          padding: '12px 0', background: 'var(--accent)', border: 'none',
          borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#000',
          cursor: (!termsAccepted || payState === 'creating') ? 'default' : 'pointer',
          opacity: (!termsAccepted || payState === 'creating') ? 0.5 : 1,
        }}
      >
        {payState === 'creating' ? 'Создание платежа…' : `Перейти к оплате — ${display.price}`}
      </button>

      <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10, lineHeight: 1.5 }}>
        Платёж защищён ЮKassa. После оплаты подписка активируется автоматически.
      </p>
    </Card>
  );
}

// ─── Plan grid ────────────────────────────────────────────────────────────────

interface PlanGridProps {
  sub: WebSubscriptionInfo;
  offers: WebSubscriptionOffers;
  selected: PlanKey | null;
  onSelect: (p: PlanKey) => void;
}

function PlanGrid({ sub, offers, selected, onSelect }: PlanGridProps) {
  const plans: PlanCard[] = [
    {
      key: 'optimal', name: 'Оптимальный', price: '399 ₽', period: 'в месяц', badge: null, accent: false,
      desc: 'Анализ фото и голоса, полная история питания.',
    },
    {
      key: 'pro', name: 'Pro', price: '499 ₽', period: 'в месяц', badge: null, accent: true,
      desc: 'Всё из Оптимального + подключение личного эксперта.',
    },
  ];

  if (offers.canUseProIntro) {
    plans.push({
      key: 'pro_intro', name: 'Pro Intro', price: '1 ₽', period: '3 дня', badge: 'Первая покупка', accent: false,
      desc: `Пробный доступ Pro на 3 дня за 1 ₽. Затем ${offers.proIntro.thenPriceRub} ₽/мес.`,
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
      {/* Free info */}
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)', padding: '16px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-3)', marginBottom: 2 }}>Free</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Базовый дневник питания · 0 ₽</div>
        </div>
        {!sub.planId && (
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>
            Текущий
          </span>
        )}
      </div>

      {plans.map(plan => {
        const isCurrent =
          (plan.key === 'optimal' && sub.hasOptimal) ||
          (plan.key === 'pro' && sub.hasPro) ||
          (plan.key === 'pro_intro' && sub.hasPro);
        const isSelected = selected === plan.key;

        return (
          <div key={plan.key} style={{
            position: 'relative',
            background: plan.accent ? 'var(--accent)' : 'var(--surface)',
            border: isSelected
              ? '2px solid #4caf50'
              : plan.accent ? '2px solid var(--accent)' : '1px solid var(--border)',
            borderRadius: 'var(--r-xl)', padding: '18px 20px',
            color: plan.accent ? '#0A0A0A' : 'inherit',
          }}>
            {plan.badge && (
              <div style={{
                position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                background: '#0A0A0A', color: 'var(--accent)',
                fontSize: 11, fontWeight: 800, padding: '3px 14px', borderRadius: 20,
                whiteSpace: 'nowrap', border: '1px solid var(--accent)',
              }}>
                {plan.badge}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2, color: plan.accent ? 'rgba(10,10,10,0.6)' : 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {plan.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1, color: plan.accent ? '#0A0A0A' : 'var(--text)' }}>
                    {plan.price}
                  </span>
                  <span style={{ fontSize: 12, color: plan.accent ? 'rgba(10,10,10,0.6)' : 'var(--text-3)' }}>
                    / {plan.period}
                  </span>
                </div>
              </div>
              {isCurrent ? (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#4caf50', background: 'rgba(76,175,80,0.12)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(76,175,80,0.25)', whiteSpace: 'nowrap' }}>
                  Текущий
                </span>
              ) : (
                <button
                  onClick={() => onSelect(plan.key)}
                  style={{
                    padding: '7px 16px',
                    background: plan.accent ? '#0A0A0A' : isSelected ? '#4caf50' : 'transparent',
                    color: plan.accent ? 'var(--accent)' : isSelected ? '#fff' : 'var(--text)',
                    border: plan.accent ? 'none' : `1.5px solid ${isSelected ? '#4caf50' : 'var(--border-2)'}`,
                    borderRadius: 8, fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {isSelected ? 'Выбрано ✓' : 'Выбрать'}
                </button>
              )}
            </div>
            <p style={{ fontSize: 13, color: plan.accent ? 'rgba(10,10,10,0.7)' : 'var(--text-3)', margin: 0, lineHeight: 1.5 }}>
              {plan.desc}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SubscriptionPageClient() {
  const [authState, setAuthState]   = useState<'loading' | 'unauthenticated' | 'ok' | 'error'>('loading');
  const [sub,       setSub]         = useState<WebSubscriptionInfo | null>(null);
  const [offers,    setOffers]      = useState<WebSubscriptionOffers | null>(null);
  const [selected,  setSelected]    = useState<PlanKey | null>(null);

  useEffect(() => {
    webApi.getWebSubscription()
      .then(r => { setSub(r.subscription); setOffers(r.offers); setAuthState('ok'); })
      .catch(err => {
        if (err instanceof ApiError && err.status === 401) setAuthState('unauthenticated');
        else setAuthState('error');
      });
  }, []);

  if (authState === 'loading') {
    return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>Загрузка…</div>;
  }

  if (authState === 'unauthenticated') {
    return (
      <div style={{ textAlign: 'center', paddingTop: 32 }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>🔒</div>
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Войдите, чтобы оформить подписку
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 28 }}>
          Авторизуйтесь в личном кабинете, чтобы управлять подпиской.
        </p>
        <Link href="/client" style={{
          display: 'inline-block', padding: '11px 28px',
          background: 'var(--accent)', borderRadius: 10,
          fontSize: 14, fontWeight: 700, color: '#000', textDecoration: 'none',
        }}>
          Войти в кабинет
        </Link>
      </div>
    );
  }

  if (authState === 'error' || !sub || !offers) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: '#ef5350' }}>
        Ошибка загрузки данных. Обновите страницу.
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 6 }}>
          Подписка
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: 'var(--text)' }}>
          Управление подпиской
        </div>
      </div>

      <CurrentSubCard sub={sub} />

      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 10, marginTop: 4 }}>
        Тарифы
      </div>

      <PlanGrid sub={sub} offers={offers} selected={selected} onSelect={setSelected} />

      <CheckoutPanel
        selected={selected}
        sub={sub}
        onSelectPlan={setSelected}
      />

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <Link href="/client" style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'underline' }}>
          ← В личный кабинет
        </Link>
      </div>
    </div>
  );
}
