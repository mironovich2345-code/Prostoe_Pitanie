import { useQuery } from '@tanstack/react-query';

import { api } from '../../api/client';

// ─── Primitives ────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: 1.2, color: 'var(--text-3)',
      padding: '20px 2px 8px',
    }}>
      {children}
    </div>
  );
}

function StatCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r-xl)',
      border: '1px solid var(--border)', overflow: 'hidden',
      marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function BigRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 18px',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: color ?? 'var(--text)' }}>
        {value}
      </span>
    </div>
  );
}

function SmallRow({ label, value, color, last }: { label: string; value: string | number; color?: string; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '11px 18px',
      borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: color ?? 'var(--text-2)' }}>{value}</span>
    </div>
  );
}

function GrowthRow({ today, week, month }: { today: number; week: number; month: number }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-around',
      padding: '10px 18px', background: 'var(--surface-2)',
    }}>
      {[
        { label: 'сегодня', value: today },
        { label: 'неделя',  value: week  },
        { label: 'месяц',   value: month },
      ].map(({ label, value }) => (
        <div key={label} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: value > 0 ? '#4CAF50' : 'var(--text-3)' }}>
            {value > 0 ? `+${value}` : value}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

function ThreeTiles({ items }: { items: { label: string; value: string | number; color?: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
      {items.map(({ label, value, color }) => (
        <div key={label} style={{
          background: 'var(--surface)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)', padding: '12px 10px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
            {label}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function AdminStatsScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: api.adminStats,
  });
  const { data: aiCost } = useQuery({
    queryKey: ['admin-ai-cost'],
    queryFn: api.adminAiCostAggregate,
  });

  return (
    <div className="screen">
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: 'var(--text)', marginBottom: 4 }}>
        Статистика
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <div className="spinner" />
        </div>
      )}

      {data && (
        <>
          {/* ── Пользователи ── */}
          <SectionLabel>Пользователи</SectionLabel>
          <StatCard>
            <BigRow label="Всего" value={data.users.total.toLocaleString('ru')} color="var(--text)" />
            <SmallRow label="Клиенты"  value={data.users.clients.toLocaleString('ru')} />
            <SmallRow label="Эксперты" value={data.users.experts.toLocaleString('ru')} color="var(--accent)" />
            <SmallRow label="Компании" value={data.users.companies.toLocaleString('ru')} color="#7EB8F0" last />
            <GrowthRow today={data.users.newToday} week={data.users.newWeek} month={data.users.newMonth} />
          </StatCard>

          {/* ── Эксперты ── */}
          <SectionLabel>Верификации</SectionLabel>
          <StatCard>
            <BigRow label="Верифицировано" value={data.experts.total} color="var(--accent)" />
            <GrowthRow today={data.experts.newToday} week={data.experts.newWeek} month={data.experts.newMonth} />
          </StatCard>

          {/* ── Подписки ── */}
          <SectionLabel>Подписки</SectionLabel>
          <ThreeTiles items={[
            { label: 'Активные',  value: data.subscriptions.active,   color: '#4CAF50' },
            { label: 'Истекшие',  value: data.subscriptions.expired,  color: 'var(--danger)' },
            { label: 'Без оплат', value: data.subscriptions.neverPaid, color: 'var(--text-3)' },
          ]} />

          {/* ── Оплаты ── */}
          <SectionLabel>Оплаты (₽)</SectionLabel>
          {data.paymentRevenue && (
            <StatCard>
              <div style={{ display: 'flex', justifyContent: 'space-around', padding: '14px 18px' }}>
                {[
                  { label: 'Сегодня', value: data.paymentRevenue.today },
                  { label: 'Неделя',  value: data.paymentRevenue.week },
                  { label: 'Месяц',   value: data.paymentRevenue.month },
                ].map(({ label, value }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: value > 0 ? 'var(--accent)' : 'var(--text-3)', letterSpacing: -0.3 }}>
                      {value.toLocaleString('ru')} ₽
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </StatCard>
          )}

          {/* ── Тарифы ── */}
          <SectionLabel>Тарифы</SectionLabel>
          {data.plans && (
            <ThreeTiles items={[
              { label: 'Бесплатно', value: data.plans.free.toLocaleString('ru'),    color: 'var(--text-3)' },
              { label: 'Optimal',   value: data.plans.optimal.toLocaleString('ru'), color: '#7EB8F0' },
              { label: 'Pro',       value: data.plans.pro.toLocaleString('ru'),     color: 'var(--accent)' },
            ]} />
          )}

          {/* ── Автосписание ── */}
          <SectionLabel>Автосписание</SectionLabel>
          {data.autoRenew && (
            <StatCard>
              <SmallRow label="С автосписанием"    value={data.autoRenew.on.toLocaleString('ru')}  color="#4CAF50" />
              <SmallRow label="Без автосписания"   value={data.autoRenew.off.toLocaleString('ru')} color="var(--text-3)" last />
            </StatCard>
          )}

          {/* ── Обязательства по офферам ── */}
          {data.offerObligations && (
            <>
              <SectionLabel>Обязательства по офферам (₽)</SectionLabel>
              <StatCard>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: 'var(--surface-2)', padding: '8px 18px' }}>
                  {(['day', 'week', 'month'] as const).map(period => (
                    <div key={period} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
                        {period === 'day' ? 'Сегодня' : period === 'week' ? 'Неделя' : 'Месяц'}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginBottom: 6 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>100% оффер</div>
                    {(['day', 'week', 'month'] as const).map(p => (
                      <div key={p} style={{ fontSize: 13, fontWeight: 700, color: data.offerObligations[p].oneTime > 0 ? 'var(--accent)' : 'var(--text-3)', textAlign: 'right' }}>
                        {data.offerObligations[p].oneTime.toLocaleString('ru')} ₽
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>20% оффер</div>
                    {(['day', 'week', 'month'] as const).map(p => (
                      <div key={p} style={{ fontSize: 13, fontWeight: 700, color: data.offerObligations[p].lifetime > 0 ? '#7EB8F0' : 'var(--text-3)', textAlign: 'right' }}>
                        {data.offerObligations[p].lifetime.toLocaleString('ru')} ₽
                      </div>
                    ))}
                  </div>
                </div>
              </StatCard>
            </>
          )}

          {/* ── Вознаграждения ── */}
          <SectionLabel>Вознаграждения тренеров</SectionLabel>
          <StatCard>
            <BigRow label="Всего начислений" value={data.payments.total} />
            <GrowthRow today={data.payments.today} week={data.payments.week} month={data.payments.month} />
          </StatCard>

          {/* ── ИИ-расходы ── */}
          <SectionLabel>ИИ-расходы</SectionLabel>
          {aiCost ? (
            <StatCard>
              <BigRow
                label="Всего расходов"
                value={`$${aiCost.totalCostUsd.toFixed(4)}`}
                color="var(--accent)"
              />
              <SmallRow label="Запросов" value={aiCost.totalRequests.toLocaleString('ru')} />
              <SmallRow label="Токенов" value={aiCost.totalTokens.toLocaleString('ru')} last />
              {aiCost.byScenario.length > 0 && (
                <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-3)', marginBottom: 8 }}>
                    По сценариям
                  </div>
                  {aiCost.byScenario.map((s, i) => (
                    <div key={s.scenario} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: 13, paddingBottom: i < aiCost.byScenario.length - 1 ? 6 : 0,
                      marginBottom: i < aiCost.byScenario.length - 1 ? 6 : 0,
                      borderBottom: i < aiCost.byScenario.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <span style={{ color: 'var(--text-2)' }}>{s.scenario}</span>
                      <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
                        {s.requests} зап. · ${s.costUsd.toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </StatCard>
          ) : (
            <div style={{
              background: 'var(--surface)', borderRadius: 'var(--r-xl)',
              border: '1px solid var(--border)', padding: '16px 18px',
              marginBottom: 12,
            }}>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                Загрузка...
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
