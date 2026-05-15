import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { ExpertApplication } from '../../types';

const STATUS_TABS = [
  { value: '',           label: 'Все' },
  { value: 'pending',    label: 'Ожидают' },
  { value: 'in_review',  label: 'На проверке' },
  { value: 'approved',   label: 'Одобрены' },
  { value: 'rejected',   label: 'Отклонены' },
];

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  pending:   { text: 'Ожидает',     color: 'var(--text-3)' },
  in_review: { text: 'На проверке', color: 'var(--accent)' },
  approved:  { text: 'Одобрена',    color: '#4caf50' },
  rejected:  { text: 'Отклонена',   color: '#ef5350' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function FieldRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-3)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, wordBreak: 'break-word' }}>
        {value}
      </div>
    </div>
  );
}

function ApplicationCard({ app }: { app: ExpertApplication }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [comment, setComment] = useState('');
  const [approvedProfile, setApprovedProfile] = useState<{ chatId: string; referralCode: string | null } | null>(null);

  const approveMutation = useMutation({
    mutationFn: () => api.adminApproveExpertApplication(app.id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin-expert-applications'] });
      if (data.trainerProfile) {
        setApprovedProfile({ chatId: data.trainerProfile.chatId, referralCode: data.trainerProfile.referralCode ?? null });
      }
    },
  });
  const rejectMutation = useMutation({
    mutationFn: () => api.adminRejectExpertApplication(app.id, comment || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-expert-applications'] });
      setShowReject(false);
    },
  });

  const st = STATUS_LABEL[app.status] ?? { text: app.status, color: 'var(--text-3)' };
  const canAct = app.status !== 'approved' && app.status !== 'rejected';

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r-xl)',
      border: '1px solid var(--border)', marginBottom: 10, overflow: 'hidden',
    }}>
      {/* Summary row */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%',
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{app.fullName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {app.specialization}
            {app.city ? ` · ${app.city}` : ''}
            {' · '}
            {fmtDate(app.createdAt)}
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: st.color, flexShrink: 0 }}>{st.text}</div>
        <span style={{ fontSize: 16, color: 'var(--text-3)', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />

          <FieldRow label="ID заявки" value={app.id} />
          <FieldRow label="User ID" value={app.userId} />
          <FieldRow label="Специализация" value={app.specialization} />
          <FieldRow label="Город" value={app.city} />
          <FieldRow label="Формат работы" value={app.workFormat} />
          <FieldRow label="Опыт (лет)" value={app.experienceYears} />
          <FieldRow label="Соцсеть / сайт" value={app.socialLink} />
          <FieldRow label="О себе" value={app.bio} />
          <FieldRow label="Подтверждение" value={app.proofLink} />
          {app.adminComment && (
            <FieldRow label="Комментарий админа" value={app.adminComment} />
          )}

          {approvedProfile && (
            <div style={{
              marginTop: 14, padding: '12px 14px', borderRadius: 10,
              background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.3)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#4caf50', marginBottom: 4 }}>
                ✓ TrainerProfile создан / обновлён
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                chatId: {approvedProfile.chatId}
                {approvedProfile.referralCode ? ` · ref: ${approvedProfile.referralCode}` : ''}
              </div>
            </div>
          )}

          {canAct && (
            <div style={{ marginTop: 14 }}>
              {showReject && (
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Комментарий для пользователя (необязательно)"
                  rows={3}
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 10, fontSize: 13, color: 'var(--text)', fontFamily: 'inherit',
                    outline: 'none', resize: 'vertical', marginBottom: 8,
                  }}
                />
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  className="btn"
                  style={{ flex: 1, fontSize: 13 }}
                >
                  {approveMutation.isPending ? '...' : '✓ Одобрить'}
                </button>
                {showReject ? (
                  <button
                    onClick={() => rejectMutation.mutate()}
                    disabled={rejectMutation.isPending || approveMutation.isPending}
                    style={{
                      flex: 1, fontSize: 13, padding: '10px 12px', borderRadius: 10,
                      background: 'rgba(255,59,48,0.12)', border: '1px solid rgba(255,59,48,0.25)',
                      color: 'var(--danger)', cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    {rejectMutation.isPending ? '...' : 'Отклонить'}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowReject(true)}
                    style={{
                      flex: 1, fontSize: 13, padding: '10px 12px', borderRadius: 10,
                      background: 'var(--surface-2)', border: '1px solid var(--border)',
                      color: 'var(--text-2)', cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    ✕ Отклонить
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminExpertApplicationsScreen() {
  const [statusFilter, setStatusFilter] = useState('pending');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-expert-applications', statusFilter],
    queryFn: () => api.adminExpertApplications({ status: statusFilter || undefined }),
  });

  return (
    <div className="screen">
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: 'var(--text)', marginBottom: 16 }}>
        Заявки экспертов
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: '1px solid var(--border)',
              background: statusFilter === tab.value ? 'var(--accent)' : 'var(--surface)',
              color: statusFilter === tab.value ? '#000' : 'var(--text-2)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="spinner" />
        </div>
      )}

      {error && (
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)',
          padding: '20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14,
        }}>
          Ошибка загрузки
        </div>
      )}

      {!isLoading && !error && data?.applications.length === 0 && (
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)',
          padding: '32px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 600, marginBottom: 4 }}>Нет заявок</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>По выбранному фильтру заявок нет</div>
        </div>
      )}

      {data?.applications.map(app => (
        <ApplicationCard key={app.id} app={app} />
      ))}
    </div>
  );
}
