import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { BootstrapData } from '../../types';

interface Props { bootstrap: BootstrapData; }

export default function NotificationSettingsScreen({ bootstrap }: Props) {
  const p = bootstrap.profile;
  const [enabled, setEnabled] = useState(p?.notificationsEnabled ?? true);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (value: boolean) => api.patchNotifications({ notificationsEnabled: value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bootstrap'] }),
  });

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    mutation.mutate(next);
  }

  return (
    <div className="screen">
      <h1 style={{ marginBottom: 16 }}>🔔 Уведомления</h1>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16 }}>Напоминания о еде</span>
          <button
            onClick={toggle}
            disabled={mutation.isPending}
            className={`btn ${enabled ? '' : 'btn-secondary'}`}
            style={{ width: 'auto', padding: '6px 18px', fontSize: 14 }}
          >
            {enabled ? 'Вкл ✅' : 'Выкл'}
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--tg-theme-hint-color, #888)', marginTop: 12, lineHeight: 1.5 }}>
          Изменить время и количество уведомлений можно в разделе «Дневник» приложения.
        </p>
      </div>
    </div>
  );
}
