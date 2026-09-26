import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, ArrowRight, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { COURSE_THUMBNAILS } from '../../lib/courseThumbnails';
import { fetchMyEnrollments, fetchMyPreregistrations, fetchMyOrders } from '../../lib/db';

const StudentCursos = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { courses } = useCourseOfferings();
  const [enrollments, setEnrollments] = useState({});
  const [preregisteredIds, setPreregisteredIds] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    Promise.all([
      fetchMyEnrollments(currentUser.uid),
      fetchMyPreregistrations(currentUser.uid),
      fetchMyOrders(currentUser.uid).catch(() => []),
    ]).then(([enr, prereg, orders]) => {
      setEnrollments(enr);
      setPreregisteredIds(prereg);
      setPendingOrders(orders.filter((o) => o.status === 'pending'));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [currentUser]);

  if (loading) return <div className="admin-empty-hint">Cargando tus cursos...</div>;

  const isActive = (c) => enrollments[c.id] && (enrollments[c.id].status || 'active') === 'active';
  const enrolledCourses = courses.filter(isActive);
  // Pago enviado y aún sin validar, o matrícula que el admin dejó pendiente.
  const waitingCourses = courses.filter((c) => !isActive(c) && (
    enrollments[c.id] || pendingOrders.some((o) => o.courseId?.toString() === c.id.toString())
  ));
  const preregisteredCourses = courses.filter((c) => preregisteredIds.includes(c.id) && !enrollments[c.id] && !waitingCourses.includes(c));

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Mis cursos</h1>
          <p className="admin-page-sub">Retoma tus clases y proyectos.</p>
        </div>
      </div>

      {waitingCourses.length > 0 && (
        <div className="admin-panel" style={{ marginBottom: 24 }}>
          {waitingCourses.map((c) => (
            <div key={c.id} className="dash-list-row">
              <div>
                <div className="dash-list-row-title">{c.title}</div>
                <div className="dash-list-row-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={13} /> {enrollments[c.id] ? 'Tu matrícula está pendiente de activación.' : 'Estamos validando tu pago -- te damos acceso en cuanto se confirme.'}
                </div>
              </div>
              <span className="admin-status admin-status-amber">En validación</span>
            </div>
          ))}
        </div>
      )}

      {enrolledCourses.length === 0 ? (
        waitingCourses.length === 0 && <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B', marginBottom: 24 }}>
          Todavía no estás inscrito en ningún curso. Explora el <a href="/catalog" onClick={(e) => { e.preventDefault(); navigate('/catalog'); }} style={{ color: 'var(--accent)', cursor: 'pointer' }}>catálogo</a>.
        </div>
      ) : (
        <div className="home-courses-grid" style={{ marginBottom: preregisteredCourses.length ? 32 : 0 }}>
          {enrolledCourses.map((c) => (
            <div className="home-course-card" key={c.id} role="link" tabIndex={0} aria-label={`Abrir ${c.title}`} onClick={() => navigate(`/student/curso/${c.id}`)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/student/curso/${c.id}`); } }}>
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
                <div className="progress-bar" style={{ height: 6, marginBottom: 6 }}><div className="progress-fill" style={{ width: `${enrollments[c.id]?.progress || 0}%` }}></div></div>
                <div className="admin-cell-sub" style={{ marginBottom: 12 }}>{(enrollments[c.id]?.completedLessonIds || []).length} módulos completados</div>
                <span className="home-course-link" onClick={(e) => { e.stopPropagation(); navigate(`/student/curso/${c.id}`); }}>Entrar al curso <ArrowRight size={16} /></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {preregisteredCourses.length > 0 && (
        <>
          <div className="admin-page-head">
            <div>
              <span className="dash-eyebrow">Te sugerimos</span>
              <h2 className="admin-page-title" style={{ fontSize: '1.15rem', marginBottom: 0 }}>Complementa con los siguientes cursos</h2>
            </div>
          </div>
          <div className="admin-panel">
            {preregisteredCourses.map((c) => (
              <div key={c.id} className="dash-list-row">
                <div>
                  <div className="dash-list-row-title">{c.title}</div>
                  <div className="dash-list-row-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={13} /> Te avisaremos cuando se abra la cohorte</div>
                </div>
                <button className="admin-btn-ghost" onClick={() => navigate(`/course/${c.id}`)}>Ver taller</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default StudentCursos;
