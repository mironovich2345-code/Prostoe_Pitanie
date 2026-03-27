import { useNavigate } from 'react-router-dom';
import type { BootstrapData, TrainerVerificationStatus } from '../../types';

interface Props {
  bootstrap: BootstrapData;
  onSwitchToCoach?: () => void;
}

function ExpertChip({ status, onSwitchToCoach }: { status: TrainerVerificationStatus | undefined; onSwitchToCoach?: () => void }) {
  const navigate = useNavigate();

  if (status === 'verified') {
    return (
      <button
        onClick={onSwitchToCoach}
        style={chipStyle('var(--tg-theme-button-color, #007aff)', '#fff')}
      >
        Режим эксперта
      </button>
    );
  }
  if (status === 'pending') {
    return (
      <span
        onClick={() => navigate('/expert/status')}
        style={{ ...chipStyle('#d6eaff', '#004085'), cursor: 'pointer' }}
      >
        На проверке
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span
        onClick={() => navigate('/expert/status')}
        style={{ ...chipStyle('#f8d7da', '#721c24'), cursor: 'pointer' }}
      >
        Отклонено
      </span>
    );
  }
  if (status === 'blocked') {
    return (
      <span
        onClick={() => navigate('/expert/status')}
        style={{ ...chipStyle('#f0f0f0', '#555'), cursor: 'pointer' }}
      >
        Заблокирован
      </span>
    );
  }
  // No application yet
  return (
    <button
      onClick={() => navigate('/expert/apply')}
      style={chipStyle('rgba(0,0,0,0.06)', 'var(--tg-theme-text-color, #000)')}
    >
      Стать экспертом
    </button>
  );
}

function chipStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg,
    color,
    border: 'none',
    borderRadius: 20,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };
}

export default function ProfileScreen({ bootstrap, onSwitchToCoach }: Props) {
  const navigate = useNavigate();
  const p = bootstrap.profile;
  const trainerStatus = bootstrap.trainerProfile?.verificationStatus;

  return (
    <div className="screen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>👤 Профиль</h1>
        <ExpertChip status={trainerStatus} onSwitchToCoach={onSwitchToCoach} />
      </div>
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
