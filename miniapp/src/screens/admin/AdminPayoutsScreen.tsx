import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

// ─── Requisites formatting helpers ────────────────────────────────────────────

const REQ_LABELS: Record<string, string> = {
  companyName: 'Наименование', inn: 'ИНН', kpp: 'КПП', ogrn: 'ОГРН',
  legalAddress: 'Адрес', accountNumber: 'Номер РС', corrAccount: 'Корр. счёт',
  bik: 'БИК', director: 'Руководитель',
};

const TYPE_LABELS: Record<string, string> = { ooo: 'ООО', ip: 'ИП', selfemployed: 'Сам.зан.' };

function formatRequisitesText(req: Record<string, string>): string {
  const { type, ...fields } = req;
  const header = TYPE_LABELS[type] ? `[${TYPE_LABELS[type]}]` : '';
  const lines = Object.entries(fields)
    .filter(([, v]) => v)
    .map(([k, v]) => `${REQ_LABELS[k] ?? k}: ${v}`);
  return [header, ...lines].filter(Boolean).join('\n');
}

// ─── Requisites panel (lazy-fetched per payout row) ───────────────────────────

function RequisitesPanel({ trainerId }: { trainerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-trainer-requisites', trainerId],
    queryFn: () => api.adminTrainerRequisites(trainerId),
  });

  if (isLoading) return <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>Загрузка реквизитов...</div>;
  if (!data?.requisites) return <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>Реквизиты не заполнены</div>;

  const { type, ...fields } = data.requisites as Record<string, string>;
  const typeLabel = type === 'ooo' ? 'ООО' : type === 'ip' ? 'ИП' : type === 'selfemployed' ? 'Сам.зан.' : type;

  const LABELS: Record<string, string> = {
    companyName: 'Наименование', inn: 'ИНН', kpp: 'КПП', ogrn: 'ОГРН',
    legalAddress: 'Адрес', accountNumber: 'Номер РС', corrAccount: 'Корр. счёт',
    bik: 'БИК', director: 'Руководитель',
  };

  return (
    <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        Реквизиты {typeLabel && `· ${typeLabel}`}
      </div>
      {Object.entries(fields).filter(([, v]) => v).map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, gap: 8 }}>
          <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>{LABELS[k] ?? k}</span>
          <span style={{ color: 'var(--text-2)', fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

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

// ─── Payout requests panel ────────────────────────────────────────────────────

type PayoutRequest = {
  trainerId: string;
  trainerName: string | null;
  specialization: string | null;
  requisites: Record<string, string> | null;
  totalRub: number;
  rewardIds: number[];
  oldestCreatedAt: string;
};

const PR_STATUS_LABELS: Record<string, string> = {
  pending:   'Ожидает',
  approved:  'Одобрено',
  paid:      'Выплачено',
  cancelled: 'Отменено',
};
const PR_STATUS_COLORS: Record<string, string> = {
  pending:   'var(--text-3)',
  approved:  '#7EB8F0',
  paid:      'var(--accent)',
  cancelled: 'var(--danger)',
};

function PayoutRequestsSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-payout-requests'],
    queryFn: api.adminPayoutRequests,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.adminUpdatePayoutRequestStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-payout-requests'] }),
  });

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const requests = data?.requests ?? [];
  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const count = requests.length;

  function copyRequisites(req: Record<string, string>, id: number) {
    const text = formatRequisitesText(req);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {/* ignore */});
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          background: pendingCount > 0 ? 'var(--accent-soft)' : 'var(--surface)',
          border: `1px solid ${pendingCount > 0 ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: open ? 'var(--r-xl) var(--r-xl) 0 0' : 'var(--r-xl)',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: pendingCount > 0 ? 'var(--accent)' : 'var(--text)' }}>
            Запросы на вывод
          </span>
          {isLoading ? (
            <div className="spinner" style={{ width: 14, height: 14 }} />
          ) : (
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: pendingCount > 0 ? 'var(--accent)' : 'var(--border)',
              color: pendingCount > 0 ? '#000' : 'var(--text-3)',
            }}>
              {pendingCount > 0 ? `${pendingCount} новых` : count}
            </span>
          )}
        </div>
        <span style={{ fontSize: 18, color: 'var(--text-3)', lineHeight: 1 }}>{open ? '∧' : '∨'}</span>
      </button>

      {open && (
        <div style={{
          background: 'var(--surface)', borderRadius: '0 0 var(--r-xl) var(--r-xl)',
          border: '1px solid var(--border)', borderTop: 'none', overflow: 'hidden',
        }}>
          {requests.length === 0 ? (
            <div style={{ padding: '20px 18px', fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>
              Нет активных заявок
            </div>
          ) : (
            requests.map((r, i) => {
              const isCompany = r.specialization === 'Компания';
              const hasCopied = copied === r.id;
              const statusColor = PR_STATUS_COLORS[r.status] ?? 'var(--text-3)';
              return (
                <div key={r.id} style={{
                  padding: '14px 18px',
                  borderBottom: i < requests.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  {/* Header: name + status badge + amount */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                        {r.trainerName || r.trainerId}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {isCompany ? 'Компания' : 'Эксперт'} · {fmtDate(r.createdAt)} · #{r.id}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: `${statusColor}18`, color: statusColor,
                      }}>
                        {PR_STATUS_LABELS[r.status] ?? r.status}
                      </span>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#4CAF50', letterSpacing: -0.3 }}>
                        {fmtRub(r.amountRub)}
                      </span>
                    </div>
                  </div>

                  {/* Requisites snapshot */}
                  {r.requisites ? (
                    <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)', marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Реквизиты {r.requisites.type ? `· ${TYPE_LABELS[r.requisites.type] ?? r.requisites.type}` : ''}
                        </span>
                        <button
                          onClick={() => copyRequisites(r.requisites!, r.id)}
                          style={{
                            fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8,
                            background: hasCopied ? '#4CAF5020' : 'var(--surface)',
                            border: `1px solid ${hasCopied ? '#4CAF50' : 'var(--border)'}`,
                            color: hasCopied ? '#4CAF50' : 'var(--text-2)',
                            cursor: 'pointer',
                          }}
                        >
                          {hasCopied ? '✓ Скопировано' : 'Скопировать'}
                        </button>
                      </div>
                      {Object.entries(r.requisites).filter(([k, v]) => k !== 'type' && v).map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3, gap: 8 }}>
                          <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>{REQ_LABELS[k] ?? k}</span>
                          <span style={{ color: 'var(--text-2)', fontWeight: 500, textAlign: 'right', wordBreak: 'break-all', userSelect: 'text' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--danger)', fontStyle: 'italic', marginBottom: 10 }}>
                      Реквизиты не найдены в заявке
                    </div>
                  )}

                  {/* Admin status actions */}
                  {r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => updateMutation.mutate({ id: r.id, status: 'approved' })} disabled={updateMutation.isPending}
                        style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: 'pointer', background: '#7EB8F020', border: '1px solid #7EB8F040', color: '#7EB8F0' }}>
                        Одобрить
                      </button>
                      <button onClick={() => updateMutation.mutate({ id: r.id, status: 'paid' })} disabled={updateMutation.isPending}
                        style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: 'pointer', background: 'var(--accent-soft)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                        Выплачено
                      </button>
                      <button onClick={() => updateMutation.mutate({ id: r.id, status: 'cancelled' })} disabled={updateMutation.isPending}
                        style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: 'pointer', background: 'rgba(255,59,48,0.10)', border: '1px solid rgba(255,59,48,0.25)', color: 'var(--danger)' }}>
                        Отклонить
                      </button>
                    </div>
                  )}
                  {r.status === 'approved' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => updateMutation.mutate({ id: r.id, status: 'paid' })} disabled={updateMutation.isPending}
                        style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: 'pointer', background: 'var(--accent-soft)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                        Выплачено
                      </button>
                      <button onClick={() => updateMutation.mutate({ id: r.id, status: 'cancelled' })} disabled={updateMutation.isPending}
                        style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: 'pointer', background: 'rgba(255,59,48,0.10)', border: '1px solid rgba(255,59,48,0.25)', color: 'var(--danger)' }}>
                        Отклонить
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
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
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: 'var(--text)', marginBottom: 4 }}>
        Выводы вознаграждения
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <div className="spinner" />
        </div>
      )}

      {/* ── Запросы на вывод — always visible, not gated on isLoading ── */}
      <SectionLabel>Запросы на вывод</SectionLabel>
      <PayoutRequestsSection />

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
                      <RequisitesPanel trainerId={p.trainerId} />
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
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
