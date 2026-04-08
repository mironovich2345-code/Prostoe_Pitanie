import type { AppMode } from '../types';

interface Props {
  mode: AppMode;
  onChange: (m: AppMode) => void;
  expertLabel?: string;
  fullWidth?: boolean;
}

export default function RoleSwitcher({ mode, onChange, expertLabel = 'Эксперт', fullWidth = false }: Props) {
  return (
    <div style={{
      display: fullWidth ? 'flex' : 'inline-flex',
      width: fullWidth ? '100%' : undefined,
      background: 'var(--surface-2)',
      borderRadius: 12,
      padding: 4,
      flexShrink: 0,
      border: '1px solid var(--border)',
    }}>
      {(['client', 'coach'] as AppMode[]).map(m => {
        const active = mode === m;
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            style={{
              flex: fullWidth ? 1 : undefined,
              padding: '9px 20px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 9,
              border: 'none',
              cursor: 'pointer',
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? '#000' : 'var(--text-3)',
              boxShadow: active ? '0 1px 4px rgba(0,0,0,0.35)' : 'none',
              transition: 'background 0.15s, color 0.15s',
              whiteSpace: 'nowrap',
              letterSpacing: -0.1,
            }}
          >
            {m === 'client' ? 'Клиент' : expertLabel}
          </button>
        );
      })}
    </div>
  );
}
