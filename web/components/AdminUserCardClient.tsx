'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { webApi, ApiError, type WebAdminUserDetail } from '@/lib/webApi';
import AdminNav from '@/components/AdminNav';

const PLAN_LABELS: Record<string, string> = {
  free: 'Free', optimal: 'Оптимальный', client_monthly: 'Оптимальный',
  pro: 'Pro', intro: 'Pro (пробный)',
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--text-3)', minWidth: 140 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500, textAlign: 'right', maxWidth: '55%', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-xl)', padding: '16px 18px', marginBottom: 12,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

const VALID_PLANS = ['optimal', 'pro', 'intro', 'client_monthly'];

function SubManagePanel({ userId, onUpdated }: { userId: string; onUpdated: () => void }) {
  const [action,  setAction]  = useState<'activate' | 'cancel' | 'expire'>('activate');
  const [planId,  setPlanId]  = useState('pro');
  const [days,    setDays]    = useState('30');
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const daysNum = parseInt(days, 10);
      await webApi.adminSubscriptionAction(
        userId, action,
        action === 'activate' ? planId : undefined,
        action === 'activate' ? daysNum : undefined,
      );
      setMsg('Готово');
      onUpdated();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'error';
      setMsg(`Ошибка: ${code}`);
    } finally {
      setLoading(false);
    }
  }

  const inp: React.CSSProperties = {
    padding: '9px 10px', background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-2)', borderRadius: 8,
    fontSize: 14, color: 'var(--text)', outline: 'none',
    minHeight: 40,
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <select value={action} onChange={e => setAction(e.target.value as typeof action)} style={{ ...inp, cursor: 'pointer' }}>
          <option value="activate">Активировать</option>
          <option value="cancel">Отменить</option>
          <option value="expire">Истечь</option>
        </select>
        {action === 'activate' && (
          <>
            <select value={planId} onChange={e => setPlanId(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
              {VALID_PLANS.map(p => <option key={p} value={p}>{PLAN_LABELS[p] ?? p}</option>)}
            </select>
            <input
              type="number" value={days} onChange={e => setDays(e.target.value)}
              min={1} max={365} placeholder="Дней"
              style={{ ...inp, width: 70 }}
            />
          </>
        )}
        <button type="submit" disabled={loading} style={{
          padding: '7px 14px', background: 'var(--accent)', border: 'none',
          borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#000',
          cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
        }}>
          {loading ? '…' : 'Применить'}
        </button>
      </div>
      {msg && <div style={{ fontSize: 12, color: msg.startsWith('Ошибка') ? '#ef5350' : '#4caf50' }}>{msg}</div>}
    </form>
  );
}

