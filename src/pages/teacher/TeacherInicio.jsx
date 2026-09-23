import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Video, ArrowRight, BookOpen, CheckCircle2, BarChart3, Clock3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { COURSE_THUMBNAILS } from '../../lib/courseThumbnails';
import { fetchLiveSessions, fetchAllEnrollments, fetchCourseContent, fetchSubmissions } from '../../lib/db';
import { getLiveSessionStatus } from '../../lib/liveSessionStatus';
import { deliverableModules } from '../../lib/weights';

const weekRangeLabel = () => {
  const now = new Date();
  const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 1);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }).replace('.', '');
  return `${fmt(start)} – ${fmt(end)}`.toUpperCase();
};

const TeacherInicio = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { courses: allCourses } = useCourseOfferings();
  // Un admin ve todo; un docente solo lo de los cursos que le asignaron.
  // useMemo: sin él `courses` es un array nuevo en cada render y el efecto de
  // abajo (que depende de él) se volvía a disparar sin parar para un docente.
  const courses = useMemo(
    () => (currentUser?.role === 'admin' ? allCourses : allCourses.filter((c) => c.teacherUid === currentUser?.uid)),
    [allCourses, currentUser?.role, currentUser?.uid],
  );
  const myCourseIds = useMemo(() => new Set(courses.map((c) => c.id.toString())), [courses]);
  const [sessions, setSessions] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [pendingByCourse, setPendingByCourse] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchLiveSessions(),
      fetchAllEnrollments(),
      Promise.all(courses.map(async (c) => {
        const content = await fetchCourseContent(c.id);
        const modules = content.modules || [];
        let pending = 0;
        for (const m of deliverableModules(modules)) {
          const subs = await fetchSubmissions(c.id, m.id);
          pending += subs.filter((s) => s.status === 'submitted').length;
        }
        return { course: c, pending, firstModuleId: modules[0]?.id };
      })),
    ]).then(([allSessions, allEnrollments, byCourse]) => {
      setSessions(allSessions.filter((s) => myCourseIds.has(s.courseId?.toString())));
      setEnrollments(allEnrollments);
      setPendingByCourse(byCourse.filter((b) => b.pending > 0));
      setLoading(false);
    });
  }, [courses, myCourseIds]);

  if (loading) return <div className="admin-empty-hint">Cargando tu semana...</div>;

  const upcoming = sessions
    .filter((s) => getLiveSessionStatus(s) === 'upcoming' || getLiveSessionStatus(s) === 'live')
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    .slice(0, 3);

  const avgProgress = enrollments.length
    ? Math.round(enrollments.reduce((sum, e) => sum + (e.progress || 0), 0) / enrollments.length)
    : 0;

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Hola, {currentUser?.displayName?.split(' ')[0] || 'Docente'}.</h1>
          <p className="admin-page-sub">Tu semana de aprendizaje.</p>
        </div>
        <button className="admin-btn-edit" onClick={() => navigate('/teacher/agenda')}><Calendar size={15} /> Ver mi agenda</button>
      </div>

      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Mis cursos <BookOpen size={16} /></div>
          <div className="admin-stat-value">{courses.length}</div>
          <div className="admin-cell-sub">Aulas a tu cargo</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Cursos por evaluar <CheckCircle2 size={16} /></div>
          <div className="admin-stat-value">{pendingByCourse.length}</div>
          <div className="admin-cell-sub">Avances esperando revisión</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Avance general <BarChart3 size={16} /></div>
          <div className="admin-stat-value">{avgProgress}%</div>
          <div className="admin-cell-sub">Promedio de tus cursos</div>
        </div>
      </div>

      <div className="admin-two-col" style={{ marginBottom: 20 }}>
        <div className="admin-panel">
          <div className="admin-panel-head">
            <span className="admin-panel-title">Próximas clases</span>
            <a className="admin-panel-link" style={{ cursor: 'pointer' }} onClick={() => navigate('/teacher/agenda')}>Ver todo</a>
          </div>
          <p className="admin-cell-sub" style={{ marginBottom: 10 }}>{weekRangeLabel()} · HORA DE PERÚ</p>
          {upcoming.length === 0 ? (
            <p className="admin-panel-caption" style={{ marginTop: 0 }}>No tienes clases programadas esta semana.</p>
          ) : upcoming.map((s) => (
            <div key={s.id} className="dash-list-row">
              <div>
                <div className="admin-cell-sub" style={{ color: 'var(--accent)', fontWeight: 600 }}>{s.courseTitle}</div>
                <div className="dash-list-row-title">{s.title}</div>
                <div className="dash-list-row-sub">{new Date(s.startsAt).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' })} · {new Date(s.startsAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}–{new Date(new Date(s.startsAt).getTime() + s.durationMin * 60000).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} · Clase en vivo</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <span className="admin-status admin-status-gray">Programada</span>
                <button className="admin-btn-edit" onClick={() => navigate(`/live/${s.id}`)}><Video size={13} /> Abrir sala</button>
              </div>
            </div>
          ))}
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <span className="admin-panel-title">Para revisar</span>
            <a className="admin-panel-link" style={{ cursor: 'pointer' }} onClick={() => navigate('/teacher/cursos')}>Ver todos</a>
          </div>
          {pendingByCourse.length === 0 ? (
            <p className="admin-panel-caption" style={{ marginTop: 0 }}>No tienes entregas pendientes por revisar.</p>
          ) : pendingByCourse.map(({ course, pending, firstModuleId }) => (
            <div key={course.id} className="dash-list-row">
              <div>
                <div className="admin-cell-sub" style={{ color: 'var(--accent)', fontWeight: 600 }}>{course.title}</div>
                <span className="admin-status admin-status-amber">Por revisar · {pending}</span>
              </div>
              <button className="admin-btn-ghost" onClick={() => navigate(`/teacher/curso/${course.id}/contenido${firstModuleId ? `?modulo=${firstModuleId}` : ''}`)}>
                <ArrowRight size={13} /> Ver proyecto
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-page-head">
        <h2 className="admin-page-title" style={{ fontSize: '1.15rem', marginBottom: 0 }}>Gestiona tus cursos</h2>
        <a className="admin-panel-link" style={{ cursor: 'pointer' }} onClick={() => navigate('/teacher/cursos')}>Ver mis cursos</a>
      </div>
      <div className="home-courses-grid">
        {courses.map((c) => (
          <div className="home-course-card" key={c.id} onClick={() => navigate(`/teacher/curso/${c.id}`)}>
            <div className="home-course-thumb"><img src={COURSE_THUMBNAILS[c.id]} alt={c.title} /></div>
            <div className="home-course-body">
              <div className="home-course-meta-row">
                <span className="home-course-tag">{c.cardTag}</span>
                <span className="home-course-live"><Video size={13} /> En vivo</span>
              </div>
              <div className="home-course-title"><span>{c.cardTitle[0]}</span><span className="accent">{c.cardTitle[1]}</span></div>
              <p className="home-course-desc">{c.cardDesc}</p>
              <div className="home-course-info"><Clock3 size={14} /> {c.duration} <span className="home-course-info-dot" /> {c.level}</div>
              <span className="home-course-link">Gestionar curso <ArrowRight size={16} /></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeacherInicio;
