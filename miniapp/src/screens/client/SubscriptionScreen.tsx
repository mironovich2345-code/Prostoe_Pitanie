import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../ui';
import StatusBadge from '../../components/StatusBadge';
import type { BootstrapData, SubscriptionStatus, TrainerOfferType } from '../../types';

interface Props { bootstrap: BootstrapData; }

// ─── Plan definitions ──────────────────────────────────────────────────────

interface PlanDef {
  id: 'pro' | 'optimal';
  label: string;
  price: string;
  tagline: string;
  features: string[];
  popular?: boolean;
}

const PLANS: PlanDef[] = [
  {
    id: 'pro',
    label: 'Pro',
    price: '499 ₽',
    tagline: 'Для результата с поддержкой эксперта',
    popular: true,
    features: [
      'Всё, что входит в Optimal',
      'Подключение эксперта',
      'Гибкие права доступа для эксперта',
      'Просмотр рациона экспертом',
      'Оценка приёмов пищи и дней экспертом',
      'Совместный контроль прогресса',
      'Расширенная реферальная программа',
    ],
  },
  {
    id: 'optimal',
    label: 'Optimal',
    price: '399 ₽',
    tagline: 'Для самостоятельного контроля питания',
    features: [
      'Анализ приёма пищи по фото / голосу / тексту',
      'Автоматический подсчёт калорий и БЖУ',
      'Сохранение приёмов пищи в дневник',
      'Статистика по дням и неделям',
      'Календарь питания с отмеченными приёмами',
      'Редактирование уведомлений',
      'История веса и прогресса',
      'Прогноз достижения цели',
    ],
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

function CurrentPlanCard({ bootstrap }: { bootstrap: BootstrapData }) {
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
        {active && sub?.autoRenew && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Автопродление</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              Включено
            </span>
          </div>
        )}
        {!active && sub && (
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
            Подписка неактивна — выберите тариф ниже для повторного подключения
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

        {/* Plan name + tagline */}
        <div style={{ paddingRight: 80, marginBottom: 4 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1, marginBottom: 5,
            color: isPro ? 'var(--accent)' : 'var(--text)',
          }}>
            {plan.label}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>
            {plan.tagline}
          </div>
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
        <div style={{ marginBottom: 18 }}>
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

// ─── Subscribe toast ───────────────────────────────────────────────────────

function SubscribeToast({ onDone }: { onDone: () => void }) {
  setTimeout(onDone, 2200);
  return (
    <div style={{
      position: 'fixed', bottom: 88, left: 16, right: 16, zIndex: 300,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)',
      padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warn)', flexShrink: 0 }} />
      <span style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.4 }}>
        Оплата будет доступна в ближайшее время
      </span>
    </div>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function SubscriptionScreen({ bootstrap }: Props) {
  const navigate = useNavigate();
  const [toastVisible, setToastVisible] = useState(false);

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

  function handleSubscribe(_planId: PlanDef['id']) {
    // TODO: integrate payment when ready
    setToastVisible(true);
  }

  return (
    <div className="screen">
      <PageHeader title="Подписка" onBack={() => navigate('/profile')} />

      {/* Current plan status */}
      <CurrentPlanCard bootstrap={bootstrap} />

      {/* Plans section label */}
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: 1, color: 'var(--text-3)', padding: '0 2px 12px',
      }}>
        Тарифы
      </div>

      {/* Pro first, then Optimal */}
      {PLANS.map(plan => (
        <PlanCard
          key={plan.id}
          plan={plan}
          cardState={getCardState(plan.id)}
          onSubscribe={handleSubscribe}
          introOffer={plan.id === 'pro' ? proIntroOffer : null}
        />
      ))}

      {/* Toast */}
      {toastVisible && <SubscribeToast onDone={() => setToastVisible(false)} />}
    </div>
  );
}
