import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import PaywallCard from '../../components/PaywallCard';
import StatusBadge from '../../components/StatusBadge';
import WeekCalendar, { TODAY } from '../../components/WeekCalendar';
import type { DotSet } from '../../components/WeekCalendar';
import type { BootstrapData, MealEntry, SubscriptionInfo, UserProfile } from '../../types';

function isPremiumTier(sub: SubscriptionInfo | null | undefined): boolean {
  if (!sub) return false;
  return sub.status === 'active' || sub.status === 'trial';
}

interface Props { bootstrap: BootstrapData; }

const MEAL_SECTIONS = [
  { type: 'breakfast', label: 'Завтрак' },
  { type: 'lunch',     label: 'Обед'    },
  { type: 'dinner',    label: 'Ужин'    },
  { type: 'snack',     label: 'Перекус' },
] as const;

// ─── SVG Ring primitive ────────────────────────────────────────────────────

interface RingProps { size: number; radius: number; progress: number; strokeWidth?: number; color: string; }
function Ring({ size, radius, progress, strokeWidth = 8, color }: RingProps) {
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - Math.min(1, Math.max(0, progress)));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      {progress > 0 && (
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      )}
    </svg>
  );
}

// ─── Calorie Hero (Ring) ───────────────────────────────────────────────────

function CalorieHero({ calories, norm }: { calories: number; norm: number | null }) {
  const pct = norm && norm > 0 ? calories / norm : 0;
  const isOver = norm ? calories > norm : false;
  const remaining = norm ? Math.max(0, norm - calories) : null;
  const ringColor = isOver ? 'var(--danger)' : 'var(--accent)';

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-xl)', padding: '20px 18px', marginBottom: 10, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Ring size={120} radius={50} progress={pct} strokeWidth={10} color={ringColor} />
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.8, color: 'var(--text)', lineHeight: 1 }}>{calories.toLocaleString('ru')}</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 500, marginTop: 2 }}>ккал</div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {norm ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                  {isOver ? 'Превышение' : 'Осталось'}
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.8, color: isOver ? 'var(--danger)' : 'var(--text)', lineHeight: 1 }}>
                  {(isOver ? calories - norm : remaining!).toLocaleString('ru')}
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-3)' }}> ккал</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>из {norm.toLocaleString('ru')} ккал</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: isOver ? 'var(--danger-soft)' : 'var(--accent-soft)', color: isOver ? 'var(--danger)' : 'var(--accent)' }}>
                  {Math.round(pct * 100)}%
                </span>
              </div>
            </>
          ) : (
            <div>
              <div style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 600, marginBottom: 6 }}>Норма не задана</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>Заполни данные в профиле — AI рассчитает норму</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Macro Ring Tiles ──────────────────────────────────────────────────────

