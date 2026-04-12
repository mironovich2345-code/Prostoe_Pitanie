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

// ─── Primitives (inline, matching AdminStatsScreen style) ──────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: 1.2, color: 'var(--text-3)',
      padding: '16px 2px 8px',
    }}>
      {children}
    </div>
  );
}

function SummaryCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r-xl)',
      border: '1px solid var(--border)', overflow: 'hidden',
      marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

function BigRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 18px', borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: color ?? 'var(--text)' }}>
        {value}
      </span>
    </div>
  );
}

function SmallRow({ label, value, color, last }: { label: string; value: string; color?: string; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '11px 18px',
      borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: color ?? 'var(--text-2)' }}>{value}</span>
    </div>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

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

  const FILTER_TABS: [string, string][] = [
    ['all', 'Все'],
    ...ALL_STATUSES.map(s => [s, STATUS_LABELS[s]] as [string, string]),
  ];

  return (
    <div className="screen">
      <button
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', fontSize: 16, marginBottom: 12, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
      >
        ← Назад
      </button>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: 'var(--text)', marginBottom: 4 }}>
        Выводы вознаграждения
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <div className="spinner" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* ── Сводка ── */}
          <SectionLabel>Сводка</SectionLabel>
          <SummaryCard>
            <BigRow label="Всего начислено" value={fmtRub(totalRub)} />
            <SmallRow label="К выплате" value={fmtRub(availableRub)} color="#4CAF50" />
            <SmallRow label="Выплачено" value={fmtRub(paidRub)} color="var(--accent)" last />
          </SummaryCard>

          {/* ── Фильтр ── */}
          <SectionLabel>Фильтр</SectionLabel>
          <div className="period-tabs" style={{ marginBottom: 16 }}>
            {FILTER_TABS.map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilterStatus(k)}
                className={`period-tab${filterStatus === k ? ' active' : ''}`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* ── Список ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(p => {
              const isExpanded = expandedId === p.id;
              return (
                <div
                  key={p.id}
                  style={{
                    background: 'var(--surface)', borderRadius: 'var(--r-xl)',
                    border: '1px solid var(--border)', overflow: 'hidden',
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, cursor: 'pointer', padding: '14px 16px' }}
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                        {p.trainerName || p.trainerId}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>
                        {p.planId} · {fmtDate(p.createdAt)}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                        {fmtRub(p.amountRub)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, paddingTop: 2 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: STATUS_COLORS[p.status] ?? 'var(--text-3)',
                        background: `${STATUS_COLORS[p.status] ?? 'var(--text-3)'}18`,
                        padding: '3px 8px', borderRadius: 20,
                      }}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                      <span style={{ fontSize: 16, color: 'var(--text-3)', lineHeight: 1 }}>{isExpanded ? '∧' : '∨'}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', background: 'var(--surface-2)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10, lineHeight: 1.6 }}>
                        ID тренера: {p.trainerId}
                        <br />
                        Клиент: {p.referredChatId}
                        {p.holdUntil && <><br />Холд до: {fmtDate(p.holdUntil)}</>}
                        {p.paidAt && <><br />Выплачено: {fmtDate(p.paidAt)}</>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {ALL_STATUSES.filter(s => s !== p.status).map(s => (
                          <button
                            key={s}
                            onClick={() => updateMutation.mutate({ id: p.id, status: s })}
                            disabled={updateMutation.isPending}
                            style={{
                              padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
                              background: s === 'paid_out' ? 'var(--accent-soft)' : s === 'cancelled' ? 'rgba(255,59,48,0.10)' : 'var(--surface)',
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

          {filtered.length === 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '48px 16px 32px', gap: 8,
            }}>
              <div style={{ fontSize: 36, opacity: 0.25 }}>💳</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-3)' }}>
                {filterStatus === 'all' ? 'Нет записей' : `Нет записей со статусом «${STATUS_LABELS[filterStatus]}»`}
              </div>
            </div>
          )}
        </>
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
