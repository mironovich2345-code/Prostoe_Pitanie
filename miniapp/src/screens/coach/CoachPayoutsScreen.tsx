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
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: 16, marginBottom: 12, padding: 0, color: 'var(--tg-theme-link-color)' }}>← Назад</button>
      <h1 style={{ marginBottom: 16 }}>💰 Начисления</h1>
      <div className="card">
        <div className="stat-row"><span className="stat-label">Начислено всего</span><span className="stat-value">{s.total} ₽</span></div>
        <div className="stat-row"><span className="stat-label">Доступно к выводу</span><span className="stat-value" style={{ color: '#28a745' }}>{s.available} ₽</span></div>
        <div className="stat-row"><span className="stat-label">Выплачено</span><span className="stat-value">{s.paidOut} ₽</span></div>
      </div>
      <div className="card" style={{ textAlign: 'center', color: 'var(--tg-theme-hint-color)', fontSize: 14 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
        Вывод средств будет доступен в следующем обновлении
      </div>
    </div>
  );
}
