import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';

const PAGE_SIZE = 20;

const PLATFORM_OPTS = [
  { value: '', label: 'Все' },
  { value: 'telegram', label: 'TG' },
  { value: 'max', label: 'MAX' },
];

const STATUS_OPTS = [
  { value: '', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'none', label: 'Без подписки' },
  { value: 'canceled', label: 'Отменённые' },
  { value: 'expired', label: 'Истёкшие' },
  { value: 'past_due', label: 'Просроченные' },
  { value: 'trial', label: 'Пробный' },
];

const PLAN_LABELS: Record<string, string> = {
  intro: 'Intro',
  pro: 'Pro',
  optimal: 'Optimal',
  client_monthly: 'Client',
};

const STATUS_COLORS: Record<string, string> = {
  active: '#4ade80',
  trial: '#a3e635',
  past_due: '#fb923c',
  canceled: 'var(--text-3)',
  expired: 'var(--text-3)',
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function SubBadge({ sub }: { sub: { planId: string; status: string; currentPeriodEnd: string | null; autoRenew: boolean } }) {
  const color = STATUS_COLORS[sub.status] ?? 'var(--text-3)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>
        {PLAN_LABELS[sub.planId] ?? sub.planId}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
        до {formatDate(sub.currentPeriodEnd)}
      </span>
    </div>
  );
}