export default function AdminUserCardClient({ userId }: { userId: string }) {
  const [state, setState] = useState<'loading' | 'forbidden' | 'not_found' | 'error' | 'ok'>('loading');
  const [user, setUser] = useState<WebAdminUserDetail | null>(null);

  function load() {
    setState('loading');
    webApi.getAdminUser(userId)
      .then(r => { setUser(r.user); setState('ok'); })
      .catch(err => {
        if (err instanceof ApiError) {
          if (err.status === 403) setState('forbidden');
          else if (err.status === 404) setState('not_found');
          else setState('error');
        } else setState('error');
      });
  }

  useEffect(() => { load(); }, [userId]);

  if (state === 'loading') return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>Загрузка…</div>;
  if (state === 'forbidden') return <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>Нет доступа</div>;
  if (state === 'not_found') return <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>Пользователь не найден</div>;
  if (state === 'error' || !user) return <div style={{ textAlign: 'center', padding: '40px 0', color: '#ef5350' }}>Ошибка загрузки</div>;

  const displayN = user.profile?.preferredName
    ?? user.identities.find(i => i.firstName)?.firstName
    ?? user.id.slice(0, 12) + '…';

  return (
    <div>
      <AdminNav />

      <Link href="/admin/users" style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}>
        ← Пользователи
      </Link>

      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5, color: 'var(--text)', marginBottom: 4 }}>
        {displayN}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20 }}>
        ID: {user.id}
        {user.roles.isAdmin ? ' · Администратор' : ''}
        {user.roles.isExpert ? ' · Эксперт' : ''}
        {user.roles.isCompany ? ' · Компания' : ''}
      </div>

      <Section title="Идентификаторы">
        {user.identities.map((id, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <Row label={`${id.platform} ID`} value={id.platformId} />
            {id.username && <Row label={`${id.platform} username`} value={`@${id.username}`} />}
            {id.firstName && <Row label="Имя" value={id.firstName} />}
            <Row label="Привязан" value={new Date(id.linkedAt).toLocaleString('ru-RU')} />
          </div>
        ))}
      </Section>

      {user.profile && (
        <Section title="Профиль">
          <Row label="Имя"           value={user.profile.preferredName} />
          <Row label="Город"         value={user.profile.city} />
          <Row label="Цель"          value={user.profile.goalType} />
          <Row label="Рост"          value={user.profile.heightCm ? `${user.profile.heightCm} см` : null} />
          <Row label="Вес"           value={user.profile.currentWeightKg ? `${user.profile.currentWeightKg} кг` : null} />
          <Row label="Желаемый вес"  value={user.profile.desiredWeightKg ? `${user.profile.desiredWeightKg} кг` : null} />
          <Row label="Калории"       value={user.profile.dailyCaloriesKcal ? `${user.profile.dailyCaloriesKcal} ккал` : null} />
          <Row label="Реф. код"      value={user.profile.referralCode} />
          <Row label="Реферер"       value={user.profile.referredByRole} />
          <Row label="Создан"        value={new Date(user.profile.profileCreatedAt).toLocaleString('ru-RU')} />
        </Section>
      )}

      <Section title="Подписка">
        {user.subscription ? (
          <>
            <Row label="Тариф"       value={PLAN_LABELS[user.subscription.planId] ?? user.subscription.planId} />
            <Row label="Статус"      value={user.subscription.status} />
            <Row label="До"          value={user.subscription.currentPeriodEnd ? new Date(user.subscription.currentPeriodEnd).toLocaleString('ru-RU') : null} />
            <Row label="Триал до"    value={user.subscription.trialEndsAt ? new Date(user.subscription.trialEndsAt).toLocaleString('ru-RU') : null} />
            <Row label="Авто-продление" value={user.subscription.autoRenew ? 'Да' : 'Нет'} />
          </>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>Нет активной подписки</div>
        )}
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-3)', marginBottom: 10 }}>
            Управление подпиской
          </div>
          <SubManagePanel userId={user.id} onUpdated={load} />
        </div>
      </Section>

      {user.expert && (
        <Section title="Профиль эксперта / компании">
          <Row label="Имя"            value={user.expert.fullName} />
          <Row label="Специализация"  value={user.expert.specialization} />
          <Row label="Город"          value={user.expert.city} />
          <Row label="Статус верификации" value={user.expert.verificationStatus} />
          <Row label="Публичный статус"   value={user.expert.publicStatus} />
          <Row label="Slug"           value={user.expert.slug} />
          <Row label="Реф. код"       value={user.expert.referralCode} />
          <Row label="Верифицирован"  value={user.expert.verifiedAt ? new Date(user.expert.verifiedAt).toLocaleString('ru-RU') : null} />
        </Section>
      )}

      {user.recentPayments.length > 0 && (
        <Section title="Последние платежи">
          {user.recentPayments.map(p => (
            <div key={p.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', marginBottom: 8, fontSize: 12, alignItems: 'center' }}>
              <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>{new Date(p.createdAt).toLocaleDateString('ru-RU')}</span>
              <span style={{ color: 'var(--text-2)', flex: '1 1 auto', minWidth: 60 }}>{PLAN_LABELS[p.planId] ?? p.planId}</span>
              <span style={{ color: 'var(--text-2)', fontWeight: 600, flexShrink: 0 }}>{p.amountRub} ₽</span>
              <span style={{ color: p.status === 'succeeded' ? '#4caf50' : 'var(--text-3)', flexShrink: 0 }}>{p.status}</span>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
