import { Outlet, NavLink } from 'react-router-dom';

export default function CoachLayout() {
  return (
    <div>
      <Outlet />
      <nav className="bottom-nav">
        <NavLink to="/" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`} end>
          <span className="bottom-nav-icon">👥</span><span>Клиенты</span>
        </NavLink>
        <NavLink to="/alerts" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <span className="bottom-nav-icon">🔔</span><span>Дашборд</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <span className="bottom-nav-icon">👤</span><span>Профиль</span>
        </NavLink>
      </nav>
    </div>
  );
}
