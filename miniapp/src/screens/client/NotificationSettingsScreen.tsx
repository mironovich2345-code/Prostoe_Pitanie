import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { BootstrapData } from '../../types';

interface Props { bootstrap: BootstrapData; }

export default function NotificationSettingsScreen({ bootstrap }: Props) {
  const p = bootstrap.profile;
  const [enabled, setEnabled] = useState(p?.notificationsEnabled ?? true);
  const [count, setCount] = useState(p?.notificationCount ?? 3);
  const [times, setTimes] = useState(p?.notificationTimes ?? '09:00,13:00,19:00');
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => api.patchNotifications({ notificationsEnabled: enabled, notificationCount: count, notificationTimes: times }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bootstrap'] }); alert('Сохранено!'); },
  });
  const timesList = times.split(',').map(t => t.trim()).slice(0, count);
  function updateTime(i: number, val: string) {
    const arr = times.split(',').map(t => t.trim());
    arr[i] = val;
    setTimes(arr.join(','));
  }
  return (
    <div className="screen">
      <h1 style={{ marginBottom: 16 }}>🔔 Уведомления</h1>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16 }}>Напоминания о еде</span>
          <button onClick={() => setEnabled(!enabled)} className={`btn ${enabled ? '' : 'btn-secondary'}`} style={{ width: 'auto', padding: '6px 16px', fontSize: 14 }}>{enabled ? 'Вкл ✅' : 'Выкл'}</button>
        </div>
      </div>
      {enabled && (
        <>
          <div className="card">
            <div className="card-title">Количество в день: {count}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setCount(n)} className={`btn ${count === n ? '' : 'btn-secondary'}`} style={{ flex: 1, padding: '8px 4px', fontSize: 15 }}>{n}</button>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-title">Время уведомлений</div>
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="stat-row">
                <span className="stat-label">#{i + 1}</span>
                <input
                  type="time"
                  value={timesList[i] ?? '09:00'}
                  onChange={e => updateTime(i, e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.1)', fontSize: 15 }}
                />
              </div>
            ))}
          </div>
        </>
      )}
      <button className="btn" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? 'Сохраняем...' : 'Сохранить'}
      </button>
    </div>
  );
}
