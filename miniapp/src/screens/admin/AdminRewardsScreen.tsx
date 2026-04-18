import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';

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

export default function AdminRewardsScreen() {
  const { trainerId } = useParams<{ trainerId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-trainer-rewards', trainerId],
    queryFn: () => api.adminTrainerRewards(trainerId!),
    enabled: !!trainerId,
  });

  const rewards: Array<{ id: number; amountRub: number; status: string; planId: string; createdAt: string }> =
    (data?.rewards as Array<{ id: number; amountRub: number; status: string; planId: string; createdAt: string }>) ?? [];
  const summary = data?.summary as { total: number; available: number; paidOut: number } | undefined;

  return (
    <div className="screen">
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: 'var(--text)', marginBottom: 4 }}>
        Начисления
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>ID: {trainerId}</div>

      {/* Summary */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Всего начислено', value: fmtRub(summary.total), color: 'var(--text)' },
            { label: 'К выплате', value: fmtRub(summary.available), color: '#4CAF50' },
            { label: 'Выплачено', value: fmtRub(summary.paidOut), color: 'var(--accent)' },
          ].map(t => (
            <div key={t.label} style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{t.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.color }}>{t.value}</div>
            </div>
          ))}
        </div>
      )}

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rewards.map(r => (
          <div
            key={r.id}
            style={{
              background: 'var(--surface)', borderRadius: 'var(--r-lg)',
              border: '1px solid var(--border)', padding: '12px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{fmtRub(r.amountRub)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                {r.planId} · {fmtDate(r.createdAt)}
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[r.status] ?? 'var(--text-3)' }}>
              {STATUS_LABELS[r.status] ?? r.status}
            </span>
          </div>
        ))}
      </div>

      {rewards.length === 0 && !isLoading && (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-3)', fontSize: 14 }}>
          Нет начислений
        </div>
      )}
    </div>
  );
}
