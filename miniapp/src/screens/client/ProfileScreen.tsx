import { useNavigate } from 'react-router-dom';
import type { BootstrapData, TrainerVerificationStatus } from '../../types';
import RoleSwitcher from '../../components/RoleSwitcher';

interface Props {
  bootstrap: BootstrapData;
  onSwitchToCoach?: () => void;
}

// Shown when trainer is not yet verified — status chip with navigation
function ExpertChip({ status }: { status: TrainerVerificationStatus | undefined }) {
  const navigate = useNavigate();

  if (status === 'pending') {
    return (
      <span
        onClick={() => navigate('/expert/status')}
        style={chipStyle('rgba(0,122,255,0.12)', 'var(--tg-theme-link-color, #007aff)')}
      >
        На проверке
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span
        onClick={() => navigate('/expert/status')}
        style={chipStyle('rgba(255,59,48,0.12)', '#ff3b30')}
      >
        Отклонено
      </span>
    );
  }
  if (status === 'blocked') {
    return (
      <span
        onClick={() => navigate('/expert/status')}
        style={chipStyle('rgba(120,120,128,0.16)', 'var(--tg-theme-hint-color, #8e8e93)')}
      >
        Заблокирован
      </span>
    );
  }
  // No application yet
  return (
    <button
      onClick={() => navigate('/expert/apply')}
      style={chipStyle('rgba(120,120,128,0.14)', 'var(--tg-theme-text-color, #000)')}
    >
      Стать экспертом
    </button>
  );
}

function chipStyle(bg: string, color: string): React.CSSProperties {
  return {
    display: 'inline-block',
    background: bg,
    color,
    border: 'none',
    borderRadius: 20,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    cursor: 'pointer',
  };
}

export default function ProfileScreen({ bootstrap, onSwitchToCoach }: Props) {
  const navigate = useNavigate();
  const trainerStatus = bootstrap.trainerProfile?.verificationStatus;
  const isVerified = trainerStatus === 'verified' && !!onSwitchToCoach;

  return (
    <div className="screen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>👤 Профиль</h1>
        {isVerified ? (
          <RoleSwitcher
            mode="client"
            onChange={(m) => { if (m === 'coach') onSwitchToCoach!(); }}
          />
        ) : (
          <ExpertChip status={trainerStatus} />
        )}
      </div>

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
