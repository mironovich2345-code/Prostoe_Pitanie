import { Outlet, NavLink } from 'react-router-dom';

export default function ClientLayout() {
  return (
    <div>
      <Outlet />
      <nav className="bottom-nav">
        <NavLink to="/" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`} end>
          <span className="bottom-nav-icon">🏠</span><span>Главная</span>
        </NavLink>
        <NavLink to="/stats" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <span className="bottom-nav-icon">📊</span><span>Статистика</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <span className="bottom-nav-icon">👤</span><span>Профиль</span>
        </NavLink>
      </nav>
    </div>
  );
}
