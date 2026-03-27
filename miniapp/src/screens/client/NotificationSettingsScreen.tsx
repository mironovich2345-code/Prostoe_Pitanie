import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { BootstrapData } from '../../types';

interface Props { bootstrap: BootstrapData; }

export default function NotificationSettingsScreen({ bootstrap }: Props) {
  const p = bootstrap.profile;
  const [enabled, setEnabled] = useState(p?.notificationsEnabled ?? true);
  const [count, setCount] = useState(p?.notificationCount ?? 3);
  const [times, setTimes] = useState(p?.notificationTimes ?? '');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: { notificationsEnabled?: boolean; notificationCount?: number; notificationTimes?: string }) =>
      api.patchNotifications(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bootstrap'] }),
  });

  function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    mutation.mutate({ notificationsEnabled: next });
  }

  function changeCount(delta: number) {
    const next = Math.max(1, Math.min(5, count + delta));
    setCount(next);
    mutation.mutate({ notificationCount: next });
  }

  function saveTimes() {
    mutation.mutate({ notificationTimes: times.trim() });
  }

  return (
    <div className="screen">
      <h1 style={{ marginBottom: 16 }}>🔔 Уведомления</h1>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16 }}>Напоминания о еде</span>
          <button
            onClick={toggleEnabled}
            disabled={mutation.isPending}
            className={`btn ${enabled ? '' : 'btn-secondary'}`}
            style={{ width: 'auto', padding: '6px 18px', fontSize: 14 }}
          >
            {enabled ? 'Вкл ✅' : 'Выкл'}
          </button>
        </div>
      </div>

      {enabled && (
        <>
          <div className="card">
            <div className="card-title">Количество в день</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, justifyContent: 'center', padding: '4px 0' }}>
              <button
                onClick={() => changeCount(-1)}
                disabled={count <= 1 || mutation.isPending}
                className="btn btn-secondary"
                style={{ width: 40, padding: '6px', fontSize: 20, lineHeight: 1 }}
              >
                −
              </button>
              <span style={{ fontSize: 22, fontWeight: 700, minWidth: 28, textAlign: 'center' }}>{count}</span>
              <button
                onClick={() => changeCount(1)}
                disabled={count >= 5 || mutation.isPending}
                className="btn btn-secondary"
                style={{ width: 40, padding: '6px', fontSize: 20, lineHeight: 1 }}
              >
                +
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Время уведомлений</div>
            <p style={{ fontSize: 13, color: 'var(--tg-theme-hint-color, #888)', marginBottom: 10, lineHeight: 1.5 }}>
              Введи время через пробел или запятую (до {count} значений).<br />
              Пример: <span style={{ fontFamily: 'monospace' }}>09:00 13:00 19:00</span>
            </p>
            <input
              type="text"
              value={times}
              onChange={e => setTimes(e.target.value)}
              placeholder="09:00 13:00 19:00"
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 8,
                fontSize: 15,
                background: 'var(--tg-theme-bg-color, #f0f0f0)',
                color: 'var(--tg-theme-text-color, #000)',
                outline: 'none',
                marginBottom: 10,
                boxSizing: 'border-box',
              }}
            />
            <button
              className="btn"
              onClick={saveTimes}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Сохраняем...' : 'Сохранить время'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
