import { Outlet, NavLink } from 'react-router-dom';

function OffersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="4" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="18" cy="17" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="6.4" y1="12.3" x2="15.6" y2="16.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="15.6" y1="5.8" x2="6.4" y2="9.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function StatsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <line x1="4" y1="18" x2="4" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="9" y1="18" x2="9" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="14" y1="18" x2="14" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="19" y1="18" x2="19" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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

const NAV = [
  { to: '/',        icon: <OffersIcon />,  label: 'Офферы',    end: true  },
  { to: '/stats',   icon: <StatsIcon />,   label: 'Статистика', end: false },
  { to: '/profile', icon: <ProfileIcon />, label: 'Профиль',   end: false },
];

export default function CompanyLayout() {
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
