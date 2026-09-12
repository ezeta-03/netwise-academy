import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutGrid, BookOpen, Tag, Calendar, Users, ShoppingCart,
  ShieldCheck, History, Settings, ChevronLeft, Bell,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import logoNetwise from '../../assets/NETWISE ACADEMY WEB/logo_netwise.webp';

const NAV_ITEMS = [
  { to: '/admin/resumen', label: 'Resumen', icon: LayoutGrid },
  { to: '/admin/cursos', label: 'Cursos y precios', icon: BookOpen, countKey: 'courses' },
  { to: '/admin/promociones', label: 'Promociones', icon: Tag },
  { to: '/admin/grupos', label: 'Grupos y horarios', icon: Calendar },
  { to: '/admin/alumnos', label: 'Alumnos y accesos', icon: Users },
  { to: '/admin/ventas', label: 'Ventas e inscripciones', icon: ShoppingCart },
];

const NAV_ITEMS_ADMIN = [
  { to: '/admin/equipo', label: 'Equipo y permisos', icon: ShieldCheck },
  { to: '/admin/historial', label: 'Historial de cambios', icon: History },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings },
];

const PAGE_LABELS = {
  '/admin/resumen': 'Resumen',
  '/admin/cursos': 'Cursos y precios',
  '/admin/promociones': 'Promociones',
  '/admin/grupos': 'Grupos y horarios',
  '/admin/alumnos': 'Alumnos y accesos',
  '/admin/ventas': 'Ventas e inscripciones',
  '/admin/equipo': 'Equipo y permisos',
  '/admin/historial': 'Historial de cambios',
  '/admin/configuracion': 'Configuración',
};

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
};

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { currentUser } = useAuth();
  const { toggleSidebar, unreadCount } = useUI();
  const { courses } = useCourseOfferings();

  const currentLabel = PAGE_LABELS[location.pathname] || 'Resumen';
  const counts = { courses: courses.length };

  const renderLink = (item) => {
    const Icon = item.icon;
    return (
      <NavLink key={item.to} to={item.to} className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
        <Icon size={17} />
        <span className="admin-nav-label">{item.label}</span>
        {item.countKey && counts[item.countKey] != null && (
          <span className="admin-nav-badge">{counts[item.countKey]}</span>
        )}
      </NavLink>
    );
  };

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
          {NAV_ITEMS.map(renderLink)}
          <div className="admin-nav-section-label">Administración</div>
          {NAV_ITEMS_ADMIN.map(renderLink)}
        </nav>
      </aside>

      <div className="admin-main">
        <div className="admin-topbar">
          <div className="admin-breadcrumb">Mi academia / <strong>{currentLabel}</strong></div>
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

export default AdminLayout;
