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
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'expert' | 'company'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-experts'],
    queryFn: api.adminExperts,
  });

  const revokeMutation = useMutation({
    mutationFn: (chatId: string) => api.adminRevokeExpert(chatId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-experts'] });
      setConfirmId(null);
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
                  {confirmId === exp.chatId ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => revokeMutation.mutate(exp.chatId)}
                        disabled={revokeMutation.isPending}
                        style={{
                          padding: '5px 8px', fontSize: 11, fontWeight: 700, borderRadius: 8,
                          background: 'rgba(255,59,48,0.14)', border: '1px solid rgba(255,59,48,0.3)',
                          color: 'var(--danger)', cursor: 'pointer',
                        }}
                      >
                        Да
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        style={{
                          padding: '5px 8px', fontSize: 11, borderRadius: 8,
                          background: 'var(--surface-2)', border: '1px solid var(--border)',
                          color: 'var(--text-3)', cursor: 'pointer',
                        }}
                      >
                        Нет
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(exp.chatId)}
                      style={{
                        padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8,
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        color: 'var(--text-3)', cursor: 'pointer',
                      }}
                    >
                      Отозвать
                    </button>
                  )}
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
