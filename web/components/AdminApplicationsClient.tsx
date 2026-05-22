'use client';

import { useState, useEffect } from 'react';
import { webApi, ApiError, type WebAdminApplication } from '@/lib/webApi';
import AdminNav from '@/components/AdminNav';

const STATUS_COLORS: Record<string, string> = {
  pending:   '#ffc107',
  in_review: 'var(--accent)',
  approved:  '#4caf50',
  rejected:  '#ef5350',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает', in_review: 'На проверке', approved: 'Одобрена', rejected: 'Отклонена',
};

export default function AdminApplicationsClient() {
  const [state, setState]     = useState<'loading' | 'forbidden' | 'error' | 'ok'>('loading');
  const [apps,  setApps]      = useState<WebAdminApplication[]>([]);
  const [filter, setFilter]   = useState('pending');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [acting, setActing]   = useState(false);
  const [actMsg, setActMsg]   = useState<string | null>(null);

  function load(s: string) {
    setState('loading');
    webApi.getAdminApplications(s)
      .then(r => { setApps(r.applications); setState('ok'); })
      .catch(err => {
        if (err instanceof ApiError && err.status === 403) setState('forbidden');
        else setState('error');
      });
  }

  useEffect(() => { load(filter); }, []);

  function handleFilterChange(s: string) {
    setFilter(s);
    load(s);
  }

  async function handleApprove(id: string) {
    setActing(true);
    setActMsg(null);
    try {
      await webApi.approveAdminApplication(id);
      setApps(prev => prev.map(a => a.id === id ? { ...a, status: 'approved' } : a));
      setExpanded(null);
    } catch (err) {
      setActMsg(`Ошибка: ${err instanceof ApiError ? err.code : 'error'}`);
    } finally {
      setActing(false);
    }
  }

  async function handleReject(id: string) {
    setActing(true);
    setActMsg(null);
    try {
      await webApi.rejectAdminApplication(id, rejectComment || undefined);
      setApps(prev => prev.map(a => a.id === id ? { ...a, status: 'rejected', adminComment: rejectComment || null } : a));
      setRejectId(null);
      setRejectComment('');
      setExpanded(null);
    } catch (err) {
      setActMsg(`Ошибка: ${err instanceof ApiError ? err.code : 'error'}`);
    } finally {
      setActing(false);
    }
  }

  if (state === 'forbidden') return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>Нет доступа</div>;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', border: 'none', borderRadius: 20,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    background: active ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
    color: active ? '#000' : 'var(--text-3)',
  });

  const inpStyle: React.CSSProperties = {
    display: 'block', width: '100%', boxSizing: 'border-box',
    padding: '7px 10px', background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-2)', borderRadius: 8,
    fontSize: 12, color: 'var(--text)', outline: 'none', marginBottom: 8,
  };

  return (
    <div>
      <AdminNav />

      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: 'var(--text)', marginBottom: 16 }}>
        Заявки экспертов
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {['pending', 'in_review', 'approved', 'rejected', 'all'].map(s => (
          <button key={s} onClick={() => handleFilterChange(s)} style={tabStyle(filter === s)}>
            {STATUS_LABELS[s] ?? 'Все'}
          </button>
        ))}
      </div>

      {state === 'loading' && <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>Загрузка…</div>}
      {state === 'error' && <div style={{ textAlign: 'center', padding: '20px 0', color: '#ef5350' }}>Ошибка загрузки</div>}

      {state === 'ok' && (
        apps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>Заявок нет</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {apps.map(a => (
              <div key={a.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)', padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{a.fullName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                      {a.specialization}
                      {a.city ? ` · ${a.city}` : ''}
                      {a.experienceYears ? ` · ${a.experienceYears} лет опыта` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[a.status] ?? 'var(--text-3)' }}>
                    {STATUS_LABELS[a.status] ?? a.status}
                  </span>
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>
                  {new Date(a.createdAt).toLocaleDateString('ru-RU')} · {a.source}
                </div>

                <button
                  onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
                >
                  {expanded === a.id ? 'Свернуть ↑' : 'Подробнее ↓'}
                </button>

                {expanded === a.id && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 10 }}>
                      {a.bio}
                    </div>
                    {a.socialLink && (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>
                        Ссылка: <a href={a.socialLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{a.socialLink}</a>
                      </div>
                    )}
                    {a.proofLink && (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
                        Подтверждение: <a href={a.proofLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{a.proofLink}</a>
                      </div>
                    )}
                    {a.adminComment && (
                      <div style={{ fontSize: 12, color: '#ef5350', marginBottom: 10 }}>Комментарий: {a.adminComment}</div>
                    )}

                    {(a.status === 'pending' || a.status === 'in_review') && (
                      <>
                        {actMsg && <div style={{ fontSize: 12, color: '#ef5350', marginBottom: 8 }}>{actMsg}</div>}
                        {rejectId === a.id ? (
                          <div>
                            <textarea
                              placeholder="Причина отклонения (необязательно)"
                              value={rejectComment}
                              onChange={e => setRejectComment(e.target.value)}
                              style={{ ...inpStyle, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
                            />
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => handleReject(a.id)} disabled={acting} style={{
                                padding: '7px 14px', background: '#ef5350', border: 'none',
                                borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer',
                                opacity: acting ? 0.6 : 1,
                              }}>
                                {acting ? '…' : 'Отклонить'}
                              </button>
                              <button onClick={() => { setRejectId(null); setRejectComment(''); }} style={{
                                padding: '7px 12px', background: 'none', border: '1px solid var(--border-2)',
                                borderRadius: 8, fontSize: 12, color: 'var(--text-3)', cursor: 'pointer',
                              }}>
                                Отмена
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button onClick={() => handleApprove(a.id)} disabled={acting} style={{
                              padding: '7px 14px', background: '#4caf50', border: 'none',
                              borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer',
                              opacity: acting ? 0.6 : 1,
                            }}>
                              Одобрить
                            </button>
                            <button onClick={() => { setRejectId(a.id); setActMsg(null); }} style={{
                              padding: '7px 14px', background: 'none', border: '1px solid #ef5350',
                              borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#ef5350', cursor: 'pointer',
                            }}>
                              Отклонить
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
