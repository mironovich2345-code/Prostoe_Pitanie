import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import NutritionSummary from '../../components/NutritionSummary';
import type { MealEntry } from '../../types';

export default function StatsScreen() {
  const [days, setDays] = useState(7);
  const { data, isLoading } = useQuery({ queryKey: ['nutrition-stats', days], queryFn: () => api.nutritionStats(days) });
  let totalCal = 0, totalProt = 0, totalFat = 0, totalCarbs = 0, totalFiber = 0;
  if (data) {
    for (const m of data.meals) {
      totalCal += m.caloriesKcal ?? 0;
      totalProt += m.proteinG ?? 0;
      totalFat += m.fatG ?? 0;
      totalCarbs += m.carbsG ?? 0;
      totalFiber += m.fiberG ?? 0;
    }
  }
  const activeDays = data ? new Set(data.meals.map((m: MealEntry) => m.createdAt.split('T')[0])).size : 0;
  return (
    <div className="screen">
      <h1 style={{ marginBottom: 16 }}>📊 Статистика</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[7, 14, 30].map(d => (
          <button key={d} className={`btn ${days === d ? '' : 'btn-secondary'}`} style={{ flex: 1, padding: '8px' }} onClick={() => setDays(d)}>{d} дней</button>
        ))}
      </div>
      {isLoading ? (
        <div className="card"><div>Загружаем...</div></div>
      ) : data ? (
        <>
          <div className="card">
            <div className="card-title">За {days} дней · {activeDays} активных дней</div>
            <NutritionSummary calories={Math.round(totalCal)} protein={totalProt} fat={totalFat} carbs={totalCarbs} fiber={totalFiber} />
          </div>
          <div className="card">
            <div className="card-title">Среднее в день</div>
            <NutritionSummary
              calories={activeDays > 0 ? Math.round(totalCal / activeDays) : 0}
              protein={activeDays > 0 ? totalProt / activeDays : 0}
              fat={activeDays > 0 ? totalFat / activeDays : 0}
              carbs={activeDays > 0 ? totalCarbs / activeDays : 0}
              fiber={activeDays > 0 ? totalFiber / activeDays : 0}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
