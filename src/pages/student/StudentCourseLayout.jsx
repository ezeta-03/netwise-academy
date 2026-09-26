import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Home, Calendar, CheckSquare, Headphones, ArrowLeft, ChevronLeft, BookOpen, Video, FolderOpen, Target, ClipboardCheck, Users, UsersRound, Sparkles, Bell, LogOut, Menu, HelpCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { COURSE_THUMBNAILS } from '../../lib/courseThumbnails';
import { fetchGroups, fetchMyEnrollments, hasSeenTour, markTourSeen } from '../../lib/db';
import CourseTour from '../../components/CourseTour';
import { COURSE_TOUR_KEY, buildCourseTourSteps } from '../../lib/courseTourSteps';
import SidebarLogo from '../../components/SidebarLogo';

// Mismos enlaces que StudentLayout.jsx -- este sidebar de curso lo reemplaza
// por completo mientras el alumno está dentro de un curso, así que sin esto
// perdía acceso directo a Inicio/Agenda/Mis entregas/Soporte. "Cursos" se
// marca activo a mano porque la ruta real es /student/curso/:id.
const MAIN_NAV = [
  { to: '/student/inicio', label: 'Inicio', icon: Home },
  { to: '/student/agenda', label: 'Agenda', icon: Calendar },
  { to: '/student/cursos', label: 'Cursos', icon: BookOpen },
  { to: '/student/entregas', label: 'Mis entregas', icon: CheckSquare },
  { to: '/student/soporte', label: 'Soporte', icon: Headphones },
];

const SUB_NAV = [
  { to: 'contenido', label: 'Contenido', icon: BookOpen },
  { to: 'sala', label: 'Sala de reuniones', icon: Video },
  { to: 'materiales', label: 'Materiales', icon: FolderOpen },
  { to: 'proyecto', label: 'Mi proyecto', icon: Target },
  { to: 'evaluacion', label: 'Mis evaluaciones', icon: ClipboardCheck },
  { to: 'comunidad', label: 'Comunidad', icon: Users },
  { to: 'grupos', label: 'Grupos de trabajo', icon: UsersRound },
  { to: 'ia', label: 'Asistente IA', icon: Sparkles },
];

const PAGE_LABELS = { contenido: 'Contenido', sala: 'Sala de Reunión', materiales: 'Materiales', proyecto: 'Mi proyecto', evaluacion: 'Mis evaluaciones', comunidad: 'Comunidad', grupos: 'Grupos de trabajo', ia: 'Asistente IA' };

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
};

