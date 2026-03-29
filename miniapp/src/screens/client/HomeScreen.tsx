import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { CalorieCard, MacroTiles, Button } from '../../ui';
import StatusBadge from '../../components/StatusBadge';
import type { BootstrapData } from '../../types';

interface Props { bootstrap: BootstrapData; }

export default function HomeScreen({ bootstrap }: Props) {
  const navigate = useNavigate();
  const { data: today, isLoading } = useQuery({ queryKey: ['nutrition-today'], queryFn: api.nutritionToday });

  const profile = bootstrap.profile;
  const sub = bootstrap.subscription;
  const trainer = bootstrap.connectedTrainer;

  const user = bootstrap.telegramUser;
  const firstName = user?.first_name ?? '';

  const weekday = new Date().toLocaleDateString('ru-RU', { weekday: 'long' });
  const dateStr = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const dateLabel = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${dateStr}`;

  return (
    <div className="screen">
      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.6, color: 'var(--text)', lineHeight: 1.1 }}>
          Привет{firstName ? `, ${firstName}` : ''} 👋
        </h1>
        <div style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 4 }}>{dateLabel}</div>
      </div>

      {/* Calories */}
      {isLoading ? (
        <div className="card" style={{ padding: '24px 18px' }}>
          <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Загружаем...</div>
        </div>
      ) : today ? (
        <>
          <CalorieCard
            calories={Math.round(today.totals.calories)}
            norm={profile?.dailyCaloriesKcal}
            mealCount={today.meals.length}
          />
          <MacroTiles
            protein={today.totals.protein}
            fat={today.totals.fat}
            carbs={today.totals.carbs}
            normProtein={profile?.dailyProteinG}
            normFat={profile?.dailyFatG}
            normCarbs={profile?.dailyCarbsG}
          />
        </>
      ) : (
        <div className="card">
          <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Нет данных за сегодня</div>
        </div>
      )}

      {/* CTA */}
      <div style={{ marginTop: 16, marginBottom: 10 }}>
        <Button onClick={() => navigate('/diary')}>
          📋 Дневник питания
        </Button>
      </div>

      {/* Subscription — compact */}
      {sub && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--surface)', borderRadius: 'var(--r-md)',
            padding: '13px 16px', border: '1px solid var(--border)',
            marginBottom: 10, cursor: 'pointer',
          }}
          onClick={() => navigate('/subscription')}
        >
          <span style={{ fontSize: 14, color: 'var(--text-2)' }}>Подписка</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatusBadge status={sub.status} />
            <span style={{ color: 'var(--text-3)', fontSize: 16 }}>›</span>
          </div>
        </div>
      )}

      {/* Connected trainer — compact */}
      {trainer && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--surface)', borderRadius: 'var(--r-md)',
            padding: '13px 16px', border: '1px solid var(--border)',
            marginBottom: 10, cursor: 'pointer',
          }}
          onClick={() => navigate('/trainer')}
        >
          <span style={{ fontSize: 14, color: 'var(--text-2)' }}>Тренер</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
              {trainer.name ?? 'Подключён'}
            </span>
            <span style={{ color: 'var(--text-3)', fontSize: 16 }}>›</span>
          </div>
        </div>
      )}
    </div>
  );
}
