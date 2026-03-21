import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import type { UserProfile, SubscriptionInfo } from '../../types';

interface LinkData {
  id: number;
  status: string;
  fullHistoryAccess: boolean;
  connectedAt: string;
}

export default function CoachClientCardScreen() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['trainer-client', clientId], queryFn: () => api.trainerClientCard(clientId!) });
  if (isLoading) return <div className="loading"><div className="spinner" /></div>;
  const p = data?.profile as UserProfile | null;
  const sub = data?.subscription as SubscriptionInfo | null;
  const link = data?.link as LinkData | null;
  return (
    <div className="screen">
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: 16, marginBottom: 12, padding: 0, color: 'var(--tg-theme-link-color)' }}>← Назад</button>
      <h1 style={{ marginBottom: 16 }}>Клиент</h1>
      <div className="card">
        <div className="card-title">Данные</div>
        {p?.currentWeightKg && <div className="stat-row"><span className="stat-label">⚖️ Вес</span><span className="stat-value">{p.currentWeightKg} кг</span></div>}
        {p?.desiredWeightKg && <div className="stat-row"><span className="stat-label">🎯 Желаемый</span><span className="stat-value">{p.desiredWeightKg} кг</span></div>}
        {p?.dailyCaloriesKcal && <div className="stat-row"><span className="stat-label">🔥 Норма</span><span className="stat-value">{p.dailyCaloriesKcal} ккал</span></div>}
        {link && <div className="stat-row"><span className="stat-label">📂 Доступ</span><span className="stat-value">{link.fullHistoryAccess ? 'Полный' : 'С подключения'}</span></div>}
      </div>
      <div className="card">
        <div className="card-title">Подписка</div>
        <StatusBadge status={sub?.status ?? 'free'} />
        {sub?.currentPeriodEnd && (
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--tg-theme-hint-color)' }}>
            До {new Date(sub.currentPeriodEnd).toLocaleDateString('ru-RU')}
          </div>
        )}
      </div>
      <button className="btn" onClick={() => navigate(`/client/${clientId}/stats`)}>📊 Статистика клиента</button>
    </div>
  );
}
