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
  clientAlias: string | null;
}

interface ClientItem {
  link: LinkData;
  profile: UserProfile | null;
  subscription: SubscriptionInfo | null;
  displayName: string;
}

function ClientAvatar({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
      background: 'var(--accent-soft)', border: '1.5px solid rgba(215,255,63,0.18)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 16, fontWeight: 700, color: 'var(--accent)',
    }}>
      {initial}
    </div>
  );
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
          <h1 style={{ margin: 0 }}>Клиенты</h1>
          <button onClick={() => navigate('/connect-client')} className="btn" style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }}>+ Добавить</button>
        </div>
        <div className="empty-state"><div className="empty-state-icon">👥</div><div>Клиентов пока нет</div></div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Клиенты {clients.length}</h1>
        <button onClick={() => navigate('/connect-client')} className="btn" style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }}>
          + Добавить
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {clients.map((c: ClientItem) => {
          const name = c.displayName;
          return (
            <div
              key={c.link.id}
              onClick={() => navigate(`/client/${c.link.clientId}`)}
              style={{
                background: 'var(--surface)', borderRadius: 'var(--r-xl)',
                border: '1px solid var(--border)', padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
              }}
            >
              <ClientAvatar name={name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
                  {name}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                  {c.profile?.currentWeightKg ? `${c.profile.currentWeightKg} кг` : '—'}
                  {c.link.status === 'frozen' && ' · заморожен'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <StatusBadge status={c.subscription?.status ?? 'free'} />
                <span style={{ color: 'var(--text-3)', fontSize: 18 }}>›</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