function MacroRingRow({ protein, fat, carbs, normP, normF, normC }: {
  protein: number; fat: number; carbs: number;
  normP: number | null; normF: number | null; normC: number | null;
}) {
  const tiles = [
    { label: 'Белки',    value: protein, norm: normP, color: '#7EB8F0' },
    { label: 'Жиры',     value: fat,     norm: normF, color: '#F0A07A' },
    { label: 'Углеводы', value: carbs,   norm: normC, color: '#90C860' },
  ];
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      {tiles.map(t => {
        const pct = t.norm && t.norm > 0 ? t.value / t.norm : 0;
        return (
          <div key={t.label} style={{ flex: 1, background: 'var(--surface)', borderRadius: 18, padding: '12px 6px 10px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ position: 'relative' }}>
              <Ring size={72} radius={28} progress={pct} strokeWidth={7} color={t.color} />
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.color, lineHeight: 1 }}>{t.value.toFixed(0)}</div>
                <div style={{ fontSize: 9, color: 'var(--text-3)' }}>г</div>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>{t.label}</div>
              {t.norm && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>/ {t.norm}г</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Goal Forecast Card ────────────────────────────────────────────────────

type ForecastPeriod = 30 | 14 | 7 | 3 | 1;

interface PeriodAnalysis {
  avgCaloriesPerDay: number;
  period: ForecastPeriod;
  daysWithData: number;
}

/** Group meals by date, find best available period, compute avg kcal/day */
function analyzePeriod(meals: MealEntry[]): PeriodAnalysis | null {
  const byDate = new Map<string, number>();
  for (const m of meals) {
    const date = m.createdAt.slice(0, 10);
    byDate.set(date, (byDate.get(date) ?? 0) + (m.caloriesKcal ?? 0));
  }

  const validDays = [...byDate.entries()].filter(([, cal]) => cal > 0);
  if (validDays.length === 0) return null;

  const totalCal = validDays.reduce((s, [, c]) => s + c, 0);
  const avgCal = Math.round(totalCal / validDays.length);

  // Determine period label from how far back oldest data goes
  const oldestMs = Math.min(...validDays.map(([d]) => new Date(d).getTime()));
  const spanDays = (Date.now() - oldestMs) / 86_400_000;

  let period: ForecastPeriod;
  if (spanDays >= 14)      period = 30;
  else if (spanDays >= 7)  period = 14;
  else if (spanDays >= 3)  period = 7;
  else if (validDays.length >= 2) period = 3;
  else                     period = 1;

  return { avgCaloriesPerDay: avgCal, period, daysWithData: validDays.length };
}

/**
 * Derive effective goal:
 * 1. Use explicit goalType if set (and not 'track')
 * 2. Derive from weight difference if weights are available
 * 3. Return null only when truly nothing is known
 */
function deriveEffectiveGoal(
  goalType: string | null,
  currentWeightKg: number | null,
  desiredWeightKg: number | null,
): string | null {
  if (goalType && goalType !== 'track') return goalType;
  if (goalType === 'track') return 'track';
  // Derive from weight difference
  if (currentWeightKg != null && desiredWeightKg != null) {
    const diff = desiredWeightKg - currentWeightKg;
    if (diff < -0.5) return 'lose';
    if (diff > 0.5)  return 'gain';
    return 'maintain';
  }
  return null;
}

/**
 * Derive maintenance (TDEE) from goal-adjusted dailyCaloriesKcal.
 * calcNorms applies: cut×0.85, maintain×1.0, bulk×1.10
 */
function getMaintenanceCalories(profile: UserProfile, effectiveGoal: string | null): number | null {
  if (!profile.dailyCaloriesKcal) return null;
  if (effectiveGoal === 'lose') return Math.round(profile.dailyCaloriesKcal / 0.85);
  if (effectiveGoal === 'gain') return Math.round(profile.dailyCaloriesKcal / 1.10);
  return Math.round(profile.dailyCaloriesKcal); // maintain / track / null → already TDEE
}

function nounWeek(n: number): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return 'недель';
  if (mod10 === 1) return 'неделя';
  if (mod10 >= 2 && mod10 <= 4) return 'недели';
  return 'недель';
}

function periodLabel(p: ForecastPeriod): string {
  if (p === 30) return '30 дней';
  if (p === 14) return '14 дней';
  if (p === 7) return '7 дней';
  if (p === 3) return '3 дня';
  return 'сегодня';
}

function GoalForecastCardInner({ profile, meals30, onInfoClick }: { profile: UserProfile; meals30: MealEntry[] | undefined; onInfoClick: () => void }) {
  const { goalType, currentWeightKg, desiredWeightKg } = profile;

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    borderRadius: 'var(--r-lg)',
    border: '1px solid var(--border)',
    padding: '14px 16px',
    marginBottom: 12,
  };
  const accentLabel = (text: string, right?: string) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, color: 'var(--accent)' }}>
          {text}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onInfoClick(); }}
          style={{
            width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
            background: 'transparent', border: '1px solid var(--border-2, #2a2a2a)',
            color: 'var(--text-3)', fontSize: 10, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, lineHeight: 1,
          }}
          aria-label="Как считается прогноз"
        >?</button>
      </div>
      {right && <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 500 }}>{right}</span>}
    </div>
  );
  const fallback = (title: string, sub: string) => (
    <div style={cardStyle}>
      {accentLabel('Прогноз')}
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>{sub}</div>
    </div>
  );

  // ── Resolve effective goal ───────────────────────────────────────────────
  // Priority: explicit goalType → derived from weights → null (no goal info)
  const effectiveGoal = deriveEffectiveGoal(goalType, currentWeightKg, desiredWeightKg);

  // ── Tracking mode ───────────────────────────────────────────────────────
  if (effectiveGoal === 'track') {
    return fallback('Режим отслеживания', 'Цель по весу не задана — прогноз недоступен');
  }

  // ── No calorie data ─────────────────────────────────────────────────────
  const analysis = meals30 ? analyzePeriod(meals30) : null;
  if (!analysis) {
    // Nothing at all — minimal fallback
    if (effectiveGoal === null) {
      return fallback('Нет данных', 'Добавь приёмы пищи и заполни данные профиля, чтобы получить прогноз');
    }
    return fallback(
      'Нет данных по калориям',
      'Добавь приёмы пищи, и мы покажем прогноз по текущему калоражу',
    );
  }

  const maintenanceCal = getMaintenanceCalories(profile, effectiveGoal);
  if (!maintenanceCal) {
    return fallback('Нормы не рассчитаны', 'Заполни физические данные в профиле, чтобы получить прогноз');
  }

  const { avgCaloriesPerDay, period, daysWithData } = analysis;
  const delta = avgCaloriesPerDay - maintenanceCal; // negative = deficit, positive = surplus
  const expectedKgPerWeek = (delta * 7) / 7700; // signed

  // ── Maintenance goal ─────────────────────────────────────────────────────
  if (effectiveGoal === 'maintain') {
    const absDelta = Math.abs(delta);
    const isClose = absDelta <= 150;
    const sign = delta > 0 ? '+' : '−';
    const deltaText = isClose
      ? 'близко к уровню поддержания'
      : `${sign}${absDelta} ккал от поддержания`;
    return (
      <div style={cardStyle}>
        {accentLabel('Цель', periodLabel(period))}
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>Поддержание веса</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Ср. калораж {avgCaloriesPerDay.toLocaleString('ru')} ккал
          </span>
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
            background: isClose ? 'var(--accent-soft)' : 'var(--surface-2)',
            color: isClose ? 'var(--accent)' : 'var(--text-3)',
          }}>
            {deltaText}
          </span>
        </div>
      </div>
    );
  }

  // ── lose / gain / null goal ───────────────────────────────────────────────
  const isEarlyEstimate = period <= 3;

  // If no effective goal (no goalType and no weight data) — show pace without goal context
  if (effectiveGoal === null) {
    const paceAbs = Math.abs(expectedKgPerWeek);
    const paceSign = expectedKgPerWeek < 0 ? '−' : '+';
    return (
      <div style={cardStyle}>
        {accentLabel(isEarlyEstimate ? 'Ранняя оценка' : 'Прогноз', periodLabel(period))}
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, color: 'var(--text)', lineHeight: 1, marginBottom: 4 }}>
          {paceSign}{paceAbs.toFixed(2)}
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', marginLeft: 4 }}>кг/нед</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
          при среднем калораже {avgCaloriesPerDay.toLocaleString('ru')} ккал/день
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          Укажи цель в профиле, чтобы получить прогноз по срокам
        </div>
      </div>
    );
  }

  const directionMatch = effectiveGoal === 'lose' ? expectedKgPerWeek < -0.02 : expectedKgPerWeek > 0.02;

  // Goal already reached
  if (currentWeightKg && desiredWeightKg) {
    const reached = effectiveGoal === 'lose' ? currentWeightKg <= desiredWeightKg : currentWeightKg >= desiredWeightKg;
    if (reached) {
      return (
        <div style={cardStyle}>
          {accentLabel('Прогресс')}
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>Цель достигнута</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Текущий вес соответствует цели</div>
        </div>
      );
    }
  }

  // Direction mismatch
  if (!directionMatch) {
    const paceSign = expectedKgPerWeek > 0 ? '+' : '−';
    const abs = Math.abs(expectedKgPerWeek).toFixed(2);
    const goalWord = effectiveGoal === 'lose' ? 'снижению' : 'набору';
    return (
      <div style={cardStyle}>
        {accentLabel('Прогноз', periodLabel(period))}
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5 }}>
          Текущий калораж не ведёт к {goalWord} веса
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
          Ожидаемый темп: {paceSign}{abs} кг/нед при среднем калораже {avgCaloriesPerDay.toLocaleString('ru')} ккал
        </div>
      </div>
    );
  }

  // Normal forecast
  const paceAbs = Math.abs(expectedKgPerWeek);
  const paceSign = effectiveGoal === 'lose' ? '−' : '+';

  // Weeks to goal (optional — needs both weights)
  let weeksToGoal: number | null = null;
  if (currentWeightKg && desiredWeightKg && paceAbs > 0.02) {
    const remaining = Math.abs(currentWeightKg - desiredWeightKg);
    const weeks = remaining / paceAbs;
    if (weeks <= 260) weeksToGoal = Math.ceil(weeks);
  }

  return (
    <div style={cardStyle}>
      {accentLabel(isEarlyEstimate ? 'Ранняя оценка' : 'Прогноз', periodLabel(period))}

      {/* Pace hero */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, color: 'var(--text)', lineHeight: 1 }}>
            {paceSign}{paceAbs.toFixed(2)}
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', marginLeft: 4 }}>кг/нед</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
            {isEarlyEstimate
              ? `предварительная оценка по ${daysWithData} ${daysWithData === 1 ? 'дню' : 'дням'}`
              : `при среднем калораже ${avgCaloriesPerDay.toLocaleString('ru')} ккал/день`}
          </div>
        </div>
        {/* Deficit/surplus badge */}
        <div style={{ textAlign: 'right' as const }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 3 }}>
            {delta < 0 ? 'дефицит' : 'профицит'}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: 8, padding: '3px 9px' }}>
            {Math.abs(delta).toLocaleString('ru')} ккал
          </div>
        </div>
      </div>

      {/* Weeks to goal */}
      {weeksToGoal != null && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>До цели</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            {weeksToGoal} {nounWeek(weeksToGoal)}
          </span>
        </div>
      )}

      {/* Early estimate disclaimer */}
      {isEarlyEstimate && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: weeksToGoal != null ? 0 : 2, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
          Добавляй приёмы пищи ещё несколько дней — прогноз станет точнее
        </div>
      )}
    </div>
  );
}

