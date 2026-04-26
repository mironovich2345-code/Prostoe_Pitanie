import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useTrackEvent } from '../../hooks/useTrackEvent';
import { Card } from '../../ui';
import type { MealEntry } from '../../types';

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Завтрак',
  lunch:     'Обед',
  dinner:    'Ужин',
  snack:     'Перекус',
  unknown:   'Прочее',
};

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function prevDay(d: string) {
  const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() - 1);
  return dt.toISOString().split('T')[0];
}
function nextDay(d: string) {
  const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + 1);
  return dt.toISOString().split('T')[0];
}

export default function FoodDiaryScreen() {
  useTrackEvent('diary_opened');
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const isToday = date === today;

  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['diary', date],
    queryFn: () => api.nutritionDiary(date),
  });

  const deleteMeal = useMutation({
    mutationFn: (mealId: number) => api.nutritionDeleteMeal(mealId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diary', date] });
    },
  });

  const meals = data?.meals ?? [];

  // Totals
  let totalCal = 0, totalP = 0, totalF = 0, totalC = 0;
  for (const m of meals) {
    totalCal += m.caloriesKcal ?? 0;
    totalP   += m.proteinG    ?? 0;
    totalF   += m.fatG        ?? 0;
    totalC   += m.carbsG      ?? 0;
  }

  return (
    <div className="screen">

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, color: 'var(--text)', marginBottom: 16 }}>
          Дневник
        </h1>

        {/* Date navigator */}
        <div
          style={{
            display: 'flex', alignItems: 'center',
            background: 'var(--surface)', borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)', padding: '4px',
          }}
        >
          <button
            onClick={() => setDate(prevDay(date))}
            style={{
              background: 'none', border: 'none',
              width: 40, height: 40, borderRadius: 12,
              color: 'var(--text-2)', fontSize: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, cursor: 'pointer',
            }}
          >‹</button>
          <div style={{ flex: 1, textAlign: 'center', padding: '4px 0' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{fmtDate(date)}</div>
            {isToday && (
              <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginTop: 1, letterSpacing: 0.3 }}>
                Сегодня
              </div>
            )}
          </div>
          <button
            onClick={() => !isToday && setDate(nextDay(date))}
            disabled={isToday}
            style={{
              background: 'none', border: 'none',
              width: 40, height: 40, borderRadius: 12,
              color: isToday ? 'var(--text-3)' : 'var(--text-2)', fontSize: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, cursor: isToday ? 'default' : 'pointer',
              opacity: isToday ? 0.3 : 1,
            }}
          >›</button>
        </div>
      </div>

      {isLoading ? (
        <Card><div style={{ color: 'var(--text-3)', fontSize: 14 }}>Загружаем...</div></Card>
      ) : meals.length === 0 ? (
        /* Premium empty state */
        <div style={{ textAlign: 'center', padding: '52px 24px 40px' }}>
          <div style={{ marginBottom: 16, opacity: 0.2, display: 'flex', justifyContent: 'center' }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
            {isToday ? 'День ещё не начат' : 'В этот день пусто'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 28 }}>
            {isToday ? 'Добавь первый приём пищи через бот или кнопку ниже' : 'В этот день записей нет'}
          </div>
          {isToday && (
            <button
              onClick={() => navigate('/add')}
              className="btn"
              style={{ width: 'auto', padding: '11px 28px', display: 'inline-block', fontSize: 14 }}
            >
              + Добавить приём
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Day totals */}
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--r-lg)',
              padding: '14px 16px',
              marginBottom: 10,
              border: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 4 }}>Итого</div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: 'var(--text)' }}>
                {Math.round(totalCal).toLocaleString('ru')}
                <span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 500 }}> ккал</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              {[
                { label: 'Б', value: totalP, color: 'var(--macro-p)' },
                { label: 'Ж', value: totalF, color: 'var(--macro-f)' },
                { label: 'У', value: totalC, color: 'var(--macro-c)' },
              ].map(m => (
                <div key={m.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: m.color, lineHeight: 1 }}>{m.value.toFixed(0)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, fontWeight: 600, letterSpacing: 0.3 }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Meal list */}
          <Card>
            {meals.map((meal: MealEntry) => (
              <div key={meal.id} className="meal-item">
                <div className="meal-item-header">
                  <span>{MEAL_LABELS[meal.mealType] ?? meal.mealType}</span>
                  <span style={{ color: meal.caloriesKcal != null ? 'var(--text)' : 'var(--text-3)' }}>
                    {meal.caloriesKcal != null ? `${meal.caloriesKcal} ккал` : '—'}
                  </span>
                </div>
                <div className="meal-item-meta">
                  {meal.text}
                  {meal.caloriesKcal != null && (
                    <span> · Б{meal.proteinG?.toFixed(0)} Ж{meal.fatG?.toFixed(0)} У{meal.carbsG?.toFixed(0)}</span>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
