'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  webApi, ApiError,
  type WebNutritionWeekStatsResponse, type WebNutritionStatsDay,
  type WebWeeklyInsight,
} from '@/lib/webApi';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(s: string, delta: number): string {
  const d = new Date(`${s}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function fmtShort(s: string): string {
  return new Date(`${s}T12:00:00.000Z`).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

function fmtDay(s: string): string {
  return new Date(`${s}T12:00:00.000Z`).toLocaleDateString('ru-RU', {
    weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
}

function pluralMeal(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'приём';
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'приёма';
  return 'приёмов';
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  no_data:   { label: 'Нет данных', color: 'var(--text-3)', bg: 'rgba(255,255,255,0.05)' },
  no_target: { label: 'Нет нормы',  color: 'var(--text-3)', bg: 'rgba(255,255,255,0.05)' },
  under:     { label: 'Недобор',    color: '#ff9800',       bg: 'rgba(255,152,0,0.12)'   },
  ok:        { label: 'В норме',    color: '#4caf50',       bg: 'rgba(76,175,80,0.12)'   },
  over:      { label: 'Перебор',    color: '#ef5350',       bg: 'rgba(239,83,80,0.12)'   },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryTile({
  label, value, unit, target, accent,
}: {
  label: string; value: number; unit: string; target?: number | null; accent?: boolean;
}) {
  const hasValue = value > 0;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${accent ? 'rgba(215,255,63,0.2)' : 'var(--border)'}`,
      borderRadius: 10, padding: '12px 14px',
    }}>
      <div style={{
        fontSize: 10, color: 'var(--text-3)', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 18, fontWeight: 700,
        color: accent ? 'var(--accent)' : 'var(--text)', lineHeight: 1,
      }}>
        {hasValue ? value : '—'}{hasValue ? ` ${unit}` : ''}
      </div>
      {target != null && hasValue && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>/ {target} {unit}</div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.no_data;
  return (
    <span style={{
      display: 'inline-block', padding: '4px 10px', borderRadius: 16,
      fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg,
      flexShrink: 0,
    }}>
      {cfg.label}
    </span>
  );
}

