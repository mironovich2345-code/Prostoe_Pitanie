import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

export default function CoachPayoutsScreen() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['trainer-rewards'], queryFn: api.trainerRewards });
  if (isLoading) return <div className="loading"><div className="spinner" /></div>;
  const s = data?.summary ?? { total: 0, available: 0, paidOut: 0 };
  return (
    <div className="screen">
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: 22, marginBottom: 12, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}>‹</button>
      <h1 style={{ marginBottom: 16 }}>Начисления</h1>
      <div className="card">
        <div className="stat-row"><span className="stat-label">Начислено всего</span><span className="stat-value">{s.total} ₽</span></div>
        <div className="stat-row"><span className="stat-label">Доступно к выводу</span><span className="stat-value" style={{ color: '#28a745' }}>{s.available} ₽</span></div>
        <div className="stat-row"><span className="stat-label">Выплачено</span><span className="stat-value">{s.paidOut} ₽</span></div>
      </div>
      <div className="card" style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
        <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center', opacity: 0.3 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
        </div>
        Вывод средств будет доступен в следующем обновлении
      </div>
    </div>
  );
}
