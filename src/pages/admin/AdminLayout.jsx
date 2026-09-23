import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutGrid, BookOpen, Tag, Calendar, Users, ShoppingCart,
  ShieldCheck, History, Settings, ChevronLeft, Bell, LogOut, Wallet, Headphones, Menu,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import SidebarLogo from '../../components/SidebarLogo';

const NAV_ITEMS = [
  { to: '/admin/resumen', label: 'Resumen', icon: LayoutGrid },
  { to: '/admin/cursos', label: 'Cursos y precios', icon: BookOpen, countKey: 'courses' },
  { to: '/admin/promociones', label: 'Promociones', icon: Tag },
  { to: '/admin/grupos', label: 'Grupos y horarios', icon: Calendar },
  { to: '/admin/alumnos', label: 'Alumnos y accesos', icon: Users },
  { to: '/admin/ventas', label: 'Ventas e inscripciones', icon: ShoppingCart, countKey: 'ventas' },
  { to: '/admin/pagos', label: 'Métodos de pago', icon: Wallet },
  { to: '/admin/soporte', label: 'Soporte', icon: Headphones },
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
  '/admin/pagos': 'Métodos de pago',
  '/admin/soporte': 'Soporte',
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { toggleSidebar, unreadCount, notifications } = useUI();
  const { courses } = useCourseOfferings();

  const currentLabel = PAGE_LABELS[location.pathname] || 'Resumen';
  // `notifications` para el admin es 1 aviso por pedido pendiente (ver
  // buildAdminNotifications) -- su length es la cuenta real de pedidos por
  // validar, sin importar si ya los marcó como leídos en la campanita.
  const counts = { courses: courses.length, ventas: notifications.length };

  // En teléfono el sidebar es un cajón: el botón lo cierra (colapsarlo a íconos no aplica ahí).
  const handleCollapseClick = () => {
    if (window.matchMedia('(max-width: 640px)').matches) setMobileOpen(false);
    else setCollapsed((c) => !c);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const renderLink = (item) => {
    const Icon = item.icon;
    return (
      <NavLink key={item.to} to={item.to} className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
        <Icon size={17} />
        <span className="admin-nav-label">{item.label}</span>
        {item.countKey && counts[item.countKey] > 0 && (
          <span className="admin-nav-badge">{counts[item.countKey]}</span>
        )}
      </NavLink>
    );
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
          {NAV_ITEMS.map(renderLink)}
          <div className="admin-nav-section-label">Administración</div>
          {NAV_ITEMS_ADMIN.map(renderLink)}
        </nav>

        <div className="admin-sidebar-footer">
          <button className="admin-nav-link admin-logout-btn" onClick={handleLogout} title="Cerrar sesión">
            <LogOut size={17} />
            <span className="admin-nav-label">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <div className="admin-topbar">
          <button className="admin-sidebar-mobile-toggle" title="Menú" onClick={() => setMobileOpen(true)}><Menu size={18} /></button>
          <div className="admin-breadcrumb"><span className="admin-breadcrumb-link" onClick={() => navigate('/admin/resumen')}>Mi academia</span> / <strong>{currentLabel}</strong></div>
          <div className="admin-topbar-right">
            <button className="admin-topbar-bell" title="Notificaciones" onClick={toggleSidebar}>
              <Bell size={18} />
              {unreadCount > 0 && <span style={{ position: 'absolute', top: 4, right: 4, background: 'var(--rose)', width: 8, height: 8, borderRadius: '50%' }}></span>}
            </button>
            <div className="admin-avatar" title={currentUser?.displayName || currentUser?.email}>
              {getInitials(currentUser?.displayName || currentUser?.email)}
            </div>
            <button className="admin-topbar-bell admin-topbar-logout" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={handleLogout}><LogOut size={18} /></button>
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
