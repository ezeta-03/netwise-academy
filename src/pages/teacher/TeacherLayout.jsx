import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, Calendar, BookOpen, Headphones, ChevronLeft, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import logoNetwise from '../../assets/NETWISE ACADEMY WEB/logo_netwise.webp';

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

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
};

const TeacherLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { currentUser } = useAuth();
  const { toggleSidebar, unreadCount } = useUI();

  const currentLabel = PAGE_LABELS[location.pathname] || 'Mi campus';

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="admin-sidebar-header">
          <img src={logoNetwise} alt="Netwise Academy" className="admin-sidebar-logo-img" />
          <button className="admin-sidebar-collapse-btn" onClick={() => setCollapsed((c) => !c)} title={collapsed ? 'Expandir' : 'Colapsar'}>
            <ChevronLeft size={16} />
          </button>
        </div>

        <nav className="admin-nav">
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
          <div className="admin-breadcrumb">Mi campus / <strong>{currentLabel}</strong></div>
          <div className="admin-topbar-right">
            <button className="admin-topbar-bell" title="Notificaciones" onClick={toggleSidebar}>
              <Bell size={18} />
              {unreadCount > 0 && <span style={{ position: 'absolute', top: 4, right: 4, background: 'var(--rose)', width: 8, height: 8, borderRadius: '50%' }}></span>}
            </button>
            <div className="admin-avatar" title={currentUser?.displayName || currentUser?.email}>
              {getInitials(currentUser?.displayName || currentUser?.email)}
            </div>
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
