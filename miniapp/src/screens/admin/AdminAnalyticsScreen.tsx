import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function addDays(s: string, n: number): string {
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

function getMondayOfWeek(s: string): string {
  const d = new Date(`${s}T12:00:00Z`);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().split('T')[0];
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function fmtMonth(iso: string): string {
  const MONTHS = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  const [y, m] = iso.split('-');
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
}

function firstOfMonth(iso: string): string {
  const [y, m] = iso.split('-');
  return `${y}-${m}-01`;
}

function prevMonth(iso: string): string {
  const [y, m] = iso.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function nextMonth(iso: string): string {
  const [y, m] = iso.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ─── Period label ─────────────────────────────────────────────────────────────

function displayLabel(mode: string, date: string, customFrom: string, customTo: string): string {
  if (mode === 'day')    return fmtDate(date);
  if (mode === 'week') {
    const mon = getMondayOfWeek(date);
    return `${fmtDate(mon)} – ${fmtDate(addDays(mon, 6))}`;
  }
  if (mode === 'month')  return fmtMonth(firstOfMonth(date));
  return `${fmtDate(customFrom || date)} – ${fmtDate(customTo || date)}`;
}

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      flex: '1 1 42%', minWidth: 120,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', padding: '12px 14px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-3)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '16px 4px 8px' }}>
      {title}
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{children}</div>;
}

// ─── Mode selector ────────────────────────────────────────────────────────────

const MODES = [
  { key: 'day',    label: 'День' },
  { key: 'week',   label: 'Неделя' },
  { key: 'month',  label: 'Месяц' },
  { key: 'custom', label: 'Период' },
] as const;
type Mode = typeof MODES[number]['key'];

