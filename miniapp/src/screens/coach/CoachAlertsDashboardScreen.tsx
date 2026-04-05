import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

interface ClientRef {
  chatId: string;
  displayName: string;
}

interface ExpiringSub extends ClientRef {
  id: number;
  currentPeriodEnd: string | null;
}

export default function CoachAlertsDashboardScreen() {
  const { data, isLoading } = useQuery({ queryKey: ['trainer-alerts'], queryFn: api.trainerAlerts });
  if (isLoading) return <div className="loading"><div className="spinner" /></div>;

  const notLoggedToday = (data?.notLoggedToday ?? []) as unknown as ClientRef[];
  const expiringSoon = (data?.expiringSoon ?? []) as unknown as ExpiringSub[];

  return (
    <div className="screen">
      <h1 style={{ marginBottom: 16 }}>Дашборд</h1>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 12,
      }}>
        {[
          { label: 'Всего клиентов', value: data?.totalClients ?? 0, color: 'var(--text)' },
          { label: 'Записали еду сегодня', value: data?.activeToday ?? 0, color: '#28a745' },
          { label: 'Не записали', value: notLoggedToday.length, color: notLoggedToday.length > 0 ? 'var(--danger)' : 'var(--text)' },
        ].map((row, i, arr) => (
          <div key={row.label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '13px 20px',
            borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{row.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: row.color }}>{row.value}</span>
          </div>
        ))}
      </div>

      {notLoggedToday.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '4px 2px 10px' }}>
            Не записали сегодня
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-xl)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {notLoggedToday.map((c: ClientRef, i) => (
              <div key={c.chatId} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                borderBottom: i < notLoggedToday.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: 'var(--text-3)', flexShrink: 0,
                }}>
                  {c.displayName.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{c.displayName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {expiringSoon.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '4px 2px 10px' }}>
            Истекает подписка
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-xl)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {expiringSoon.map((s: ExpiringSub, i) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: i < expiringSoon.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{s.displayName}</span>
                <span style={{ fontSize: 13, color: 'var(--warn)', fontWeight: 600 }}>
                  {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString('ru-RU') : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {notLoggedToday.length === 0 && expiringSoon.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', opacity: 0.3 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div>Всё в порядке</div>
        </div>
      )}
    </div>
  );
}
