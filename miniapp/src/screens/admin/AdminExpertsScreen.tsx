import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, type AdminTrainer } from '../../api/client';

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Черновик',
  published: 'Опубликован',
  hidden: 'Скрыт',
};
const STATUS_COLOR: Record<string, string> = {
  draft: 'var(--text-3)',
  published: '#4caf50',
  hidden: 'var(--text-2)',
};

type Filter = 'all' | 'expert' | 'company';
type EditForm = {
  fullName: string;
  specialization: string;
  bio: string;
  city: string;
  socialLink: string;
  experienceYears: string;
  suitableFor: string;
  tags: string;
};

export default function AdminExpertsScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [confirmRevoke, setConfirmRevoke] = useState<AdminTrainer | null>(null);
  const [editing, setEditing] = useState<AdminTrainer | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-experts'],
    queryFn: api.adminExperts,
  });

  const revokeMutation = useMutation({
    mutationFn: (chatId: string) => api.adminRevokeExpert(chatId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-experts'] });
      setConfirmRevoke(null);
      showToast('Права отозваны');
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: number) => api.adminPublishTrainer(id),
    onSuccess: ({ trainer }) => {
      qc.setQueryData(['admin-experts'], (old: { experts: AdminTrainer[] } | undefined) =>
        old ? { experts: old.experts.map(e => e.id === trainer.id ? trainer : e) } : old
      );
      showToast('Опубликовано в каталоге');
    },
    onError: (err: unknown) => {
      const msg = (err as { message?: string })?.message ?? '';
      if (msg.includes('incomplete_profile')) {
        showToast('Заполните описание и специализацию перед публикацией');
      } else {
        showToast('Ошибка публикации');
      }
    },
  });

  const hideMutation = useMutation({
    mutationFn: (id: number) => api.adminHideTrainer(id),
    onSuccess: ({ trainer }) => {
      qc.setQueryData(['admin-experts'], (old: { experts: AdminTrainer[] } | undefined) =>
        old ? { experts: old.experts.map(e => e.id === trainer.id ? trainer : e) } : old
      );
      showToast('Скрыт из каталога');
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof api.adminUpdateTrainerPublicProfile>[1] }) =>
      api.adminUpdateTrainerPublicProfile(id, data),
    onSuccess: ({ trainer }) => {
      qc.setQueryData(['admin-experts'], (old: { experts: AdminTrainer[] } | undefined) =>
        old ? { experts: old.experts.map(e => e.id === trainer.id ? trainer : e) } : old
      );
      setEditing(null);
      setEditForm(null);
      showToast('Карточка обновлена');
    },
    onError: () => setEditError('Ошибка сохранения. Проверьте поля.'),
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  function openEdit(exp: AdminTrainer) {
    setEditing(exp);
    setEditError(null);
    setEditForm({
      fullName: exp.fullName ?? '',
      specialization: exp.specialization ?? '',
      bio: exp.bio ?? '',
      city: exp.city ?? '',
      socialLink: exp.socialLink ?? '',
      experienceYears: exp.experienceYears != null ? String(exp.experienceYears) : '',
      suitableFor: exp.suitableFor ?? '',
      tags: exp.tags ?? '',
    });
  }

  function handleEditChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setEditForm(prev => prev ? { ...prev, [e.target.name]: e.target.value } : prev);
    setEditError(null);
  }

  function submitEdit() {
    if (!editing || !editForm) return;
    const years = editForm.experienceYears.trim();
    editMutation.mutate({
      id: editing.id,
      data: {
        fullName: editForm.fullName || undefined,
        specialization: editForm.specialization || undefined,
        bio: editForm.bio || undefined,
        city: editForm.city || undefined,
        socialLink: editForm.socialLink || undefined,
        experienceYears: years !== '' ? parseInt(years, 10) : null,
        suitableFor: editForm.suitableFor || undefined,
        tags: editForm.tags || undefined,
      },
    });
  }

  const experts: AdminTrainer[] = data?.experts ?? [];
  const filtered = experts.filter(e => {
    if (filter === 'expert') return e.specialization !== 'Компания';
    if (filter === 'company') return e.specialization === 'Компания';
    return true;
  });

  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', boxSizing: 'border-box',
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '9px 11px', fontSize: 13, color: 'var(--text)',
    fontFamily: 'inherit', outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600,
    color: 'var(--text-3)', marginBottom: 4,
  };

  return (
    <div className="screen">
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: 'var(--text)', marginBottom: 16 }}>
        Верифицированные ({experts.length})
      </div>

      {/* Filter tabs */}
      <div className="period-tabs" style={{ marginBottom: 16 }}>
        {([['all', 'Все'], ['expert', 'Эксперты'], ['company', 'Компании']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`period-tab${filter === k ? ' active' : ''}`}>
            {l}
          </button>
        ))}
      </div>

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(exp => {
          const isCompany = exp.specialization === 'Компания';
          const statusLabel = STATUS_LABEL[exp.publicStatus] ?? exp.publicStatus;
          const statusColor = STATUS_COLOR[exp.publicStatus] ?? 'var(--text-3)';
          const isPublishing = publishMutation.isPending && publishMutation.variables === exp.id;
          const isHiding = hideMutation.isPending && hideMutation.variables === exp.id;
          return (
            <div
              key={exp.chatId}
              style={{
                background: 'var(--surface)', borderRadius: 'var(--r-xl)',
                border: '1px solid var(--border)', padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                    {exp.fullName || '—'}
                  </div>
                  <div style={{ fontSize: 11, color: isCompany ? '#7EB8F0' : 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>
                    {isCompany ? 'Компания' : (exp.specialization || 'Эксперт')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>
                    ID: {exp.chatId} · с {fmtDate(exp.verifiedAt)}
                  </div>
                  {/* publicStatus badge */}
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                    color: statusColor, border: `1px solid ${statusColor}40`,
                    borderRadius: 10, padding: '2px 8px',
                    background: `${statusColor}12`,
                  }}>
                    {statusLabel}
                    {exp.slug ? ` · /${exp.slug}` : ''}
                  </span>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => navigate(`/rewards/${exp.chatId}`)}
                    style={{
                      padding: '5px 10px', fontSize: 11, fontWeight: 600, borderRadius: 8,
                      background: 'var(--accent-soft)', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                    }}
                  >
                    Начисления
                  </button>

                  {exp.publicStatus !== 'published' ? (
                    <button
                      onClick={() => publishMutation.mutate(exp.id)}
                      disabled={isPublishing}
                      style={{
                        padding: '5px 10px', fontSize: 11, fontWeight: 600, borderRadius: 8,
                        background: 'rgba(76,175,80,0.12)', border: '1px solid rgba(76,175,80,0.3)',
                        color: '#4caf50', cursor: isPublishing ? 'default' : 'pointer',
                        opacity: isPublishing ? 0.6 : 1,
                      }}
                    >
                      {isPublishing ? '...' : 'Опубликовать'}
                    </button>
                  ) : (
                    <button
                      onClick={() => hideMutation.mutate(exp.id)}
                      disabled={isHiding}
                      style={{
                        padding: '5px 10px', fontSize: 11, fontWeight: 600, borderRadius: 8,
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        color: 'var(--text-2)', cursor: isHiding ? 'default' : 'pointer',
                        opacity: isHiding ? 0.6 : 1,
                      }}
                    >
                      {isHiding ? '...' : 'Скрыть'}
                    </button>
                  )}

                  <button
                    onClick={() => openEdit(exp)}
                    style={{
                      padding: '5px 10px', fontSize: 11, fontWeight: 600, borderRadius: 8,
                      background: 'var(--surface-2)', border: '1px solid var(--border)',
                      color: 'var(--text-2)', cursor: 'pointer',
                    }}
                  >
                    Редактировать
                  </button>

                  <button
                    onClick={() => setConfirmRevoke(exp)}
                    style={{
                      padding: '5px 10px', fontSize: 11, fontWeight: 600, borderRadius: 8,
                      background: 'var(--surface-2)', border: '1px solid var(--border)',
                      color: 'var(--text-3)', cursor: 'pointer',
                    }}
                  >
                    Отозвать
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && !isLoading && (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-3)', fontSize: 14 }}>
          Нет записей
        </div>
      )}

      {/* ── Edit bottom-sheet ────────────────────────────────────────────── */}
      {editing && editForm && (
        <div
          onClick={() => !editMutation.isPending && (setEditing(null), setEditForm(null))}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
              padding: '20px 20px 32px', width: '100%', maxWidth: 480,
              boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
              maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
              Карточка: {editing.fullName || editing.chatId}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Имя и фамилия</label>
                <input name="fullName" style={inputStyle} value={editForm.fullName}
                  onChange={handleEditChange} maxLength={80} />
              </div>
              <div>
                <label style={labelStyle}>Специализация</label>
                <input name="specialization" style={inputStyle} value={editForm.specialization}
                  onChange={handleEditChange} maxLength={120} />
              </div>
              <div>
                <label style={labelStyle}>О себе (минимум 20 символов)</label>
                <textarea name="bio" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                  value={editForm.bio} onChange={handleEditChange} maxLength={2000} rows={4} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Город</label>
                  <input name="city" style={inputStyle} value={editForm.city}
                    onChange={handleEditChange} maxLength={80} />
                </div>
                <div>
                  <label style={labelStyle}>Опыт (лет)</label>
                  <input name="experienceYears" type="number" style={inputStyle}
                    value={editForm.experienceYears} onChange={handleEditChange} min={0} max={60} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Соцсеть / сайт</label>
                <input name="socialLink" style={inputStyle} value={editForm.socialLink}
                  onChange={handleEditChange} maxLength={200} />
              </div>
              <div>
                <label style={labelStyle}>Кому подходит</label>
                <textarea name="suitableFor" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                  value={editForm.suitableFor} onChange={handleEditChange} maxLength={500} rows={2} />
              </div>
              <div>
                <label style={labelStyle}>Теги (через запятую)</label>
                <input name="tags" style={inputStyle} value={editForm.tags}
                  onChange={handleEditChange} maxLength={300} />
              </div>
            </div>

            {editError && (
              <div style={{ fontSize: 12, color: '#ef5350', marginTop: 10 }}>{editError}</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
              <button
                onClick={submitEdit}
                disabled={editMutation.isPending}
                style={{
                  width: '100%', padding: '12px', borderRadius: 'var(--r-md)',
                  background: 'var(--accent)', color: '#000',
                  border: 'none', fontSize: 14, fontWeight: 700,
                  cursor: editMutation.isPending ? 'default' : 'pointer',
                  opacity: editMutation.isPending ? 0.6 : 1,
                }}
              >
                {editMutation.isPending ? 'Сохраняем…' : 'Сохранить'}
              </button>
              <button
                onClick={() => { setEditing(null); setEditForm(null); }}
                disabled={editMutation.isPending}
                style={{
                  width: '100%', padding: '12px', borderRadius: 'var(--r-md)',
                  background: 'var(--surface-2)', color: 'var(--text-2)',
                  border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Revoke confirm ───────────────────────────────────────────────── */}
      {confirmRevoke && (
        <div
          onClick={() => !revokeMutation.isPending && setConfirmRevoke(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
              padding: '24px 20px 32px', width: '100%', maxWidth: 480,
              boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              Отозвать права?
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.4 }}>
              {confirmRevoke.specialization === 'Компания' ? 'Компания' : 'Эксперт'}{' '}
              <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>
                {confirmRevoke.fullName || confirmRevoke.chatId}
              </span>{' '}
              потеряет верифицированный статус и доступ к кабинету эксперта.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => revokeMutation.mutate(confirmRevoke.chatId)}
                disabled={revokeMutation.isPending}
                style={{
                  width: '100%', padding: '13px', borderRadius: 'var(--r-md)',
                  background: 'var(--danger, #e53935)', color: '#fff',
                  border: 'none', fontSize: 14, fontWeight: 600,
                  cursor: revokeMutation.isPending ? 'default' : 'pointer',
                  opacity: revokeMutation.isPending ? 0.6 : 1,
                }}
              >
                {revokeMutation.isPending ? 'Отзываем...' : 'Да, отозвать'}
              </button>
              <button
                onClick={() => setConfirmRevoke(null)}
                disabled={revokeMutation.isPending}
                style={{
                  width: '100%', padding: '13px', borderRadius: 'var(--r-md)',
                  background: 'var(--surface-2)', color: 'var(--text-2)',
                  border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                }}
              >
                Отмена
              </button>
            </div>
          </div>
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
