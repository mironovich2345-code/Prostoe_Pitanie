import { useNavigate } from 'react-router-dom';
import { useBootstrap } from '../../hooks/useBootstrap';

const STATUS_CONFIG: Record<string, {
  svgPath: React.ReactNode;
  iconColor: string;
  title: string;
  text: string;
  action?: { label: string; to: string };
}> = {
  pending: {
    svgPath: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    iconColor: 'var(--warn)',
    title: 'Заявка на проверке',
    text: 'Мы проверяем твою заявку. Обычно это занимает 1–3 рабочих дня. После решения ты получишь уведомление в Telegram.',
  },
  rejected: {
    svgPath: <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>,
    iconColor: 'var(--danger)',
    title: 'Заявка отклонена',
    text: 'К сожалению, твоя заявка не прошла проверку. Ты можешь исправить данные и подать повторно.',
    action: { label: 'Подать заново', to: '/expert/apply' },
  },
  blocked: {
    svgPath: <><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></>,
    iconColor: 'var(--danger)',
    title: 'Доступ заблокирован',
    text: 'Тренерский аккаунт заблокирован. Если считаешь это ошибкой — обратись в поддержку.',
  },
};

export default function ExpertStatusScreen() {
  const navigate = useNavigate();
  const { data: bootstrap } = useBootstrap();
  const status = bootstrap?.trainerProfile?.verificationStatus;
  const current = STATUS_CONFIG[status ?? ''] ?? STATUS_CONFIG['pending'];

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate('/profile')}
          style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
        >
          ‹
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Статус заявки</h1>
      </div>

      <div style={{ textAlign: 'center', padding: '32px 0 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--surface)', border: `2px solid ${current.iconColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={current.iconColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {current.svgPath}
            </svg>
          </div>
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{current.title}</h2>
        <p style={{ color: 'var(--text-3)', lineHeight: 1.6, maxWidth: 280, margin: '0 auto 24px', fontSize: 14 }}>
          {current.text}
        </p>
        {current.action && (
          <button className="btn" onClick={() => navigate(current.action!.to)}>
            {current.action.label}
          </button>
        )}
      </div>

      {bootstrap?.trainerProfile?.fullName && (
        <div className="card">
          <div className="card-title">Поданная заявка</div>
          <div className="stat-row">
            <span className="stat-label">Имя</span>
            <span className="stat-value" style={{ fontSize: 14 }}>{bootstrap.trainerProfile.fullName}</span>
          </div>
          {bootstrap.trainerProfile.specialization && (
            <div className="stat-row">
              <span className="stat-label">Специализация</span>
              <span className="stat-value" style={{ fontSize: 14 }}>{bootstrap.trainerProfile.specialization}</span>
            </div>
          )}
          {bootstrap.trainerProfile.appliedAt && (
            <div className="stat-row">
              <span className="stat-label">Дата подачи</span>
              <span className="stat-value" style={{ fontSize: 14 }}>
                {new Date(bootstrap.trainerProfile.appliedAt).toLocaleDateString('ru-RU')}
              </span>
            </div>
          )}
        </div>
      )}

      <button className="btn btn-secondary" onClick={() => navigate('/profile')} style={{ marginTop: 8 }}>
        Вернуться в профиль
      </button>
    </div>
  );
}
