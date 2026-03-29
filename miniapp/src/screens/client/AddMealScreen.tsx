import { useNavigate } from 'react-router-dom';

export default function AddMealScreen() {
  const navigate = useNavigate();

  return (
    <div className="screen">

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, color: 'var(--text)', marginBottom: 5 }}>
          Добавить приём
        </h1>
        <div style={{ fontSize: 14, color: 'var(--text-3)' }}>Выбери способ добавления</div>
      </div>

      {/* Active method — Текстом */}
      <div
        onClick={() => navigate('/diary')}
        className="method-card active"
        style={{ marginBottom: 8 }}
      >
        <div
          style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'var(--accent-soft)',
            border: '1px solid rgba(215,255,63,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
          }}
        >
          📝
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>Текстом</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Напиши, что съел — AI посчитает калории</div>
        </div>
        <span style={{ color: 'var(--accent)', fontSize: 20, flexShrink: 0 }}>›</span>
      </div>

      {/* Divider label */}
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-3)', padding: '12px 2px 8px' }}>
        Скоро
      </div>

      {/* Soon methods */}
      {[
        { icon: '📷', title: 'Фото', desc: 'Сфотографируй блюдо для анализа' },
        { icon: '🎤', title: 'Голосом', desc: 'Продиктуй приём пищи' },
      ].map(m => (
        <div key={m.title} className="method-card soon" style={{ marginBottom: 8 }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'var(--surface-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
            }}
          >
            {m.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{m.title}</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{m.desc}</div>
          </div>
        </div>
      ))}

      {/* Hint */}
      <div style={{ marginTop: 24, padding: '14px 16px', background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
          Пока все способы добавления работают через Telegram-бот.
          Введи приём пищи текстом — и AI рассчитает калории и БЖУ.
        </div>
      </div>

    </div>
  );
}
