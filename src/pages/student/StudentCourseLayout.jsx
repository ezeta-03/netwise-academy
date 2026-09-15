import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, BookOpen, Video, FolderOpen, Target, Users, Sparkles, Bell, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { COURSE_THUMBNAILS } from '../../lib/courseThumbnails';
import { fetchGroups, fetchMyEnrollments } from '../../lib/db';
import logoNetwise from '../../assets/NETWISE ACADEMY WEB/logo_netwise.webp';

const SUB_NAV = [
  { to: 'contenido', label: 'Contenido', icon: BookOpen },
  { to: 'sala', label: 'Sala de reuniones', icon: Video },
  { to: 'materiales', label: 'Materiales', icon: FolderOpen },
  { to: 'proyecto', label: 'Mi proyecto', icon: Target },
  { to: 'comunidad', label: 'Comunidad', icon: Users },
  { to: 'ia', label: 'Asistente IA', icon: Sparkles },
];

const PAGE_LABELS = { contenido: 'Contenido', sala: 'Sala de Reunión', materiales: 'Materiales', proyecto: 'Mi proyecto', comunidad: 'Comunidad', ia: 'Asistente IA' };

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
};

const StudentCourseLayout = () => {
  const { courseId } = useParams();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { toggleSidebar, unreadCount } = useUI();
  const { courses } = useCourseOfferings();
  const [group, setGroup] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const course = courses.find((c) => c.id.toString() === courseId?.toString());

  useEffect(() => {
    if (!currentUser) return;
    Promise.all([fetchGroups(), fetchMyEnrollments(currentUser.uid)]).then(([groups, enrollments]) => {
      setGroup(groups.find((g) => g.courseId?.toString() === courseId?.toString()) || null);
      setEnrollment(enrollments[courseId] || null);
      setLoading(false);
    });
  }, [courseId, currentUser]);

  const activeSub = location.pathname.split('/').pop();
  const currentLabel = PAGE_LABELS[activeSub] || 'Contenido';

  if (!course || loading) return <div className="admin-empty-hint">Cargando curso...</div>;

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="admin-sidebar-header">
          <img src={logoNetwise} alt="Netwise Academy" className="admin-sidebar-logo-img" />
          <button className="admin-sidebar-collapse-btn" onClick={() => setCollapsed((c) => !c)}><ChevronLeft size={16} /></button>
        </div>

        <button className="dash-back-link" onClick={() => navigate('/student/cursos')}>
          <ArrowLeft size={14} /> <span className="admin-nav-label">Todos mis cursos</span>
        </button>

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

        <nav className="admin-nav">
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
          <div className="admin-breadcrumb">Mis cursos / {course.title} / <strong>{currentLabel}</strong></div>
          <div className="admin-topbar-right">
            <button className="admin-topbar-bell" title="Notificaciones" onClick={toggleSidebar}>
              <Bell size={18} />
              {unreadCount > 0 && <span style={{ position: 'absolute', top: 4, right: 4, background: 'var(--rose)', width: 8, height: 8, borderRadius: '50%' }}></span>}
            </button>
            <div className="admin-avatar" title={currentUser?.displayName || currentUser?.email}>{getInitials(currentUser?.displayName || currentUser?.email)}</div>
          </div>
        </div>

        <div className="admin-content">
          <Outlet context={{ course, group, enrollment }} />
        </div>
      </div>
    </div>
  );
};

export default StudentCourseLayout;
