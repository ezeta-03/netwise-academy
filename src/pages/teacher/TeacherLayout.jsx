import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, Calendar, BookOpen, Headphones, ChevronLeft, Bell, Menu } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import SidebarLogo from '../../components/SidebarLogo';
import UserMenu from '../../components/UserMenu';

const NAV_ITEMS = [
  { to: '/teacher/inicio', label: 'Inicio', icon: Home },
  { to: '/teacher/agenda', label: 'Agenda', icon: Calendar },
  { to: '/teacher/cursos', label: 'Cursos', icon: BookOpen },
  { to: '/teacher/soporte', label: 'Soporte', icon: Headphones },
];

const PAGE_LABELS = {
  '/teacher/inicio': 'Inicio',
  '/teacher/agenda': 'Agenda',
  '/teacher/cursos': 'Cursos',
  '/teacher/soporte': 'Soporte',
};

const TeacherLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleSidebar, unreadCount } = useUI();

  const currentLabel = PAGE_LABELS[location.pathname] || 'Mi campus';

  // En teléfono el sidebar es un cajón: el botón lo cierra (colapsarlo a íconos no aplica ahí).
  const handleCollapseClick = () => {
    if (window.matchMedia('(max-width: 640px)').matches) setMobileOpen(false);
    else setCollapsed((c) => !c);
  };

  return (
    <div className="admin-shell">
      <div className={`overlay ${mobileOpen ? 'active' : ''}`} onClick={() => setMobileOpen(false)}></div>
      <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="admin-sidebar-header">
          <SidebarLogo />
          <button className="admin-sidebar-collapse-btn" onClick={handleCollapseClick} title={collapsed ? 'Expandir' : 'Colapsar'}>
            <ChevronLeft size={16} />
          </button>
        </div>

        <nav className="admin-nav" onClick={() => setMobileOpen(false)}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
                <Icon size={17} />
                <span className="admin-nav-label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="admin-main">
        <div className="admin-topbar">
          <button className="admin-sidebar-mobile-toggle" title="Menú" onClick={() => setMobileOpen(true)}><Menu size={18} /></button>
          <div className="admin-breadcrumb"><span className="admin-breadcrumb-link" onClick={() => navigate('/teacher/inicio')}>Mi campus</span> / <strong>{currentLabel}</strong></div>
          <div className="admin-topbar-right">
            <button className="admin-topbar-bell" title="Notificaciones" onClick={toggleSidebar}>
              <Bell size={18} />
              {unreadCount > 0 && <span style={{ position: 'absolute', top: 4, right: 4, background: 'var(--rose)', width: 8, height: 8, borderRadius: '50%' }}></span>}
            </button>
            <UserMenu />
          </div>
        </div>

        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default TeacherLayout;
