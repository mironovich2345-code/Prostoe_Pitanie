import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../ui';
import StatusBadge from '../../components/StatusBadge';
import { api } from '../../api/client';
import { useTrackEvent } from '../../hooks/useTrackEvent';
import type { BootstrapData, SubscriptionStatus, TrainerOfferType } from '../../types';

interface Props { bootstrap: BootstrapData; }

// ─── Plan definitions ──────────────────────────────────────────────────────

interface PlanDef {
  id: 'pro' | 'optimal';
  label: string;
  price: string;
  tagline: string;
  subtitle?: string;
  features: string[];
  footer?: string;
  popular?: boolean;
}

const PLANS: PlanDef[] = [
  {
    id: 'pro',
    label: 'Pro',
    price: '499 ₽',
    tagline: 'Идти к результату с экспертом',
    subtitle: 'Когда нужен человек, который видит твой рацион и помогает держать курс.',
    popular: true,
    features: [
      'Всё, что входит в Optimal',
      'Подключите эксперта-нутрициолога',
      'Эксперт видит ваш рацион и оценивает приёмы',
      'Совместный контроль прогресса и цели',
      'Расширенная реферальная программа',
    ],
    footer: 'Для тех, кто хочет не просто начать — а прийти к результату.',
  },
  {
    id: 'optimal',
    label: 'Optimal',
    price: '399 ₽',
    tagline: 'Держать питание под контролем самому',
    subtitle: 'Не просто записывай еду — понимай, что ешь и куда движешься.',
    features: [
      'Анализ еды по фото, голосу и тексту',
      'Автоподсчёт калорий, белков, жиров и углеводов',
      'Дневник, статистика, календарь питания и вес',
      'Уведомления, прогноз цели и история прогресса',
    ],
    footer: 'Для тех, кто хочет навести порядок в питании без лишних сложностей.',
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Normalize any planId string from API to our UI buckets */
function normalizePlanId(planId: string | undefined | null): 'pro' | 'optimal' | 'free' {
  if (!planId) return 'free';
  if (planId === 'pro' || planId === 'intro') return 'pro';
  if (planId === 'optimal' || planId === 'basic' || planId === 'client_monthly') return 'optimal';
  return 'free';
}

function isActiveStatus(status: SubscriptionStatus | 'free'): boolean {
  return status === 'active' || status === 'trial';
}

function statusBarColor(status: SubscriptionStatus | 'free'): string {
  if (status === 'active' || status === 'trial') return 'var(--accent)';
  if (status === 'expired' || status === 'past_due' || status === 'canceled') return 'var(--danger)';
  return 'rgba(255,255,255,0.1)';
}

// ─── Current plan card (top) ───────────────────────────────────────────────

function CurrentPlanCard({
  bootstrap,
  confirmingCancel,
  isCancelling,
  onRequestCancel,
  onConfirmCancel,
  onAbortCancel,
}: {
  bootstrap: BootstrapData;
  confirmingCancel: boolean;
  isCancelling: boolean;
  onRequestCancel: () => void;
  onConfirmCancel: () => void;
  onAbortCancel: () => void;
}) {
  const sub = bootstrap.subscription;
  const statusKey = (sub?.status ?? 'free') as SubscriptionStatus | 'free';
  const active = isActiveStatus(statusKey);

  const PLAN_LABELS: Record<string, string> = {
    free: 'Бесплатный', intro: 'Pro Intro', trial: 'Pro Intro',
    basic: 'Optimal', client_monthly: 'Optimal', optimal: 'Optimal', pro: 'Pro',
  };

  // When inactive, show the plan name only as historical context, not as the current active plan
  const planLabel = sub
    ? (PLAN_LABELS[sub.planId] ?? sub.planId)
    : 'Бесплатный';

  // Only show date rows if subscription is currently active
  const showIntroDate = active && !!sub?.trialEndsAt;
  const showPeriodDate = active && !!sub?.currentPeriodEnd && !sub?.trialEndsAt;
  const showDateRow = showIntroDate || showPeriodDate;

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--r-xl)',
      border: '1px solid var(--border)',
      marginBottom: 20,
      overflow: 'hidden',
    }}>
      <div style={{ height: 3, background: statusBarColor(statusKey) }} />
      <div style={{ padding: '18px 18px 20px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 10 }}>
          {active ? 'Текущий тариф' : 'Тариф'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showDateRow ? 14 : 0 }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.6, color: active ? 'var(--text)' : 'var(--text-3)', lineHeight: 1 }}>
            {planLabel}
          </div>
          <StatusBadge status={statusKey} />
        </div>
        {showIntroDate && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Intro до</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
              {new Date(sub!.trialEndsAt!).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </span>
          </div>
        )}
        {showPeriodDate && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sub!.autoRenew ? 6 : 0 }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Действует до</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
              {new Date(sub!.currentPeriodEnd!).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        )}
        {/* autoRenew + saved payment method → real recurring billing */}
        {active && sub?.autoRenew && sub?.hasPaymentMethod && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Автопродление</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              Включено
            </span>
          </div>
        )}

        {/* autoRenew=true but no saved payment method — be honest with the user */}
        {active && sub?.autoRenew && !sub?.hasPaymentMethod && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Автопродление</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                Недоступно
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>
              Способ оплаты не поддерживает автосписание — продлите вручную до окончания периода.
            </div>
          </div>
        )}

        {/* Cancel auto-renewal — only shown when a real payment method is saved */}
        {active && sub?.autoRenew && sub?.hasPaymentMethod && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            {!confirmingCancel ? (
              <button
                onClick={onRequestCancel}
                disabled={isCancelling}
                style={{
                  width: '100%', padding: '10px 0', fontSize: 13, fontWeight: 600,
                  borderRadius: 10, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-3)',
                  cursor: 'pointer', textAlign: 'center',
                }}
              >
                Отключить автосписание
              </button>
            ) : (
              <div style={{
                background: 'rgba(255,59,48,0.07)', border: '1px solid rgba(255,59,48,0.2)',
                borderRadius: 12, padding: '14px 16px',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                  Отключить автосписание?
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 14 }}>
                  Текущий оплаченный период сохранится. После его окончания подписка не продлится автоматически — нужно будет продлить вручную.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={onConfirmCancel}
                    disabled={isCancelling}
                    style={{
                      flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700,
                      borderRadius: 10, border: 'none',
                      background: 'rgba(255,59,48,0.15)', color: 'var(--danger)',
                      cursor: isCancelling ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isCancelling ? 'Отключаем...' : 'Да, отключить'}
                  </button>
                  <button
                    onClick={onAbortCancel}
                    disabled={isCancelling}
                    style={{
                      flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600,
                      borderRadius: 10, border: '1px solid var(--border)',
                      background: 'var(--surface-2)', color: 'var(--text-2)',
                      cursor: 'pointer',
                    }}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {!active && sub && (
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.5 }}>
            {sub.status === 'past_due'
              ? 'Оплата не прошла — выберите тариф ниже, чтобы не выпасть из режима.'
              : 'Доступ закрыт. Чтобы не терять контроль над питанием — выберите тариф ниже.'}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Plan card ─────────────────────────────────────────────────────────────

type CardState = 'active' | 'available' | 'unavailable';

/**
 * introOffer controls the Pro price slot:
 *   null          → show standard price (499 ₽/мес)
 *   'pro_3day'    → show "3 дня за 1 ₽"  (no trainer offer, first purchase)
 *   'month_1rub'  → show "1 месяц за 1 ₽" (trainer month_1rub offer)
 */
type IntroOffer = 'pro_3day' | 'month_1rub' | null;

function PlanCard({
  plan,
  cardState,
  onSubscribe,
  introOffer = null,
}: {
  plan: PlanDef;
  cardState: CardState;
  onSubscribe: (id: PlanDef['id']) => void;
  introOffer?: IntroOffer;
}) {
  const isPro    = plan.popular;
  const isActive = cardState === 'active';
  const isUnavailable = cardState === 'unavailable';

  // Border: active pro → accent + glow-ish; available pro → accent; optimal → grey
  const borderStyle = isPro
    ? `1.5px solid ${isActive ? 'var(--accent)' : 'var(--accent)'}`
    : `1px solid ${isActive ? 'var(--border-2, rgba(255,255,255,0.13))' : 'var(--border)'}`;

  // Background tint for active state
  const bgOverlay = isActive ? 'var(--accent-dim, rgba(215,255,63,0.05))' : 'var(--surface)';

  return (
    <div style={{
      background: bgOverlay,
      borderRadius: 'var(--r-xl)',
      border: borderStyle,
      marginBottom: 10,
      overflow: 'hidden',
      position: 'relative',
      opacity: isUnavailable ? 0.55 : 1,
      transition: 'opacity 0.2s',
    }}>

      {/* "Популярно" badge — always on Pro */}
      {isPro && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          background: isActive ? 'var(--accent)' : 'var(--accent)',
          color: '#000',
          fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
          padding: '3px 10px', borderRadius: 20,
          textTransform: 'uppercase',
        }}>
          Популярно
        </div>
      )}

      {/* "Активен" badge — on active non-pro */}
      {isActive && !isPro && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          color: 'var(--text-2)',
          fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          padding: '3px 10px', borderRadius: 20,
          textTransform: 'uppercase',
        }}>
          Активен
        </div>
      )}

      {/* "Активен" badge — on active Pro (alongside "Популярно") */}
      {isActive && isPro && (
        <div style={{
          position: 'absolute', top: 42, right: 14,
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          padding: '3px 10px', borderRadius: 20,
          textTransform: 'uppercase',
        }}>
          Активен
        </div>
      )}

      <div style={{ padding: '20px 18px 18px' }}>

        {/* Plan name + tagline + subtitle */}
        <div style={{ paddingRight: 80, marginBottom: 4 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1, marginBottom: 5,
            color: isPro ? 'var(--accent)' : 'var(--text)',
          }}>
            {plan.label}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>
            {plan.tagline}
          </div>
          {plan.subtitle && (
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, marginTop: 6 }}>
              {plan.subtitle}
            </div>
          )}
        </div>

        {/* Price */}
        {introOffer && !isActive ? (
          <div style={{ marginTop: 14, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.8, color: 'var(--accent)', lineHeight: 1 }}>
                {introOffer === 'month_1rub' ? '1 месяц за 1 ₽' : '3 дня за 1 ₽'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 5 }}>
              Затем 499 ₽/мес
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 14, marginBottom: 16, display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.8, color: 'var(--text)', lineHeight: 1 }}>
              {plan.price}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}> / месяц</span>
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />

        {/* Features */}
        <div style={{ marginBottom: plan.footer ? 14 : 18 }}>
          {plan.features.map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 9 }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                background: isPro ? 'var(--accent)' : 'var(--text-3)',
              }} />
              <span style={{ fontSize: 13, color: isUnavailable ? 'var(--text-3)' : 'var(--text-2)', lineHeight: 1.45 }}>{f}</span>
            </div>
          ))}
        </div>

        {/* Footer note */}
        {plan.footer && (
          <div style={{
            fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5,
            fontStyle: 'italic', marginBottom: 16,
          }}>
            {plan.footer}
          </div>
        )}

        {/* CTA */}
        {isActive ? (
          <button
            disabled
            className="btn btn-secondary"
            style={{
              fontSize: 14, cursor: 'default',
              color: 'var(--text-3)',
              opacity: 1,
              border: '1px solid var(--border)',
            }}
          >
            Текущий тариф
          </button>
        ) : isUnavailable ? (
          <button
            disabled
            className="btn btn-ghost"
            style={{
              fontSize: 14, cursor: 'default',
              color: 'var(--text-3)',
              opacity: 1,
            }}
          >
            Недоступно
          </button>
        ) : (
          <button
            onClick={() => onSubscribe(plan.id)}
            className={isPro ? 'btn' : 'btn btn-secondary'}
            style={{ fontSize: 15, fontWeight: 600 }}
          >
            {introOffer ? 'Начать за 1 ₽' : 'Подключить'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Error toast ───────────────────────────────────────────────────────────

function ErrorToast({ message, onDone }: { message: string; onDone: () => void }) {
  setTimeout(onDone, 3500);
  return (
    <div style={{
      position: 'fixed', bottom: 88, left: 16, right: 16, zIndex: 300,
      background: 'var(--surface)',
      border: '1px solid rgba(255,59,48,0.4)',
      borderRadius: 'var(--r-md)',
      padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 }} />
      <span style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.4 }}>{message}</span>
    </div>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function SubscriptionScreen({ bootstrap }: Props) {
  useTrackEvent('subscription_opened');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  // Set to true after opening the YooKassa page so we know to re-fetch bootstrap
  // when the user returns (visibility change after payment redirect).
  const paymentStarted = useRef(false);

  const cancelAutoRenewMutation = useMutation({
    mutationFn: api.cancelAutoRenew,
    onSuccess: () => {
      setConfirmingCancel(false);
      qc.invalidateQueries({ queryKey: ['bootstrap'] });
    },
    onError: () => {
      setConfirmingCancel(false);
      setErrorMsg('Не удалось отключить автосписание. Попробуйте позже.');
    },
  });

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && paymentStarted.current) {
        // User came back from YooKassa — refresh bootstrap so status updates immediately
        qc.invalidateQueries({ queryKey: ['bootstrap'] });
        paymentStarted.current = false;
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [qc]);

  const sub = bootstrap.subscription;
  const statusKey = (sub?.status ?? 'free') as SubscriptionStatus | 'free';
  const subIsActive = isActiveStatus(statusKey);
  const activePlan = subIsActive ? normalizePlanId(sub?.planId) : 'free';

  /**
   * First-purchase heuristic: user has no subscription record at all.
   * NOTE: users who migrated from legacy chatId-only flow may also have null here
   * until backfill runs. Conservative — only show intro offer when truly no record.
   */
  const isFirstPurchase = sub === null;
  const trainerOffer: TrainerOfferType | null = bootstrap.trainerOfferType ?? null;

  /**
   * Resolve which intro offer to show on the Pro card:
   *   month_1rub trainer offer + first purchase → '1 месяц за 1 ₽'
   *   no trainer offer + first purchase          → '3 дня за 1 ₽'
   *   one_time / lifetime trainer offer          → null (client sees normal price)
   *   not first purchase                         → null
   */
  function getProIntroOffer(): IntroOffer {
    if (!isFirstPurchase) return null;
    if (trainerOffer === 'month_1rub') return 'month_1rub';
    if (trainerOffer === 'one_time' || trainerOffer === 'lifetime') return null;
    return 'pro_3day';
  }
  const proIntroOffer = getProIntroOffer();

  /** Determine card state for each plan */
  function getCardState(planId: 'pro' | 'optimal'): CardState {
    if (subIsActive && activePlan === planId) return 'active';
    // Pro is active → downgrade to Optimal not allowed
    if (subIsActive && activePlan === 'pro' && planId === 'optimal') return 'unavailable';
    return 'available';
  }

  const paymentMutation = useMutation({
    mutationFn: ({ planId, offer }: { planId: 'pro' | 'optimal'; offer?: 'pro_3day' | 'month_1rub' }) =>
      api.createPayment(planId, offer),
    onSuccess: (data) => {
      // Open YooKassa payment page.
      // Prefer Telegram's openLink (opens in external browser, mini app stays open).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tgWebApp = window.Telegram?.WebApp as any;
      const url = data.confirmationUrl;
      paymentStarted.current = true;
      if (typeof tgWebApp?.openLink === 'function') {
        tgWebApp.openLink(url);
      } else {
        window.open(url, '_blank');
      }
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || 'Не удалось создать платёж. Попробуйте позже.');
    },
  });

  function handleSubscribe(planId: PlanDef['id']) {
    setErrorMsg(null);
    api.trackEvent('subscription_connect_clicked', { planId });
    const offer = planId === 'pro' && proIntroOffer ? proIntroOffer : undefined;
    paymentMutation.mutate({ planId, offer });
  }

  return (
    <div className="screen">
      <PageHeader title="Подписка" onBack={() => navigate('/profile')} />

      {/* Current plan status */}
      <CurrentPlanCard
        bootstrap={bootstrap}
        confirmingCancel={confirmingCancel}
        isCancelling={cancelAutoRenewMutation.isPending}
        onRequestCancel={() => setConfirmingCancel(true)}
        onConfirmCancel={() => cancelAutoRenewMutation.mutate()}
        onAbortCancel={() => setConfirmingCancel(false)}
      />

      {/* Plans section label */}
      <div style={{ padding: '0 2px 12px' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: 1, color: 'var(--text-3)', marginBottom: 4,
        }}>
          Тарифы
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
          Optimal — самостоятельный контроль питания. Pro — когда нужен эксперт рядом.
        </div>
      </div>

      {/* Pro first, then Optimal */}
      {PLANS.map(plan => (
        <PlanCard
          key={plan.id}
          plan={plan}
          cardState={paymentMutation.isPending ? 'unavailable' : getCardState(plan.id)}
          onSubscribe={handleSubscribe}
          introOffer={plan.id === 'pro' ? proIntroOffer : null}
        />
      ))}

      {/* Supporting block below plans */}
      {!subIsActive && (
        <div style={{
          marginTop: 4, marginBottom: 8, padding: '14px 16px',
          background: 'var(--surface)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.55 }}>
            Без контроля питание легко уходит в хаос. Начни с Optimal — и ты будешь понимать, что ешь и куда движешься.
          </div>
        </div>
      )}

      {/* Loading indicator while creating payment */}
      {paymentMutation.isPending && (
        <div style={{
          position: 'fixed', bottom: 88, left: 16, right: 16, zIndex: 300,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', padding: '14px 18px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <div className="spinner" style={{ width: 16, height: 16, flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: 'var(--text-2)' }}>Открываем страницу оплаты…</span>
        </div>
      )}

      {/* Error */}
      {errorMsg && <ErrorToast message={errorMsg} onDone={() => setErrorMsg(null)} />}
    </div>
  );
}
