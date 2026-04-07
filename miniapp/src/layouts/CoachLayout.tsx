import { Outlet, NavLink } from 'react-router-dom';

// ─── Nav SVG Icons ─────────────────────────────────────────────────────────
function ClientsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="8" cy="7.5" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 19c0-3.314 2.686-6 6-6s6 2.686 6 6"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="16" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M20 19c0-2.761-1.791-5-4-5.5"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function AlertsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M11 3a6 6 0 0 0-6 6v2.5L3.5 14h15L17 11.5V9a6 6 0 0 0-6-6z"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 17a2 2 0 0 0 4 0"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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

// ─── Nav config ─────────────────────────────────────────────────────────────
const NAV = [
  { to: '/',        icon: <ClientsIcon />, label: 'Клиенты', end: true  },
  { to: '/alerts',  icon: <AlertsIcon />,  label: 'Дашборд', end: false },
  { to: '/profile', icon: <ProfileIcon />, label: 'Профиль', end: false },
];

export default function CoachLayout() {
  return (
    <div>
      <Outlet />
      <nav className="bottom-nav">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
