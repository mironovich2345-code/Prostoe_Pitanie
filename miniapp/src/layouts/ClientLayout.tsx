import { Outlet, NavLink } from 'react-router-dom';

// ─── Nav SVG Icons ─────────────────────────────────────────────────────────
function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M11 3L3 10.5V19h5.5v-5h5v5H19v-8.5L11 3z"
            stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}
function DiaryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="4" y="3" width="14" height="16" rx="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 8h6M8 12h6M8 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function StatsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M4 17V11M8 17V7M12 17V9M16 17V4"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M3 17h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 19c0-3.866 3.134-7 7-7s7 3.134 7 7"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Nav config ────────────────────────────────────────────────────────────
const NAV: Array<{
  to: string;
  icon: React.ReactNode;
  label: string;
  end: boolean;
  isAdd: boolean;
}> = [
  { to: '/',        icon: <HomeIcon />,    label: 'Главная',    end: true,  isAdd: false },
  { to: '/diary',   icon: <DiaryIcon />,   label: 'Дневник',    end: false, isAdd: false },
  { to: '/add',     icon: '+',             label: 'Добавить',   end: false, isAdd: true  },
  { to: '/stats',   icon: <StatsIcon />,   label: 'Статистика', end: false, isAdd: false },
  { to: '/profile', icon: <ProfileIcon />, label: 'Профиль',    end: false, isAdd: false },
];

export default function ClientLayout() {
  return (
    <div>
      <Outlet />
      <nav className="bottom-nav">
        {NAV.map(item =>
          item.isAdd ? (
            <NavLink key={item.to} to={item.to} className="bottom-nav-item">
              <div className="nav-add-pill">{item.icon}</div>
              <span>{item.label}</span>
            </NavLink>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
            >
              <span className="bottom-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          )
        )}
      </nav>
    </div>
  );
}
