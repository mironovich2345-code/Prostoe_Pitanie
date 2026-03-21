import type { AppMode } from '../types';

interface Props { mode: AppMode; onChange: (m: AppMode) => void; }

export default function RoleSwitcher({ mode, onChange }: Props) {
  return (
    <div className="role-switcher">
      <button className={`role-tab ${mode === 'client' ? 'active' : ''}`} onClick={() => onChange('client')}>👤 Клиент</button>
      <button className={`role-tab ${mode === 'coach' ? 'active' : ''}`} onClick={() => onChange('coach')}>🏋 Тренер</button>
    </div>
  );
}
