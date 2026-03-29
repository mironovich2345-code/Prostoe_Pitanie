import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { CalorieCard, MacroTiles } from '../../ui';
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
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.8, color: 'var(--text)', lineHeight: 1.1, marginBottom: 5 }}>
          {firstName ? `Привет, ${firstName}` : 'Привет'} 👋
        </h1>
        <div style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 400 }}>{dateLabel}</div>
      </div>

      {/* Calories hero */}
      {isLoading ? (
        <div className="card" style={{ padding: '28px 18px', marginBottom: 10 }}>
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
        <div className="card" style={{ padding: '28px 18px', marginBottom: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.3 }}>🍽</div>
          <div style={{ color: 'var(--text-2)', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Нет данных за сегодня</div>
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Добавь первый приём пищи</div>
        </div>
      )}

      {/* Primary CTA */}
      <button
        onClick={() => navigate('/add')}
        className="btn"
        style={{ marginBottom: 16, fontSize: 15 }}
      >
        + Добавить приём пищи
      </button>

      {/* Subscription */}
      {sub && (
        <div className="info-row" onClick={() => navigate('/subscription')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>💳</span>
            <span style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>Подписка</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusBadge status={sub.status} />
            <span style={{ color: 'var(--text-3)', fontSize: 16 }}>›</span>
          </div>
        </div>
      )}

      {/* Connected trainer */}
      {trainer && (
        <div className="info-row" onClick={() => navigate('/trainer')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🏋</span>
            <span style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>Тренер</span>
          </div>
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