export default function AdminClientsBaseScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState('');
  const [page, setPage] = useState(1);
  const [confirmCancel, setConfirmCancel] = useState<{ userId: string; name: string } | null>(null);

  const queryKey = ['admin-clients', search, platform, subscriptionStatus, page] as const;

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => api.adminClients({ search: search || undefined, platform: platform || undefined, subscriptionStatus: subscriptionStatus || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  const cancelMutation = useMutation({
    mutationFn: (userId: string) => api.adminCancelClientSubscription(userId),
    onSuccess: () => {
      setConfirmCancel(null);
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
    },
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  function handleFilterChange(fn: () => void) {
    fn();
    setPage(1);
  }

  return (
    <div className="screen">
      {/* Header */}
      <button
        onClick={() => navigate('/')}
        style={{ background: 'none', border: 'none', fontSize: 16, marginBottom: 12, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
      >
        ← Администратор
      </button>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: 'var(--text)', marginBottom: 16 }}>
        База клиентов
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => handleFilterChange(() => setSearch(e.target.value))}
        placeholder="Поиск по имени, userId, @username…"
        style={{
          width: '100%', padding: '11px 14px', marginBottom: 10,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', fontSize: 14, color: 'var(--text)',
          boxSizing: 'border-box',
        }}
      />

      {/* Filters row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {/* Platform filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {PLATFORM_OPTS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleFilterChange(() => setPlatform(opt.value))}
              style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: platform === opt.value ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: platform === opt.value ? 'var(--accent-soft)' : 'var(--surface)',
                color: platform === opt.value ? 'var(--accent)' : 'var(--text-3)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {STATUS_OPTS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleFilterChange(() => setSubscriptionStatus(opt.value))}
              style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: subscriptionStatus === opt.value ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: subscriptionStatus === opt.value ? 'var(--accent-soft)' : 'var(--surface)',
                color: subscriptionStatus === opt.value ? 'var(--accent)' : 'var(--text-3)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary bar */}
      {data && (
        <div style={{
          display: 'flex', gap: 16, padding: '10px 16px', marginBottom: 14,
          background: 'var(--surface)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-3)' }}>Всего</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{data.total}</div>
          </div>
          <div style={{ width: 1, background: 'var(--border)' }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-3)' }}>Выручка</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{data.totalRevenueRub.toLocaleString('ru-RU')} ₽</div>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>Загрузка…</div>
      )}
      {isError && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#f87171' }}>Ошибка загрузки</div>
      )}
      {data && data.items.length === 0 && !isLoading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>Пользователи не найдены</div>
      )}
      {data && data.items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {data.items.map(item => (
            <div
              key={item.userId}
              style={{
                background: 'var(--surface)', borderRadius: 'var(--r-lg)',
                border: '1px solid var(--border)', padding: '14px 16px',
              }}
            >
              {/* Top row: name + subscription */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.displayName}
                  </div>
                  {item.username && (
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>@{item.username}</div>
                  )}
                </div>
                {item.subscription
                  ? <SubBadge sub={item.subscription} />
                  : <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>Без подписки</span>
                }
              </div>

              {/* Meta row */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {item.platform} · {formatDate(item.connectedAt)}
                </span>
                {/* clientStatus badge */}
                {item.clientStatus && (() => {
                  const STATUS_STYLE: Record<string, string> = {
                    new: 'var(--text-3)', activated: '#60a5fa', active: '#4ade80',
                    sleeping: '#fb923c', lost: '#f87171',
                  };
                  const STATUS_LABEL: Record<string, string> = {
                    new: 'новый', activated: 'активирован', active: 'активен',
                    sleeping: 'спит', lost: 'потерян',
                  };
                  return (
                    <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_STYLE[item.clientStatus] ?? 'var(--text-3)' }}>
                      {STATUS_LABEL[item.clientStatus] ?? item.clientStatus}
                    </span>
                  );
                })()}
                {item.totalSpentRub > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    ₽: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{item.totalSpentRub}</span>
                  </span>
                )}
              </div>
              {/* Behavioural row */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: item.subscription ? 8 : 0 }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  Ед. всего: <span style={{ color: 'var(--text)' }}>{item.mealsTotal ?? 0}</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  За 7д: <span style={{ color: 'var(--text)' }}>{item.mealsLast7Days ?? 0}</span>
                </span>
                {item.lastActivityAt && (
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    Посл. активность: {item.daysSinceLastActivity === 0 ? 'сегодня' : item.daysSinceLastActivity === 1 ? 'вчера' : `${item.daysSinceLastActivity}д назад`}
                  </span>
                )}
                {item.aiCostUsd > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    AI: <span style={{ color: 'var(--text)' }}>${item.aiCostUsd.toFixed(4)}</span>
                  </span>
                )}
              </div>

              {/* Cancel button — only for active/trial/past_due */}
              {item.subscription && ['active', 'trial', 'past_due'].includes(item.subscription.status) && (
                <button
                  onClick={() => setConfirmCancel({ userId: item.userId, name: item.displayName })}
                  style={{
                    marginTop: 4, padding: '6px 14px',
                    background: 'none', border: '1px solid rgba(248,113,113,0.4)',
                    borderRadius: 20, fontSize: 12, fontWeight: 600,
                    color: '#f87171', cursor: 'pointer',
                  }}
                >
                  Отменить подписку
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: page <= 1 ? 'var(--text-3)' : 'var(--accent)',
            }}
          >
            ← Назад
          </button>
          <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--text-3)' }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{
              padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: page >= totalPages ? 'var(--text-3)' : 'var(--accent)',
            }}
          >
            Вперёд →
          </button>
        </div>
      )}

      {/* Confirm cancel modal */}
      {confirmCancel && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 1000, padding: '0 0 env(safe-area-inset-bottom)',
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: '20px 20px 0 0',
            padding: '24px 20px 32px', width: '100%', maxWidth: 480,
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              Отменить подписку?
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 24, lineHeight: 1.5 }}>
              Подписка пользователя <strong style={{ color: 'var(--text)' }}>{confirmCancel.name}</strong> будет немедленно отменена.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmCancel(null)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 'var(--r-lg)',
                  background: 'none', border: '1px solid var(--border)',
                  fontSize: 15, fontWeight: 600, color: 'var(--text)', cursor: 'pointer',
                }}
              >
                Отмена
              </button>
              <button
                onClick={() => cancelMutation.mutate(confirmCancel.userId)}
                disabled={cancelMutation.isPending}
                style={{
                  flex: 1, padding: '12px', borderRadius: 'var(--r-lg)',
                  background: '#ef4444', border: 'none',
                  fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer',
                  opacity: cancelMutation.isPending ? 0.6 : 1,
                }}
              >
                {cancelMutation.isPending ? 'Отменяю…' : 'Отменить'}
              </button>
            </div>
            {cancelMutation.isError && (
              <div style={{ marginTop: 12, fontSize: 13, color: '#f87171', textAlign: 'center' }}>
                Ошибка. Попробуйте ещё раз.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
