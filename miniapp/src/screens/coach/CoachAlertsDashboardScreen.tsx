import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

interface ExpiringSub {
  id: number;
  chatId: string;
  currentPeriodEnd: string | null;
}

export default function CoachAlertsDashboardScreen() {
  const { data, isLoading } = useQuery({ queryKey: ['trainer-alerts'], queryFn: api.trainerAlerts });
  if (isLoading) return <div className="loading"><div className="spinner" /></div>;
  const notLoggedToday: string[] = data?.notLoggedToday ?? [];
  const expiringSoon = (data?.expiringSoon ?? []) as ExpiringSub[];
  return (
    <div className="screen">
      <h1 style={{ marginBottom: 16 }}>🔔 Дашборд</h1>
      <div className="card">
        <div className="card-title">Активность сегодня</div>
        <div className="stat-row"><span className="stat-label">Всего клиентов</span><span className="stat-value">{data?.totalClients ?? 0}</span></div>
        <div className="stat-row"><span className="stat-label">Записали еду сегодня</span><span className="stat-value" style={{ color: '#28a745' }}>{data?.activeToday ?? 0}</span></div>
        <div className="stat-row"><span className="stat-label">Не записали</span><span className="stat-value" style={{ color: notLoggedToday.length > 0 ? '#dc3545' : 'inherit' }}>{notLoggedToday.length}</span></div>
      </div>
      {notLoggedToday.length > 0 && (
        <div>
          <div className="section-header">Не записали сегодня</div>
          {notLoggedToday.map((id: string) => (
            <div key={id} className="alert-item">👤 Клиент {id}</div>
          ))}
        </div>
      )}
      {expiringSoon.length > 0 && (
        <div>
          <div className="section-header">Истекает подписка</div>
          {expiringSoon.map((s: ExpiringSub) => (
            <div key={s.id} className="alert-item">
              ⚠️ Клиент {s.chatId} — {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString('ru-RU') : '—'}
            </div>
          ))}
        </div>
      )}
      {notLoggedToday.length === 0 && expiringSoon.length === 0 && (
        <div className="empty-state"><div className="empty-state-icon">✅</div><div>Всё в порядке</div></div>
      )}
    </div>
  );
}
