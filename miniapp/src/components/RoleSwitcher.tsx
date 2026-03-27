import type { AppMode } from '../types';

interface Props { mode: AppMode; onChange: (m: AppMode) => void; }

export default function RoleSwitcher({ mode, onChange }: Props) {
  return (
    <div style={{
      display: 'inline-flex',
      background: 'rgba(120,120,128,0.16)',
      borderRadius: 9,
      padding: 2,
      flexShrink: 0,
    }}>
      {(['client', 'coach'] as AppMode[]).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 7,
              border: 'none',
              cursor: 'pointer',
              background: active ? 'var(--tg-theme-bg-color, #fff)' : 'transparent',
              color: active
                ? 'var(--tg-theme-text-color, #000)'
                : 'var(--tg-theme-hint-color, #8e8e93)',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
              transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {m === 'client' ? 'Клиент' : 'Тренер'}
          </button>
        );
      })}
    </div>
  );
}
