import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { Card, MacroTiles } from '../../ui';
import type { MealEntry } from '../../types';

const PERIODS = [
  { days: 7,  label: '7 дней'  },
  { days: 14, label: '14 дней' },
  { days: 30, label: '30 дней' },
];

export default function StatsScreen() {
  const [days, setDays] = useState(7);
  const { data, isLoading } = useQuery({
    queryKey: ['nutrition-stats', days],
    queryFn: () => api.nutritionStats(days),
  });

  let totalCal = 0, totalP = 0, totalF = 0, totalC = 0, totalFib = 0;
  if (data) {
    for (const m of data.meals) {
      totalCal += m.caloriesKcal ?? 0;
      totalP   += m.proteinG    ?? 0;
      totalF   += m.fatG        ?? 0;
      totalC   += m.carbsG      ?? 0;
      totalFib += m.fiberG      ?? 0;
    }
  }
  const activeDays = data
    ? new Set(data.meals.map((m: MealEntry) => m.createdAt.split('T')[0])).size
    : 0;
  const avg = (v: number) => activeDays > 0 ? v / activeDays : 0;

  return (
    <div className="screen">
      <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: 'var(--text)', marginBottom: 20 }}>
        📊 Отчёт
      </h1>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {PERIODS.map(p => (
          <button
            key={p.days}
            onClick={() => setDays(p.days)}
            className={days === p.days ? 'btn' : 'btn btn-secondary'}
            style={{ flex: 1, padding: '10px 8px', fontSize: 13 }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Card><div style={{ color: 'var(--text-3)', fontSize: 14 }}>Загружаем...</div></Card>
      ) : data && activeDays > 0 ? (
        <>
          {/* Summary header */}
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--r-lg)',
              padding: '18px',
              marginBottom: 10,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 12 }}>
              За {days} дней · {activeDays} активных
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 14, color: 'var(--text-2)' }}>Всего калорий</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                {Math.round(totalCal).toLocaleString('ru')}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              Белки {totalP.toFixed(0)}г · Жиры {totalF.toFixed(0)}г · Углеводы {totalC.toFixed(0)}г
              {totalFib > 0 && ` · Клетчатка ${totalFib.toFixed(0)}г`}
            </div>
          </div>

          {/* Average per day */}
          <div style={{ marginBottom: 6 }}>
            <div className="section-title">Среднее в день</div>
          </div>

          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--r-lg)',
              padding: '16px 18px',
              marginBottom: 10,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 14 }}>
              <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: -1, color: 'var(--text)', lineHeight: 1 }}>
                {Math.round(avg(totalCal)).toLocaleString('ru')}
              </span>
              <span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 500 }}>ккал/день</span>
            </div>
            <MacroTiles
              protein={avg(totalP)}
              fat={avg(totalF)}
              carbs={avg(totalC)}
            />
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div style={{ fontSize: 15, color: 'var(--text-2)', fontWeight: 600, marginBottom: 6 }}>Нет данных</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Начни записывать приёмы пищи</div>
        </div>
      )}
    </div>
  );
}
