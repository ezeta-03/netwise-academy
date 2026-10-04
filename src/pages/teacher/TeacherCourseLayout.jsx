import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Home, Calendar, Headphones, ArrowLeft, ChevronLeft, BookOpen, Video, FolderOpen, Target, ClipboardCheck, Users, UsersRound, Sparkles, Bell, Menu, ListChecks, CalendarClock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { COURSE_THUMBNAILS } from '../../lib/courseThumbnails';
import { fetchGroups, fetchAllEnrollments } from '../../lib/db';
import SidebarLogo from '../../components/SidebarLogo';
import UserMenu from '../../components/UserMenu';
import { NO_AULA, aulaRoster } from '../../lib/roster';
import { ADMIN_NAV } from '../../lib/adminNav';

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
  { to: 'proyecto', label: 'Seguimiento', icon: Target },
  { to: 'evaluacion', label: 'Evaluación', icon: ClipboardCheck },
  { to: 'rubrica', label: 'Rúbrica', icon: ListChecks },
  { to: 'cronograma', label: 'Cronograma', icon: CalendarClock },
  { to: 'comunidad', label: 'Comunidad', icon: Users },
  { to: 'grupos', label: 'Grupos de trabajo', icon: UsersRound },
  { to: 'ia', label: 'Asistente IA', icon: Sparkles },
];

const PAGE_LABELS = { indicaciones: 'Indicaciones de clase', contenido: 'Contenido', sala: 'Sala de reuniones', materiales: 'Materiales', proyecto: 'Seguimiento', evaluacion: 'Evaluación', comunidad: 'Comunidad', grupos: 'Grupos de trabajo', ia: 'Asistente IA', rubrica: 'Rúbrica de evaluación', cronograma: 'Cronograma de evaluación' };

