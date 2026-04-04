import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import WeekCalendar, { TODAY, isoToLocalDate } from '../../components/WeekCalendar';
import type { MealEntry } from '../../types';

// ─── Helpers ───────────────────────────────────────────────────────────────

function weightDeltaColor(delta: number, goalType: string | null | undefined): string {
  if (Math.abs(delta) < 0.01) return 'var(--text-3)';
  if (!goalType || goalType === 'maintain' || goalType === 'track') return 'var(--text-2)';
  if (goalType === 'gain') return delta > 0 ? 'var(--accent)' : 'var(--danger)';
  return delta < 0 ? 'var(--accent)' : 'var(--danger)'; // 'lose'
}

function deriveGoal(current: number | null | undefined, target: number | null | undefined): 'lose' | 'gain' | 'maintain' | null {
  if (!current || !target) return null;
  if (current > target + 0.05) return 'lose';
  if (current < target - 0.05) return 'gain';
  return 'maintain';
}

// ─── Types ─────────────────────────────────────────────────────────────────

type Tab = 'day' | 'week' | 'weight';

const TABS: { key: Tab; label: string }[] = [
  { key: 'day',    label: 'День'    },
  { key: 'week',   label: 'Неделя'  },
  { key: 'weight', label: 'Вес'     },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

const SOURCE_ICONS: Record<string, string> = {
  text:  '📝',
  photo: '📷',
  voice: '🎤',
};

const SOURCE_LABELS: Record<string, string> = {
  text:  'Текст',
  photo: 'Фото',
  voice: 'Голос',
};

const MEAL_LABELS: Record<string, string> = {
  breakfast: '🍳 Завтрак',
  lunch:     '🍲 Обед',
  dinner:    '🍽 Ужин',
  snack:     '🍎 Перекус',
  unknown:   '🍴 Прочее',
};

function computeTotals(meals: MealEntry[]) {
  let cal = 0, p = 0, f = 0, c = 0;
  for (const m of meals) {
    cal += m.caloriesKcal ?? 0;
    p   += m.proteinG    ?? 0;
    f   += m.fatG        ?? 0;
    c   += m.carbsG      ?? 0;
  }
  return { cal: Math.round(cal), p, f, c };
}

function fmtDateShort(iso: string) {
  return isoToLocalDate(iso).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─── Metric Card ───────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: number;
  unit: string;
  norm: number | null;
  color: string;
  accentSoft: string;
}
function MetricCard({ label, value, unit, norm, color, accentSoft }: MetricCardProps) {
  const pct = norm && norm > 0 ? Math.min(100, Math.round((value / norm) * 100)) : null;
  const isOver = pct !== null && pct >= 100;

  return (
    <div style={{
      flex: '1 1 calc(50% - 4px)',
      minWidth: 0,
      background: 'var(--surface)',
      borderRadius: 'var(--r-lg)',
      padding: '14px 14px 12px',
      border: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {label}
        </span>
        {pct !== null && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
            background: isOver ? 'var(--danger-soft)' : accentSoft,
            color: isOver ? 'var(--danger)' : color,
          }}>
            {pct}%
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.8, color: 'var(--text)', lineHeight: 1 }}>
          {value.toLocaleString('ru')}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>{unit}</span>
      </div>
      {pct !== null && (
        <div style={{ height: 4, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden', marginBottom: 6 }}>
          <div style={{
            height: '100%', borderRadius: 4,
            background: isOver ? 'var(--danger)' : color,
            width: `${pct}%`,
            transition: 'width 0.5s ease',
          }} />
        </div>
      )}
      {norm && (
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
          цель {norm.toLocaleString('ru')} {unit}
        </div>
      )}
    </div>
  );
}

// ─── Metric Cards 2×2 grid ─────────────────────────────────────────────────

function MetricGrid({ cal, p, f, c, normCal, normP, normF, normC }: {
  cal: number; p: number; f: number; c: number;
  normCal: number | null; normP: number | null; normF: number | null; normC: number | null;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
      <MetricCard label="Калории" value={cal}         unit="ккал" norm={normCal} color="var(--accent)"   accentSoft="var(--accent-soft)" />
      <MetricCard label="Белки"   value={Math.round(p)} unit="г"    norm={normP}   color="#7EB8F0"         accentSoft="rgba(126,184,240,0.14)" />
      <MetricCard label="Жиры"    value={Math.round(f)} unit="г"    norm={normF}   color="#F0A07A"         accentSoft="rgba(240,160,122,0.14)" />
      <MetricCard label="Углеводы" value={Math.round(c)} unit="г"   norm={normC}   color="#90C860"         accentSoft="rgba(144,200,96,0.14)" />
    </div>
  );
}

// ─── Compact Day Summary ────────────────────────────────────────────────────

function CompactDaySummary({ cal, p, f, c }: { cal: number; p: number; f: number; c: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '10px 16px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
      <span>
        <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{cal.toLocaleString('ru')}</span>{' '}
        <span style={{ color: 'var(--text-3)' }}>ккал</span>
      </span>
      <span style={{ color: 'var(--text-3)' }}>·</span>
      <span style={{ color: 'var(--text-2)' }}>
        Б <span style={{ fontWeight: 600, color: '#7EB8F0' }}>{Math.round(p)}</span>г
      </span>
      <span style={{ color: 'var(--text-2)' }}>
        Ж <span style={{ fontWeight: 600, color: '#F0A07A' }}>{Math.round(f)}</span>г
      </span>
      <span style={{ color: 'var(--text-2)' }}>
        У <span style={{ fontWeight: 600, color: '#90C860' }}>{Math.round(c)}</span>г
      </span>
    </div>
  );
}

// ─── Meal Card (expandable, with media viewing) ─────────────────────────────

function MealCard({ meal, isLast }: { meal: MealEntry; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  // Mini-app photos: photoData is already in the meal object (returned by Prisma findMany).
  // Bot photos: only have photoFileId — need a separate API call.
  const [mediaUrl, setMediaUrl] = useState<string | null>(meal.photoData ?? null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState(false);

  const srcIcon = SOURCE_ICONS[meal.sourceType] ?? '📝';
  const isMediaType = meal.sourceType === 'photo' || meal.sourceType === 'voice';
  // Whether a Telegram file ID exists (bot-originated media)
  const hasTelegramFile = meal.sourceType === 'photo' ? !!meal.photoFileId
                        : meal.sourceType === 'voice' ? !!meal.voiceFileId
                        : false;

  async function loadMedia() {
    if (mediaUrl || mediaLoading || mediaError) return;
    if (!hasTelegramFile) {
      // No Telegram file and no photoData — nothing to show
      console.warn('[MealCard] no media source for meal', meal.id,
        '| sourceType:', meal.sourceType,
        '| photoFileId:', meal.photoFileId,
        '| photoData present:', !!meal.photoData);
      setMediaError(true);
      return;
    }
    console.log('[MealCard] fetching Telegram media for meal', meal.id);
    setMediaLoading(true);
    try {
      const result = await api.nutritionMealMedia(meal.id);
      console.log('[MealCard] media fetched ok, type:', result.type, 'url length:', result.url?.length);
      setMediaUrl(result.url);
    } catch (e) {
      console.error('[MealCard] media fetch failed for meal', meal.id, e);
      setMediaError(true);
    } finally {
      setMediaLoading(false);
    }
  }

  function toggle() {
    console.log('[MealCard] toggle', meal.id,
      '| sourceType:', meal.sourceType,
      '| photoData:', !!meal.photoData,
      '| photoFileId:', !!meal.photoFileId,
      '| mediaUrl already set:', !!mediaUrl,
      '| expanded →', !expanded);
    if (!expanded && !mediaUrl) loadMedia();
    setExpanded(v => !v);
  }

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
      {/* Main row */}
      <div
        onClick={isMediaType ? toggle : undefined}
        style={{
          padding: '10px 14px',
          display: 'flex', alignItems: 'flex-start', gap: 10,
          cursor: isMediaType ? 'pointer' : 'default',
        }}
      >
        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1, opacity: 0.65 }}>{srcIcon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.4 }}>
            {meal.text || (isMediaType ? `${SOURCE_LABELS[meal.sourceType]} запись` : '—')}
          </div>
          {meal.caloriesKcal != null && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
              {Math.round(meal.caloriesKcal)} ккал
              {meal.proteinG != null && ` · Б${meal.proteinG.toFixed(0)} Ж${meal.fatG?.toFixed(0)} У${meal.carbsG?.toFixed(0)}`}
            </div>
          )}
        </div>
        {isMediaType && (
          <span style={{
            fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 2,
            padding: '2px 7px', borderRadius: 6,
            background: expanded ? 'var(--surface-2)' : 'var(--accent-soft)',
            color: expanded ? 'var(--text-3)' : 'var(--accent)',
          }}>
            {expanded ? '▲' : SOURCE_LABELS[meal.sourceType]}
          </span>
        )}
      </div>

      {/* Expanded media */}
      {expanded && isMediaType && (
        <div style={{ padding: '0 14px 12px' }}>
          {mediaLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="spinner" style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Загрузка...</span>
            </div>
          ) : mediaError || !mediaUrl ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>
              Источник недоступен для этой записи
            </div>
          ) : meal.sourceType === 'photo' ? (
            <img
              src={mediaUrl}
              alt="Фото блюда"
              style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }}
            />
          ) : (
            <audio controls src={mediaUrl} style={{ width: '100%' }} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Records Section ────────────────────────────────────────────────────────

function RecordsSection({ meals }: { meals: MealEntry[] }) {
  const ORDER = ['breakfast', 'lunch', 'dinner', 'snack', 'unknown'];
  const byType: Record<string, MealEntry[]> = {};
  for (const m of meals) { (byType[m.mealType] ??= []).push(m); }

  const groups = ORDER.map(t => ({ type: t, entries: byType[t] ?? [] })).filter(g => g.entries.length > 0);
  const others = meals.filter(m => !ORDER.includes(m.mealType));
  if (others.length > 0) groups.push({ type: 'other', entries: others });

  if (groups.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 16px' }}>
        <div style={{ fontSize: 32, opacity: 0.2, marginBottom: 8 }}>🍽</div>
        <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Нет записей за этот день</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {groups.map(g => (
        <div key={g.type} style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
              {MEAL_LABELS[g.type] ?? g.type}
            </span>
          </div>
          {g.entries.map((m, i) => <MealCard key={m.id} meal={m} isLast={i === g.entries.length - 1} />)}
        </div>
      ))}
    </div>
  );
}

// ─── Day View ──────────────────────────────────────────────────────────────

function DayView({ norms }: { norms: { cal: number | null; p: number | null; f: number | null; c: number | null } }) {
  const [date, setDate] = useState(TODAY);

  const { data, isLoading } = useQuery({
    queryKey: ['diary', date],
    queryFn: () => api.nutritionDiary(date),
  });

  const meals: MealEntry[] = data?.meals ?? [];
  const totals = useMemo(() => computeTotals(meals), [meals]);

  return (
    <>
      <WeekCalendar selected={date} onSelect={setDate} />

      {isLoading ? (
        <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          <MetricGrid
            cal={totals.cal} p={totals.p} f={totals.f} c={totals.c}
            normCal={norms.cal} normP={norms.p} normF={norms.f} normC={norms.c}
          />

          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '0 2px 10px' }}>
            Записи
          </div>
          <RecordsSection meals={meals} />
        </>
      )}
    </>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Week View ─────────────────────────────────────────────────────────────

function WeekView({ norms }: { norms: { cal: number | null; p: number | null; f: number | null; c: number | null } }) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const endDate = new Date(TODAY + 'T12:00:00');
  endDate.setDate(endDate.getDate() + weekOffset * 7);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6);
  const fromStr = toLocalIso(startDate);
  const toStr = toLocalIso(endDate);
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return toLocalIso(d);
  });

  const { data, isLoading } = useQuery({
    queryKey: ['nutrition-stats-range', fromStr, toStr],
    queryFn: () => api.nutritionStatsRange(fromStr, toStr),
  });

  const meals: MealEntry[] = data?.meals ?? [];

  const { totals, activeDays, byDate } = useMemo(() => {
    let cal = 0, p = 0, f = 0, c = 0;
    const byDate: Record<string, MealEntry[]> = {};
    for (const m of meals) {
      cal += m.caloriesKcal ?? 0;
      p   += m.proteinG    ?? 0;
      f   += m.fatG        ?? 0;
      c   += m.carbsG      ?? 0;
      const d = m.createdAt.split('T')[0];
      (byDate[d] ??= []).push(m);
    }
    const activeDays = Object.keys(byDate).length;
    return { totals: { cal: Math.round(cal), p, f, c }, activeDays, byDate };
  }, [meals]);

  const avg = (v: number) => activeDays > 0 ? Math.round(v / activeDays) : 0;

  if (isLoading) {
    return (
      <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      {/* Week navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '10px 14px',
        border: '1px solid var(--border)', marginBottom: 8,
      }}>
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            color: 'var(--text-2)', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          }}
        >‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}>
            {weekOffset === 0 ? 'Текущая неделя' : `${weekOffset === -1 ? 'Прошлая неделя' : `${Math.abs(weekOffset)} нед. назад`}`}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
            {startDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — {endDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
          </div>
        </div>
        <button
          onClick={() => setWeekOffset(o => o + 1)}
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: weekOffset >= 0 ? 'transparent' : 'var(--surface-2)',
            border: weekOffset >= 0 ? 'none' : '1px solid var(--border)',
            color: 'var(--text-2)', fontSize: 18, cursor: weekOffset >= 0 ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            visibility: weekOffset >= 0 ? 'hidden' : 'visible',
          } as React.CSSProperties}
        >›</button>
      </div>

      {activeDays === 0 ? (
        <div style={{ textAlign: 'center', padding: '52px 16px' }}>
          <div style={{ fontSize: 40, opacity: 0.2, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Нет данных за неделю</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Начни записывать питание, чтобы увидеть статистику</div>
        </div>
      ) : (
        <>
          {/* Period summary */}
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '12px 16px',
            border: '1px solid var(--border)', marginBottom: 12,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
              {activeDays} {activeDays === 1 ? 'активный день' : activeDays < 5 ? 'активных дня' : 'активных дней'}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Всего</div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.5, color: 'var(--text)' }}>
                {totals.cal.toLocaleString('ru')} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)' }}>ккал</span>
              </div>
            </div>
          </div>

          {/* Avg per day metric grid */}
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '0 2px 10px' }}>
            Среднее в день
          </div>
          <MetricGrid
            cal={avg(totals.cal)} p={avg(totals.p)} f={avg(totals.f)} c={avg(totals.c)}
            normCal={norms.cal} normP={norms.p} normF={norms.f} normC={norms.c}
          />

          {/* Day-by-day breakdown with expandable detail */}
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '0 2px 10px' }}>
            По дням
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 10 }}>
            {last7.map((day, i) => {
              const dayMeals = byDate[day] ?? [];
              const dayCal = dayMeals.reduce((s, m) => s + (m.caloriesKcal ?? 0), 0);
              const hasData = dayMeals.length > 0;
              const isToday = day === TODAY;
              const isExpanded = expandedDay === day;
              const isLast = i === 6;

              return (
                <div key={day}>
                  {/* Day row */}
                  <div
                    onClick={hasData ? () => setExpandedDay(isExpanded ? null : day) : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '13px 16px',
                      borderBottom: (!isLast || isExpanded) ? '1px solid var(--border)' : 'none',
                      cursor: hasData ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: hasData ? 'var(--accent)' : 'var(--surface-3)',
                        flexShrink: 0,
                      }} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: isToday ? 'var(--accent)' : 'var(--text)' }}>
                          {fmtDateShort(day)}{isToday ? ' · сегодня' : ''}
                        </div>
                        {hasData && (
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                            {dayMeals.length} {dayMeals.length === 1 ? 'запись' : dayMeals.length < 5 ? 'записи' : 'записей'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {hasData ? (
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                          {Math.round(dayCal).toLocaleString('ru')}
                          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}> ккал</span>
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>—</span>
                      )}
                      {hasData && (
                        <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 2 }}>
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded day detail */}
                  {isExpanded && (
                    <div style={{
                      background: 'var(--surface-2)',
                      borderBottom: !isLast ? '1px solid var(--border)' : 'none',
                    }}>
                      <CompactDaySummary {...computeTotals(dayMeals)} />
                      <div style={{ padding: '12px' }}>
                        <RecordsSection meals={dayMeals} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

// ─── Weight View ───────────────────────────────────────────────────────────

function WeightView() {
  const { data, isLoading } = useQuery({
    queryKey: ['profile-full'],
    queryFn: api.profile,
  });

  const profile = data?.profile;
  const history = data?.weightHistory ?? [];

  if (isLoading) {
    return (
      <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
        <div className="spinner" />
      </div>
    );
  }

  const current = history.length > 0 ? history[history.length - 1].weightKg : profile?.currentWeightKg;
  const target = profile?.desiredWeightKg;
  const diff = current != null && target != null ? current - target : null;
  const pct = current != null && target != null && current > 0
    ? Math.max(0, Math.min(100, Math.round(((current - target) / current) * 100)))
    : null;

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: '16px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 6 }}>Текущий</div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.8, color: 'var(--text)', lineHeight: 1 }}>
            {current != null ? current.toFixed(1) : '—'}
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-3)' }}> кг</span>
          </div>
        </div>
        <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: '16px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-3)', marginBottom: 6 }}>Цель</div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.8, color: target != null ? 'var(--accent)' : 'var(--text-3)', lineHeight: 1 }}>
            {target != null ? target.toFixed(1) : '—'}
            {target != null && <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-3)' }}> кг</span>}
          </div>
        </div>
      </div>

      {diff !== null && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: '16px', border: '1px solid var(--border)', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
              {diff > 0 ? `Нужно сбросить ${diff.toFixed(1)} кг` : diff < 0 ? `Нужно набрать ${Math.abs(diff).toFixed(1)} кг` : 'Цель достигнута 🎉'}
            </span>
            {pct !== null && (
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '2px 8px', borderRadius: 6 }}>
                {pct}%
              </span>
            )}
          </div>
          {pct !== null && (
            <div style={{ height: 5, borderRadius: 5, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 5, background: 'var(--accent)', width: `${100 - pct}%`, transition: 'width 0.5s ease' }} />
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '0 2px 10px' }}>
        История
      </div>

      {history.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', padding: '32px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, opacity: 0.2, marginBottom: 10 }}>⚖️</div>
          <div style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 600, marginBottom: 4 }}>История веса пуста</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Записи добавляются через Telegram-бот</div>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          {/* API returns DESC (newest first) — no reverse needed.
              arr[i+1] is the older entry → delta = newer − older = correct sign. */}
          {[...history].map((entry, i, arr) => {
            const prev = arr[i + 1]; // older entry (DESC order)
            const delta = prev ? entry.weightKg - prev.weightKg : null;
            const dateLabel = new Date(entry.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
            const goal = deriveGoal(profile?.currentWeightKg, profile?.desiredWeightKg);
            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '13px 16px',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5, color: 'var(--text)', lineHeight: 1 }}>
                    {entry.weightKg.toFixed(1)} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)' }}>кг</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{dateLabel}</div>
                </div>
                {delta !== null && (
                  <span style={{
                    fontSize: 12, fontWeight: 600,
                    color: weightDeltaColor(delta, goal),
                  }}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(1)} кг
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function StatsScreen() {
  const [tab, setTab] = useState<Tab>('day');

  const { data: bootstrapProfile } = useQuery({
    queryKey: ['profile-full'],
    queryFn: api.profile,
  });
  const p = bootstrapProfile?.profile;
  const norms = {
    cal: p?.dailyCaloriesKcal ?? null,
    p:   p?.dailyProteinG    ?? null,
    f:   p?.dailyFatG        ?? null,
    c:   p?.dailyCarbsG      ?? null,
  };

  return (
    <div className="screen">
      <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, color: 'var(--text)', marginBottom: 16 }}>
        Статистика
      </h1>

      <div className="period-tabs" style={{ marginBottom: 16 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`period-tab${tab === t.key ? ' active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'day'    && <DayView    norms={norms} />}
      {tab === 'week'   && <WeekView   norms={norms} />}
      {tab === 'weight' && <WeightView />}
    </div>
  );
}
