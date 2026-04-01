import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import type { UserProfile, SubscriptionInfo } from '../../types';

interface LinkData {
  id: number;
  clientId: string;
  status: string;
  fullHistoryAccess: boolean;
  connectedAt: string;
}

interface ClientItem {
  link: LinkData;
  profile: UserProfile | null;
  subscription: SubscriptionInfo | null;
}

export default function CoachClientsScreen() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['trainer-clients'], queryFn: api.trainerClients });
  if (isLoading) return <div className="loading"><div className="spinner" /></div>;
  const clients = (data?.clients ?? []) as unknown as ClientItem[];
  if (!clients.length) {
    return (
      <div className="screen">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ margin: 0 }}>👥 Клиенты</h1>
          <button onClick={() => navigate('/connect-client')} className="btn" style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }}>+ Добавить</button>
        </div>
        <div className="empty-state"><div className="empty-state-icon">👥</div><div>Клиентов пока нет</div></div>
      </div>
    );
  }
  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>👥 Клиенты ({clients.length})</h1>
        <button
          onClick={() => navigate('/connect-client')}
          className="btn"
          style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }}
        >
          + Добавить
        </button>
      </div>
      <div className="card">
        {clients.map((c: ClientItem) => (
          <div key={c.link.id} className="client-item" onClick={() => navigate(`/client/${c.link.clientId}`)}>
            <div>
              <div style={{ fontWeight: 600 }}>{c.profile?.chatId ?? c.link.clientId}</div>
              <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)', marginTop: 2 }}>
                {c.profile?.currentWeightKg ? `${c.profile.currentWeightKg} кг` : '—'}
                {c.link.status === 'frozen' && ' · заморожен'}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <StatusBadge status={c.subscription?.status ?? 'free'} />
              <span style={{ color: 'var(--tg-theme-hint-color)', fontSize: 18 }}>›</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
