import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../ui';
import StatusBadge from '../../components/StatusBadge';
import type { BootstrapData, SubscriptionStatus } from '../../types';

interface Props { bootstrap: BootstrapData; }

// ─── Plan metadata ─────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  free: 'Бесплатный',
  basic: 'Базовый',
  pro: 'Про',
};

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    'Запись приёмов пищи',
    'Дневник питания',
    'AI-анализ блюд',
  ],
  basic: [
    'Запись приёмов пищи',
    'Дневник питания',
    'AI-анализ блюд и фото',
    'Умные напоминания о приёмах пищи',
    'Статистика и аналитика питания',
    'Прогноз по достижению цели',
  ],
  pro: [
    'Всё из тарифа Базовый',
    'Подключение персонального тренера',
    'История питания для тренера',
    'Приоритетная поддержка',
  ],
};

function statusAccentColor(status: SubscriptionStatus | 'free'): string {
  if (status === 'active') return 'var(--accent)';
  if (status === 'trial')  return 'var(--warn)';
  if (status === 'expired' || status === 'past_due') return 'var(--danger)';
  return 'var(--border-2, rgba(255,255,255,0.13))';
}

// ─── Feature dot row ───────────────────────────────────────────────────────

function FeatureRow({ text, last }: { text: string; last: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
      borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: 'var(--accent)', flexShrink: 0,
      }} />
      <span style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.4 }}>{text}</span>
    </div>
  );
}

// ─── Date row ──────────────────────────────────────────────────────────────

function DateRow({ label, date }: { label: string; date: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
        {new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
      </span>
    </div>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function SubscriptionScreen({ bootstrap }: Props) {
  const navigate = useNavigate();
  const sub = bootstrap.subscription;

  const planId     = sub?.planId ?? 'free';
  const statusKey  = sub?.status ?? 'free';
  const planLabel  = PLAN_LABELS[planId] ?? planId;
  const features   = PLAN_FEATURES[planId] ?? PLAN_FEATURES.free;
  const accentBar  = statusAccentColor(statusKey as SubscriptionStatus | 'free');

  const hasDates = sub?.trialEndsAt || sub?.currentPeriodEnd;

  function openBot() {
    window.Telegram?.WebApp?.close();
  }

  return (
    <div className="screen">
      <PageHeader title="Подписка" onBack={() => navigate('/profile')} />

      {/* ── Hero plan card ─────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)',
        marginBottom: 12,
        overflow: 'hidden',
      }}>
        {/* Status accent bar */}
        <div style={{ height: 3, background: accentBar }} />

        <div style={{ padding: '20px' }}>
          {/* Plan name + badge */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: hasDates ? 16 : 0 }}>
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: 1, color: 'var(--text-3)', marginBottom: 6,
              }}>
                Тариф
              </div>
              <div style={{
                fontSize: 30, fontWeight: 700, letterSpacing: -0.8,
                color: 'var(--text)', lineHeight: 1,
              }}>
                {planLabel}
              </div>
            </div>
            <StatusBadge status={statusKey} />
          </div>

          {/* Dates */}
          {sub?.trialEndsAt && (
            <DateRow label="Пробный период до" date={sub.trialEndsAt} />
          )}
          {sub?.currentPeriodEnd && !sub?.trialEndsAt && (
            <DateRow label="Действует до" date={sub.currentPeriodEnd} />
          )}
          {sub?.autoRenew && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Автопродление</span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px',
                borderRadius: 20, background: 'var(--accent-soft)', color: 'var(--accent)',
              }}>
                Включено
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: 1, color: 'var(--text-3)', padding: '4px 2px 10px',
      }}>
        Включено в тариф
      </div>
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        marginBottom: 12,
      }}>
        {features.map((f, i) => (
          <FeatureRow key={f} text={f} last={i === features.length - 1} />
        ))}
      </div>

      {/* ── Management note ────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)',
        padding: '18px 16px',
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 14 }}>
          Продление, изменение тарифа и отмена подписки доступны в чате с ботом.
        </div>
        <button
          onClick={openBot}
          className="btn btn-secondary"
          style={{ fontSize: 14 }}
        >
          Перейти в бот
        </button>
      </div>
    </div>
  );
}
