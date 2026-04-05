import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import NutritionSummary from '../../components/NutritionSummary';
import type { MealEntry, UserProfile } from '../../types';

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

function DayRatingBar({ date, clientId }: { date: string; clientId: string }) {
  const qc = useQueryClient();
  const [active, setActive] = useState('');

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
  for (const r of ratingsData?.ratings ?? []) {
    if (r.targetType === 'meal') ratingByMeal[r.targetId] = r.rating;
  }

  const todayDateStr = new Date().toISOString().slice(0, 10);

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
            <DayRatingBar date={todayDateStr} clientId={clientId} />
          </div>
        )}
      </div>

      {/* Recent meals with rating buttons */}
      {recentMeals.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '8px 2px 10px' }}>
            Последние записи
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentMeals.slice(0, 10).map((m: MealEntry) => (
              <div
                key={m.id}
                style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '12px 14px', border: '1px solid var(--border)' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.4, marginBottom: 2 }}>{m.text}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {new Date(m.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
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
            ))}
          </div>
        </>
      )}
    </div>
  );
}