// ─── Forecast Info Overlay ─────────────────────────────────────────────────

function ForecastInfoOverlay({ onClose }: { onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 200,
        }}
      />
      {/* Bottom sheet */}
      <div className="bottom-sheet">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: -0.3 }}>
            Как считается прогноз
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'var(--surface-2)', border: 'none',
              color: 'var(--text-3)', fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0, lineHeight: 1,
            }}
            aria-label="Закрыть"
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65 }}>

          {/* Step 1 — avg calories */}
          <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>
            Шаг 1. Средний калораж
          </p>
          <p style={{ margin: '0 0 12px' }}>
            Берём ваш средний дневной калораж за лучший доступный период:
            30 дней → 14 → 7 → 3 → 1 день.
            Учитываются только дни, когда вы добавляли еду.
          </p>

          {/* Step 2 — delta */}
          <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>
            Шаг 2. Разница с поддержанием
          </p>
          <p style={{ margin: '0 0 6px' }}>
            Сравниваем со значением поддержания вашего текущего веса:
          </p>
          <div style={{
            margin: '0 0 12px', padding: '8px 12px',
            background: 'var(--surface-2)', borderRadius: 10,
            fontSize: 12, color: 'var(--accent)', fontWeight: 600, letterSpacing: 0.1,
          }}>
            средний калораж − уровень поддержания
          </div>
          <p style={{ margin: '0 0 12px' }}>
            Дефицит → снижение веса.
            Избыток → набор.
            Около нуля → поддержание.
          </p>

          {/* Step 3 — pace */}
          <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>
            Шаг 3. Ожидаемый темп
          </p>
          <div style={{
            margin: '0 0 12px', padding: '8px 12px',
            background: 'var(--surface-2)', borderRadius: 10,
            fontSize: 12, color: 'var(--accent)', fontWeight: 600, letterSpacing: 0.1,
          }}>
            (разница × 7) ÷ 7700 = кг в неделю
          </div>
          <p style={{ margin: '0 0 12px' }}>
            7 700 — это примерная калорийность одного килограмма жировой ткани.
          </p>

          {/* Step 4 — weeks to goal */}
          <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>
            Шаг 4. Срок до цели
          </p>
          <p style={{ margin: '0 0 14px' }}>
            Если указаны текущий и желаемый вес, срок считается как:{' '}
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
              сколько кг осталось ÷ темп в неделю
            </span>.
          </p>

          {/* Factors */}
          <p style={{ margin: '0 0 6px', fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>
            На результат могут влиять:
          </p>
          <ul style={{ margin: '0 0 14px', paddingLeft: 16 }}>
            {[
              'Неточности в учёте еды и объёма порций',
              'Вода, соль и углеводы (временные колебания веса)',
              'Тренировки и уровень повседневной активности',
              'Сон, стресс и гормональный фон',
            ].map(item => (
              <li key={item} style={{ marginBottom: 4 }}>{item}</li>
            ))}
          </ul>
        </div>

        {/* Disclaimer */}
        <div style={{
          fontSize: 12, color: 'var(--text-3)', lineHeight: 1.55,
          padding: '10px 12px',
          background: 'var(--surface-2)',
          borderRadius: 10,
        }}>
          Это расчётная оценка, а не точный медицинский прогноз.
          Реальный результат зависит от множества факторов.
        </div>
      </div>
    </>
  );
}

