import { useNavigate } from 'react-router-dom';
import StatusBadge from '../../components/StatusBadge';
import type { BootstrapData } from '../../types';

interface Props { bootstrap: BootstrapData; }

const PLAN_LABELS: Record<string, string> = { free: 'Бесплатный', basic: 'Базовый', pro: 'Про' };

export default function SubscriptionScreen({ bootstrap }: Props) {
  const navigate = useNavigate();
  const sub = bootstrap.subscription;
  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => navigate('/profile')} style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--tg-theme-button-color, #007aff)' }}>‹</button>
        <h1 style={{ margin: 0 }}>💳 Подписка</h1>
      </div>
      <div className="card">
        <div className="card-title">Текущий тариф</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{sub ? (PLAN_LABELS[sub.planId] ?? sub.planId) : 'Бесплатный'}</div>
          <StatusBadge status={sub?.status ?? 'free'} />
        </div>
        {sub?.trialEndsAt && (
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--tg-theme-hint-color)' }}>
            Пробный период до {new Date(sub.trialEndsAt).toLocaleDateString('ru-RU')}
          </div>
        )}
        {sub?.currentPeriodEnd && (
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--tg-theme-hint-color)' }}>
            Действует до {new Date(sub.currentPeriodEnd).toLocaleDateString('ru-RU')}
          </div>
        )}
        {sub?.autoRenew && (
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--tg-theme-hint-color)' }}>Автопродление включено</div>
        )}
      </div>
      <div className="card" style={{ textAlign: 'center', color: 'var(--tg-theme-hint-color)', fontSize: 14 }}>
        <div style={{ marginBottom: 8 }}>💡 Управление подпиской доступно в боте</div>
      </div>
    </div>
  );
}
