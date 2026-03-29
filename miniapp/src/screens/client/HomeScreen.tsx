import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import type { BootstrapData, MealEntry } from '../../types';

interface Props { bootstrap: BootstrapData; }

// ─── Helpers ──────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0];

function isoToDate(iso: string) { return new Date(iso + 'T12:00:00'); }

/** Returns Mon–Sun array of YYYY-MM-DD strings for the week containing `anchor` */
function getWeekDays(anchor: string): string[] {
  const d = isoToDate(anchor);
  const dow = d.getDay(); // 0=Sun
  const toMonday = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setDate(d.getDate() + toMonday);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(mon);
    day.setDate(mon.getDate() + i);
    return day.toISOString().split('T')[0];
  });
}

const RU_DOW_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const MEAL_SECTIONS = [
  { type: 'breakfast', icon: '🍳', label: 'Завтрак' },
  { type: 'lunch',     icon: '🍲', label: 'Обед'    },
  { type: 'dinner',    icon: '🍽', label: 'Ужин'    },
  { type: 'snack',     icon: '🍎', label: 'Перекус'  },
] as const;

// ─── SVG Ring primitive ────────────────────────────────────────────────────

interface RingProps {
  size: number;
  radius: number;
  progress: number; // 0–1
  strokeWidth?: number;
  color: string;
}
function Ring({ size, radius, progress, strokeWidth = 8, color }: RingProps) {
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - Math.min(1, Math.max(0, progress)));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      {/* Track */}
      <circle cx={cx} cy={cy} r={radius} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      {/* Arc */}
      {progress > 0 && (
        <circle
          cx={cx} cy={cy} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      )}
    </svg>
  );
}

// ─── Week Calendar ─────────────────────────────────────────────────────────

function WeekCalendar({ selected, onSelect }: { selected: string; onSelect: (d: string) => void }) {
  const days = getWeekDays(selected);
  const monday = days[0];
  const sunday = days[6];

  const monthLabel = isoToDate(monday).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  // Navigation: offset by 7 days relative to selected date, capped at today
  const goBack = () => {
    const d = isoToDate(selected);
    d.setDate(d.getDate() - 7);
    onSelect(d.toISOString().split('T')[0]);
  };
  const goForward = () => {
    const d = isoToDate(selected);
    d.setDate(d.getDate() + 7);
    const candidate = d.toISOString().split('T')[0];
    // Never go past today
    onSelect(candidate > TODAY ? TODAY : candidate);
  };

  // Next week button is shown only when the current week's Sunday is before today
  const canGoForward = sunday < TODAY;

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--r-lg)',
      padding: '12px 10px',
      border: '1px solid var(--border)',
      marginBottom: 12,
    }}>
      {/* Month label + arrows */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingInline: 2 }}>
        <button
          onClick={goBack}
          style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 20, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 8, flexShrink: 0 }}
        >‹</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', letterSpacing: -0.1, textTransform: 'capitalize' }}>
          {monthLabel}
        </span>
        <button
          onClick={goForward}
          disabled={!canGoForward}
          style={{ background: 'none', border: 'none', color: canGoForward ? 'var(--text-2)' : 'transparent', fontSize: 20, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canGoForward ? 'pointer' : 'default', borderRadius: 8, flexShrink: 0 }}
        >›</button>
      </div>

      {/* Day buttons */}
      <div style={{ display: 'flex', gap: 3 }}>
        {days.map((day, i) => {
          const isSelected = day === selected;
          const isToday = day === TODAY;
          const isFuture = day > TODAY;
          const dayNum = isoToDate(day).getDate();

          return (
            <button
              key={day}
              onClick={() => !isFuture && onSelect(day)}
              disabled={isFuture}
              style={{
                flex: 1,
                padding: '8px 2px 7px',
                borderRadius: 12,
                border: isToday && !isSelected
                  ? '1px solid rgba(215,255,63,0.35)'
                  : '1px solid transparent',
                background: isSelected ? 'var(--accent)' : 'transparent',
                cursor: isFuture ? 'default' : 'pointer',
                opacity: isFuture ? 0.28 : 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                transition: 'background 0.15s',
              }}
            >
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: 0.2,
                color: isSelected ? '#000' : 'var(--text-3)',
              }}>
                {RU_DOW_SHORT[i]}
              </span>
              <span style={{
                fontSize: 16, lineHeight: 1, fontWeight: isSelected || isToday ? 700 : 500,
                color: isSelected ? '#000' : isToday ? 'var(--accent)' : 'var(--text)',
              }}>
                {dayNum}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Calorie Hero (Ring) ───────────────────────────────────────────────────

function CalorieHero({ calories, norm }: { calories: number; norm: number | null }) {
  const pct = norm && norm > 0 ? calories / norm : 0;
  const isOver = norm ? calories > norm : false;
  const remaining = norm ? Math.max(0, norm - calories) : null;
  const ringColor = isOver ? 'var(--danger)' : 'var(--accent)';

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--r-xl)',
      padding: '20px 18px',
      marginBottom: 10,
      border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>

        {/* Ring */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Ring size={120} radius={50} progress={pct} strokeWidth={10} color={ringColor} />
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center', pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.8, color: 'var(--text)', lineHeight: 1 }}>
              {calories.toLocaleString('ru')}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 500, marginTop: 2 }}>ккал</div>
          </div>
        </div>

        {/* Stats */}
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
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  из {norm.toLocaleString('ru')} ккал
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                  background: isOver ? 'var(--danger-soft)' : 'var(--accent-soft)',
                  color: isOver ? 'var(--danger)' : 'var(--accent)',
                }}>
                  {Math.round(pct * 100)}%
                </span>
              </div>
            </>
          ) : (
            <div>
              <div style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 600, marginBottom: 6 }}>
                Норма не задана
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
                Заполни данные в профиле — AI рассчитает норму
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Macro Ring Tiles ──────────────────────────────────────────────────────

