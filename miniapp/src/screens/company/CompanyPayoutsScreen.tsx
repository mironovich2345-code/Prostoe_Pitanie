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

export default function CompanyPayoutsScreen() {
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

      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: 'var(--text)', marginBottom: 20 }}>
        Вывод средств
      </div>

      {/* Balance summary tiles */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-3)', marginBottom: 6 }}>Начислено</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: 'var(--text)', lineHeight: 1 }}>
            {s.total.toLocaleString('ru')}<span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginLeft: 3 }}>₽</span>
          </div>
        </div>
        <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--accent)', padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-3)', marginBottom: 6 }}>К выводу</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: 'var(--accent)', lineHeight: 1 }}>
            {s.available.toLocaleString('ru')}<span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)', marginLeft: 3 }}>₽</span>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>Выплачено всего</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-2)' }}>{s.paidOut.toLocaleString('ru')} ₽</span>
        </div>
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

      {/* Payout request block */}
      {!activeRequest && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', padding: '18px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Вывод вознаграждения
          </div>
          {s.available === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
              Нет доступных средств. Выплаты появятся через 30 дней после начисления.
            </div>
          ) : s.available < MIN_PAYOUT ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
              Минимальная сумма для вывода — {MIN_PAYOUT.toLocaleString('ru')} ₽.<br />
              Сейчас доступно {s.available.toLocaleString('ru')} ₽.
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 12 }}>
              Готово к выводу: <strong style={{ color: 'var(--accent)' }}>{s.available.toLocaleString('ru')} ₽</strong>.<br />
              Убедитесь, что реквизиты заполнены, и отправьте заявку.
            </div>
          )}
          {errMessage && (
            <div style={{ fontSize: 12, color: 'var(--danger)', margin: '8px 0', lineHeight: 1.4 }}>
              {errMessage}
            </div>
          )}
          {s.available > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => navigate('/requisites')}
                style={{
                  flex: 1, padding: '11px 0', fontSize: 13, fontWeight: 600,
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
                    flex: 1, padding: '11px 0', fontSize: 13, fontWeight: 700,
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
          )}
        </div>
      )}

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
