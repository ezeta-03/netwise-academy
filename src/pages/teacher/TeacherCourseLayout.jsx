import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Home, Calendar, Headphones, ArrowLeft, ChevronLeft, BookOpen, Video, FolderOpen, Target, ClipboardCheck, Users, UsersRound, Sparkles, Bell, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { COURSE_THUMBNAILS } from '../../lib/courseThumbnails';
import { fetchGroups, fetchAllEnrollments } from '../../lib/db';
import SidebarLogo from '../../components/SidebarLogo';

// Mismos 4 enlaces que TeacherLayout.jsx -- este sidebar de curso reemplaza
// por completo al de TeacherLayout mientras el docente está dentro de un
// curso, así que sin esto perdía acceso directo a Inicio/Agenda/Soporte
// (solo podía volver con "Todos mis cursos"). "Cursos" se marca activo a
// mano porque la ruta real es /teacher/curso/:id, no /teacher/cursos.
const MAIN_NAV = [
  { to: '/teacher/inicio', label: 'Inicio', icon: Home },
  { to: '/teacher/agenda', label: 'Agenda', icon: Calendar },
  { to: '/teacher/cursos', label: 'Cursos', icon: BookOpen },
  { to: '/teacher/soporte', label: 'Soporte', icon: Headphones },
];

const SUB_NAV = [
  { to: 'contenido', label: 'Contenido', icon: BookOpen },
  { to: 'sala', label: 'Sala de reuniones', icon: Video },
  { to: 'materiales', label: 'Materiales', icon: FolderOpen },
  { to: 'proyecto', label: 'Mi proyecto', icon: Target },
  { to: 'evaluacion', label: 'Evaluación', icon: ClipboardCheck },
  { to: 'comunidad', label: 'Comunidad', icon: Users },
  { to: 'grupos', label: 'Grupos de trabajo', icon: UsersRound },
  { to: 'ia', label: 'Asistente IA', icon: Sparkles },
];

const PAGE_LABELS = { contenido: 'Contenido', sala: 'Sala de reuniones', materiales: 'Materiales', proyecto: 'Mi proyecto', evaluacion: 'Evaluación', comunidad: 'Comunidad', grupos: 'Grupos de trabajo', ia: 'Asistente IA', rubrica: 'Rúbrica de evaluación', cronograma: 'Cronograma de evaluación' };

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
};

const TeacherCourseLayout = () => {
  const { courseId } = useParams();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { toggleSidebar, unreadCount, addToast } = useUI();
  const { courses, loaded: coursesLoaded } = useCourseOfferings();
  const [group, setGroup] = useState(null);
  const [avgProgress, setAvgProgress] = useState(0);

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
  // Un docente solo entra al curso que el admin le asignó (courseOfferings
  // .teacherUid) -- si lo desasignan mientras el docente sigue con la
  // pestaña abierta, al navegar entre secciones este layout se re-evalúa y
  // lo saca. Un admin sigue viendo cualquier curso.
  const isAssigned = currentUser?.role === 'admin' || course?.teacherUid === currentUser?.uid;

  useEffect(() => {
    if (coursesLoaded && course && !isAssigned) {
      addToast('Ya no tienes asignado este curso.', 'warning');
      navigate('/teacher/cursos', { replace: true });
    }
  }, [coursesLoaded, course, isAssigned, navigate, addToast]);

  // Se consulta con el id numérico del curso (el que guardan las matrículas) y
  // solo cuando el curso está asignado: las reglas rechazan la consulta a un
  // docente ajeno.
  const canLoad = coursesLoaded && !!course && isAssigned;
  const numericCourseId = course?.id;
  useEffect(() => {
    if (!canLoad) return;
    Promise.all([fetchGroups(), fetchAllEnrollments(numericCourseId)]).then(([groups, enrollments]) => {
      setGroup(groups.find((g) => g.courseId?.toString() === courseId?.toString()) || null);
      const courseEnrollments = enrollments.filter((e) => e.courseId?.toString() === courseId?.toString());
      setAvgProgress(courseEnrollments.length ? Math.round(courseEnrollments.reduce((s, e) => s + (e.progress || 0), 0) / courseEnrollments.length) : 0);
    }).catch(() => {});
  }, [canLoad, numericCourseId, courseId]);

  const activeSub = location.pathname.split('/').pop();
  const currentLabel = PAGE_LABELS[activeSub] || 'Contenido';

  if (!course || !isAssigned) return <div className="admin-empty-hint">Cargando curso...</div>;

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
            const isCursos = item.to === '/teacher/cursos';
            return (
              <NavLink key={item.to} to={item.to} className={() => `admin-nav-link ${isCursos ? 'active' : ''}`}>
                <Icon size={17} />
                <span className="admin-nav-label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="dash-sidebar-divider"></div>

        <button className="dash-back-link" onClick={() => navigate('/teacher/cursos')}>
          <ArrowLeft size={14} /> <span className="admin-nav-label">Todos mis cursos</span>
        </button>

        <div className="dash-course-context">
          <img src={COURSE_THUMBNAILS[course.id]} alt={course.title} />
          <div className="admin-nav-label">
            <div className="dash-course-context-title">{course.title}</div>
            <div className="dash-course-context-sub">{group?.name ? `Grupo ${group.name}` : 'Sin grupo'} · Docente</div>
          </div>
        </div>
        <div className="admin-nav-label">
          <div className="dash-mini-progress">
            <div className="dash-mini-progress-label"><span>Avance del grupo</span><span>{avgProgress}%</span></div>
            <div className="dash-mini-progress-track"><div className="dash-mini-progress-fill" style={{ width: `${avgProgress}%` }}></div></div>
          </div>
        </div>

        <nav className="admin-nav" onClick={() => setMobileOpen(false)}>
          {SUB_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
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
            <span className="admin-breadcrumb-link" onClick={() => navigate('/teacher/cursos')}>Mis cursos</span> / <span className="admin-breadcrumb-link" onClick={() => navigate(`/teacher/curso/${course.id}`)}>{course.title}</span> / <strong>{currentLabel}</strong>
          </div>
          <div className="admin-topbar-right">
            <button className="admin-topbar-bell" title="Notificaciones" onClick={toggleSidebar}>
              <Bell size={18} />
              {unreadCount > 0 && <span style={{ position: 'absolute', top: 4, right: 4, background: 'var(--rose)', width: 8, height: 8, borderRadius: '50%' }}></span>}
            </button>
            <div className="admin-avatar" title={currentUser?.displayName || currentUser?.email}>{getInitials(currentUser?.displayName || currentUser?.email)}</div>
            <button className="admin-topbar-bell admin-topbar-logout" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={handleLogout}><LogOut size={18} /></button>
          </div>
        </div>

        <div className="admin-content">
          <Outlet context={{ course, group }} />
        </div>
      </div>
    </div>
  );
};

export default TeacherCourseLayout;
