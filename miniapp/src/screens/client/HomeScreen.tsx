import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import NutritionSummary from '../../components/NutritionSummary';
import StatusBadge from '../../components/StatusBadge';
import type { BootstrapData } from '../../types';

interface Props { bootstrap: BootstrapData; }

export default function HomeScreen({ bootstrap }: Props) {
  const navigate = useNavigate();
  const { data: today, isLoading } = useQuery({ queryKey: ['nutrition-today'], queryFn: api.nutritionToday });
  const profile = bootstrap.profile;
  const sub = bootstrap.subscription;
  const today_ = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="screen">
      <h1 style={{ marginBottom: 4, fontSize: 22 }}>Привет 👋</h1>
      <div style={{ color: 'var(--tg-theme-hint-color, #888)', marginBottom: 16 }}>{today_}</div>
      {isLoading ? (
        <div className="card"><div style={{ color: 'var(--tg-theme-hint-color)' }}>Загружаем данные...</div></div>
      ) : today ? (
        <div className="card">
          <div className="card-title">Питание сегодня</div>
          <NutritionSummary
            calories={today.totals.calories}
            protein={today.totals.protein}
            fat={today.totals.fat}
            carbs={today.totals.carbs}
            fiber={today.totals.fiber}
            normCalories={profile?.dailyCaloriesKcal}
            normProtein={profile?.dailyProteinG}
            normFat={profile?.dailyFatG}
            normCarbs={profile?.dailyCarbsG}
          />
          <div style={{ marginTop: 12, color: 'var(--tg-theme-hint-color)', fontSize: 13 }}>Приёмов пищи: {today.meals.length}</div>
        </div>
      ) : null}
      <div className="card">
        <div className="card-title">Подписка</div>
        {sub ? <StatusBadge status={sub.status} /> : <StatusBadge status="free" />}
        {sub?.currentPeriodEnd && (
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--tg-theme-hint-color)' }}>
            До {new Date(sub.currentPeriodEnd).toLocaleDateString('ru-RU')}
          </div>
        )}
      </div>
      {bootstrap.connectedTrainer && (
        <div className="card">
          <div className="card-title">Тренер</div>
          <div>{bootstrap.connectedTrainer.name ?? 'Тренер подключён'}</div>
          {bootstrap.connectedTrainer.fullHistoryAccess && (
            <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)', marginTop: 4 }}>Полный доступ к истории</div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn" style={{ flex: 1 }} onClick={() => navigate('/stats')}>📊 Статистика</button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/diary')}>📋 Дневник</button>
      </div>
    </div>
  );
}
