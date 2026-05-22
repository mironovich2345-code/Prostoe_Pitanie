'use client';

import { useState, useEffect } from 'react';
import { webApi, ApiError, type WebAdminExpert } from '@/lib/webApi';
import AdminNav from '@/components/AdminNav';

const STATUS_COLORS: Record<string, string> = {
  verified: '#4caf50',
  pending:  '#ffc107',
  rejected: '#ef5350',
  blocked:  '#9e9e9e',
};

const VERIFICATION_STATUSES = ['', 'verified', 'pending', 'rejected', 'blocked'];
const TYPES = ['', 'expert', 'company'];

export default function AdminExpertsClient() {
  const [state,   setState]   = useState<'loading' | 'forbidden' | 'error' | 'ok'>('loading');
  const [experts, setExperts] = useState<WebAdminExpert[]>([]);
  const [q,       setQ]       = useState('');
  const [status,  setStatus]  = useState('');
  const [type,    setType]    = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [editVS,  setEditVS]  = useState('');
  const [editPS,  setEditPS]  = useState('');
  const [saving,  setSaving]  = useState(false);
  const [editMsg, setEditMsg] = useState<string | null>(null);

  function load() {
    setState('loading');
    webApi.getAdminExperts(q || undefined, status || undefined, type || undefined)
      .then(r => { setExperts(r.experts); setState('ok'); })
      .catch(err => {
        if (err instanceof ApiError && err.status === 403) setState('forbidden');
        else setState('error');
      });
  }

  useEffect(() => { load(); }, []);

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    load();
  }

  function openEdit(e: WebAdminExpert) {
    setEditing(e.id);
    setEditVS(e.verificationStatus);
    setEditPS(e.publicStatus);
    setEditMsg(null);
  }

  async function saveEdit(e: WebAdminExpert) {
    setSaving(true);
    setEditMsg(null);
    try {
      const updated = await webApi.patchAdminExpert(e.id, { verificationStatus: editVS, publicStatus: editPS });
      setExperts(prev => prev.map(x => x.id === e.id ? updated.expert : x));
      setEditing(null);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'error';
      setEditMsg(`Ошибка: ${code}`);
    } finally {
      setSaving(false);
    }
  }

  if (state === 'forbidden') return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>Нет доступа</div>;

  const inp: React.CSSProperties = {
    padding: '8px 10px', background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-2)', borderRadius: 8,
    fontSize: 12, color: 'var(--text)', outline: 'none',
  };

  return (
    <div>
      <AdminNav />

      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: 'var(--text)', marginBottom: 16 }}>
        Эксперты и компании
      </div>

      <form onSubmit={handleFilter} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <input
          type="search" placeholder="Имя или город" value={q}
          onChange={e => setQ(e.target.value)}
          style={{ ...inp, flex: 1, minWidth: 140 }}
        />
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
          {VERIFICATION_STATUSES.map(s => (
            <option key={s} value={s}>{s || 'Все статусы'}</option>
          ))}
        </select>
        <select value={type} onChange={e => setType(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
          {TYPES.map(t => (
            <option key={t} value={t}>{t === 'expert' ? 'Эксперты' : t === 'company' ? 'Компании' : 'Все типы'}</option>
          ))}
        </select>
        <button type="submit" style={{
          padding: '8px 14px', background: 'var(--accent)', border: 'none',
          borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#000', cursor: 'pointer',
        }}>
          Найти
        </button>
      </form>

      {state === 'loading' && <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>Загрузка…</div>}
      {state === 'error' && <div style={{ textAlign: 'center', padding: '20px 0', color: '#ef5350' }}>Ошибка загрузки</div>}

      {state === 'ok' && (
        experts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>Ничего не найдено</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {experts.map(e => (
              <div key={e.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)', padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                      {e.fullName ?? e.chatId}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {e.specialization ?? 'Эксперт'}
                      {e.city ? ` · ${e.city}` : ''}
                      {e.slug ? ` · /${e.slug}` : ''}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: STATUS_COLORS[e.verificationStatus] ?? 'var(--text-3)',
                  }}>
                    {e.verificationStatus}
                  </span>
                </div>

                {editing === e.id ? (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <select value={editVS} onChange={ev => setEditVS(ev.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                        {['verified', 'pending', 'rejected', 'blocked'].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <select value={editPS} onChange={ev => setEditPS(ev.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                        {['draft', 'published', 'hidden'].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <button onClick={() => saveEdit(e)} disabled={saving} style={{
                        padding: '7px 12px', background: 'var(--accent)', border: 'none',
                        borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#000', cursor: 'pointer',
                        opacity: saving ? 0.6 : 1,
                      }}>
                        {saving ? '…' : 'Сохранить'}
                      </button>
                      <button onClick={() => setEditing(null)} style={{
                        padding: '7px 12px', background: 'none', border: '1px solid var(--border-2)',
                        borderRadius: 8, fontSize: 12, color: 'var(--text-3)', cursor: 'pointer',
                      }}>
                        Отмена
                      </button>
                    </div>
                    {editMsg && <div style={{ fontSize: 12, color: '#ef5350', marginTop: 6 }}>{editMsg}</div>}
                  </div>
                ) : (
                  <button onClick={() => openEdit(e)} style={{
                    marginTop: 6, background: 'none', border: 'none', padding: 0,
                    fontSize: 12, color: 'var(--accent)', cursor: 'pointer', fontWeight: 600,
                  }}>
                    Редактировать статус
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
