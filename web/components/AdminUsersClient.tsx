'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { webApi, ApiError, type WebAdminUserSummary } from '@/lib/webApi';
import AdminNav from '@/components/AdminNav';

const PLAN_LABELS: Record<string, string> = {
  free: 'Free', optimal: 'Оптимальный', client_monthly: 'Оптимальный',
  pro: 'Pro', intro: 'Pro (пробный)',
};

function displayName(u: WebAdminUserSummary): string {
  if (u.profile?.preferredName) return u.profile.preferredName;
  const tg = u.identities.find(i => i.platform === 'telegram');
  if (tg?.firstName) return tg.firstName;
  if (tg?.username) return `@${tg.username}`;
  const first = u.identities[0];
  if (first?.firstName) return first.firstName;
  return u.id.slice(0, 8) + '…';
}

function platformTag(u: WebAdminUserSummary): string {
  const platforms = [...new Set(u.identities.map(i => i.platform))];
  return platforms.join(', ');
}

export default function AdminUsersClient() {
  const [state, setState] = useState<'loading' | 'forbidden' | 'error' | 'ok'>('loading');
  const [users, setUsers] = useState<WebAdminUserSummary[]>([]);
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function loadUsers(query: string) {
    setSearching(true);
    webApi.getAdminUsers(query || undefined)
      .then(r => { setUsers(r.users); setState('ok'); setSearching(false); })
      .catch(err => {
        if (err instanceof ApiError && err.status === 403) setState('forbidden');
        else setState('error');
        setSearching(false);
      });
  }

  useEffect(() => { loadUsers(''); }, []);

  function handleSearch(val: string) {
    setQ(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadUsers(val), 400);
  }

  if (state === 'forbidden') {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <p style={{ color: 'var(--text-3)' }}>Нет доступа</p>
      </div>
    );
  }

  const inp: React.CSSProperties = {
    display: 'block', width: '100%', boxSizing: 'border-box',
    padding: '9px 12px', background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-2)', borderRadius: 8,
    fontSize: 13, color: 'var(--text)', outline: 'none', marginBottom: 16,
  };

  return (
    <div>
      <AdminNav />

      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: 'var(--text)', marginBottom: 16 }}>
        Пользователи
      </div>

      <input
        type="search" placeholder="Поиск по имени, username, platformId…"
        value={q} onChange={e => handleSearch(e.target.value)}
        style={inp}
      />

      {state === 'loading' && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>Загрузка…</div>
      )}
      {state === 'error' && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#ef5350' }}>Ошибка загрузки</div>
      )}

      {state === 'ok' && (
        <>
          {searching && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>Поиск…</div>
          )}
          {users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
              Пользователи не найдены
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {users.map(u => {
                const tg = u.identities.find(i => i.platform === 'telegram');
                const sub = u.subscription;
                return (
                  <Link key={u.id} href={`/admin/users/${u.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 'var(--r-xl)', padding: '14px 18px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                          {displayName(u)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          {tg?.username ? `@${tg.username} · ` : ''}{platformTag(u)}
                          {u.roles.isExpert ? ' · Эксперт' : ''}
                          {u.roles.isCompany ? ' · Компания' : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {sub ? (
                          <span style={{
                            fontSize: 11, fontWeight: 700,
                            color: ['active', 'trial'].includes(sub.status) ? '#4caf50' : 'var(--text-3)',
                          }}>
                            {PLAN_LABELS[sub.planId] ?? sub.planId}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Free</span>
                        )}
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>→</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
