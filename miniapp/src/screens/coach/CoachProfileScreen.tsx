import { useNavigate } from 'react-router-dom';
import type { BootstrapData } from '../../types';
import StatusBadge from '../../components/StatusBadge';

interface Props { bootstrap: BootstrapData; }

export default function CoachProfileScreen({ bootstrap }: Props) {
  const navigate = useNavigate();
  const tp = bootstrap.trainerProfile;
  return (
    <div className="screen">
      <h1 style={{ marginBottom: 16 }}>👤 Профиль тренера</h1>
      <div className="card">
        <div className="card-title">Статус</div>
        <StatusBadge status={tp?.verificationStatus ?? 'pending'} />
        {tp?.specialization && <div style={{ marginTop: 8, fontSize: 14 }}>Специализация: {tp.specialization}</div>}
        {tp?.referralCode && <div style={{ marginTop: 4, fontSize: 14, color: 'var(--tg-theme-hint-color)' }}>Реферальный код: {tp.referralCode}</div>}
      </div>
      <div className="section-header">Финансы</div>
      <div className="card" style={{ padding: 0 }}>
        {[
          { label: '🎯 Рефералы', path: '/referrals' },
          { label: '💰 Начисления и вывод', path: '/payouts' },
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
