import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../ui';
import StatusBadge from '../../components/StatusBadge';
import type { BootstrapData, SubscriptionStatus } from '../../types';

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
    tagline: 'Для результата с поддержкой тренера',
    popular: true,
    features: [
      'Всё, что входит в Optimal',
      'Подключение тренера',
      'Гибкие права доступа для тренера',
      'Просмотр рациона тренером',
      'Оценка приёмов пищи и дней тренером',
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

// ─── Status bar color ──────────────────────────────────────────────────────

function statusBarColor(status: SubscriptionStatus | 'free'): string {
  if (status === 'active') return 'var(--accent)';
  if (status === 'trial')  return 'var(--warn)';
  if (status === 'expired' || status === 'past_due') return 'var(--danger)';
  return 'var(--border-2, rgba(255,255,255,0.13))';
}

// ─── Current plan card ─────────────────────────────────────────────────────

function CurrentPlanCard({ bootstrap }: { bootstrap: BootstrapData }) {
  const sub = bootstrap.subscription;
  const statusKey = (sub?.status ?? 'free') as SubscriptionStatus | 'free';

  const PLAN_LABELS: Record<string, string> = {
    free: 'Бесплатный', basic: 'Базовый', optimal: 'Optimal', pro: 'Pro',
  };
  const planLabel = sub ? (PLAN_LABELS[sub.planId] ?? sub.planId) : 'Бесплатный';

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
          Текущий тариф
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: sub?.trialEndsAt || sub?.currentPeriodEnd ? 14 : 0 }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.6, color: 'var(--text)', lineHeight: 1 }}>
            {planLabel}
          </div>
          <StatusBadge status={statusKey} />
        </div>

        {sub?.trialEndsAt && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Пробный период до</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
              {new Date(sub.trialEndsAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </span>
          </div>
        )}
        {sub?.currentPeriodEnd && !sub?.trialEndsAt && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sub.autoRenew ? 6 : 0 }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Действует до</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
              {new Date(sub.currentPeriodEnd).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        )}
        {sub?.autoRenew && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Автопродление</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              Включено
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Plan card ─────────────────────────────────────────────────────────────

function PlanCard({ plan, onSubscribe }: { plan: PlanDef; onSubscribe: (id: PlanDef['id']) => void }) {
  const isPro = plan.popular;

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--r-xl)',
      border: isPro ? '1.5px solid var(--accent)' : '1px solid var(--border)',
      marginBottom: 10,
      overflow: 'hidden',
      position: 'relative',
    }}>

      {/* Popular badge */}
      {isPro && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          background: 'var(--accent)', color: '#000',
          fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
          padding: '3px 10px', borderRadius: 20,
          textTransform: 'uppercase',
        }}>
          Популярно
        </div>
      )}

      <div style={{ padding: '20px 18px 18px' }}>

        {/* Header */}
        <div style={{ marginBottom: 4, paddingRight: isPro ? 80 : 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, color: isPro ? 'var(--accent)' : 'var(--text)', lineHeight: 1, marginBottom: 4 }}>
            {plan.label}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>
            {plan.tagline}
          </div>
        </div>

        {/* Price */}
        <div style={{ marginTop: 14, marginBottom: 18, display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.8, color: 'var(--text)', lineHeight: 1 }}>
            {plan.price}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}> / месяц</span>
        </div>

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
              <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>{f}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => onSubscribe(plan.id)}
          className={isPro ? 'btn' : 'btn btn-secondary'}
          style={{ fontSize: 15, fontWeight: 600 }}
        >
          Подключить
        </button>
      </div>
    </div>
  );
}

// ─── Subscribe toast ───────────────────────────────────────────────────────

function SubscribeToast({ onDone }: { onDone: () => void }) {
  // auto-dismiss
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
        Выбери тариф
      </div>

      {/* Pro first, then Optimal */}
      {PLANS.map(plan => (
        <PlanCard key={plan.id} plan={plan} onSubscribe={handleSubscribe} />
      ))}

      {/* Toast */}
      {toastVisible && <SubscribeToast onDone={() => setToastVisible(false)} />}
    </div>
  );
}
