import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, Calendar, BookOpen, CheckSquare, Headphones, ChevronLeft, Bell, Menu, HelpCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { fetchMyActiveEnrollments } from '../../lib/db';
import { fetchMyDeliverables } from '../../lib/studentDeliverables';
import SidebarLogo from '../../components/SidebarLogo';
import UserMenu from '../../components/UserMenu';
import { useStudentTour } from '../../context/StudentTourContext';

const NAV_ITEMS = [
  { to: '/student/inicio', label: 'Inicio', icon: Home },
  { to: '/student/agenda', label: 'Agenda', icon: Calendar },
  { to: '/student/cursos', label: 'Cursos', icon: BookOpen },
  { to: '/student/entregas', label: 'Mis entregas', icon: CheckSquare },
  { to: '/student/soporte', label: 'Soporte', icon: Headphones },
];

const PAGE_LABELS = {
  '/student/inicio': 'Inicio', '/student/agenda': 'Agenda', '/student/cursos': 'Cursos',
  '/student/entregas': 'Mis entregas', '/student/soporte': 'Soporte',
};

const StudentLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { toggleSidebar, unreadCount } = useUI();
  const { courses } = useCourseOfferings();
  const [pendingCount, setPendingCount] = useState(0);
  const { startTour, sidebarRequest } = useStudentTour();

  // Mientras el tutorial está abierto, él decide si el menú lateral del
  // teléfono se ve (null = sin tutorial, manda el estado propio).
  const drawerOpen = sidebarRequest ?? mobileOpen;

  const currentLabel = PAGE_LABELS[location.pathname] || 'Mi campus';

  // En teléfono el sidebar es un cajón: el botón lo cierra (colapsarlo a íconos no aplica ahí).
  const handleCollapseClick = () => {
    if (window.matchMedia('(max-width: 640px)').matches) setMobileOpen(false);
    else setCollapsed((c) => !c);
  };

  useEffect(() => {
    if (!currentUser) return;
    fetchMyActiveEnrollments(currentUser.uid).then((enrollments) => {
      const enrolledCourses = courses.filter((c) => enrollments[c.id]);
      fetchMyDeliverables(currentUser.uid, enrolledCourses).then((items) => {
        setPendingCount(items.filter((i) => i.status === 'pending').length);
      });
    });
  }, [currentUser, courses]);

  return (
    <div className="admin-shell">
      <div className={`overlay ${drawerOpen ? 'active' : ''}`} onClick={() => setMobileOpen(false)}></div>
      <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''} ${drawerOpen ? 'mobile-open' : ''}`}>
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
              <NavLink key={item.to} to={item.to} data-tour={`nav-${item.to}`} className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
                <Icon size={17} />
                <span className="admin-nav-label">{item.label}</span>
                {item.to === '/student/entregas' && pendingCount > 0 && (
                  <span className="admin-status admin-status-amber" style={{ marginLeft: 'auto' }}>{pendingCount}</span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="admin-main">
        <div className="admin-topbar">
          <button className="admin-sidebar-mobile-toggle" title="Menú" onClick={() => setMobileOpen(true)}><Menu size={18} /></button>
          <div className="admin-breadcrumb"><span className="admin-breadcrumb-link" onClick={() => navigate('/student/inicio')}>Mi campus</span> / <strong>{currentLabel}</strong></div>
          <div className="admin-topbar-right">
            <button type="button" className="tour-help-btn" data-tour="tour-help" onClick={() => startTour()} title="Ver el tutorial" aria-label="Ver el tutorial">
              <HelpCircle size={16} /> <span className="tour-help-label">Ver tutorial</span>
            </button>
            <button className="admin-topbar-bell" data-tour="notifications" title="Notificaciones" aria-label="Notificaciones" onClick={toggleSidebar}>
              <Bell size={18} />
              {unreadCount > 0 && <span style={{ position: 'absolute', top: 4, right: 4, background: 'var(--rose)', width: 8, height: 8, borderRadius: '50%' }}></span>}
            </button>
            <UserMenu />
          </div>
        </div>

        <div className="admin-content" data-tour="page">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default StudentLayout;
