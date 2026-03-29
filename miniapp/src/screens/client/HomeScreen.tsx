import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import WeekCalendar, { TODAY } from '../../components/WeekCalendar';
import type { BootstrapData, MealEntry } from '../../types';

interface Props { bootstrap: BootstrapData; }

const MEAL_SECTIONS = [
  { type: 'breakfast', icon: '🍳', label: 'Завтрак' },
  { type: 'lunch',     icon: '🍲', label: 'Обед'    },
  { type: 'dinner',    icon: '🍽', label: 'Ужин'    },
  { type: 'snack',     icon: '🍎', label: 'Перекус'  },
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

// ─── Meal Section Card ─────────────────────────────────────────────────────

function MealSectionCard({ icon, label, meals, onAdd }: { icon: string; label: string; meals: MealEntry[]; onAdd: () => void }) {
  const totalCal = meals.reduce((s, m) => s + (m.caloriesKcal ?? 0), 0);
  const hasMeals = meals.length > 0;

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', marginBottom: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: hasMeals ? '1px solid var(--border)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
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

  const profile = bootstrap.profile;
  const sub = bootstrap.subscription;
  const trainer = bootstrap.connectedTrainer;
  const firstName = bootstrap.telegramUser?.first_name ?? '';
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

  return (
    <div className="screen">

      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.8, color: 'var(--text)', lineHeight: 1.1 }}>
          {firstName ? `Привет, ${firstName}` : 'Привет'} 👋
        </h1>
      </div>

      <WeekCalendar selected={selectedDate} onSelect={setSelectedDate} />

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

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '4px 2px 10px' }}>
        Приёмы пищи
      </div>

      {MEAL_SECTIONS.map(s => (
        <MealSectionCard key={s.type} icon={s.icon} label={s.label} meals={mealsByType[s.type] ?? []} onAdd={() => navigate('/add')} />
      ))}

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
                <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>{trainer.name ?? 'Подключён'}</span>
                <span style={{ color: 'var(--text-3)', fontSize: 16 }}>›</span>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
