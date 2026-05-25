'use client';

import { useState, useEffect } from 'react';
import { webApi, ApiError, type WebAdminOverview } from '@/lib/webApi';
import AdminNav from '@/components/AdminNav';

function StatTile({ label, value }: { label: string; value: number | null }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-xl)',
      padding: '18px 20px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1, color: 'var(--text)' }}>
        {value !== null ? value.toLocaleString('ru') : '—'}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-3)', marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

export default function AdminDashboardClient({ botUsername }: { botUsername: string }) {
  const [state, setState] = useState<'loading' | 'forbidden' | 'error' | 'ok'>('loading');
  const [overview, setOverview] = useState<WebAdminOverview | null>(null);

  useEffect(() => {
    webApi.getAdminOverview()
      .then(r => { setOverview(r.overview); setState('ok'); })
      .catch(err => {
        if (err instanceof ApiError && err.status === 403) setState('forbidden');
        else setState('error');
      });
  }, []);

  if (state === 'loading') {
    return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>Загрузка…</div>;
  }
  if (state === 'forbidden') {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--text-3)' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="4" y="9" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <p style={{ color: 'var(--text-3)' }}>Нет доступа. Этот раздел доступен только администраторам.</p>
      </div>
    );
  }
  if (state === 'error' || !overview) {
    return <div style={{ textAlign: 'center', padding: '40px 0', color: '#ef5350' }}>Ошибка загрузки данных</div>;
  }

  void botUsername;

  return (
    <div>
      <AdminNav />

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 6 }}>
          Администрирование
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: 'var(--text)' }}>
          Обзор системы
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <StatTile label="Пользователей" value={overview.usersTotal} />
        <StatTile label="Экспертов" value={overview.expertsTotal} />
        <StatTile label="Компаний" value={overview.companiesTotal} />
        <StatTile label="Активных подписок" value={overview.activeSubscriptions} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
        <StatTile label="Заявок (ожид.)" value={overview.expertApplicationsPending} />
        <StatTile label="Запросов (ожид.)" value={overview.clientExpertRequestsPending} />
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)',
        padding: '20px 22px',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 14 }}>
          Разделы
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { href: '/admin/users',        label: 'Пользователи' },
            { href: '/admin/experts',      label: 'Эксперты и компании' },
            { href: '/admin/applications', label: 'Заявки экспертов' },
            { href: '/admin/requests',     label: 'Запросы клиент→эксперт' },
          ].map((item, i, arr) => (
            <span key={item.href}>
              <a href={item.href} style={{ fontSize: 14, color: 'var(--text-2)', textDecoration: 'none', display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.label}</span>
                <span style={{ color: 'var(--text-3)' }}>→</span>
              </a>
              {i < arr.length - 1 && <div style={{ height: 1, background: 'var(--border)', marginTop: 10 }} />}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
