import { useNavigate } from 'react-router-dom';
import type { BootstrapData, TrainerVerificationStatus } from '../../types';
import RoleSwitcher from '../../components/RoleSwitcher';

interface Props {
  bootstrap: BootstrapData;
  onSwitchToCoach?: () => void;
}

function ExpertChip({ status }: { status: TrainerVerificationStatus | undefined }) {
  const navigate = useNavigate();
  if (status === 'pending') return <span onClick={() => navigate('/expert/status')} style={chipStyle('rgba(0,122,255,0.12)', 'var(--tg-theme-link-color, #007aff)')}>На проверке</span>;
  if (status === 'rejected') return <span onClick={() => navigate('/expert/status')} style={chipStyle('rgba(255,59,48,0.12)', '#ff3b30')}>Отклонено</span>;
  if (status === 'blocked') return <span onClick={() => navigate('/expert/status')} style={chipStyle('rgba(120,120,128,0.16)', 'var(--tg-theme-hint-color, #8e8e93)')}>Заблокирован</span>;
  return <button onClick={() => navigate('/expert/apply')} style={chipStyle('rgba(120,120,128,0.14)', 'var(--tg-theme-text-color, #000)')}>Стать экспертом</button>;
}

function chipStyle(bg: string, color: string): React.CSSProperties {
  return { display: 'inline-block', background: bg, color, border: 'none', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer' };
}

const SEX_LABELS: Record<string, string> = { male: 'Мужской', female: 'Женский' };
const ACTIVITY_LABELS: Record<number, string> = {
  1.2: 'Почти нет', 1.375: 'Лёгкая', 1.55: 'Средняя', 1.725: 'Высокая', 1.9: 'Очень высокая',
};

export default function ProfileScreen({ bootstrap, onSwitchToCoach }: Props) {
  const navigate = useNavigate();
  const p = bootstrap.profile;
  const trainerStatus = bootstrap.trainerProfile?.verificationStatus;
  const isVerified = trainerStatus === 'verified' && !!onSwitchToCoach;

  const age = p?.birthDate
    ? Math.floor((Date.now() - new Date(p.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const activityLabel = p?.activityLevel
    ? ACTIVITY_LABELS[p.activityLevel] ?? String(p.activityLevel)
    : null;

  return (
    <div className="screen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>👤 Профиль</h1>
        {isVerified ? (
          <RoleSwitcher mode="client" onChange={(m) => { if (m === 'coach') onSwitchToCoach!(); }} />
        ) : (
          <ExpertChip status={trainerStatus} />
        )}
      </div>

      {/* Physical data */}
      {p && (p.heightCm || p.currentWeightKg || p.sex) && (
        <div className="card">
          <div className="card-title">Физические данные</div>
          {p.sex && <div className="stat-row"><span className="stat-label">👤 Пол</span><span className="stat-value">{SEX_LABELS[p.sex] ?? p.sex}</span></div>}
          {p.heightCm && <div className="stat-row"><span className="stat-label">📏 Рост</span><span className="stat-value">{p.heightCm} см</span></div>}
          {p.currentWeightKg && <div className="stat-row"><span className="stat-label">⚖️ Вес</span><span className="stat-value">{p.currentWeightKg} кг</span></div>}
          {p.desiredWeightKg && <div className="stat-row"><span className="stat-label">🎯 Желаемый вес</span><span className="stat-value">{p.desiredWeightKg} кг</span></div>}
          {age && <div className="stat-row"><span className="stat-label">🎂 Возраст</span><span className="stat-value">{age} лет</span></div>}
          {activityLabel && <div className="stat-row"><span className="stat-label">⚡ Активность</span><span className="stat-value">{activityLabel}</span></div>}
          {p.city && <div className="stat-row"><span className="stat-label">🌍 Город</span><span className="stat-value">{p.city}</span></div>}
        </div>
      )}

      {/* Daily norms */}
      {p?.dailyCaloriesKcal && (
        <div className="card">
          <div className="card-title">Дневные нормы</div>
          <div className="stat-row"><span className="stat-label">🔥 Калории</span><span className="stat-value">{p.dailyCaloriesKcal} ккал</span></div>
          <div className="stat-row"><span className="stat-label">💪 Белки</span><span className="stat-value">{p.dailyProteinG} г</span></div>
          <div className="stat-row"><span className="stat-label">🧈 Жиры</span><span className="stat-value">{p.dailyFatG} г</span></div>
          <div className="stat-row"><span className="stat-label">🌾 Углеводы</span><span className="stat-value">{p.dailyCarbsG} г</span></div>
        </div>
      )}

      {/* Edit physical data — prominent entry */}
      <button
        onClick={() => navigate('/profile/edit-data')}
        className="btn btn-secondary"
        style={{ width: '100%', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', fontSize: 16 }}
      >
        <span>✏️ Мои физические данные</span>
        <span style={{ color: 'var(--tg-theme-hint-color)' }}>›</span>
      </button>

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