const TeacherCourseLayout = () => {
  const { courseId } = useParams();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { toggleSidebar, unreadCount, addToast } = useUI();
  const { courses, loaded: coursesLoaded } = useCourseOfferings();
  // Un curso puede tener varias aulas: el docente elige con cuál trabaja y
  // todas las pestañas (asistencia, notas, entregas, cronograma, seguimiento)
  // se muestran solo para esa aula.
  const [groups, setGroups] = useState([]);
  const [courseEnrollments, setCourseEnrollments] = useState([]);
  const aulaStorageKey = `nw_aula_${courseId}`;
  const [aulaChoice, setAulaChoice] = useState(() => {
    try { return sessionStorage.getItem(aulaStorageKey) || ''; } catch { return ''; }
  });
  const pickAula = (id) => {
    setAulaChoice(id);
    try { sessionStorage.setItem(aulaStorageKey, id); } catch { /* sin almacenamiento: vale solo en esta vista */ }
  };

  // En teléfono el sidebar es un cajón: el botón lo cierra (colapsarlo a íconos no aplica ahí).
  const handleCollapseClick = () => {
    if (window.matchMedia('(max-width: 640px)').matches) setMobileOpen(false);
    else setCollapsed((c) => !c);
  };

  // El admin abre este mismo editor desde Cursos y precios, pero dentro de SU
  // panel (/admin/curso/:id): mismo contenido, con el menú y las rutas del admin.
  const adminMode = location.pathname.startsWith('/admin/');
  const base = adminMode ? '/admin' : '/teacher';
  const listPath = adminMode ? '/admin/cursos' : '/teacher/cursos';
  const mainNav = adminMode ? ADMIN_NAV : MAIN_NAV;

  const course = courses.find((c) => c.id.toString() === courseId?.toString());
  // Un docente solo entra al curso que el admin le asignó (courseOfferings
  // .teacherUid) -- si lo desasignan mientras el docente sigue con la
  // pestaña abierta, al navegar entre secciones este layout se re-evalúa y
  // lo saca. Un admin sigue viendo cualquier curso.
  const isAssigned = currentUser?.role === 'admin' || course?.teacherUid === currentUser?.uid;

  useEffect(() => {
    if (coursesLoaded && course && !isAssigned) {
      addToast('Ya no tienes asignado este curso.', 'warning');
      navigate(listPath, { replace: true });
    }
  }, [coursesLoaded, course, isAssigned, navigate, addToast, listPath]);

  // Se consulta con el id numérico del curso (el que guardan las matrículas) y
  // solo cuando el curso está asignado: las reglas rechazan la consulta a un
  // docente ajeno.
  const canLoad = coursesLoaded && !!course && isAssigned;
  const numericCourseId = course?.id;
  useEffect(() => {
    if (!canLoad) return;
    Promise.all([fetchGroups(numericCourseId), fetchAllEnrollments(numericCourseId)]).then(([list, enrollments]) => {
      setGroups(list.filter((g) => g.courseId?.toString() === courseId?.toString())
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es')));
      setCourseEnrollments(enrollments.filter((e) => e.courseId?.toString() === courseId?.toString()));
    }).catch(() => {});
  }, [canLoad, numericCourseId, courseId]);

  // Aula activa: la elegida si sigue siendo válida; si no, la primera.
  const unassignedCount = groups.length ? aulaRoster(courseEnrollments, courseId, groups, NO_AULA).length : 0;
  const aulaId = groups.length === 0 ? null
    : (aulaChoice === NO_AULA && unassignedCount > 0 ? NO_AULA
      : (groups.some((g) => g.id === aulaChoice) ? aulaChoice : groups[0].id));
  const group = groups.find((g) => g.id === aulaId) || null;
  const aulaUids = new Set(aulaRoster(courseEnrollments, courseId, groups, aulaId).map((r) => r.uid));
  const aulaEnrollments = courseEnrollments.filter((e) => aulaUids.has(e.uid));
  const avgProgress = aulaEnrollments.length ? Math.round(aulaEnrollments.reduce((s, e) => s + (e.progress || 0), 0) / aulaEnrollments.length) : 0;
  const showAulaPicker = groups.length > 1 || unassignedCount > 0;

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
          {mainNav.map((item) => {
            const Icon = item.icon;
            const isCursos = item.to === listPath;
            return (
              <NavLink key={item.to} to={item.to} className={() => `admin-nav-link ${isCursos ? 'active' : ''}`}>
                <Icon size={17} />
                <span className="admin-nav-label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="dash-sidebar-divider"></div>

        <button className="dash-back-link" onClick={() => navigate(listPath)}>
          <ArrowLeft size={14} /> <span className="admin-nav-label">{adminMode ? 'Todos los cursos' : 'Todos mis cursos'}</span>
        </button>

        <div className="dash-course-context">
          <img src={COURSE_THUMBNAILS[course.id]} alt={course.title} />
          <div className="admin-nav-label">
            <div className="dash-course-context-title">{course.title}</div>
            <div className="dash-course-context-sub">{group?.name ? `Aula ${group.name}` : (aulaId === NO_AULA ? 'Alumnos sin aula' : 'Sin aula')} · {adminMode ? 'Administrador' : 'Docente'}</div>
          </div>
        </div>
        <div className="admin-nav-label">
          <div className="dash-mini-progress">
            <div className="dash-mini-progress-label"><span>Avance del aula</span><span>{avgProgress}%</span></div>
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
      </aside>

      <div className="admin-main">
        <div className="admin-topbar">
          <button className="admin-sidebar-mobile-toggle" title="Menú" onClick={() => setMobileOpen(true)}><Menu size={18} /></button>
          <div className="admin-breadcrumb">
            {adminMode && <><span className="admin-breadcrumb-link" onClick={() => navigate('/admin/resumen')}>Mi academia</span> / </>}<span className="admin-breadcrumb-link" onClick={() => navigate(listPath)}>{adminMode ? 'Cursos y precios' : 'Mis cursos'}</span> / <span className="admin-breadcrumb-link" onClick={() => navigate(`${base}/curso/${course.id}`)}>{course.title}</span> / <strong>{currentLabel}</strong>
          </div>
          <div className="admin-topbar-right">
            <button className="admin-topbar-bell" title="Notificaciones" onClick={toggleSidebar}>
              <Bell size={18} />
              {unreadCount > 0 && <span style={{ position: 'absolute', top: 4, right: 4, background: 'var(--rose)', width: 8, height: 8, borderRadius: '50%' }}></span>}
            </button>
            <UserMenu />
          </div>
        </div>

        <div className="admin-content">
          {showAulaPicker && (
            <div className="admin-toolbar" style={{ marginBottom: 16, alignItems: 'center' }}>
              <label htmlFor="aula-select" style={{ fontWeight: 700, fontSize: '.86rem' }}>Aula</label>
              <select id="aula-select" className="admin-select" value={aulaId} onChange={(e) => pickAula(e.target.value)}>
                {groups.map((g) => {
                  const n = aulaRoster(courseEnrollments, courseId, groups, g.id).length;
                  return <option key={g.id} value={g.id}>{g.name} · {n} alumno{n === 1 ? '' : 's'}</option>;
                })}
                {unassignedCount > 0 && <option value={NO_AULA}>Sin aula · {unassignedCount} alumno{unassignedCount === 1 ? '' : 's'}</option>}
              </select>
              <span className="admin-cell-sub">Asistencia, notas, entregas, cronograma y seguimiento se muestran solo para esta aula.</span>
            </div>
          )}
          <Outlet context={{ course, group, groups, aulaId }} />
        </div>
      </div>
    </div>
  );
};

export default TeacherCourseLayout;
