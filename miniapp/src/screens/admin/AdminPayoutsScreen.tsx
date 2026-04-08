import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

type Payout = {
  id: number;
  trainerId: string;
  trainerName: string | null;
  referredChatId: string;
  planId: string;
  amountRub: number;
  status: string;
  holdUntil: string | null;
  paidAt: string | null;
  createdAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending_hold: 'На удержании',
  available: 'Доступно',
  paid_out: 'Выплачено',
  cancelled: 'Отменено',
};

const STATUS_COLORS: Record<string, string> = {
  pending_hold: 'var(--text-3)',
  available: '#4CAF50',
  paid_out: 'var(--accent)',
  cancelled: 'var(--danger)',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtRub(n: number) {
  return n.toLocaleString('ru-RU') + ' ₽';
}

const ALL_STATUSES = ['pending_hold', 'available', 'paid_out', 'cancelled'] as const;

export default function AdminPayoutsScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payouts'],
    queryFn: api.adminPayouts,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.adminUpdatePayoutStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-payouts'] });
      showToast('Статус обновлён');
    },
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const payouts: Payout[] = data?.payouts ?? [];
  const filtered = filterStatus === 'all' ? payouts : payouts.filter(p => p.status === filterStatus);

  const totalRub = payouts.reduce((s, p) => s + p.amountRub, 0);
  const availableRub = payouts.filter(p => p.status === 'available').reduce((s, p) => s + p.amountRub, 0);
  const paidRub = payouts.filter(p => p.status === 'paid_out').reduce((s, p) => s + p.amountRub, 0);

  return (
    <div className="screen">
      <button
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', fontSize: 16, marginBottom: 12, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
      >
        ← Назад
      </button>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: 'var(--text)', marginBottom: 16 }}>
        Выводы вознаграждения
      </div>

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Всего начислено', value: fmtRub(totalRub), color: 'var(--text)' },
          { label: 'К выплате', value: fmtRub(availableRub), color: '#4CAF50' },
          { label: 'Выплачено', value: fmtRub(paidRub), color: 'var(--accent)' },
        ].map(t => (
          <div key={t.label} style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.color }}>{t.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {([['all', 'Все'], ...ALL_STATUSES.map(s => [s, STATUS_LABELS[s]])] as [string, string][]).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setFilterStatus(k)}
            style={{
              padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 20, cursor: 'pointer',
              background: filterStatus === k ? 'var(--accent)' : 'var(--surface-2)',
              color: filterStatus === k ? '#000' : 'var(--text-2)',
              border: filterStatus === k ? 'none' : '1px solid var(--border)',
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(p => {
          const isExpanded = expandedId === p.id;
          return (
            <div
              key={p.id}
              style={{
                background: 'var(--surface)', borderRadius: 'var(--r-xl)',
                border: '1px solid var(--border)', padding: '14px 16px',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, cursor: 'pointer' }}
                onClick={() => setExpandedId(isExpanded ? null : p.id)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                    {p.trainerName || p.trainerId}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>
                    {p.planId} · {fmtDate(p.createdAt)}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                    {fmtRub(p.amountRub)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[p.status] ?? 'var(--text-3)' }}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </span>
                  <span style={{ fontSize: 18, color: 'var(--text-3)' }}>{isExpanded ? '∧' : '∨'}</span>
                </div>
              </div>

              {isExpanded && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>
                    ID: {p.trainerId} · Клиент: {p.referredChatId}
                    {p.holdUntil && ` · Холд до: ${fmtDate(p.holdUntil)}`}
                    {p.paidAt && ` · Выплачено: ${fmtDate(p.paidAt)}`}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {ALL_STATUSES.filter(s => s !== p.status).map(s => (
                      <button
                        key={s}
                        onClick={() => updateMutation.mutate({ id: p.id, status: s })}
                        disabled={updateMutation.isPending}
                        style={{
                          padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
                          background: s === 'paid_out' ? 'var(--accent-soft)' : s === 'cancelled' ? 'rgba(255,59,48,0.10)' : 'var(--surface-2)',
                          border: s === 'cancelled' ? '1px solid rgba(255,59,48,0.25)' : '1px solid var(--border)',
                          color: s === 'paid_out' ? 'var(--accent)' : s === 'cancelled' ? 'var(--danger)' : 'var(--text-2)',
                        }}
                      >
                        → {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && !isLoading && (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-3)', fontSize: 14 }}>
          Нет записей
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--accent)', color: '#000', fontWeight: 700,
          padding: '10px 22px', borderRadius: 24, fontSize: 14, zIndex: 999, whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
