import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import NutritionSummary from '../../components/NutritionSummary';
import type { MealEntry, UserProfile } from '../../types';

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Завтрак',
  lunch:     'Обед',
  dinner:    'Ужин',
  snack:     'Перекус',
  unknown:   'Приём пищи',
};

const MEAL_RATINGS = [
  { value: 'good',    label: 'Хорошо' },
  { value: 'ok',      label: 'Нормально' },
  { value: 'improve', label: 'Улучшить' },
] as const;

const DAY_RATINGS = [
  { value: 'excellent', label: 'Отлично' },
  { value: 'good',      label: 'Хорошо' },
  { value: 'improve',   label: 'Улучшить' },
] as const;

/** Returns 'YYYY-MM-DD' in local time */
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Format short date label for day picker tab */
function dayTabLabel(dateStr: string): string {
  const today = localDateStr(new Date());
  const yesterday = localDateStr(new Date(Date.now() - 86400000));
  if (dateStr === today) return 'Сегодня';
  if (dateStr === yesterday) return 'Вчера';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
}

/** Format date header for a day section */
function dayHeader(dateStr: string): string {
  const today = localDateStr(new Date());
  const yesterday = localDateStr(new Date(Date.now() - 86400000));
  if (dateStr === today) return 'Сегодня';
  if (dateStr === yesterday) return 'Вчера';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function MealRatingBar({ mealId, existingRating }: { mealId: number; existingRating?: string }) {
  const qc = useQueryClient();
  const { clientId } = useParams<{ clientId: string }>();
  const [active, setActive] = useState(existingRating ?? '');

  const mutation = useMutation({
    mutationFn: (rating: string) => api.rateMeal(mealId, rating),
    onSuccess: (_, rating) => {
      setActive(rating);
      qc.invalidateQueries({ queryKey: ['trainer-client-ratings', clientId] });
    },
  });

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
      {MEAL_RATINGS.map(opt => (
        <button
          key={opt.value}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(opt.value)}
          style={{
            flex: 1, padding: '6px 4px', fontSize: 11, fontWeight: 600,
            borderRadius: 8, border: 'none', cursor: 'pointer',
            background: active === opt.value ? 'var(--accent-soft)' : 'var(--surface-2)',
            color: active === opt.value ? 'var(--accent)' : 'var(--text-3)',
            transition: 'all 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function DayRatingBar({ date, clientId, existingRating }: { date: string; clientId: string; existingRating?: string }) {
  const qc = useQueryClient();
  const [active, setActive] = useState(existingRating ?? '');

  const mutation = useMutation({
    mutationFn: (rating: string) => api.rateDay(date, clientId, rating),
    onSuccess: (_, rating) => {
      setActive(rating);
      qc.invalidateQueries({ queryKey: ['trainer-client-ratings', clientId] });
    },
  });

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 8 }}>
        Оценка дня
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {DAY_RATINGS.map(opt => (
          <button
            key={opt.value}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(opt.value)}
            style={{
              flex: 1, padding: '9px 4px', fontSize: 12, fontWeight: 600,
              borderRadius: 10, border: 'none', cursor: 'pointer',
              background: active === opt.value ? 'var(--accent-soft)' : 'var(--surface-2)',
              color: active === opt.value ? 'var(--accent)' : 'var(--text-3)',
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CoachClientStatsScreen() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['trainer-client-stats', clientId],
    queryFn: () => api.trainerClientStats(clientId!),
  });
  const { data: ratingsData } = useQuery({
    queryKey: ['trainer-client-ratings', clientId],
    queryFn: () => api.ratingsForClient(clientId!),
    enabled: !!clientId,
  });

  if (isLoading) return <div className="loading"><div className="spinner" /></div>;

  const todayMeals: MealEntry[] = data?.todayMeals ?? [];
  const recentMeals: MealEntry[] = data?.recentMeals ?? [];
  const profile = data?.profile as UserProfile | null;
  const displayName = (data as { displayName?: string })?.displayName ?? `Клиент …${clientId?.slice(-4)}`;
  const todayProt = todayMeals.reduce((s, m) => s + (m.proteinG ?? 0), 0);
  const todayFat = todayMeals.reduce((s, m) => s + (m.fatG ?? 0), 0);
  const todayCarbs = todayMeals.reduce((s, m) => s + (m.carbsG ?? 0), 0);

  // Index existing ratings by targetId for quick lookup
  const ratingByMeal: Record<string, string> = {};
  const ratingByDay: Record<string, string> = {};
  for (const r of ratingsData?.ratings ?? []) {
    if (r.targetType === 'meal') ratingByMeal[r.targetId] = r.rating;
    if (r.targetType === 'day') ratingByDay[r.targetId] = r.rating;
  }

  const todayDateStr = localDateStr(new Date());

  // Group all recentMeals by date (up to 50 entries from backend)
  const grouped: Record<string, MealEntry[]> = {};
  for (const m of recentMeals) {
    const d = localDateStr(new Date(m.createdAt));
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(m);
  }
  // Sorted descending by date
  const availableDays = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Ensure selectedDay stays valid if data loads
  const activeDay = availableDays.includes(selectedDay) ? selectedDay : (availableDays[0] ?? todayDateStr);

  const dayMeals = grouped[activeDay] ?? [];

  return (
    <div className="screen">
      <button
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', fontSize: 16, marginBottom: 12, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
      >
        ← Назад
      </button>
      <h1 style={{ marginBottom: 16, fontSize: 18 }}>Статистика · {displayName}</h1>

      {/* Today summary */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-xl)', padding: '18px', border: '1px solid var(--border)', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 12 }}>
          Сегодня
        </div>
        <NutritionSummary
          calories={data?.todayCalories ?? 0}
          protein={todayProt}
          fat={todayFat}
          carbs={todayCarbs}
          normCalories={profile?.dailyCaloriesKcal}
          normProtein={profile?.dailyProteinG}
          normFat={profile?.dailyFatG}
          normCarbs={profile?.dailyCarbsG}
        />
        {todayMeals.length > 0 && clientId && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <DayRatingBar date={todayDateStr} clientId={clientId} existingRating={ratingByDay[todayDateStr]} />
          </div>
        )}
      </div>

      {/* Day picker */}
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '8px 2px 10px' }}>
        История приёмов
      </div>

      {availableDays.length === 0 ? (
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r-xl)',
          border: '1px solid var(--border)', padding: '32px 20px',
          textAlign: 'center',
        }}>
          <div style={{ opacity: 0.25, marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M3 12h18M3 18h18"/>
            </svg>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6 }}>
            Приёмов пищи ещё не записано
          </div>
        </div>
      ) : (
        <>
          {/* Day tabs strip */}
          <div style={{
            display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 12,
            scrollbarWidth: 'none',
          }}>
            {availableDays.map(d => (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                style={{
                  flexShrink: 0, padding: '7px 14px', fontSize: 12, fontWeight: 600,
                  borderRadius: 20, border: 'none', cursor: 'pointer',
                  background: activeDay === d ? 'var(--accent)' : 'var(--surface-2)',
                  color: activeDay === d ? '#000' : 'var(--text-3)',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {dayTabLabel(d)}
              </button>
            ))}
          </div>

          {/* Selected day content */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-2)', marginBottom: 10 }}>
              {dayHeader(activeDay)}
            </div>

            {dayMeals.length === 0 ? (
              <div style={{
                background: 'var(--surface)', borderRadius: 'var(--r-xl)',
                border: '1px solid var(--border)', padding: '24px 20px',
                textAlign: 'center', fontSize: 14, color: 'var(--text-3)',
              }}>
                Нет записей за этот день
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dayMeals.map((m: MealEntry) => {
                  const mealLabel = MEAL_TYPE_LABELS[m.mealType] ?? MEAL_TYPE_LABELS['unknown'];
                  const timeLabel = new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={m.id}
                      style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '12px 14px', border: '1px solid var(--border)' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--accent)', marginBottom: 4 }}>
                            {mealLabel} · {timeLabel}
                          </div>
                          <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.45 }}>
                            {m.text || '—'}
                          </div>
                        </div>
                        {m.caloriesKcal != null && (
                          <div style={{ flexShrink: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                            {Math.round(m.caloriesKcal)} <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400 }}>ккал</span>
                          </div>
                        )}
                      </div>
                      <MealRatingBar mealId={m.id} existingRating={ratingByMeal[String(m.id)]} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Day rating for selected day */}
            {clientId && dayMeals.length > 0 && (
              <div style={{ marginTop: 8, background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '12px 14px', border: '1px solid var(--border)' }}>
                <DayRatingBar date={activeDay} clientId={clientId} existingRating={ratingByDay[activeDay]} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
