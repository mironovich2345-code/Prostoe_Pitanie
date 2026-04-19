import { useNavigate } from 'react-router-dom';

interface PaywallCardProps {
  plan: 'optimal' | 'pro';
  feature?: string;
  /** Compact inline badge, no button */
  compact?: boolean;
}

function getContextNote(plan: 'optimal' | 'pro', feature?: string): string {
  const f = (feature ?? '').toLowerCase();
  if (plan === 'pro') {
    if (f.includes('эксперт') || f.includes('подключение')) {
      return 'С экспертом проще держать режим: меньше срывов, выше дисциплина, быстрее результат.';
    }
    return 'Доступно в Pro — с экспертом, который видит рацион и помогает не съезжать с цели.';
  }
  // optimal
  if (f.includes('прогноз')) {
    return 'Подключи Optimal — и ты увидишь не только записи, но и куда движешься к своей цели.';
  }
  if (f.includes('анализ')) {
    return 'Подключи Optimal, чтобы видеть не только записи, но и где теряешь результат.';
  }
  if (f.includes('история') || f.includes('статистик') || f.includes('вес')) {
    return 'Подключи Optimal — получи полную аналитику питания и понимай свой прогресс.';
  }
  if (f.includes('уведомлен') || f.includes('напоминан')) {
    return 'Подключи Optimal — настрой напоминания и не пропускай приёмы пищи.';
  }
  return 'Подключи Optimal — питание из хаоса превратится в управляемый процесс.';
}

export default function PaywallCard({ plan, feature, compact }: PaywallCardProps) {
  const navigate = useNavigate();
  const planLabel = plan === 'pro' ? 'Pro' : 'Optimal';
  const planNote  = getContextNote(plan, feature);

  if (compact) {
    return (
      <button
        onClick={() => navigate('/subscription')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600,
          color: 'var(--text-3)', cursor: 'pointer',
        }}
      >
        🔒 {planLabel}+
      </button>
    );
  }

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r-lg)',
      border: '1px solid var(--border)', padding: '16px 18px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 15 }}>🔒</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          {feature ? `${feature}` : 'Функция'} — {planLabel}+
        </span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5, margin: '0 0 12px 0' }}>
        {planNote}
      </p>
      <button
        onClick={() => navigate('/subscription')}
        style={{
          padding: '8px 16px', fontSize: 13, fontWeight: 600,
          borderRadius: 8, border: 'none',
          background: 'var(--accent-soft)', color: 'var(--accent)',
          cursor: 'pointer',
        }}
      >
        Выбрать {planLabel} →
      </button>
    </div>
  );
}
