import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Bell, Menu } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import SidebarLogo from '../../components/SidebarLogo';
import UserMenu from '../../components/UserMenu';
import { materializeCoursePricing } from '../../lib/db';
import { ADMIN_NAV, ADMIN_NAV_SECONDARY } from '../../lib/adminNav';


const PAGE_LABELS = {
  '/admin/resumen': 'Resumen',
  '/admin/cursos': 'Cursos y precios',
  '/admin/promociones': 'Promociones',
  '/admin/grupos': 'Aulas y horarios',
  '/admin/alumnos': 'Alumnos y accesos',
  '/admin/ventas': 'Ventas e inscripciones',
  '/admin/pagos': 'Métodos de pago',
  '/admin/soporte': 'Soporte',
  '/admin/equipo': 'Equipo y permisos',
  '/admin/historial': 'Historial de cambios',
  '/admin/configuracion': 'Configuración',
};

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleSidebar, unreadCount, notifications } = useUI();
  const { courses, offerings, loaded, refresh } = useCourseOfferings();

  // Las reglas validan el importe de cada pedido contra el precio y la
  // promoción guardados en la oferta del curso. Un curso cuyo precio nunca se
  // editó solo los tiene en el código: se guardan una vez, tal como se muestran.
  useEffect(() => {
    if (!loaded) return;
    const has = (id, field) => Object.prototype.hasOwnProperty.call(offerings[id] || {}, field);
    const missing = courses.filter((c) => !has(c.id, 'price') || !has(c.id, 'promoPercent'));
    if (missing.length === 0) return;
    Promise.all(missing.map((c) => materializeCoursePricing(c.id, c))).then(refresh).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, offerings]);

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
          {ADMIN_NAV.map(renderLink)}
          <div className="admin-nav-section-label">Administración</div>
          {ADMIN_NAV_SECONDARY.map(renderLink)}
        </nav>
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

export default AdminLayout;