// ─── Goal Forecast Card (public wrapper) ───────────────────────────────────

function GoalForecastCard({ profile, meals30 }: { profile: UserProfile; meals30: MealEntry[] | undefined }) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <>
      <GoalForecastCardInner profile={profile} meals30={meals30} onInfoClick={() => setShowInfo(true)} />
      {showInfo && <ForecastInfoOverlay onClose={() => setShowInfo(false)} />}
    </>
  );
}

// ─── Meal Section Card ─────────────────────────────────────────────────────

function MealSectionCard({ label, meals, onAdd }: { label: string; meals: MealEntry[]; onAdd: () => void }) {
  const totalCal = meals.reduce((s, m) => s + (m.caloriesKcal ?? 0), 0);
  const hasMeals = meals.length > 0;

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', marginBottom: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: hasMeals ? '1px solid var(--border)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {totalCal > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{totalCal} ккал</span>}
          <button
            onClick={e => { e.stopPropagation(); onAdd(); }}
            style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--accent)', fontSize: 18, fontWeight: 700, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >+</button>
        </div>
      </div>
      {hasMeals ? (
        <div>
          {meals.map(m => (
            <div key={m.id} style={{ padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.4, paddingRight: 10 }}>
                {m.text}
                {m.proteinG != null && <span style={{ color: 'var(--text-3)' }}>{' '}· Б{m.proteinG.toFixed(0)} Ж{m.fatG?.toFixed(0)} У{m.carbsG?.toFixed(0)}</span>}
              </div>
              {m.caloriesKcal != null && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>{m.caloriesKcal} ккал</div>}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '10px 14px 11px', fontSize: 13, color: 'var(--text-3)' }}>не записано</div>
      )}
    </div>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function HomeScreen({ bootstrap }: Props) {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(TODAY);

  const { data, isLoading } = useQuery({
    queryKey: ['diary', selectedDate],
    queryFn: () => api.nutritionDiary(selectedDate),
  });

  // Last 30 days of meals — used for calorie-based forecast
  const { data: stats30 } = useQuery({
    queryKey: ['stats', 30],
    queryFn: () => api.nutritionStats(30),
  });

  const profile = bootstrap.profile;
  const sub = bootstrap.subscription;
  const trainer = bootstrap.connectedTrainer;
  const firstName = bootstrap.telegramUser?.first_name ?? '';

  // Greeting: preferredName > firstName from Telegram > no name
  const displayName = profile?.preferredName?.trim() || firstName || '';
  const greetingHour = new Date().getHours();
  const greetingWord = greetingHour >= 5 && greetingHour < 12
    ? 'Доброе утро'
    : greetingHour >= 12 && greetingHour < 18
    ? 'Добрый день'
    : 'Добрый вечер';
  const meals: MealEntry[] = data?.meals ?? [];

  const totals = useMemo(() => {
    let cal = 0, p = 0, f = 0, c = 0;
    for (const m of meals) { cal += m.caloriesKcal ?? 0; p += m.proteinG ?? 0; f += m.fatG ?? 0; c += m.carbsG ?? 0; }
    return { calories: Math.round(cal), protein: p, fat: f, carbs: c };
  }, [meals]);

  const mealsByType = useMemo(() => {
    const g: Record<string, MealEntry[]> = {};
    for (const m of meals) { (g[m.mealType] ??= []).push(m); }
    return g;
  }, [meals]);

  const dotsByDate = useMemo(() => {
    const map: Record<string, DotSet> = {};
    for (const m of (stats30?.meals ?? [])) {
      const date = m.createdAt.slice(0, 10);
      if (!map[date]) map[date] = { breakfast: false, lunch: false, dinner: false };
      if (m.mealType === 'breakfast') map[date].breakfast = true;
      else if (m.mealType === 'lunch') map[date].lunch = true;
      else if (m.mealType === 'dinner') map[date].dinner = true;
    }
    return map;
  }, [stats30]);

  return (
    <div className="screen">

      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.8, color: 'var(--text)', lineHeight: 1.1 }}>
          {displayName ? `${greetingWord}, ${displayName}` : greetingWord} 👋
        </h1>
      </div>

      <WeekCalendar selected={selectedDate} onSelect={setSelectedDate} dotsByDate={dotsByDate} />

      {isLoading ? (
        <div className="card" style={{ padding: '28px 18px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          <CalorieHero calories={totals.calories} norm={profile?.dailyCaloriesKcal ?? null} />
          <MacroRingRow
            protein={totals.protein} fat={totals.fat} carbs={totals.carbs}
            normP={profile?.dailyProteinG ?? null} normF={profile?.dailyFatG ?? null} normC={profile?.dailyCarbsG ?? null}
          />
        </>
      )}

      {profile && isPremiumTier(bootstrap.subscription) ? (
        <GoalForecastCard
          profile={profile}
          meals30={stats30?.meals}
        />
      ) : profile && !isPremiumTier(bootstrap.subscription) ? (
        <PaywallCard plan="optimal" feature="Прогноз достижения цели" />
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 8 }}>Прогноз</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5 }}>Профиль не заполнен</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>Заполни данные в профиле — мы рассчитаем прогноз</div>
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '4px 2px 10px' }}>
        Приёмы пищи
      </div>

      {MEAL_SECTIONS.map(s => (
        <MealSectionCard key={s.type} label={s.label} meals={mealsByType[s.type] ?? []} onAdd={() => navigate('/add')} />
      ))}

      <div style={{ marginTop: 6 }}>
        {sub && (
          <div className="info-row" onClick={() => navigate('/subscription')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>💳</span>
              <span style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>Подписка</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusBadge status={sub.status} />
              <span style={{ color: 'var(--text-3)', fontSize: 16 }}>›</span>
            </div>
          </div>
        )}
        <div className="info-row" onClick={() => navigate(trainer ? '/trainer' : '/connect-trainer')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--text-3)' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>Мой эксперт</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{
              fontSize: 13, color: trainer ? 'var(--accent)' : 'var(--text-3)', fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160,
            }}>
              {trainer ? (trainer.fullName?.trim() || 'Эксперт') : 'Выбрать эксперта'}
            </span>
            <span style={{ color: 'var(--text-3)', fontSize: 16, flexShrink: 0 }}>›</span>
          </div>
        </div>
      </div>

    </div>
  );
}
