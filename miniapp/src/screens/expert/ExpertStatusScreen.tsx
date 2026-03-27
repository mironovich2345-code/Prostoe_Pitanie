import { useNavigate } from 'react-router-dom';
import { useBootstrap } from '../../hooks/useBootstrap';

export default function ExpertStatusScreen() {
  const navigate = useNavigate();
  const { data: bootstrap } = useBootstrap();
  const status = bootstrap?.trainerProfile?.verificationStatus;

  const config: Record<string, { icon: string; title: string; text: string; action?: { label: string; to: string } }> = {
    pending: {
      icon: '⏳',
      title: 'Заявка на проверке',
      text: 'Мы проверяем твою заявку. Обычно это занимает 1–3 рабочих дня. После решения ты получишь уведомление в Telegram.',
    },
    rejected: {
      icon: '❌',
      title: 'Заявка отклонена',
      text: 'К сожалению, твоя заявка не прошла проверку. Ты можешь исправить данные и подать повторно.',
      action: { label: 'Подать заново', to: '/expert/apply' },
    },
    blocked: {
      icon: '🚫',
      title: 'Доступ заблокирован',
      text: 'Тренерский аккаунт заблокирован. Если считаешь это ошибкой — обратись в поддержку.',
    },
  };

  const current = config[status ?? ''] ?? config['pending'];

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate('/profile')}
          style={{ background: 'none', border: 'none', fontSize: 22, padding: 0, color: 'var(--tg-theme-button-color, #007aff)' }}
        >
          ‹
        </button>
        <h1 style={{ margin: 0, fontSize: 20 }}>Статус заявки</h1>
      </div>

      <div style={{ textAlign: 'center', padding: '32px 0 24px' }}>
        <div style={{ fontSize: 64 }}>{current.icon}</div>
        <h2 style={{ margin: '16px 0 8px' }}>{current.title}</h2>
        <p style={{ color: 'var(--tg-theme-hint-color, #888)', lineHeight: 1.6, maxWidth: 280, margin: '0 auto 24px' }}>
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
