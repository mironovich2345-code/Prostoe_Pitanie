import { Outlet, NavLink } from 'react-router-dom';

const NAV = [
  { to: '/',        icon: '🏠', label: 'Главная',  end: true,  isAdd: false },
  { to: '/diary',   icon: '📋', label: 'Дневник',  end: false, isAdd: false },
  { to: '/add',     icon: '+',  label: 'Добавить', end: false, isAdd: true  },
  { to: '/stats',   icon: '📊', label: 'Статистика', end: false, isAdd: false },
  { to: '/profile', icon: '👤', label: 'Профиль',  end: false, isAdd: false },
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
