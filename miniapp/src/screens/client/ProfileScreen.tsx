import { useNavigate } from 'react-router-dom';
import type { BootstrapData } from '../../types';

interface Props { bootstrap: BootstrapData; }

export default function ProfileScreen({ bootstrap }: Props) {
  const navigate = useNavigate();
  const p = bootstrap.profile;
  return (
    <div className="screen">
      <h1 style={{ marginBottom: 16 }}>👤 Профиль</h1>
      {p && (
        <div className="card">
          <div className="card-title">Физические данные</div>
          {p.heightCm && <div className="stat-row"><span className="stat-label">📏 Рост</span><span className="stat-value">{p.heightCm} см</span></div>}
          {p.currentWeightKg && <div className="stat-row"><span className="stat-label">⚖️ Вес</span><span className="stat-value">{p.currentWeightKg} кг</span></div>}
          {p.desiredWeightKg && <div className="stat-row"><span className="stat-label">🎯 Желаемый вес</span><span className="stat-value">{p.desiredWeightKg} кг</span></div>}
          {p.city && <div className="stat-row"><span className="stat-label">🌍 Город</span><span className="stat-value">{p.city}</span></div>}
        </div>
      )}
      {p?.dailyCaloriesKcal && (
        <div className="card">
          <div className="card-title">Дневные нормы</div>
          <div className="stat-row"><span className="stat-label">🔥 Калории</span><span className="stat-value">{p.dailyCaloriesKcal} ккал</span></div>
          <div className="stat-row"><span className="stat-label">💪 Белки</span><span className="stat-value">{p.dailyProteinG} г</span></div>
          <div className="stat-row"><span className="stat-label">🧈 Жиры</span><span className="stat-value">{p.dailyFatG} г</span></div>
          <div className="stat-row"><span className="stat-label">🌾 Углеводы</span><span className="stat-value">{p.dailyCarbsG} г</span></div>
        </div>
      )}
      <div className="section-header">Разделы</div>
      <div className="card" style={{ padding: 0 }}>
        {[
          { label: '💳 Подписка', path: '/subscription' },
          { label: '🏋 Мой тренер', path: '/trainer' },
          { label: '🔔 Уведомления', path: '/notifications' },
        ].map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '14px 16px', background: 'none', border: 'none', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: 16 }}
          >
            <span>{item.label}</span><span style={{ color: 'var(--tg-theme-hint-color)' }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
