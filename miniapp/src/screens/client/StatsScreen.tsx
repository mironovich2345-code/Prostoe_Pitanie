import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { MacroTiles } from '../../ui';
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

      {/* Title */}
      <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, color: 'var(--text)', marginBottom: 20 }}>
        Отчёт
      </h1>

      {/* Period selector — segmented control */}
      <div className="period-tabs">
        {PERIODS.map(p => (
          <button
            key={p.days}
            onClick={() => setDays(p.days)}
            className={`period-tab${days === p.days ? ' active' : ''}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="card"><div style={{ color: 'var(--text-3)', fontSize: 14 }}>Загружаем...</div></div>
      ) : data && activeDays > 0 ? (
        <>
          {/* Total summary */}
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--r-lg)',
              padding: '18px',
              marginBottom: 10,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', marginBottom: 14 }}>
              За {days} дней · {activeDays} {activeDays === 1 ? 'активный день' : activeDays < 5 ? 'активных дня' : 'активных дней'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 14, color: 'var(--text-3)' }}>Всего калорий</span>
              <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.6, color: 'var(--text)' }}>
                {Math.round(totalCal).toLocaleString('ru')}
                <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}> ккал</span>
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>
              Белки {totalP.toFixed(0)}г · Жиры {totalF.toFixed(0)}г · Углеводы {totalC.toFixed(0)}г
              {totalFib > 0 && ` · Клетчатка ${totalFib.toFixed(0)}г`}
            </div>
          </div>

          {/* Average per day */}
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '2px 2px 10px', marginTop: 8 }}>
            Среднее в день
          </div>

          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--r-lg)',
              padding: '16px 18px 14px',
              marginBottom: 10,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 14 }}>
              <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1.2, color: 'var(--text)', lineHeight: 1 }}>
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
        <div style={{ textAlign: 'center', padding: '56px 24px 40px' }}>
          <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.25 }}>📊</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Нет данных</div>
          <div style={{ fontSize: 14, color: 'var(--text-3)' }}>Начни записывать приёмы пищи, чтобы увидеть статистику</div>
        </div>
      )}
    </div>
  );
}
