import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Video, ArrowRight, BookOpen, CheckSquare, BarChart3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { COURSE_THUMBNAILS } from '../../lib/courseThumbnails';
import { fetchLiveSessions, fetchMyEnrollments } from '../../lib/db';
import { fetchMyDeliverables } from '../../lib/studentDeliverables';
import { getLiveSessionStatus } from '../../lib/liveSessionStatus';

const StudentInicio = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { courses } = useCourseOfferings();
  const [enrollments, setEnrollments] = useState({});
  const [sessions, setSessions] = useState([]);
  const [pendingByCourse, setPendingByCourse] = useState([]);
  const [loading, setLoading] = useState(true);

  const enrolledCourses = courses.filter((c) => enrollments[c.id]);

  useEffect(() => {
    if (!currentUser) return;
    fetchMyEnrollments(currentUser.uid).then((map) => {
      setEnrollments(map);
      const enrolled = courses.filter((c) => map[c.id]);
      Promise.all([fetchLiveSessions(), fetchMyDeliverables(currentUser.uid, enrolled)]).then(([allSessions, deliverables]) => {
        setSessions(allSessions.filter((s) => enrolled.some((c) => c.id.toString() === s.courseId?.toString())));
        const byCourse = enrolled
          .map((c) => ({ course: c, pending: deliverables.filter((d) => d.courseId.toString() === c.id.toString() && d.status === 'pending').length }))
          .filter((b) => b.pending > 0);
        setPendingByCourse(byCourse);
        setLoading(false);
      });
    });
  }, [currentUser, courses]);

  if (loading) return <div className="admin-empty-hint">Cargando tu semana...</div>;

  const upcoming = sessions
    .filter((s) => getLiveSessionStatus(s) === 'upcoming' || getLiveSessionStatus(s) === 'live')
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    .slice(0, 3);

  const avgProgress = enrolledCourses.length
    ? Math.round(enrolledCourses.reduce((sum, c) => sum + (enrollments[c.id]?.progress || 0), 0) / enrolledCourses.length)
    : 0;

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Hola, {currentUser?.displayName?.split(' ')[0] || 'Estudiante'}.</h1>
          <p className="admin-page-sub">Tu semana de aprendizaje.</p>
        </div>
        <button className="admin-btn-edit" onClick={() => navigate('/student/agenda')}><Calendar size={15} /> Ver mi agenda</button>
      </div>

      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Mis cursos <BookOpen size={16} /></div>
          <div className="admin-stat-value">{enrolledCourses.length}</div>
          <div className="admin-cell-sub">Cursos en tu campus</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Cursos con pendientes <CheckSquare size={16} /></div>
          <div className="admin-stat-value">{pendingByCourse.length}</div>
          <div className="admin-cell-sub">Entregas y seguimiento</div>
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
            <a className="admin-panel-link" style={{ cursor: 'pointer' }} onClick={() => navigate('/student/agenda')}>Ver toda</a>
          </div>
          {upcoming.length === 0 ? (
            <p className="admin-panel-caption" style={{ marginTop: 0 }}>No tienes clases programadas esta semana.</p>
          ) : upcoming.map((s) => (
            <div key={s.id} className="dash-list-row">
              <div>
                <div className="admin-cell-sub" style={{ color: 'var(--accent)', fontWeight: 600 }}>{s.courseTitle}</div>
                <div className="dash-list-row-title">{s.title}</div>
                <div className="dash-list-row-sub">{new Date(s.startsAt).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' })} · {new Date(s.startsAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} · Clase en vivo</div>
              </div>
              <button className="admin-btn-ghost" onClick={() => navigate(`/live/${s.id}`)}><Video size={13} /> Ver sala</button>
            </div>
          ))}
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <span className="admin-panel-title">Tus pendientes</span>
            <a className="admin-panel-link" style={{ cursor: 'pointer' }} onClick={() => navigate('/student/entregas')}>Ver todos</a>
          </div>
          {pendingByCourse.length === 0 ? (
            <p className="admin-panel-caption" style={{ marginTop: 0 }}>No tienes entregas pendientes.</p>
          ) : pendingByCourse.map(({ course, pending }) => (
            <div key={course.id} className="dash-list-row">
              <div>
                <div className="admin-cell-sub" style={{ color: 'var(--accent)', fontWeight: 600 }}>{course.title}</div>
                <span className="admin-status admin-status-amber">Por entregar · {pending}</span>
              </div>
              <button className="admin-btn-ghost" onClick={() => navigate(`/student/curso/${course.id}/proyecto`)}><ArrowRight size={13} /> Ver proyecto</button>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-page-head">
        <h2 className="admin-page-title" style={{ fontSize: '1.15rem', marginBottom: 0 }}>Continúa aprendiendo</h2>
        <a className="admin-panel-link" style={{ cursor: 'pointer' }} onClick={() => navigate('/student/cursos')}>Ver mis cursos</a>
      </div>
      {enrolledCourses.length === 0 ? (
        <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B' }}>Todavía no estás inscrito en ningún curso.</div>
      ) : (
        <div className="home-courses-grid">
          {enrolledCourses.map((c) => (
            <div className="home-course-card" key={c.id} onClick={() => navigate(`/student/curso/${c.id}`)}>
              <div className="home-course-thumb"><img src={COURSE_THUMBNAILS[c.id]} alt={c.title} /></div>
              <div className="home-course-body">
                <div className="home-course-meta-row">
                  <span className="home-course-tag">{c.cardTag}</span>
                  <span className="home-course-live"><Video size={13} /> En vivo</span>
                </div>
                <div className="home-course-title"><span>{c.cardTitle[0]}</span><span className="accent">{c.cardTitle[1]}</span></div>
                <div style={{ margin: '10px 0 6px', display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', color: '#8B8A9B' }}>
                  <span>Tu progreso</span><span style={{ color: 'var(--accent)', fontWeight: 700 }}>{enrollments[c.id]?.progress || 0}%</span>
                </div>
                <div className="progress-bar" style={{ height: 6, marginBottom: 12 }}><div className="progress-fill" style={{ width: `${enrollments[c.id]?.progress || 0}%` }}></div></div>
                <span className="home-course-link" onClick={(e) => { e.stopPropagation(); navigate(`/player/${c.id}/1-1`); }}>Entrar al curso <ArrowRight size={16} /></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentInicio;