const StudentCourseLayout = () => {
  const { courseId } = useParams();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { toggleSidebar, unreadCount, addToast } = useUI();
  const { courses } = useCourseOfferings();
  const [group, setGroup] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tourOpen, setTourOpen] = useState(false);
  const helpBtnRef = useRef(null);

  // En teléfono el sidebar es un cajón: el botón lo cierra (colapsarlo a íconos no aplica ahí).
  const handleCollapseClick = () => {
    if (window.matchMedia('(max-width: 640px)').matches) setMobileOpen(false);
    else setCollapsed((c) => !c);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const course = courses.find((c) => c.id.toString() === courseId?.toString());

  useEffect(() => {
    if (!currentUser) return;
    // `cancelled` evita el doble aviso cuando el efecto se ejecuta dos veces
    // (StrictMode, o un cambio rápido de curso).
    let cancelled = false;
    Promise.all([fetchGroups(), fetchMyEnrollments(currentUser.uid)]).then(([groups, enrollments]) => {
      if (cancelled) return;
      const enr = enrollments[courseId] || null;
      // Un curso puede tener varias aulas abiertas a la vez -- usar el
      // groupId de la matrícula del alumno (si el admin ya se lo asignó). Sin
      // groupId solo se asume el aula si el curso tiene una sola; con varias
      // se mostraría el horario/grupo equivocado.
      const courseGroups = groups.filter((g) => g.courseId?.toString() === courseId?.toString());
      setGroup(groups.find((g) => g.id === enr?.groupId) || (courseGroups.length === 1 ? courseGroups[0] : null));
      // Una matrícula 'pending' (pago o alta aún sin confirmar) todavía no da acceso.
      const active = enr && (enr.status || 'active') === 'active';
      setEnrollment(active ? enr : null);
      setLoading(false);
      // Sin matrícula activa en este curso no hay nada que ver: se vuelve a
      // "Cursos" en vez de mostrar el curso vacío por URL directa.
      if (!active) {
        addToast(enr ? 'Tu matrícula en este curso todavía está pendiente de activación.' : 'No estás inscrito en este curso.', 'warning');
        navigate('/student/cursos', { replace: true });
      }
    }).catch(() => {
      if (cancelled) return;
      addToast('No se pudo cargar el curso. Intenta de nuevo.', 'error');
      navigate('/student/cursos', { replace: true });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, currentUser]);

  // Recorrido guiado: se abre solo la primera vez que el alumno entra a un
  // aula (en cualquier curso); después queda en el botón "Ver tutorial".
  useEffect(() => {
    if (!currentUser || !enrollment) return;
    let cancelled = false;
    hasSeenTour(currentUser.uid, COURSE_TOUR_KEY)
      .then((seen) => { if (!cancelled && !seen) setTourOpen(true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentUser, enrollment]);

  const closeTour = useCallback((reason) => {
    setTourOpen(false);
    setMobileOpen(false);
    markTourSeen(currentUser.uid, COURSE_TOUR_KEY).catch(() => {});
    if (reason === 'skipped') addToast('Puedes ver el tutorial cuando quieras desde "Ver tutorial".', 'info');
    helpBtnRef.current?.focus();
  }, [currentUser, addToast]);

  // En el teléfono el menú lateral es un cajón: se abre para los pasos que lo resaltan.
  const prepareTourStep = useCallback((step) => {
    if (window.matchMedia('(max-width: 640px)').matches) setMobileOpen(!!step.inSidebar);
  }, []);

  const activeSub = location.pathname.split('/').pop();
  const currentLabel = PAGE_LABELS[activeSub] || 'Contenido';

  if (!course || loading || !enrollment) return <div className="admin-empty-hint">Cargando curso...</div>;

  return (
    <div className="admin-shell">
      <div className={`overlay ${mobileOpen ? 'active' : ''}`} onClick={() => setMobileOpen(false)}></div>
      <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="admin-sidebar-header">
          <SidebarLogo />
          <button className="admin-sidebar-collapse-btn" onClick={handleCollapseClick}><ChevronLeft size={16} /></button>
        </div>

        <nav className="admin-nav" onClick={() => setMobileOpen(false)}>
          {MAIN_NAV.map((item) => {
            const Icon = item.icon;
            const isCursos = item.to === '/student/cursos';
            return (
              <NavLink key={item.to} to={item.to} className={() => `admin-nav-link ${isCursos ? 'active' : ''}`}>
                <Icon size={17} />
                <span className="admin-nav-label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="dash-sidebar-divider"></div>

        <button className="dash-back-link" onClick={() => navigate('/student/cursos')}>
          <ArrowLeft size={14} /> <span className="admin-nav-label">Todos mis cursos</span>
        </button>

        <div data-tour="course-context">
        <div className="dash-course-context">
          <img src={COURSE_THUMBNAILS[course.id]} alt={course.title} />
          <div className="admin-nav-label">
            <div className="dash-course-context-title">{course.title}</div>
            <div className="dash-course-context-sub">{group?.name ? `Grupo ${group.name}` : 'Sin grupo'} · Estudiante</div>
          </div>
        </div>
        <div className="admin-nav-label">
          <div className="dash-mini-progress">
            <div className="dash-mini-progress-label"><span>Tu avance</span><span>{enrollment?.progress || 0}%</span></div>
            <div className="dash-mini-progress-track"><div className="dash-mini-progress-fill" style={{ width: `${enrollment?.progress || 0}%` }}></div></div>
          </div>
        </div>
        </div>

        <nav className="admin-nav" onClick={() => setMobileOpen(false)}>
          {SUB_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} data-tour={`nav-${item.to}`} className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
                <Icon size={17} />
                <span className="admin-nav-label">{item.label}</span>
              </NavLink>
            );
          })}
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
          <div className="admin-breadcrumb">
            <span className="admin-breadcrumb-link" onClick={() => navigate('/student/cursos')}>Mis cursos</span> / <span className="admin-breadcrumb-link" onClick={() => navigate(`/student/curso/${course.id}`)}>{course.title}</span> / <strong>{currentLabel}</strong>
          </div>
          <div className="admin-topbar-right">
            <button ref={helpBtnRef} type="button" className="tour-help-btn" data-tour="tour-help" onClick={() => setTourOpen(true)} title="Ver el tutorial del aula" aria-label="Ver el tutorial del aula">
              <HelpCircle size={16} /> <span className="tour-help-label">Ver tutorial</span>
            </button>
            <button className="admin-topbar-bell" data-tour="notifications" title="Notificaciones" aria-label="Notificaciones" onClick={toggleSidebar}>
              <Bell size={18} />
              {unreadCount > 0 && <span style={{ position: 'absolute', top: 4, right: 4, background: 'var(--rose)', width: 8, height: 8, borderRadius: '50%' }}></span>}
            </button>
            <div className="admin-avatar" title={currentUser?.displayName || currentUser?.email}>{getInitials(currentUser?.displayName || currentUser?.email)}</div>
            <button className="admin-topbar-bell admin-topbar-logout" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={handleLogout}><LogOut size={18} /></button>
          </div>
        </div>

        <div className="admin-content">
          <Outlet context={{ course, group, enrollment }} />
        </div>
      </div>

      {tourOpen && <CourseTour steps={buildCourseTourSteps(course)} onClose={closeTour} onBeforeStep={prepareTourStep} />}
    </div>
  );
};

export default StudentCourseLayout;
