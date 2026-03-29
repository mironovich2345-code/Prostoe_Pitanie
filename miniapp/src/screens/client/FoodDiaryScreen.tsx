import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { MealEntry } from '../../types';

const MEAL_LABELS: Record<string, string> = {
  breakfast: '🍳 Завтрак',
  lunch: '🍲 Обед',
  dinner: '🍽 Ужин',
  snack: '🍎 Перекус',
  unknown: '🍴 Прочее',
};

export default function FoodDiaryScreen() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const { data, isLoading } = useQuery({ queryKey: ['diary', date], queryFn: () => api.nutritionDiary(date) });

  return (
    <div className="screen">
      <h1 style={{ marginBottom: 12 }}>📋 Дневник</h1>

      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        style={{ marginBottom: 16, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', fontSize: 16, width: '100%', background: 'var(--tg-theme-secondary-bg-color, #fff)' }}
      />

      {isLoading ? (
        <div className="card">Загружаем...</div>
      ) : data?.meals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🍽</div>
          <div>Записей за этот день нет</div>
        </div>
      ) : (
        <div className="card">
          {data?.meals.map((meal: MealEntry) => (
            <div key={meal.id} className="meal-item">
              <div className="meal-item-header">
                <span>{MEAL_LABELS[meal.mealType] ?? meal.mealType}</span>
                <span>{meal.caloriesKcal != null ? `${meal.caloriesKcal} ккал` : '—'}</span>
              </div>
              <div className="meal-item-meta">
                {meal.text}
                {meal.caloriesKcal != null && (
                  <span> · Б{meal.proteinG?.toFixed(0)} Ж{meal.fatG?.toFixed(0)} У{meal.carbsG?.toFixed(0)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
