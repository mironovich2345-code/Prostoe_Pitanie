import { useNavigate } from 'react-router-dom';
import type { BootstrapData, TrainerVerificationStatus } from '../../types';
import { Card, PageHeader, ListCard, ListItem, Button, Chip } from '../../ui';
import RoleSwitcher from '../../components/RoleSwitcher';

interface Props {
  bootstrap: BootstrapData;
  onSwitchToCoach?: () => void;
}

function ExpertChip({ status }: { status: TrainerVerificationStatus | undefined }) {
  const navigate = useNavigate();
  if (status === 'pending')
    return <Chip variant="purple" onClick={() => navigate('/expert/status')} style={{ cursor: 'pointer' }}>На проверке</Chip>;
  if (status === 'rejected')
    return <Chip variant="danger" onClick={() => navigate('/expert/status')} style={{ cursor: 'pointer' }}>Отклонено</Chip>;
  if (status === 'blocked')
    return <Chip variant="muted" onClick={() => navigate('/expert/status')} style={{ cursor: 'pointer' }}>Заблокирован</Chip>;
  return (
    <button
      onClick={() => navigate('/expert/apply')}
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}
    >
      Стать экспертом
    </button>
  );
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
  const activityLabel = p?.activityLevel ? (ACTIVITY_LABELS[p.activityLevel] ?? String(p.activityLevel)) : null;

  return (
    <div className="screen">
      <PageHeader
        title="Профиль"
        right={
          isVerified ? (
            <RoleSwitcher mode="client" onChange={m => { if (m === 'coach') onSwitchToCoach!(); }} />
          ) : (
            <ExpertChip status={trainerStatus} />
          )
        }
      />

      {/* Physical data */}
      {p && (p.heightCm || p.currentWeightKg || p.sex) && (
        <Card>
          <div className="card-title">Физические данные</div>
          {p.sex        && <div className="stat-row"><span className="stat-label">Пол</span><span className="stat-value">{SEX_LABELS[p.sex] ?? p.sex}</span></div>}
          {p.heightCm   && <div className="stat-row"><span className="stat-label">Рост</span><span className="stat-value">{p.heightCm} см</span></div>}
          {p.currentWeightKg && <div className="stat-row"><span className="stat-label">Вес</span><span className="stat-value">{p.currentWeightKg} кг</span></div>}
          {p.desiredWeightKg && <div className="stat-row"><span className="stat-label">Желаемый вес</span><span className="stat-value">{p.desiredWeightKg} кг</span></div>}
          {age          && <div className="stat-row"><span className="stat-label">Возраст</span><span className="stat-value">{age} лет</span></div>}
          {activityLabel && <div className="stat-row"><span className="stat-label">Активность</span><span className="stat-value">{activityLabel}</span></div>}
          {p.city       && <div className="stat-row"><span className="stat-label">Город</span><span className="stat-value">{p.city}</span></div>}
        </Card>
      )}

      {/* Daily norms */}
      {p?.dailyCaloriesKcal && (
        <Card>
          <div className="card-title">Дневные нормы</div>
          <div className="stat-row"><span className="stat-label">Калории</span><span className="stat-value" style={{ color: 'var(--accent)' }}>{p.dailyCaloriesKcal} ккал</span></div>
          <div className="stat-row"><span className="stat-label">Белки</span><span className="stat-value" style={{ color: 'var(--macro-p)' }}>{p.dailyProteinG} г</span></div>
          <div className="stat-row"><span className="stat-label">Жиры</span><span className="stat-value" style={{ color: 'var(--macro-f)' }}>{p.dailyFatG} г</span></div>
          <div className="stat-row"><span className="stat-label">Углеводы</span><span className="stat-value" style={{ color: 'var(--macro-c)' }}>{p.dailyCarbsG} г</span></div>
        </Card>
      )}

      {/* Edit physical data */}
      <Button
        variant="secondary"
        onClick={() => navigate('/profile/edit-data')}
        style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', fontSize: 15 }}
      >
        <span>✏️ Мои физические данные</span>
        <span style={{ color: 'var(--text-3)' }}>›</span>
      </Button>

      {/* Sections */}
      <div className="section-title">Разделы</div>
      <ListCard>
        {[
          { label: '💳 Подписка',    path: '/subscription' },
          { label: '🏋 Мой тренер',  path: '/trainer' },
          { label: '🔔 Уведомления', path: '/notifications' },
        ].map(item => (
          <ListItem key={item.path} label={item.label} onClick={() => navigate(item.path)} />
        ))}
      </ListCard>
    </div>
  );
}
