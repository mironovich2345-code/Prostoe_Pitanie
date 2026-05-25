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
  features: string[];
  cta: string;
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

  const description = sub.hasPro
    ? 'Pro активен — AI-функции и работа с личным экспертом открыты.'
    : sub.hasOptimal
    ? 'AI-анализ питания активен. Для работы с экспертом нужен Pro.'
    : 'Базовый дневник питания без ограничений.';

  return (
    <Card>
      <SLabel>Текущая подписка</SLabel>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
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
          padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0,
          background: sub.accessLevel === 'full' ? 'rgba(76,175,80,0.12)' : 'rgba(255,255,255,0.05)',
          color: sub.accessLevel === 'full' ? '#4caf50' : 'var(--text-3)',
          border: `1px solid ${sub.accessLevel === 'full' ? 'rgba(76,175,80,0.25)' : 'var(--border)'}`,
        }}>
          {sub.accessLevel === 'full' ? 'Активна' : 'Базовый'}
        </span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{description}</div>
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
        {payState === 'creating' ? 'Создание платежа…' : `Оплатить — ${display.price}`}
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
      key: 'optimal', name: 'Оптимальный', price: '399 ₽', period: 'в месяц',
      badge: null, accent: false, cta: 'Оформить Оптимальный',
      desc: 'AI-анализ питания, полная история, расширенная статистика.',
      features: ['AI-анализ еды по фото', 'AI-разбор рациона за неделю', 'Расширенная статистика', 'История веса и прогресс'],
    },
    {
      key: 'pro', name: 'Pro', price: '499 ₽', period: 'в месяц',
      badge: null, accent: true, cta: 'Оформить Pro',
      desc: 'Всё из Оптимального + личный эксперт видит ваш дневник.',
      features: ['Всё из Оптимального', 'Подключение личного эксперта', 'Эксперт видит дневник и прогресс', 'Приоритетная поддержка'],
    },
  ];

  if (offers.canUseProIntro) {
    plans.push({
      key: 'pro_intro', name: 'Pro Intro', price: '1 ₽', period: '3 дня',
      badge: 'Специальное предложение', accent: false, cta: 'Попробовать Pro за 1 ₽',
      desc: `Полный доступ Pro на 3 дня за 1 ₽. Далее ${offers.proIntro.thenPriceRub} ₽/мес, отмена в любой момент.`,
      features: ['Полный доступ Pro на 3 дня', `Далее ${offers.proIntro.thenPriceRub} ₽/мес`, 'Только для первой покупки'],
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
      {/* Free info */}
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)', padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-3)', marginBottom: 2 }}>Free</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>0 ₽ навсегда</div>
          </div>
          {!sub.planId && (
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>
              Текущий
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {['Дневник питания', 'Ручной ввод КБЖУ', 'Базовая статистика'].map(f => (
            <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>—</span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {plans.map(plan => {
        const isCurrent =
          (plan.key === 'optimal' && sub.hasOptimal) ||
          (plan.key === 'pro' && sub.hasPro) ||
          (plan.key === 'pro_intro' && sub.hasPro);
        const isSelected = selected === plan.key;
        const isProIntro = plan.key === 'pro_intro';

        return (
          <div key={plan.key} style={{
            position: 'relative',
            background: plan.accent ? 'var(--accent)' : isProIntro ? 'var(--surface-2)' : 'var(--surface)',
            border: isSelected
              ? '2px solid rgba(215,255,63,0.6)'
              : plan.accent ? '2px solid var(--accent)'
              : isProIntro ? '1px solid rgba(215,255,63,0.2)'
              : '1px solid var(--border)',
            borderRadius: 'var(--r-xl)', padding: '18px 20px',
            color: plan.accent ? '#0A0A0A' : 'inherit',
            marginTop: isProIntro ? 4 : 0,
          }}>
            {plan.badge && (
              <div style={{
                position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                background: isProIntro ? 'var(--accent)' : '#0A0A0A',
                color: isProIntro ? '#0A0A0A' : 'var(--accent)',
                fontSize: 11, fontWeight: 800, padding: '3px 14px', borderRadius: 20,
                whiteSpace: 'nowrap', border: isProIntro ? 'none' : '1px solid var(--accent)',
              }}>
                {plan.badge}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: plan.accent ? 'rgba(10,10,10,0.6)' : 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
                <span style={{ fontSize: 11, fontWeight: 700, color: '#4caf50', background: 'rgba(76,175,80,0.12)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(76,175,80,0.25)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  Текущий
                </span>
              ) : (
                <button
                  onClick={() => onSelect(plan.key)}
                  style={{
                    padding: '7px 14px', flexShrink: 0,
                    background: plan.accent ? '#0A0A0A' : isSelected ? 'rgba(215,255,63,0.12)' : 'rgba(255,255,255,0.05)',
                    color: plan.accent ? 'var(--accent)' : isSelected ? 'var(--accent)' : 'var(--text-2)',
                    border: plan.accent ? 'none' : isSelected ? '1px solid rgba(215,255,63,0.35)' : '1px solid var(--border)',
                    borderRadius: 8, fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {isSelected ? 'Выбрано' : (isProIntro ? 'За 1 ₽' : 'Выбрать')}
                </button>
              )}
            </div>

            <p style={{ fontSize: 12, color: plan.accent ? 'rgba(10,10,10,0.65)' : 'var(--text-3)', margin: '0 0 12px', lineHeight: 1.5 }}>
              {plan.desc}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, borderTop: `1px solid ${plan.accent ? 'rgba(10,10,10,0.12)' : 'var(--border)'}`, paddingTop: 10 }}>
              {plan.features.map(f => (
                <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: plan.accent ? '#0A0A0A' : 'var(--accent)', flexShrink: 0 }}>+</span>
                  <span style={{ fontSize: 12, color: plan.accent ? 'rgba(10,10,10,0.8)' : 'var(--text-2)' }}>{f}</span>
                </div>
              ))}
            </div>

            {!isCurrent && (
              <button
                onClick={() => onSelect(plan.key)}
                style={{
                  marginTop: 14, width: '100%', padding: '11px 0',
                  background: plan.accent ? '#0A0A0A' : isSelected ? 'var(--accent)' : 'transparent',
                  color: plan.accent ? 'var(--accent)' : isSelected ? '#000' : 'var(--text-2)',
                  border: plan.accent ? 'none' : `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border-2)'}`,
                  borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {isSelected ? `Выбрано — ${plan.cta}` : plan.cta}
              </button>
            )}
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
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', color: 'var(--text-3)' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="9" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
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
      {/* Hero */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 6 }}>
          Подписка EATLYY
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: 'var(--text)', marginBottom: 8 }}>
          Управление подпиской
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
          Выберите доступ под свой сценарий: самостоятельный контроль питания или работа с личным экспертом.
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
