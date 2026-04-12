import { useNavigate } from 'react-router-dom';

interface PaywallCardProps {
  plan: 'optimal' | 'pro';
  feature?: string;
  /** Compact inline badge, no button */
  compact?: boolean;
}

export default function PaywallCard({ plan, feature, compact }: PaywallCardProps) {
  const navigate = useNavigate();
  const planLabel = plan === 'pro' ? 'Pro' : 'Optimal';
  const planNote  = plan === 'pro'
    ? 'Доступно в тарифе Pro'
    : 'Доступно в тарифах Optimal и Pro';

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
        Подключить →
      </button>
    </div>
  );
}
