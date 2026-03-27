import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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

      <div className="section-header" style={{ marginTop: 8 }}>Настройки</div>
      <div className="card" style={{ padding: 0 }}>
        <button
          onClick={() => navigate('/diary/edit-data')}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '14px 16px', background: 'none', border: 'none', fontSize: 16 }}
        >
          <span>✏️ Мои физические данные</span>
          <span style={{ color: 'var(--tg-theme-hint-color)' }}>›</span>
        </button>
      </div>
    </div>
  );
}
