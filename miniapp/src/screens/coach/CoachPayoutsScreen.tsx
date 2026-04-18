import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

const MIN_PAYOUT = 2500;

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  pending:   { text: 'Рассматривается',  color: 'var(--text-3)' },
  approved:  { text: 'Одобрено',         color: '#7EB8F0' },
  paid:      { text: 'Выплачено',        color: 'var(--accent)' },
  cancelled: { text: 'Отклонено',        color: 'var(--danger)' },
};

export default function CoachPayoutsScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: rewardsData, isLoading: rewardsLoading } = useQuery({
    queryKey: ['trainer-rewards'],
    queryFn: api.trainerRewards,
  });
  const { data: reqData, isLoading: reqLoading } = useQuery({
    queryKey: ['trainer-payout-request'],
    queryFn: api.trainerPayoutRequest,
  });

  const createMutation = useMutation({
    mutationFn: api.trainerCreatePayoutRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trainer-payout-request'] });
      qc.invalidateQueries({ queryKey: ['trainer-rewards'] });
    },
  });

  const isLoading = rewardsLoading || reqLoading;
  if (isLoading) return <div className="loading"><div className="spinner" /></div>;

  const s = rewardsData?.summary ?? { total: 0, available: 0, paidOut: 0 };
  const activeRequest = reqData?.request ?? null;
  const canRequest = s.available >= MIN_PAYOUT && !activeRequest;
  const statusInfo = activeRequest ? (STATUS_LABELS[activeRequest.status] ?? { text: activeRequest.status, color: 'var(--text-3)' }) : null;

  const mutErr = createMutation.error as Error | null;
  let errMessage: string | null = null;
  if (mutErr) {
    try {
      const body = JSON.parse(mutErr.message || '{}');
      errMessage = body.error ?? mutErr.message;
    } catch { errMessage = mutErr.message; }
  }

  return (
    <div className="screen">
      <h1 style={{ marginBottom: 16 }}>Начисления</h1>

      {/* Balance tiles */}
      <div className="card">
        <div className="stat-row"><span className="stat-label">Начислено всего</span><span className="stat-value">{s.total.toLocaleString('ru')} ₽</span></div>
        <div className="stat-row"><span className="stat-label">Доступно к выводу</span><span className="stat-value" style={{ color: '#28a745' }}>{s.available.toLocaleString('ru')} ₽</span></div>
        <div className="stat-row"><span className="stat-label">Выплачено</span><span className="stat-value">{s.paidOut.toLocaleString('ru')} ₽</span></div>
      </div>

      {/* Active request banner */}
      {activeRequest && statusInfo && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', padding: '16px 18px', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Заявка на вывод</span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
              background: `${statusInfo.color}18`, color: statusInfo.color,
            }}>
              {statusInfo.text}
            </span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: 'var(--accent)', marginBottom: 4 }}>
            {activeRequest.amountRub.toLocaleString('ru')} ₽
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Создана {new Date(activeRequest.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
          </div>
        </div>
      )}

      {/* Request payout block */}
      {!activeRequest && s.available > 0 && (
        <div style={{
          background: canRequest ? 'var(--surface)' : 'var(--surface-2)',
          border: `1px solid ${canRequest ? 'var(--border)' : 'var(--border)'}`,
          borderRadius: 'var(--r-lg)', padding: '18px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
            Вывод вознаграждения
          </div>
          {s.available < MIN_PAYOUT ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 12 }}>
              Минимальная сумма для вывода — {MIN_PAYOUT.toLocaleString('ru')} ₽.<br />
              Сейчас доступно {s.available.toLocaleString('ru')} ₽ — подождите, пока накопится больше.
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 12 }}>
              Готово к выводу: <strong style={{ color: '#28a745' }}>{s.available.toLocaleString('ru')} ₽</strong>.<br />
              Убедитесь, что реквизиты заполнены, и нажмите кнопку ниже.
            </div>
          )}
          {errMessage && (
            <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10, lineHeight: 1.4 }}>
              {errMessage}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => navigate('/requisites')}
              style={{
                flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600,
                borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer',
              }}
            >
              Реквизиты →
            </button>
            {canRequest && (
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                style={{
                  flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700,
                  borderRadius: 10, border: 'none',
                  background: createMutation.isPending ? 'var(--border)' : 'var(--accent)',
                  color: createMutation.isPending ? 'var(--text-3)' : '#000',
                  cursor: createMutation.isPending ? 'not-allowed' : 'pointer',
                }}
              >
                {createMutation.isPending ? 'Создаём...' : 'Запросить вывод'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* No available yet */}
      {!activeRequest && s.available === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
          <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center', opacity: 0.3 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          </div>
          Выплаты появятся, когда удержание снято (обычно 30 дней после начисления).
        </div>
      )}

      {/* Success toast */}
      {createMutation.isSuccess && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--accent)', color: '#000', fontWeight: 700,
          padding: '10px 22px', borderRadius: 24, fontSize: 14, zIndex: 999, whiteSpace: 'nowrap',
        }}>
          Заявка на вывод отправлена
        </div>
      )}
    </div>
  );
}