interface MacroRingRowProps {
  protein: number; fat: number; carbs: number;
  normP: number | null; normF: number | null; normC: number | null;
}
function MacroRingRow({ protein, fat, carbs, normP, normF, normC }: MacroRingRowProps) {
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
          <div
            key={t.label}
            style={{
              flex: 1,
              background: 'var(--surface)',
              borderRadius: 18,
              padding: '12px 6px 10px',
              border: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}
          >
            {/* Ring with value inside */}
            <div style={{ position: 'relative' }}>
              <Ring size={72} radius={28} progress={pct} strokeWidth={7} color={t.color} />
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center', pointerEvents: 'none',
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.color, lineHeight: 1 }}>
                  {t.value.toFixed(0)}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-3)' }}>г</div>
              </div>
            </div>
            {/* Label + norm */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>{t.label}</div>
              {t.norm && (
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>/ {t.norm}г</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Meal Section Card ─────────────────────────────────────────────────────

function MealSectionCard({
  icon, label, meals, onAdd,
}: {
  icon: string; label: string; meals: MealEntry[]; onAdd: () => void;
}) {
  const totalCal = meals.reduce((s, m) => s + (m.caloriesKcal ?? 0), 0);
  const hasMeals = meals.length > 0;

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--r-lg)',
      border: '1px solid var(--border)',
      marginBottom: 8,
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px',
        borderBottom: hasMeals ? '1px solid var(--border)' : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {totalCal > 0 && (
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
              {totalCal} ккал
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); onAdd(); }}
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              color: 'var(--accent)', fontSize: 18, fontWeight: 700, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >+</button>
        </div>
      </div>

      {/* Entries or empty state */}
      {hasMeals ? (
        <div>
          {meals.map(m => (
            <div
              key={m.id}
              style={{
                padding: '8px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ flex: 1, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.4, paddingRight: 10 }}>
                {m.text}
                {m.proteinG != null && (
                  <span style={{ color: 'var(--text-3)' }}>
                    {' '}· Б{m.proteinG.toFixed(0)} Ж{m.fatG?.toFixed(0)} У{m.carbsG?.toFixed(0)}
                  </span>
                )}
              </div>
              {m.caloriesKcal != null && (
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>
                  {m.caloriesKcal} ккал
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '10px 14px 11px', fontSize: 13, color: 'var(--text-3)' }}>
          не записано
        </div>
      )}
    </div>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function HomeScreen({ bootstrap }: Props) {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(TODAY);

  // Shared cache with FoodDiaryScreen via ['diary', date]
  const { data, isLoading } = useQuery({
    queryKey: ['diary', selectedDate],
    queryFn: () => api.nutritionDiary(selectedDate),
  });

  const profile = bootstrap.profile;
  const sub = bootstrap.subscription;
  const trainer = bootstrap.connectedTrainer;
  const firstName = bootstrap.telegramUser?.first_name ?? '';

  const meals: MealEntry[] = data?.meals ?? [];

  // Compute totals from raw meals
  const totals = useMemo(() => {
    let cal = 0, p = 0, f = 0, c = 0;
    for (const m of meals) {
      cal += m.caloriesKcal ?? 0;
      p   += m.proteinG    ?? 0;
      f   += m.fatG        ?? 0;
      c   += m.carbsG      ?? 0;
    }
    return { calories: Math.round(cal), protein: p, fat: f, carbs: c };
  }, [meals]);

  // Group meals by type
  const mealsByType = useMemo(() => {
    const g: Record<string, MealEntry[]> = {};
    for (const m of meals) {
      (g[m.mealType] ??= []).push(m);
    }
    return g;
  }, [meals]);

  return (
    <div className="screen">

      {/* Greeting */}
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.8, color: 'var(--text)', lineHeight: 1.1 }}>
          {firstName ? `Привет, ${firstName}` : 'Привет'} 👋
        </h1>
      </div>

      {/* Week calendar */}
      <WeekCalendar selected={selectedDate} onSelect={setSelectedDate} />

      {/* Hero + Macros */}
      {isLoading ? (
        <div className="card" style={{ padding: '28px 18px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          <CalorieHero
            calories={totals.calories}
            norm={profile?.dailyCaloriesKcal ?? null}
          />
          <MacroRingRow
            protein={totals.protein}
            fat={totals.fat}
            carbs={totals.carbs}
            normP={profile?.dailyProteinG ?? null}
            normF={profile?.dailyFatG ?? null}
            normC={profile?.dailyCarbsG ?? null}
          />
        </>
      )}

      {/* Meal sections */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '4px 2px 10px' }}>
        Приёмы пищи
      </div>

      {MEAL_SECTIONS.map(s => (
        <MealSectionCard
          key={s.type}
          icon={s.icon}
          label={s.label}
          meals={mealsByType[s.type] ?? []}
          onAdd={() => navigate('/add')}
        />
      ))}

      {/* Compact sub / trainer rows */}
      {(sub || trainer) && (
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
          {trainer && (
            <div className="info-row" onClick={() => navigate('/trainer')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>🏋</span>
                <span style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>Тренер</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                  {trainer.name ?? 'Подключён'}
                </span>
                <span style={{ color: 'var(--text-3)', fontSize: 16 }}>›</span>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
