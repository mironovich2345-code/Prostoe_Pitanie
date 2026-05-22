'use client';

import { useState, useEffect } from 'react';
import { webApi, ApiError, type WebAdminRequest } from '@/lib/webApi';
import AdminNav from '@/components/AdminNav';

const STATUS_COLORS: Record<string, string> = {
  pending:  '#ffc107',
  accepted: '#4caf50',
  rejected: '#ef5350',
  canceled: '#9e9e9e',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает', accepted: 'Принята', rejected: 'Отклонена', canceled: 'Отменена',
};

export default function AdminRequestsClient() {
  const [state,    setState]   = useState<'loading' | 'forbidden' | 'error' | 'ok'>('loading');
  const [requests, setRequests] = useState<WebAdminRequest[]>([]);
  const [filter,   setFilter]  = useState('pending');

  function load(s: string) {
    setState('loading');
    webApi.getAdminRequests(s)
      .then(r => { setRequests(r.requests); setState('ok'); })
      .catch(err => {
        if (err instanceof ApiError && err.status === 403) setState('forbidden');
        else setState('error');
      });
  }

  useEffect(() => { load(filter); }, []);

  function handleFilterChange(s: string) {
    setFilter(s);
    load(s);
  }

  if (state === 'forbidden') return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>Нет доступа</div>;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', border: 'none', borderRadius: 20,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    background: active ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
    color: active ? '#000' : 'var(--text-3)',
  });

  return (
    <div>
      <AdminNav />

      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: 'var(--text)', marginBottom: 16 }}>
        Запросы клиент → эксперт
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {['pending', 'accepted', 'rejected', 'canceled', 'all'].map(s => (
          <button key={s} onClick={() => handleFilterChange(s)} style={tabStyle(filter === s)}>
            {STATUS_LABELS[s] ?? 'Все'}
          </button>
        ))}
      </div>

      {state === 'loading' && <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>Загрузка…</div>}
      {state === 'error' && <div style={{ textAlign: 'center', padding: '20px 0', color: '#ef5350' }}>Ошибка загрузки</div>}

      {state === 'ok' && (
        requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>Запросов нет</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {requests.map(r => (
              <div key={r.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)', padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                      {r.client.displayName ?? r.client.userId.slice(0, 12) + '…'}
                      {r.client.username ? ` (@${r.client.username})` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      → {r.expert.fullName ?? `ID ${r.expert.id}`}
                      {r.expert.specialization ? ` · ${r.expert.specialization}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[r.status] ?? 'var(--text-3)' }}>
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {new Date(r.createdAt).toLocaleString('ru-RU')} · {r.source}
                  {r.respondedAt ? ` · Ответ: ${new Date(r.respondedAt).toLocaleString('ru-RU')}` : ''}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
