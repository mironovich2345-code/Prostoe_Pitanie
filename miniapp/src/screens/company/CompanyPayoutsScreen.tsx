import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

export default function CompanyPayoutsScreen() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['trainer-rewards'], queryFn: api.trainerRewards });

  if (isLoading) return <div className="loading"><div className="spinner" /></div>;

  const s = data?.summary ?? { total: 0, available: 0, paidOut: 0 };

  return (
    <div className="screen">
      <button
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', fontSize: 22, marginBottom: 12, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
      >
        ‹
      </button>

      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: 'var(--text)', marginBottom: 20 }}>
        Вывод средств
      </div>

      {/* Balance summary */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-3)', marginBottom: 6 }}>Начислено</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: 'var(--text)', lineHeight: 1 }}>
            {s.total.toLocaleString('ru')}
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginLeft: 3 }}>₽</span>
          </div>
        </div>
        <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--accent)', padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-3)', marginBottom: 6 }}>К выводу</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: 'var(--accent)', lineHeight: 1 }}>
            {s.available.toLocaleString('ru')}
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginLeft: 3 }}>₽</span>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>Выплачено всего</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-2)' }}>{s.paidOut.toLocaleString('ru')} ₽</span>
        </div>
      </div>

      {/* Payout placeholder */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)', padding: '32px 20px',
        textAlign: 'center',
      }}>
        <div style={{ opacity: 0.25, marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>
          Вывод средств
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
          Будет доступен в следующем обновлении
        </div>
      </div>
    </div>
  );
}
