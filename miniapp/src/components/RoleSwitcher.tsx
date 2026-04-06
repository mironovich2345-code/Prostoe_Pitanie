import type { AppMode } from '../types';

interface Props { mode: AppMode; onChange: (m: AppMode) => void; }

export default function RoleSwitcher({ mode, onChange }: Props) {
  return (
    <div style={{
      display: 'inline-flex',
      background: 'var(--surface-2)',
      borderRadius: 11,
      padding: 3,
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
              padding: '4px 14px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              background: active ? 'var(--surface-3)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text-3)',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
              transition: 'background 0.15s, color 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {m === 'client' ? 'Клиент' : 'Эксперт'}
          </button>
        );
      })}
    </div>
  );
}
