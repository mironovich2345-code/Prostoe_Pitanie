import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

function Tile({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)',
      padding: '12px 14px',
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '16px 2px 10px' }}>
      {children}
    </div>
  );
}

function fmtRub(n: number | null) {
  if (n === null) return '—';
  return n.toLocaleString('ru-RU') + ' ₽';
}

export default function AdminStatsScreen() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: api.adminStats,
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
        Статистика
      </div>

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>}

      {data && (
        <>
          <SectionTitle>Пользователи</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
            <Tile label="Всего" value={data.users.total} color="var(--text)" />
            <Tile label="Клиенты" value={data.users.clients} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
            <Tile label="Эксперты" value={data.users.experts} color="var(--accent)" />
            <Tile label="Компании" value={data.users.companies} color="#7EB8F0" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <Tile label="Сегодня" value={`+${data.users.newToday}`} color="#4CAF50" />
            <Tile label="Неделя" value={`+${data.users.newWeek}`} color="#4CAF50" />
            <Tile label="Месяц" value={`+${data.users.newMonth}`} color="#4CAF50" />
          </div>

          <SectionTitle>Эксперты</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            <Tile label="Всего" value={data.experts.total} />
            <Tile label="Сегодня" value={`+${data.experts.newToday}`} color="#4CAF50" />
            <Tile label="Неделя" value={`+${data.experts.newWeek}`} color="#4CAF50" />
            <Tile label="Месяц" value={`+${data.experts.newMonth}`} color="#4CAF50" />
          </div>

          <SectionTitle>Подписки</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <Tile label="Активные" value={data.subscriptions.active} color="#4CAF50" />
            <Tile label="Истекшие" value={data.subscriptions.expired} color="var(--danger)" />
            <Tile label="Без оплат" value={data.subscriptions.neverPaid} color="var(--text-3)" />
          </div>

          <SectionTitle>Оплаты (вознаграждения)</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            <Tile label="Всего" value={data.payments.total} />
            <Tile label="Сегодня" value={data.payments.today} />
            <Tile label="Неделя" value={data.payments.week} />
            <Tile label="Месяц" value={data.payments.month} />
          </div>

          <SectionTitle>ИИ-расходы</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <Tile label="Сегодня" value={fmtRub(data.aiCosts.today)} />
            <Tile label="Неделя" value={fmtRub(data.aiCosts.week)} />
            <Tile label="Месяц" value={fmtRub(data.aiCosts.month)} />
          </div>
          {data.aiCosts.note && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', padding: '8px 4px', lineHeight: 1.4 }}>
              {data.aiCosts.note}
            </div>
          )}
        </>
      )}
    </div>
  );
}
