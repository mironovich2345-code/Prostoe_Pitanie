import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import PaywallCard from '../../components/PaywallCard';
import WeekCalendar, { TODAY, isoToLocalDate } from '../../components/WeekCalendar';
import type { DotSet } from '../../components/WeekCalendar';
import type { BootstrapData, MealEntry, SubscriptionInfo } from '../../types';

// ─── Subscription tier helpers ─────────────────────────────────────────────

function isPremiumTier(sub: SubscriptionInfo | null | undefined): boolean {
  if (!sub) return false;
  return sub.status === 'active' || sub.status === 'trial' || sub.status === 'past_due';
}

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
  text:  '·',
  photo: '·',
  voice: '·',
};

const SOURCE_LABELS: Record<string, string> = {
  text:  'Текст',
  photo: 'Фото',
  voice: 'Голос',
};

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Завтрак',
  lunch:     'Обед',
  dinner:    'Ужин',
  snack:     'Перекус',
  unknown:   'Прочее',
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
  const isOver = norm != null && norm > 0 && value > norm;
  const displayPct = norm && norm > 0
    ? isOver
      ? Math.round(((value - norm) / norm) * 100)
      : Math.round((value / norm) * 100)
    : null;
  const barPct = norm && norm > 0 ? Math.min(100, Math.round((value / norm) * 100)) : null;

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
        {displayPct !== null && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
            background: isOver ? 'var(--danger-soft)' : accentSoft,
            color: isOver ? 'var(--danger)' : color,
          }}>
            {isOver ? `+${displayPct}%` : `${displayPct}%`}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.8, color: 'var(--text)', lineHeight: 1 }}>
          {value.toLocaleString('ru')}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>{unit}</span>
      </div>
      {barPct !== null && (
        <div style={{ height: 4, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden', marginBottom: 6 }}>
          <div style={{
            height: '100%', borderRadius: 4,
            background: isOver ? 'var(--danger)' : color,
            width: `${barPct}%`,
            transition: 'width 0.5s ease',
          }} />
        </div>
      )}
      {norm && (
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
          {isOver ? 'превышение' : 'цель'} {norm.toLocaleString('ru')} {unit}
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
  const [showConfirm, setShowConfirm] = useState(false);
  const qc = useQueryClient();
  const deleteMeal = useMutation({
    mutationFn: () => api.nutritionDeleteMeal(meal.id),
    onSuccess: () => {
      setShowConfirm(false);
      qc.invalidateQueries({ queryKey: ['diary'] });
      qc.invalidateQueries({ queryKey: ['nutrition-stats-range'] });
      qc.invalidateQueries({ queryKey: ['nutrition-stats', 60] });
    },
  });
  // Photos are always loaded via /media endpoint — photoData is not included in bulk responses.
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState(false);

  // Revoke blob URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (mediaUrl?.startsWith('blob:')) URL.revokeObjectURL(mediaUrl);
    };
  }, [mediaUrl]);

  const srcIcon = SOURCE_ICONS[meal.sourceType] ?? '📝';
  const isMediaType = meal.sourceType === 'photo' || meal.sourceType === 'voice';
  // Whether a Telegram file ID exists (bot-originated media)
  const hasTelegramFile = meal.sourceType === 'photo' ? !!meal.photoFileId
                        : meal.sourceType === 'voice' ? !!meal.voiceFileId
                        : false;

  async function loadMedia() {
    if (mediaUrl || mediaLoading || mediaError) return;
    console.log('[MealCard] fetching media for meal', meal.id);
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
        <span style={{ fontSize: 11, flexShrink: 0, marginTop: 2, opacity: 0.5, color: 'var(--text-3)', fontWeight: 600, minWidth: 10 }}>
          {SOURCE_LABELS[meal.sourceType] ? SOURCE_LABELS[meal.sourceType].charAt(0) : '·'}
        </span>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {isMediaType && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: '2px 7px', borderRadius: 6,
              background: expanded ? 'var(--surface-2)' : 'var(--accent-soft)',
              color: expanded ? 'var(--text-3)' : 'var(--accent)',
            }}>
              {expanded ? '▲' : SOURCE_LABELS[meal.sourceType]}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setShowConfirm(true); }}
            style={{
              background: 'none', border: 'none', padding: '2px 6px',
              color: 'var(--text-3)', fontSize: 11, fontWeight: 500,
              cursor: 'pointer', lineHeight: 1, flexShrink: 0,
            }}
          >Удалить</button>
        </div>
      </div>

      {/* Confirm dialog */}
      {showConfirm && (
        <div
          onClick={() => setShowConfirm(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
              padding: '24px 20px 32px',
              width: '100%', maxWidth: 480,
              boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              Удалить запись?
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.4 }}>
              {meal.text || 'Эта запись будет удалена без возможности восстановления.'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => deleteMeal.mutate()}
                disabled={deleteMeal.isPending}
                style={{
                  width: '100%', padding: '13px', borderRadius: 'var(--r-md)',
                  background: 'var(--danger, #e53935)', color: '#fff',
                  border: 'none', fontSize: 14, fontWeight: 600,
                  cursor: deleteMeal.isPending ? 'default' : 'pointer',
                  opacity: deleteMeal.isPending ? 0.6 : 1,
                }}
              >
                {deleteMeal.isPending ? 'Удаляем...' : 'Да, удалить'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={deleteMeal.isPending}
                style={{
                  width: '100%', padding: '13px', borderRadius: 'var(--r-md)',
                  background: 'var(--surface-2, var(--border))', color: 'var(--text-2)',
                  border: 'none', fontSize: 14, fontWeight: 500,
                  cursor: deleteMeal.isPending ? 'default' : 'pointer',
                }}
              >
                Нет, оставить
              </button>
            </div>
          </div>
        </div>
      )}

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
        <div style={{ opacity: 0.18, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>
        </div>
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

// ─── AI Insight Banner ─────────────────────────────────────────────────────

function AiInsightBanner({ date, mealCount }: { date: string; mealCount: number }) {
  const qc = useQueryClient();
  const bs = qc.getQueryData<BootstrapData>(['bootstrap']);
  const isPremium = isPremiumTier(bs?.subscription);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['nutrition-insight', date, mealCount],
    queryFn: () => api.nutritionInsight(date),
    staleTime: Infinity,
    retry: 1,
    enabled: isPremium && (date === TODAY || mealCount > 0),
  });

  if (!isPremium) return <PaywallCard plan="optimal" feature="Анализ рациона" />;

  if (isError) {
    if ((error as Error)?.message === 'subscription_required') {
      return <PaywallCard plan="optimal" feature="Анализ рациона" />;
    }
    return null;
  }

  if (isLoading) {
    return (
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)', padding: '14px 16px',
        marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div className="spinner" style={{ width: 14, height: 14, flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Анализирую рацион...</span>
      </div>
    );
  }

  if (!data) return null;

  const dotColor = data.severity === 'good'
    ? 'var(--accent)'
    : data.severity === 'warning'
    ? 'var(--danger)'
    : 'var(--text-3)';
  const chipBg = data.severity === 'good'
    ? 'var(--accent-soft)'
    : data.severity === 'warning'
    ? 'rgba(255,87,87,0.09)'
    : 'var(--surface-2)';

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r-lg)',
      border: '1px solid var(--border)', padding: '14px 16px',
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: dotColor, letterSpacing: 0.3 }}>
          {data.bannerTitle}
        </span>
      </div>

      {/* Main text */}
      <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55, margin: 0,
        marginBottom: (data.nextMealSuggestion || data.mealAdvice.length > 0) ? 10 : 0 }}>
        {data.bannerText}
      </p>

      {/* Next meal suggestion */}
      {data.nextMealSuggestion && (
        <div style={{
          background: chipBg, borderRadius: 8, padding: '8px 11px',
          fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45,
          marginBottom: data.mealAdvice.length > 0 ? 8 : 0,
        }}>
          <span style={{ fontWeight: 600, color: dotColor }}>Следующий приём: </span>
          {data.nextMealSuggestion}
        </div>
      )}

      {/* Meal advice list */}
      {data.mealAdvice.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.mealAdvice.map((tip, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.45 }}>
              · {tip}
            </div>
          ))}
        </div>
      )}
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

  const { data: stats60 } = useQuery({
    queryKey: ['nutrition-stats', 60],
    queryFn: () => api.nutritionStats(60),
    staleTime: 5 * 60_000,
  });

  const dotsByDate = useMemo(() => {
    const map: Record<string, DotSet> = {};
    for (const m of (stats60?.meals ?? [])) {
      const d = m.createdAt.slice(0, 10);
      if (!map[d]) map[d] = { breakfast: false, lunch: false, dinner: false };
      if (m.mealType === 'breakfast') map[d].breakfast = true;
      else if (m.mealType === 'lunch') map[d].lunch = true;
      else if (m.mealType === 'dinner') map[d].dinner = true;
    }
    return map;
  }, [stats60]);

  const meals: MealEntry[] = data?.meals ?? [];
  const totals = useMemo(() => computeTotals(meals), [meals]);

  return (
    <>
      <WeekCalendar selected={date} onSelect={setDate} dotsByDate={dotsByDate} />

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

          <AiInsightBanner date={date} mealCount={meals.length} />

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

// ─── Weekly AI Insight Banner ──────────────────────────────────────────────

function WeeklyInsightBanner({ from, to, mealCount }: { from: string; to: string; mealCount: number }) {
  const qc = useQueryClient();
  const bs = qc.getQueryData<BootstrapData>(['bootstrap']);
  const isPremium = isPremiumTier(bs?.subscription);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['nutrition-insight-week', from, to, mealCount],
    queryFn: () => api.nutritionInsightWeek(from, to),
    staleTime: Infinity,
    retry: 1,
    enabled: isPremium && mealCount > 0,
  });

  if (!isPremium) return <PaywallCard plan="optimal" feature="Анализ рациона за неделю" />;

  if (mealCount === 0) return null;

  if (isError) {
    if ((error as Error)?.message === 'subscription_required') {
      return <PaywallCard plan="optimal" feature="Анализ рациона за неделю" />;
    }
    return null;
  }

  if (isLoading) {
    return (
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)', padding: '14px 16px',
        marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div className="spinner" style={{ width: 14, height: 14, flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Анализирую неделю...</span>
      </div>
    );
  }

  if (!data) return null;

  const dotColor = data.severity === 'good'
    ? 'var(--accent)'
    : data.severity === 'warning'
    ? 'var(--danger)'
    : 'var(--text-3)';
  const chipBg = data.severity === 'good'
    ? 'var(--accent-soft)'
    : data.severity === 'warning'
    ? 'rgba(255,87,87,0.09)'
    : 'var(--surface-2)';

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--r-lg)',
      border: '1px solid var(--border)', padding: '14px 16px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: dotColor, letterSpacing: 0.3 }}>
          {data.bannerTitle}
        </span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55, margin: 0,
        marginBottom: (data.nextMealSuggestion || data.mealAdvice.length > 0) ? 10 : 0 }}>
        {data.bannerText}
      </p>
      {data.nextMealSuggestion && (
        <div style={{
          background: chipBg, borderRadius: 8, padding: '8px 11px',
          fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45,
          marginBottom: data.mealAdvice.length > 0 ? 8 : 0,
        }}>
          <span style={{ fontWeight: 600, color: dotColor }}>На следующую неделю: </span>
          {data.nextMealSuggestion}
        </div>
      )}
      {data.mealAdvice.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.mealAdvice.map((tip, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.45 }}>
              · {tip}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Week View ─────────────────────────────────────────────────────────────

const DAY_RATING_CHIP: Record<string, { label: string; color: string; bg: string }> = {
  excellent: { label: 'Отлично',  color: 'var(--accent)',                bg: 'var(--accent-soft)' },
  good:      { label: 'Хорошо',   color: '#7EB8F0',                      bg: 'rgba(126,184,240,0.12)' },
  improve:   { label: 'Улучшить', color: 'var(--warn, #F0A07A)',          bg: 'rgba(240,160,122,0.12)' },
};

function WeekView({ norms }: { norms: { cal: number | null; p: number | null; f: number | null; c: number | null } }) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const today = new Date(TODAY + 'T12:00:00');
  const dow = today.getDay(); // 0=Sun,1=Mon..6=Sat
  const daysToMonday = dow === 0 ? -6 : 1 - dow;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() + daysToMonday);
  const startDate = new Date(thisMonday);
  startDate.setDate(thisMonday.getDate() + weekOffset * 7);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
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

  const { data: ratingsData } = useQuery({
    queryKey: ['my-ratings'],
    queryFn: api.myRatings,
  });

  const dayRatingMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of ratingsData?.ratings ?? []) {
      if (r.targetType === 'day') map[r.targetId] = r.rating;
    }
    return map;
  }, [ratingsData]);

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
          <div style={{ opacity: 0.2, marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </div>
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

          {/* Weekly AI insight */}
          <WeeklyInsightBanner from={fromStr} to={toStr} mealCount={meals.length} />

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
                      {dayRatingMap[day] && (() => {
                        const chip = DAY_RATING_CHIP[dayRatingMap[day]];
                        return chip ? (
                          <span style={{
                            fontSize: 10, fontWeight: 700,
                            padding: '2px 7px', borderRadius: 20,
                            background: chip.bg, color: chip.color,
                            whiteSpace: 'nowrap',
                          }}>
                            {chip.label}
                          </span>
                        ) : null;
                      })()}
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
  const qc = useQueryClient();
  const bs = qc.getQueryData<BootstrapData>(['bootstrap']);
  const isPremium = isPremiumTier(bs?.subscription);

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

  // history is DESC (newest first): [0] = newest, [last] = oldest
  const currentWeight = history.length > 0 ? history[0].weightKg : profile?.currentWeightKg ?? null;
  const startWeight   = history.length > 0 ? history[history.length - 1].weightKg : null;
  const current = currentWeight;
  const target = profile?.desiredWeightKg;
  const diff = currentWeight != null && target != null ? currentWeight - target : null;

  // Progress: 0% = startWeight (oldest entry), 100% = targetWeight
  const totalSpan = startWeight != null && target != null ? startWeight - target : null;
  const pct = totalSpan != null && Math.abs(totalSpan) > 0.01 && currentWeight != null
    ? Math.max(0, Math.min(100, Math.round(((startWeight! - currentWeight) / totalSpan) * 100)))
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

      {!isPremium && (
        <PaywallCard plan="optimal" feature="История веса и прогресса" />
      )}

      {isPremium && diff !== null && (
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
              <div style={{ height: '100%', borderRadius: 5, background: 'var(--accent)', width: `${pct}%`, transition: 'width 0.5s ease' }} />
            </div>
          )}
        </div>
      )}

      {isPremium && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '0 2px 10px' }}>
            История
          </div>

          {history.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', padding: '32px 16px', textAlign: 'center' }}>
          <div style={{ opacity: 0.2, marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          </div>
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
            const dt = new Date(entry.createdAt);
            const dateLabel = dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
            const timeLabel = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
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
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
                    {dateLabel}
                    <span style={{ color: 'var(--accent)', marginLeft: 6 }}>{timeLabel}</span>
                  </div>
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
      )}
    </>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function StatsScreen() {
  const location = useLocation();
  const initialTab = (location.state as { tab?: Tab } | null)?.tab ?? 'day';
  const [tab, setTab] = useState<Tab>(initialTab);

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
