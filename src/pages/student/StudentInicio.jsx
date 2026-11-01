import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowRight, BookOpen, Clock3, Video } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { COURSE_THUMBNAILS } from '../../lib/courseThumbnails';
import { fetchLiveSessions, fetchMyEnrollments, fetchMyOrders, isActiveEnrollment, fetchCampusBanners } from '../../lib/db';
import { activeBanner } from '../../lib/campusBanner';
import CampusBanner from '../../components/CampusBanner';
import { fetchMyDeliverables } from '../../lib/studentDeliverables';
import { fetchCourseStanding } from '../../lib/studentStanding';
import { getClassCardState, daysUntil } from '../../lib/liveSessionStatus';
import { daysLeft, dueLabel, KIND_LABEL } from '../../lib/workItems';
import SubmitWorkModal from '../../components/SubmitWorkModal';
import { sessionsForStudent } from '../../lib/groupAssignment';
import InstitutionalEmailCard from './InstitutionalEmailCard';
import { useClassLinks } from '../../hooks/useClassLinks';
import { useNow } from '../../hooks/useNow';
import { meetLinkFor } from '../../lib/classLinks';
import ClassCard from '../../components/ClassCard';

const WEEK_DAYS = 7;
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' });

// Inicio del alumno (E1). De arriba hacia abajo responde: ¿tengo clase ahora?
// (la tarjeta de clase, con Meet en un clic), ¿cómo voy? (Mis cursos, con nota
// parcial y asistencia) y ¿qué tengo que entregar esta semana?
const StudentInicio = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { courses } = useCourseOfferings();
  const now = useNow();
  const [enrollments, setEnrollments] = useState({});
  const [sessions, setSessions] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [standing, setStanding] = useState({});
  const [pendingOrders, setPendingOrders] = useState([]);
  const [rejectedOrders, setRejectedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitItem, setSubmitItem] = useState(null);
  const [banners, setBanners] = useState([]);
  // Sube cuando el admin aprueba un pago mientras el alumno mira esta página.
  const [reloadKey, setReloadKey] = useState(0);

  const enrolledCourses = courses.filter((c) => enrollments[c.id] && (enrollments[c.id].status || 'active') === 'active');

  // Banner del campus (C3): el que esté activo, arriba de la clase de hoy.
  useEffect(() => { fetchCampusBanners().then(setBanners).catch(() => {}); }, []);

  useEffect(() => {
    if (!currentUser) return;
    fetchMyEnrollments(currentUser.uid).then((map) => {
      setEnrollments(map);
      // Solo matrículas activas: una pendiente todavía no puede leer el contenido del curso.
      const enrolled = courses.filter((c) => isActiveEnrollment(map[c.id]));
      // Pedidos aún sin validar, para que quien ya pagó sepa en qué está su acceso.
      fetchMyOrders(currentUser.uid)
        .then((orders) => {
          const open = orders.filter((o) => !isActiveEnrollment(map[o.courseId]));
          setPendingOrders(open.filter((o) => o.status === 'pending'));
          // Un rechazo solo se muestra si es lo último que pasó con ese curso
          // (si ya volvió a pagar, manda el pedido nuevo).
          const latest = new Map();
          [...open].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
            .forEach((o) => { if (!latest.has(String(o.courseId))) latest.set(String(o.courseId), o); });
          setRejectedOrders([...latest.values()].filter((o) => o.status === 'rejected'));
        })
        .catch(() => {});
      // La nota y la asistencia de cada curso llegan aparte: no frenan la clase de hoy.
      enrolled.forEach((c) => {
        fetchCourseStanding(c.id, currentUser.uid, map[c.id]?.groupId)
          .then((st) => setStanding((prev) => ({ ...prev, [c.id]: st })))
          .catch(() => {});
      });
      Promise.all([fetchLiveSessions(enrolled.map((c) => c.id)), fetchMyDeliverables(currentUser.uid, enrolled)]).then(([allSessions, list]) => {
        setSessions(sessionsForStudent(allSessions, map));
        setDeliverables(list);
        setLoading(false);
      }).catch(() => setLoading(false));
    }).catch(() => setLoading(false));
  }, [currentUser, courses, reloadKey]);

  const classLinks = useClassLinks(sessions);

  if (loading) return <div className="admin-empty-hint">Cargando tu semana...</div>;

  const titleOf = (courseId, fallback) => courses.find((c) => c.id.toString() === courseId?.toString())?.title || fallback;

  // "Tu clase de hoy": la próxima que aún no termina (si hoy no hay, la siguiente).
  const pending = sessions
    .filter((s) => { const st = getClassCardState(s, now); return st !== 'ended' && st !== 'cancelled'; })
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const nextClass = pending[0] || null;
  const nextIsToday = nextClass && daysUntil(nextClass, now) === 0;
  const alsoToday = nextIsToday ? pending.slice(1).filter((s) => daysUntil(s, now) === 0) : [];

  // "Esta semana": lo que vence en los próximos 7 días y aún no se entrega.
  const thisWeek = deliverables
    .filter((d) => d.status === 'pending' && d.dueDate)
    .map((d) => ({ ...d, days: daysLeft(d.dueDate) }))
    .filter((d) => d.days >= 0 && d.days <= WEEK_DAYS)
    .sort((a, b) => a.days - b.days);

  const firstName = currentUser?.displayName?.split(' ')[0] || 'Estudiante';
  const greetingSub = !nextClass
    ? 'Tu semana de aprendizaje.'
    : nextIsToday
      ? (getClassCardState(nextClass, now) === 'live' ? 'Tu clase está en vivo ahora.' : `Tu clase de hoy es a las ${fmtTime(nextClass.startsAt)}.`)
      : `Tu próxima clase es el ${new Date(nextClass.startsAt).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}.`;

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Hola, {firstName}.</h1>
          <p className="admin-page-sub">{greetingSub}</p>
        </div>
        <button className="admin-btn-edit" onClick={() => navigate('/student/agenda')}><Calendar size={15} /> Ver mi agenda</button>
      </div>

      {pendingOrders.map((o) => (
        <div key={o.id} className="admin-panel" role="status" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Clock3 size={18} />
          <div>
            <div className="dash-list-row-title">Estamos validando tu pago de {o.courseTitle}</div>
            <div className="admin-cell-sub">Pedido {o.code} · En cuanto lo confirmemos, el curso aparecerá aquí con tu aula y tu horario.</div>
          </div>
        </div>
      ))}
      <InstitutionalEmailCard
        uid={currentUser.uid}
        hasActiveEnrollment={enrolledCourses.length > 0}
        awaitingApproval={pendingOrders.length > 0}
        onApproved={() => setReloadKey((k) => k + 1)}
      />
      {enrolledCourses.filter((c) => !enrollments[c.id].groupId).map((c) => (
        <div key={`sin-aula-${c.id}`} className="admin-panel" role="status" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Clock3 size={18} />
          <div>
            <div className="dash-list-row-title">Todavía no tienes aula en {c.title}</div>
            <div className="admin-cell-sub">Ya puedes ver el contenido del curso. Tu horario de clases aparecerá aquí cuando te asignemos un aula.</div>
          </div>
        </div>
      ))}
      {rejectedOrders.map((o) => (
        <div key={o.id} className="admin-panel" role="alert" style={{ marginBottom: 16 }}>
          <div className="dash-list-row-title">No pudimos validar tu pago de {o.courseTitle}</div>
          <div className="admin-cell-sub" style={{ marginBottom: 10 }}>Pedido {o.code}{o.rejectReason ? ` · ${o.rejectReason}` : ''}. Puedes registrar el pago otra vez o escribirnos por Soporte.</div>
          <button className="admin-btn-edit" onClick={() => navigate(`/checkout/${o.courseId}`)}>Volver a registrar mi pago</button>
        </div>
      ))}

      <CampusBanner banner={activeBanner(banners, now)} />

      {nextClass ? (
        <>
          <ClassCard
            session={nextClass}
            courseTitle={titleOf(nextClass.courseId, nextClass.courseTitle)}
            meetLink={meetLinkFor(nextClass, classLinks)}
            secondary={<button className="admin-btn-ghost" onClick={() => navigate(`/student/curso/${nextClass.courseId}/contenido`)}><BookOpen size={14} /> Ver contenido del curso</button>}
          />
          {alsoToday.length > 0 && (
            <p className="home-also-today">
              También hoy: {alsoToday.map((s, i) => (
                <React.Fragment key={s.id}>{i > 0 && ' · '}<strong>{titleOf(s.courseId, s.courseTitle)} · {fmtTime(s.startsAt)}</strong></React.Fragment>
              ))}{' '}
              <a className="admin-panel-link" style={{ cursor: 'pointer' }} onClick={() => navigate('/student/agenda')}>Ver en mi agenda →</a>
            </p>
          )}
        </>
      ) : enrolledCourses.length > 0 && (
        <div className="admin-panel" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Video size={18} />
          <div className="admin-cell-sub">No tienes clases programadas por ahora. Cuando tu docente programe una, aparecerá aquí con su botón para entrar.</div>
        </div>
      )}

      <div className="admin-page-head" style={{ marginTop: 24 }}>
        <h2 className="admin-page-title" style={{ fontSize: '1.15rem', marginBottom: 0 }}>Mis cursos</h2>
        <button className="admin-btn-ghost" onClick={() => navigate('/student/cursos')}>Ver mis cursos</button>
      </div>
      {enrolledCourses.length === 0 ? (
        <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B' }}>Todavía no estás inscrito en ningún curso.</div>
      ) : (
        <div className="home-courses-grid">
          {enrolledCourses.map((c) => {
            const st = standing[c.id];
            const grade = st?.promedioParcial;
            const att = st?.attendance;
            return (
              <div className="home-course-card" key={c.id} role="link" tabIndex={0} aria-label={`Abrir ${c.title}`} onClick={() => navigate(`/student/curso/${c.id}`)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/student/curso/${c.id}`); } }}>
                <div className="home-course-thumb"><img src={COURSE_THUMBNAILS[c.id]} alt={c.title} /></div>
                <div className="home-course-body">
                  <div className="home-course-meta-row">
                    <span className="home-course-tag">{enrollments[c.id]?.groupName || c.cardTag}</span>
                    <span className="home-course-live"><BookOpen size={13} /> En curso</span>
                  </div>
                  <div className="home-course-title"><span>{c.cardTitle[0]}</span><span className="accent">{c.cardTitle[1]}</span></div>
                  <div style={{ margin: '10px 0 6px', display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', color: '#8B8A9B' }}>
                    <span>Nota parcial</span><span style={{ color: 'var(--accent)', fontWeight: 700 }}>{grade == null ? '—' : `${grade} / 20`}</span>
                  </div>
                  <div className="progress-bar" style={{ height: 6, marginBottom: 8 }}><div className="progress-fill" style={{ width: `${grade == null ? 0 : Math.min(100, (grade / 20) * 100)}%` }}></div></div>
                  <div style={{ fontSize: '.74rem', color: '#8B8A9B', marginBottom: 12 }}>
                    {!att ? 'Asistencia —' : att.taken === 0
                      ? `Asistencia 0 de 0${c.startDate ? ` · empieza el ${new Date(`${c.startDate}T00:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}` : ''}`
                      : `Asistencia ${att.present} de ${att.taken} · ${att.pct}% (mínimo 75%)`}
                  </div>
                  <span className="home-course-link" onClick={(e) => { e.stopPropagation(); navigate(`/student/curso/${c.id}`); }}>Entrar al curso <ArrowRight size={16} /></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="admin-panel" style={{ marginTop: 24 }}>
        <div className="admin-panel-head">
          <span className="admin-panel-title">Esta semana</span>
          <button className="admin-btn-ghost" onClick={() => navigate('/student/entregas')}>Ver mis entregas</button>
        </div>
        {thisWeek.length === 0 ? (
          <p className="admin-panel-caption" style={{ marginTop: 0 }}>No tienes entregas que venzan en los próximos 7 días.</p>
        ) : thisWeek.map((d) => {
          const due = new Date(`${d.dueDate}T12:00:00`);
          return (
            <div key={`${d.courseId}-${d.key}`} className="class-row">
              <div className="class-row-date is-plain">
                <small>{due.toLocaleDateString('es-PE', { weekday: 'short' }).replace('.', '')}</small>
                <strong>{String(due.getDate()).padStart(2, '0')}</strong>
              </div>
              <div className="class-row-body">
                <div className="class-row-course">{titleOf(d.courseId, d.courseTitle)}</div>
                <div className="class-row-title">{d.title}</div>
                <div className="class-row-sub" style={{ gap: 8 }}>
                  <span className={`work-tag ${d.kind === 'practice' ? 'is-practice' : 'is-module'}`}>{KIND_LABEL[d.kind]}</span>
                  <span className={`work-due ${d.days <= 2 ? 'is-soon' : ''}`}>{dueLabel(d.days)}</span>
                </div>
              </div>
              <div className="class-row-actions">
                {d.blocked
                  ? <button className="admin-btn-ghost" onClick={() => navigate(`/student/curso/${d.courseId}/proyecto`)} title="Primero define tu empresa en Mi proyecto">Definir mi empresa</button>
                  : <button className="admin-btn-edit" onClick={() => setSubmitItem(d)}>Entregar</button>}
              </div>
            </div>
          );
        })}
      </div>

      {submitItem && (
        <SubmitWorkModal
          course={{ id: submitItem.courseId, title: titleOf(submitItem.courseId, submitItem.courseTitle) }}
          item={submitItem} existing={submitItem.sub}
          onClose={() => setSubmitItem(null)} onSaved={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
};

export default StudentInicio;
