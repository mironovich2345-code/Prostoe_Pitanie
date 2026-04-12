import { useNavigate } from 'react-router-dom';

interface Props {
  onBack: () => void;
}

const SECTIONS = [
  { to: '/applications',  emoji: '📋', label: 'Заявки на верификацию', desc: 'Подтвердить или отклонить' },
  { to: '/experts',       emoji: '🎓', label: 'Верифицированные',      desc: 'Эксперты и компании, отзыв прав' },
  { to: '/user-search',   emoji: '🔍', label: 'Поиск пользователя',    desc: 'По chatId или @username' },
  { to: '/subscriptions', emoji: '🔑', label: 'Подписки',              desc: 'Ручное управление подпиской пользователя' },
  { to: '/payouts',       emoji: '💳', label: 'Выводы вознаграждения', desc: 'Управление статусами выплат' },
  { to: '/stats',         emoji: '📊', label: 'Статистика',            desc: 'Пользователи, оплаты, ИИ-расходы' },
];

export default function AdminDashboardScreen({ onBack }: Props) {
  const navigate = useNavigate();
  return (
    <div className="screen">
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', fontSize: 16, marginBottom: 12, padding: 0, color: 'var(--accent)', cursor: 'pointer' }}
      >
        ← Профиль
      </button>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, color: 'var(--text)', marginBottom: 6 }}>
        Администратор
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24, lineHeight: 1.5 }}>
        Управление платформой EATLYY
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SECTIONS.map(s => (
          <button
            key={s.to}
            onClick={() => navigate(s.to)}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              background: 'var(--surface)', borderRadius: 'var(--r-xl)',
              border: '1px solid var(--border)', padding: '16px 18px',
              cursor: 'pointer', textAlign: 'left', width: '100%',
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 14, flexShrink: 0,
              background: 'var(--accent-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>
              {s.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.desc}</div>
            </div>
            <span style={{ fontSize: 20, color: 'var(--accent)', flexShrink: 0 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