export default function AdminAnalyticsScreen() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('day');
  const [date, setDate] = useState(todayStr());
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo] = useState(todayStr());

  // ── Navigation helpers ────────────────────────────────────────────────────
  function prev() {
    if (mode === 'day')   setDate(d => addDays(d, -1));
    if (mode === 'week')  setDate(d => addDays(getMondayOfWeek(d), -7));
    if (mode === 'month') setDate(d => prevMonth(d));
  }
  function next() {
    if (mode === 'day')   setDate(d => addDays(d, 1));
    if (mode === 'week')  setDate(d => addDays(getMondayOfWeek(d), 7));
    if (mode === 'month') setDate(d => nextMonth(d));
  }
  function resetToNow() {
    const t = todayStr();
    setDate(t);
    if (mode === 'custom') { setCustomFrom(t); setCustomTo(t); }
  }

  // ── Query params ──────────────────────────────────────────────────────────
  const queryParams = mode === 'custom'
    ? { mode, from: customFrom, to: customTo }
    : { mode, date };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-analytics', mode, date, customFrom, customTo],
    queryFn: () => api.adminAnalytics(queryParams),
    placeholderData: (prev) => prev,
  });

  const s = data?.summary;

  return (
    <div className="screen">
      {/* Header */}
      <button
        onClick={() => navigate('/')}
        style={{ background: 'none', border: 'none', fontSize: 16, marginBottom: 12, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
      >
        ← Администратор
      </button>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: 'var(--text)', marginBottom: 16 }}>
        Статистика клиентов
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {MODES.map(m => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: mode === m.key ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: mode === m.key ? 'var(--accent-soft)' : 'var(--surface)',
              color: mode === m.key ? 'var(--accent)' : 'var(--text-3)',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Date navigation */}
      {mode !== 'custom' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <button onClick={prev} style={navBtn}>←</button>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {displayLabel(mode, date, customFrom, customTo)}
          </div>
          <button onClick={next} style={navBtn}>→</button>
          <button
            onClick={resetToNow}
            style={{ ...navBtn, fontSize: 11, padding: '6px 10px', color: 'var(--accent)', border: '1px solid var(--accent)' }}
          >
            {mode === 'day' ? 'Сегодня' : mode === 'week' ? 'Тек. неделя' : 'Тек. месяц'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>От</span>
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              style={dateInput}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>До</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              style={dateInput}
            />
          </div>
        </div>
      )}

      {/* Loading / error */}
      {isLoading && !data && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>Загрузка…</div>
      )}
      {isError && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#f87171', fontSize: 13 }}>
          Ошибка: {(error as Error)?.message ?? 'неизвестная ошибка'}
        </div>
      )}

      {/* Period label */}
      {data && (
        <div style={{
          fontSize: 12, color: 'var(--text-3)', marginBottom: 14,
          padding: '8px 14px', background: 'var(--surface)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)', textAlign: 'center',
        }}>
          Период: <strong style={{ color: 'var(--text)' }}>{data.period.label}</strong>
        </div>
      )}

      {s && (
        <>
          {/* ── Клиенты */}
          <SectionHeader title="Клиенты" />
          <CardGrid>
            <MetricCard label="Всего" value={s.totalClients} />
            <MetricCard label="Новые за период" value={s.newClients} />
            <MetricCard label="Активные" value={s.activeClients} sub="в выбранном периоде" />
            <MetricCard label="Активированные" value={s.activatedClients} sub="анкета + хотя бы 1 еда" />
          </CardGrid>

          {/* ── Еда */}
          <SectionHeader title="Еда" />
          <CardGrid>
            <MetricCard label="Приёмов пищи" value={s.mealsTotal} />
            <MetricCard label="Пользователей с едой" value={s.clientsWithMeals} />
            <MetricCard label="Текстом" value={s.mealsText} />
            <MetricCard label="Фото" value={s.mealsPhoto} />
          </CardGrid>

          {/* ── Возврат */}
          <SectionHeader title="Возврат" />
          <CardGrid>
            <MetricCard
              label="D1 Retention"
              value={s.d1RetentionPercent !== null ? `${s.d1RetentionPercent}%` : '—'}
              sub="вернулись на следующий день"
            />
            <MetricCard label="Открыли статистику" value={s.statsOpenedUsers} />
          </CardGrid>

          {/* ── Интерес к оплате */}
          <SectionHeader title="Интерес к оплате" />
          <CardGrid>
            <MetricCard label="Открыли подписку" value={s.subscriptionOpenedUsers} />
            <MetricCard label="Нажали подключение" value={s.subscriptionClickedUsers} />
            <MetricCard label="Активный Pro" value={s.manualProActive} sub="Pro/Intro сейчас" />
            <MetricCard label="Нажали поддержку" value={s.supportClickedUsers} />
          </CardGrid>

          {/* ── Деньги и расходы */}
          <SectionHeader title="Деньги и расходы" />
          <CardGrid>
            <MetricCard
              label="Выручка клиентов"
              value={`${s.totalRevenueRub.toLocaleString('ru-RU')} ₽`}
              sub="платежи succeeded"
            />
            <MetricCard
              label="AI-расходы"
              value={`$${s.aiCostUsd.toFixed(4)}`}
              sub="costUsd из AiCostLog"
            />
            <MetricCard
              label="AI на 1 активного"
              value={s.activeClients > 0 ? `$${s.aiCostPerActiveUsd.toFixed(5)}` : '—'}
            />
          </CardGrid>

          {/* ── Динамика по дням */}
          {data.chart.length > 1 && (
            <>
              <SectionHeader title="Динамика по дням" />
              <div style={{
                background: 'var(--surface)', borderRadius: 'var(--r-xl)',
                border: '1px solid var(--border)', overflow: 'hidden',
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr 1fr 1fr 1fr',
                  gap: 0,
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3,
                  color: 'var(--text-3)', padding: '8px 12px',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span>Дата</span><span>Новые</span><span>Актив.</span><span>Ед.</span><span>AI $</span>
                </div>
                {data.chart.map((row, i) => (
                  <div
                    key={row.date}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '80px 1fr 1fr 1fr 1fr',
                      padding: '8px 12px',
                      borderBottom: i < data.chart.length - 1 ? '1px solid var(--border)' : 'none',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>{row.date}</span>
                    <span style={{ color: row.newClients > 0 ? 'var(--accent)' : 'var(--text-3)' }}>{row.newClients}</span>
                    <span style={{ color: row.activeClients > 0 ? 'var(--text)' : 'var(--text-3)' }}>{row.activeClients}</span>
                    <span style={{ color: row.mealsTotal > 0 ? 'var(--text)' : 'var(--text-3)' }}>{row.mealsTotal}</span>
                    <span style={{ color: row.aiCostUsd > 0 ? 'var(--text)' : 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                      {row.aiCostUsd > 0 ? row.aiCostUsd.toFixed(4) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Link to clients */}
          <button
            onClick={() => navigate('/clients')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '15px 20px', marginTop: 20,
              background: 'var(--surface)', borderRadius: 'var(--r-xl)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)' }}>База клиентов →</span>
          </button>
          <div style={{ height: 32 }} />
        </>
      )}
    </div>
  );
}

// ─── Inline styles ─────────────────────────────────────────────────────────────

const navBtn: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 20, fontSize: 15, fontWeight: 600, cursor: 'pointer',
  background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)',
  flexShrink: 0,
};

const dateInput: React.CSSProperties = {
  padding: '7px 10px',
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--r-lg)', fontSize: 13, color: 'var(--text)',
  colorScheme: 'dark',
};
