import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

type Expert = {
  chatId: string;
  fullName: string | null;
  specialization: string | null;
  verifiedAt: string | null;
  socialLink: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminExpertsScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ chatId: string; fullName: string | null; isCompany: boolean } | null>(null);
  const [filter, setFilter] = useState<'all' | 'expert' | 'company'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-experts'],
    queryFn: api.adminExperts,
  });

  const revokeMutation = useMutation({
    mutationFn: (chatId: string) => api.adminRevokeExpert(chatId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-experts'] });
      setConfirmTarget(null);
      showToast('Права отозваны');
    },
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const experts: Expert[] = data?.experts ?? [];
  const filtered = experts.filter(e => {
    if (filter === 'expert') return e.specialization !== 'Компания';
    if (filter === 'company') return e.specialization === 'Компания';
    return true;
  });

  return (
    <div className="screen">
      <button
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', fontSize: 16, marginBottom: 12, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
      >
        ← Назад
      </button>
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
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    ID: {exp.chatId} · с {fmtDate(exp.verifiedAt)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    onClick={() => navigate(`/rewards/${exp.chatId}`)}
                    style={{
                      padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8,
                      background: 'var(--accent-soft)', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                    }}
                  >
                    Начисления
                  </button>
                  <button
                    onClick={() => setConfirmTarget({ chatId: exp.chatId, fullName: exp.fullName, isCompany })}
                    style={{
                      padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8,
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

      {confirmTarget && (
        <div
          onClick={() => !revokeMutation.isPending && setConfirmTarget(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
              padding: '24px 20px 32px',
              width: '100%', maxWidth: 480,
              boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              Отозвать права?
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.4 }}>
              {confirmTarget.isCompany ? 'Компания' : 'Эксперт'}{' '}
              <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>
                {confirmTarget.fullName || confirmTarget.chatId}
              </span>{' '}
              потеряет верифицированный статус и доступ к кабинету эксперта.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => revokeMutation.mutate(confirmTarget.chatId)}
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
                onClick={() => setConfirmTarget(null)}
                disabled={revokeMutation.isPending}
                style={{
                  width: '100%', padding: '13px', borderRadius: 'var(--r-md)',
                  background: 'var(--surface-2)', color: 'var(--text-2)',
                  border: 'none', fontSize: 14, fontWeight: 500,
                  cursor: revokeMutation.isPending ? 'default' : 'pointer',
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
