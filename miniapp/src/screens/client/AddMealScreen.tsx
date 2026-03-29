/**
 * AddMealScreen — placeholder for the "Добавить" tab.
 * Future: text / photo / voice input for AI food analysis.
 */

import { useNavigate } from 'react-router-dom';

const METHODS = [
  {
    icon: '📝',
    title: 'Текстом',
    desc: 'Напиши, что съел — AI посчитает калории',
    soon: false,
  },
  {
    icon: '📷',
    title: 'Фото',
    desc: 'Сфотографируй блюдо для анализа',
    soon: true,
  },
  {
    icon: '🎤',
    title: 'Голосом',
    desc: 'Продиктуй приём пищи',
    soon: true,
  },
];

export default function AddMealScreen() {
  const navigate = useNavigate();

  return (
    <div className="screen">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: 'var(--text)', marginBottom: 6 }}>
          Добавить приём
        </h1>
        <div style={{ fontSize: 14, color: 'var(--text-3)' }}>Выбери способ добавления</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {METHODS.map(m => (
          <div
            key={m.title}
            onClick={() => !m.soon && navigate('/diary')}
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--r-lg)',
              padding: '18px',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              cursor: m.soon ? 'default' : 'pointer',
              opacity: m.soon ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            <div style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>{m.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{m.title}</span>
                {m.soon && (
                  <span
                    style={{
                      fontSize: 10, fontWeight: 700, color: 'var(--text-3)',
                      background: 'var(--surface-2)', borderRadius: 6,
                      padding: '2px 7px', letterSpacing: 0.4, textTransform: 'uppercase',
                    }}
                  >
                    Скоро
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{m.desc}</div>
            </div>
            {!m.soon && <span style={{ color: 'var(--text-3)', fontSize: 18 }}>›</span>}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>
          Пока работает через Telegram-бот
        </div>
        <button
          onClick={() => navigate('/diary')}
          className="btn btn-secondary"
          style={{ width: 'auto', padding: '10px 24px', display: 'inline-block' }}
        >
          Открыть дневник
        </button>
      </div>
    </div>
  );
}
