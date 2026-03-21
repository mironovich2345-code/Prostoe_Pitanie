import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import NutritionSummary from '../../components/NutritionSummary';
import type { MealEntry, UserProfile } from '../../types';

export default function CoachClientStatsScreen() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['trainer-client-stats', clientId], queryFn: () => api.trainerClientStats(clientId!) });
  if (isLoading) return <div className="loading"><div className="spinner" /></div>;
  const todayMeals: MealEntry[] = data?.todayMeals ?? [];
  const recentMeals: MealEntry[] = data?.recentMeals ?? [];
  const profile = data?.profile as UserProfile | null;
  const todayProt = todayMeals.reduce((s, m) => s + (m.proteinG ?? 0), 0);
  const todayFat = todayMeals.reduce((s, m) => s + (m.fatG ?? 0), 0);
  const todayCarbs = todayMeals.reduce((s, m) => s + (m.carbsG ?? 0), 0);
  return (
    <div className="screen">
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: 16, marginBottom: 12, padding: 0, color: 'var(--tg-theme-link-color)' }}>← Назад</button>
      <h1 style={{ marginBottom: 16 }}>📊 Статистика клиента</h1>
      <div className="card">
        <div className="card-title">Сегодня</div>
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
      </div>
      {recentMeals.length > 0 && (
        <div className="card">
          <div className="card-title">Последние записи</div>
          {recentMeals.slice(0, 10).map((m: MealEntry) => (
            <div key={m.id} className="meal-item">
              <div className="meal-item-header"><span>{m.text}</span><span>{m.caloriesKcal ?? '—'} ккал</span></div>
              <div className="meal-item-meta">{new Date(m.createdAt).toLocaleDateString('ru-RU')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