function MacroItem({
  label, value, target, accent,
}: {
  label: string; value: number; target: number | null; accent?: boolean;
}) {
  return (
    <div style={{
      flex: '1 1 52px', padding: '8px 8px 6px', borderRadius: 8, textAlign: 'center',
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${accent ? 'rgba(215,255,63,0.15)' : 'var(--border)'}`,
    }}>
      <div style={{
        fontSize: 15, fontWeight: 700,
        color: accent ? 'var(--accent)' : 'var(--text)', lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>{label}</div>
      {target != null && (
        <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 1 }}>/ {target}</div>
      )}
    </div>
  );
}

// ─── Bar fill colours by calorie status ──────────────────────────────────────

const BAR_STATUS_FILL: Record<string, string> = {
  no_data:   'rgba(255,255,255,0.08)',
  no_target: 'rgba(255,255,255,0.20)',
  under:     'rgba(255,152,0,0.50)',
  ok:        'rgba(215,255,63,0.60)',
  over:      'rgba(239,83,80,0.55)',
};

// ─── Calories bar chart (SVG, no deps) ───────────────────────────────────────

function CaloriesBarChart({
  days, targetCal,
}: {
  days: WebNutritionStatsDay[];
  targetCal: number | null;
}) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const anyData = sorted.some(d => d.mealCount > 0);

  if (!anyData) {
    return (
      <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        Нет данных за эту неделю
      </div>
    );
  }

  const maxCal = Math.max(...sorted.map(d => d.totals.caloriesKcal), targetCal ?? 0, 1);
  const niceMax = Math.max(Math.ceil(maxCal / 200) * 200, 200);
  const mid = Math.round(niceMax / 2);

  const W = 300, H = 178;
  const padL = 36, padR = 6, padT = 14, padB = 26;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const slotW = chartW / 7;
  const barW = Math.min(Math.floor(slotW * 0.55), 26);

  const toY = (v: number) => padT + chartH - Math.min(1, v / niceMax) * chartH;
  const targetY = targetCal !== null ? toY(targetCal) : null;
  const targetLabelY = targetY !== null ? Math.max(padT + 9, targetY - 3) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}
      aria-label="График калорий за неделю">
      {/* Grid lines */}
      {([0, mid, niceMax] as number[]).map(v => {
        const y = toY(v);
        return (
          <g key={v}>
            <line x1={padL} y1={y} x2={W - padR} y2={y}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            {v > 0 && (
              <text x={padL - 3} y={y + 3.5} textAnchor="end" fontSize="8"
                fill="rgba(255,255,255,0.25)">
                {niceMax >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
              </text>
            )}
          </g>
        );
      })}

      {/* Target / norm line */}
      {targetY !== null && (
        <g>
          <line x1={padL} y1={targetY} x2={W - padR} y2={targetY}
            stroke="rgba(215,255,63,0.40)" strokeWidth="1" strokeDasharray="3 3" />
          <text x={padL + 3} y={targetLabelY!}
            fontSize="8" fill="rgba(215,255,63,0.55)">Норма</text>
        </g>
      )}

      {/* Bars + day labels */}
      {sorted.map((day, i) => {
        const cal = day.totals.caloriesKcal;
        const barH = cal > 0 ? Math.max(3, (cal / niceMax) * chartH) : 3;
        const cx = padL + i * slotW + slotW / 2;
        const barX = cx - barW / 2;
        const barY = cal > 0 ? toY(cal) : padT + chartH - 3;
        const fill = BAR_STATUS_FILL[day.calorieStatus] ?? BAR_STATUS_FILL.no_data;
        const dayLabel = new Date(`${day.date}T12:00:00.000Z`)
          .toLocaleDateString('ru-RU', { weekday: 'short', timeZone: 'UTC' })
          .replace('.', '').slice(0, 2);
        return (
          <g key={day.date}>
            <rect x={barX} y={barY} width={barW} height={barH} rx="3" fill={fill} />
            <text x={cx} y={H - 4} textAnchor="middle" fontSize="9"
              fill="rgba(255,255,255,0.35)">{dayLabel}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Macro average progress bars ─────────────────────────────────────────────

function MacroProgressBars({
  averages, target,
}: {
  averages: WebNutritionWeekStatsResponse['averages'];
  target: WebNutritionWeekStatsResponse['target'];
}) {
  const rows = [
    { label: 'Белки',  val: averages.proteinG, norm: target?.dailyProteinG ?? null, color: 'rgba(130,190,255,0.70)' },
    { label: 'Жиры',   val: averages.fatG,     norm: target?.dailyFatG     ?? null, color: 'rgba(255,160,80,0.65)'  },
    { label: 'Углев.', val: averages.carbsG,   norm: target?.dailyCarbsG   ?? null, color: 'rgba(215,255,63,0.60)' },
  ];
  const maxVal = Math.max(...rows.map(r => r.val), ...rows.map(r => r.norm ?? 0), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map(({ label, val, norm, color }) => {
        const base = norm ?? maxVal;
        const pct = base > 0 ? Math.min(100, Math.round((val / base) * 100)) : 0;
        return (
          <div key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {Math.round(val)}г{norm != null ? ` / ${norm}г` : ''}
              </span>
            </div>
            <div style={{ width: '100%', height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Day card ─────────────────────────────────────────────────────────────────

function DayCard({
  day, target,
}: {
  day: WebNutritionStatsDay;
  target: WebNutritionWeekStatsResponse['target'];
}) {
  const hasData = day.mealCount > 0;
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-xl)', padding: '16px 18px',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: hasData ? 12 : 0, flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
            {fmtDay(day.date)}
          </div>
          {hasData && (
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {day.mealCount} {pluralMeal(day.mealCount)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <StatusBadge status={day.calorieStatus} />
          <Link
            href={`/client/diary?date=${day.date}`}
            style={{
              display: 'inline-block', padding: '7px 12px', borderRadius: 8, minHeight: 32,
              background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
              fontSize: 12, fontWeight: 600, color: 'var(--text-2)', textDecoration: 'none',
              lineHeight: '18px', whiteSpace: 'nowrap',
            }}
          >
            Дневник →
          </Link>
        </div>
      </div>

      {hasData && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto' }}>
          <MacroItem label="ккал" value={day.totals.caloriesKcal} target={target?.dailyCaloriesKcal ?? null} accent />
          <MacroItem label="Б" value={day.totals.proteinG} target={target?.dailyProteinG ?? null} />
          <MacroItem label="Ж" value={day.totals.fatG} target={target?.dailyFatG ?? null} />
          <MacroItem label="У" value={day.totals.carbsG} target={target?.dailyCarbsG ?? null} />
        </div>
      )}
    </div>
  );
}

// ─── Insight block ────────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<string, { color: string; border: string; bg: string }> = {
  good:    { color: '#4caf50', border: 'rgba(76,175,80,0.25)',  bg: 'rgba(76,175,80,0.07)' },
  warning: { color: '#ff9800', border: 'rgba(255,152,0,0.25)',  bg: 'rgba(255,152,0,0.07)' },
  neutral: { color: 'var(--text-2)', border: 'var(--border)',   bg: 'rgba(255,255,255,0.03)' },
};

function InsightBlock({
  endDate,
}: {
  endDate: string;
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'paywall' | 'error' | 'done'>('idle');
  const [insight, setInsight] = useState<WebWeeklyInsight | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleGenerate() {
    setState('loading');
    setInsight(null);
    setErrorMsg(null);
    try {
      const res = await webApi.getWeeklyNutritionInsight(endDate);
      setInsight(res.insight);
      setState('done');
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setState('paywall');
      } else if (err instanceof ApiError && err.status === 429) {
        setErrorMsg('Слишком много запросов к AI-разбору. Попробуйте позже.');
        setState('error');
      } else {
        setErrorMsg('Не удалось сгенерировать разбор. Попробуйте позже.');
        setState('error');
      }
    }
  }

  const sev = insight ? (SEVERITY_STYLE[insight.severity] ?? SEVERITY_STYLE.neutral) : SEVERITY_STYLE.neutral;

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-xl)', padding: '18px 20px', marginTop: 16,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 14,
      }}>
        AI-разбор недели
      </div>

      {state === 'idle' && (
        <button
          onClick={handleGenerate}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 10, minHeight: 48,
            background: 'var(--accent)', border: 'none', color: '#000',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Получить AI-разбор недели
        </button>
      )}

      {state === 'loading' && (
        <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-3)', fontSize: 14 }}>
          Генерируем разбор…
        </div>
      )}

      {state === 'paywall' && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8, letterSpacing: -0.3 }}>
            AI-разбор недели доступен в подписке
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: 16 }}>
            Получите короткий вывод по рациону: где перебор, где недобор и что улучшить на следующей неделе.
          </p>
          <Link
            href="/subscription"
            style={{
              display: 'block', padding: '12px 0', borderRadius: 10, textAlign: 'center',
              background: 'var(--accent)', color: '#000', fontWeight: 700,
              fontSize: 14, textDecoration: 'none', marginBottom: 8,
            }}
          >
            Оформить подписку
          </Link>
          <button
            onClick={() => setState('idle')}
            style={{
              display: 'block', width: '100%', padding: '10px 0', borderRadius: 10,
              background: 'none', border: 'none',
              fontSize: 12, color: 'var(--text-3)', cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Закрыть
          </button>
        </div>
      )}

      {state === 'error' && (
        <div>
          <p style={{ fontSize: 13, color: '#ef5350', marginBottom: 12 }}>{errorMsg}</p>
          <button
            onClick={handleGenerate}
            style={{
              padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              color: 'var(--text-2)', cursor: 'pointer', minHeight: 44,
            }}
          >
            Попробовать снова
          </button>
        </div>
      )}

      {state === 'done' && insight && (
        <div>
          {/* Banner */}
          <div style={{
            padding: '14px 16px', borderRadius: 10, marginBottom: 16,
            background: sev.bg, border: `1px solid ${sev.border}`,
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: sev.color, marginBottom: 5 }}>
              {insight.bannerTitle}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
              {insight.bannerText}
            </div>
          </div>

          {/* Recommendation for next week */}
          {insight.nextMealSuggestion && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 8,
              }}>
                На следующую неделю
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65, margin: 0 }}>
                {insight.nextMealSuggestion}
              </p>
            </div>
          )}

          {/* Advice list */}
          {insight.mealAdvice.length > 0 && (
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 8,
              }}>
                Рекомендации
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {insight.mealAdvice.map((tip, i) => (
                  <li key={i} style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: 6 }}>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Regenerate */}
          <button
            onClick={handleGenerate}
            style={{
              marginTop: 16, padding: '8px 16px', borderRadius: 8, fontSize: 12,
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
              color: 'var(--text-3)', cursor: 'pointer',
            }}
          >
            Сгенерировать заново
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Nav button style ─────────────────────────────────────────────────────────

const navBtn: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  background: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--text-2)', cursor: 'pointer', minHeight: 44, flexShrink: 0,
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function NutritionStatsClient() {
  const [authState, setAuthState] = useState<'loading' | 'unauthenticated' | 'ok'>('loading');
  const [endDate, setEndDate] = useState(todayStr());
  const [data, setData] = useState<WebNutritionWeekStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const today = todayStr();
  const canGoNext = endDate < today;

  async function loadStats(ed: string) {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await webApi.getNutritionWeekStats(ed);
      setData(result);
      setAuthState('ok');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthState('unauthenticated');
      } else {
        setLoadError('Не удалось загрузить статистику.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    webApi.getMe()
      .then(() => loadStats(endDate))
      .catch(() => setAuthState('unauthenticated'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goBack() {
    const ed = shiftDate(endDate, -7);
    setEndDate(ed);
    loadStats(ed);
  }
  function goForward() {
    if (!canGoNext) return;
    const ed = shiftDate(endDate, 7);
    const clamped = ed > today ? today : ed;
    setEndDate(clamped);
    loadStats(clamped);
  }
  function goToday() {
    setEndDate(today);
    loadStats(today);
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (authState === 'loading') {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)', fontSize: 14 }}>
        Загрузка…
      </div>
    );
  }

  // ── Unauthenticated ──────────────────────────────────────────────────────────
  if (authState === 'unauthenticated') {
    return (
      <div style={{ textAlign: 'center', paddingTop: 40 }}>
        <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', color: 'var(--text-3)' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="4" y="9" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 320, margin: '0 auto 24px' }}>
          Войдите в кабинет клиента для просмотра статистики.
        </p>
        <Link href="/client" style={{
          display: 'inline-block', padding: '13px 28px', borderRadius: 10,
          background: 'var(--accent)', color: '#000', fontWeight: 700,
          fontSize: 14, textDecoration: 'none',
        }}>
          Войти в кабинет
        </Link>
      </div>
    );
  }

  // ── Authenticated ────────────────────────────────────────────────────────────

  const startLabel = data ? fmtShort(data.period.startDate) : fmtShort(shiftDate(endDate, -6));
  const endLabel   = data ? fmtShort(data.period.endDate)   : fmtShort(endDate);

  // days descending (newest first)
  const days = data ? [...data.days].reverse() : [];

  return (
    <div>
      {/* ── Week navigator ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={goBack} disabled={loading} style={navBtn}>← Назад</button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 13, color: 'var(--text-2)', fontWeight: 600, minWidth: 120 }}>
          {startLabel} – {endLabel}
        </div>
        <button
          onClick={goForward}
          disabled={loading || !canGoNext}
          style={{ ...navBtn, opacity: canGoNext ? 1 : 0.35, cursor: canGoNext ? 'pointer' : 'default' }}
        >
          Вперёд →
        </button>
        {endDate !== today && (
          <button
            onClick={goToday}
            disabled={loading}
            style={{
              ...navBtn,
              background: 'var(--accent-dim)', color: 'var(--accent)',
              border: '1px solid rgba(215,255,63,0.25)',
            }}
          >
            Сегодня
          </button>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: 14 }}>
          Загрузка…
        </div>
      )}
      {loadError && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#ef5350', fontSize: 14 }}>
          {loadError}
        </div>
      )}

      {data && !loading && (
        <>
          {/* ── Calories bar chart ── */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-xl)', padding: '16px 18px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 10 }}>
              Калории за неделю
            </div>
            <CaloriesBarChart days={data.days} targetCal={data.target?.dailyCaloriesKcal ?? null} />
          </div>

          {/* ── Averages card ── */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-xl)', padding: '18px 20px', marginBottom: 14,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 14,
            }}>
              Средние за неделю · {data.summary.daysWithData}/7 дней с данными
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <SummaryTile label="Калории"  value={data.averages.caloriesKcal} unit="ккал" target={data.target?.dailyCaloriesKcal ?? null} accent />
              <SummaryTile label="Белки"    value={data.averages.proteinG}     unit="г"    target={data.target?.dailyProteinG     ?? null} />
              <SummaryTile label="Жиры"     value={data.averages.fatG}         unit="г"    target={data.target?.dailyFatG         ?? null} />
              <SummaryTile label="Углеводы" value={data.averages.carbsG}       unit="г"    target={data.target?.dailyCarbsG       ?? null} />
            </div>
          </div>

          {/* ── Macro progress bars ── */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-xl)', padding: '18px 20px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 14 }}>
              Среднее БЖУ
            </div>
            <MacroProgressBars averages={data.averages} target={data.target} />
          </div>

          {/* ── Status chips ── */}
          {data.target?.dailyCaloriesKcal ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {data.summary.daysOk > 0 && (
                <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#4caf50', background: 'rgba(76,175,80,0.12)' }}>
                  В норме: {data.summary.daysOk} д
                </span>
              )}
              {data.summary.daysUnderTarget > 0 && (
                <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#ff9800', background: 'rgba(255,152,0,0.12)' }}>
                  Недобор: {data.summary.daysUnderTarget} д
                </span>
              )}
              {data.summary.daysOverTarget > 0 && (
                <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#ef5350', background: 'rgba(239,83,80,0.12)' }}>
                  Перебор: {data.summary.daysOverTarget} д
                </span>
              )}
            </div>
          ) : (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-xl)', padding: '16px 18px', marginBottom: 16,
            }}>
              <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 12 }}>
                Норма КБЖУ не задана — статусы дней недоступны.
              </p>
              <Link href="/client" style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                Заполнить анкету →
              </Link>
            </div>
          )}

          {/* ── Day list ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {days.map(day => (
              <DayCard key={day.date} day={day} target={data.target} />
            ))}
          </div>

          {/* ── AI Insight ── */}
          <InsightBlock key={endDate} endDate={endDate} />
        </>
      )}
    </div>
  );
}
