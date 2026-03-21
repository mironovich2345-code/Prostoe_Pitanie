import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

interface Reward {
  id: number;
  referredChatId: string;
  planId: string;
  amountRub: number;
  status: string;
  createdAt: string;
}

export default function CoachReferralsScreen() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['trainer-rewards'], queryFn: api.trainerRewards });
  if (isLoading) return <div className="loading"><div className="spinner" /></div>;
  const rewards = (data?.rewards ?? []) as Reward[];
  return (
    <div className="screen">
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: 16, marginBottom: 12, padding: 0, color: 'var(--tg-theme-link-color)' }}>← Назад</button>
      <h1 style={{ marginBottom: 16 }}>🎯 Рефералы</h1>
      {rewards.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">🎯</div><div>Рефералов пока нет</div></div>
      ) : (
        <div className="card">
          {rewards.map((r: Reward) => (
            <div key={r.id} className="meal-item">
              <div className="meal-item-header"><span>Клиент {r.referredChatId}</span><span>+{r.amountRub} ₽</span></div>
              <div className="meal-item-meta">{r.planId} · {r.status} · {new Date(r.createdAt).toLocaleDateString('ru-RU')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
