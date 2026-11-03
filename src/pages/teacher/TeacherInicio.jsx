import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Video, ArrowRight, Clock3, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { COURSE_THUMBNAILS } from '../../lib/courseThumbnails';
import { useEnterCourse } from '../../hooks/useEnterCourse';
import { useClassLinks } from '../../hooks/useClassLinks';
import { useNow } from '../../hooks/useNow';
import { fetchLiveSessions, fetchAllEnrollments, fetchCourseContent, fetchCourseSubmissions, fetchCourseAttendance, fetchGroups, fetchGroupProgress, fetchPractices } from '../../lib/db';
import { getClassCardState, daysUntil, isPendingClass } from '../../lib/liveSessionStatus';
import { meetLinkFor } from '../../lib/classLinks';
import { courseRoster } from '../../lib/roster';
import { buildClassList, normalizeAttendance } from '../../lib/classList';
import { deliverableDueDate } from '../../lib/deliveryDates';
import { deliverableModules } from '../../lib/weights';
import { buildToReview, buildAttentionList } from '../../lib/teacherHome';
import ClassCard from '../../components/ClassCard';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const initials = (name) => (name || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

// Inicio del docente (D1), de arriba hacia abajo: la clase de hoy con
// "Iniciar clase en Meet", lo que hay por revisar, los alumnos que necesitan
// atención y sus cursos.
const TeacherInicio = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { courses: allCourses } = useCourseOfferings();
  const now = useNow();
  // Un admin ve todo; un docente solo lo de los cursos que le asignaron.
  // useMemo: sin él `courses` es un array nuevo en cada render y el efecto de
  // abajo (que depende de él) se volvía a disparar sin parar para un docente.
  const courses = useMemo(
    () => (currentUser?.role === 'admin' ? allCourses : allCourses.filter((c) => c.teacherUid === currentUser?.uid)),
    [allCourses, currentUser?.role, currentUser?.uid],
  );
  const myCourseIds = useMemo(() => new Set(courses.map((c) => c.id.toString())), [courses]);
  const [sessions, setSessions] = useState([]);
  const [toReview, setToReview] = useState([]);
  const [attention, setAttention] = useState([]);
  const [rosterByGroup, setRosterByGroup] = useState({});
  const [loading, setLoading] = useState(true);
  const { enterCourse, picker } = useEnterCourse();
  const classLinks = useClassLinks(sessions);

  useEffect(() => {
    const ids = courses.map((c) => c.id);
    Promise.all([
      fetchLiveSessions(ids),
      // Un docente solo puede leer las matrículas de SUS cursos (reglas de Firestore).
      fetchAllEnrollments(currentUser?.role === 'admin' ? undefined : ids),
      ids.length ? fetchGroups(ids) : Promise.resolve([]),
      Promise.all(courses.map(async (c) => {
        const [content, subs, att] = await Promise.all([fetchCourseContent(c.id), fetchCourseSubmissions(c.id).catch(() => []), fetchCourseAttendance(c.id).catch(() => [])]);
        return { course: c, modules: content.modules || [], subs, att };
      })),
      ids.length ? fetchPractices(ids).catch(() => []) : Promise.resolve([]),
    ]).then(async ([allSessions, allEnrollments, groups, perCourse, practices]) => {
      const progress = Object.fromEntries(await Promise.all(groups.map((g) => fetchGroupProgress(g.id).then((done) => [g.id, done]).catch(() => [g.id, []]))));
      const groupById = new Map(groups.map((g) => [g.id, g]));
      const enrollmentOf = new Map(allEnrollments.map((e) => [`${e.courseId}_${e.uid}`, e]));
      const today = todayIso();

      setSessions(allSessions.filter((s) => myCourseIds.has(s.courseId?.toString())));

      // El plazo de una entrega depende del aula (horario e inicio): se usa la primera aula del curso.
      const firstGroupOf = (course) => groups.find((g) => g.courseId?.toString() === course.id.toString()) || null;
      setToReview(buildToReview({
        courses,
        submissionsByCourse: Object.fromEntries(perCourse.map((p) => [p.course.id, p.subs])),
        modulesByCourse: Object.fromEntries(perCourse.map((p) => [p.course.id, p.modules])),
        dueDateOf: (course, module, index) => deliverableDueDate(module, index, firstGroupOf(course)),
        practices,
      }));

      const students = perCourse.flatMap(({ course, modules, subs, att }) => courseRoster(allEnrollments, course.id).map((r) => {
        const enr = enrollmentOf.get(`${course.id}_${r.uid}`);
        const group = groupById.get(enr?.groupId) || null;
        const graded = deliverableModules(modules);
        const classList = buildClassList({ liveSessions: allSessions.filter((s) => s.courseId?.toString() === course.id.toString()), modules, groupId: group?.id || null, doneIds: progress[group?.id] || [] });
        return {
          ...r, course, email: enr?.studentEmail || null, groupId: group?.id || null,
          sessions: classList,
          attendance: normalizeAttendance(att.filter((a) => a.uid === r.uid), classList),
          submissions: subs.filter((s) => s.uid === r.uid && !s.practiceId),
          overdueModules: graded
            .map((m) => ({ m, due: deliverableDueDate(m, modules.indexOf(m), group) }))
            .filter(({ due }) => due && due < today)
            .map(({ m }) => ({ id: m.id, label: `Módulo ${modules.indexOf(m) + 1}` })),
        };
      }));
      setAttention(buildAttentionList(students));
      const counts = {};
      students.forEach((s) => { if (s.groupId) counts[s.groupId] = (counts[s.groupId] || 0) + 1; });
      setRosterByGroup(counts);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [courses, myCourseIds, currentUser?.role]);

  if (loading) return <div className="admin-empty-hint">Cargando tu semana...</div>;

  const pending = sessions
    .filter((s) => isPendingClass(s, now))
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const nextClass = pending[0] || null;
  const titleOf = (s) => courses.find((c) => c.id.toString() === s.courseId?.toString())?.title || s.courseTitle;
  const mins = nextClass ? Math.ceil((new Date(nextClass.startsAt).getTime() - now) / 60000) : null;
  const greetingSub = !nextClass
    ? 'No tienes clases programadas por ahora.'
    : getClassCardState(nextClass, now) === 'live'
      ? 'Tu clase está en vivo ahora.'
      : daysUntil(nextClass, now) === 0
        ? (mins <= 60 ? `Tu clase de hoy empieza en ${mins} minutos.` : `Tu clase de hoy es a las ${new Date(nextClass.startsAt).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' })}.`)
        : `Tu próxima clase es el ${new Date(nextClass.startsAt).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}.`;
  const studentsCount = nextClass?.groupId ? rosterByGroup[nextClass.groupId] : null;

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Hola, {currentUser?.displayName?.split(' ')[0] || 'Docente'}.</h1>
          <p className="admin-page-sub">{greetingSub}</p>
        </div>
        <button className="admin-btn-edit" onClick={() => navigate('/teacher/agenda')}><Calendar size={15} /> Ver mi agenda</button>
      </div>

      {nextClass && (
        <ClassCard
          session={nextClass} courseTitle={titleOf(nextClass)} role="teacher"
          meetLink={meetLinkFor(nextClass, classLinks)}
          meta={studentsCount ? `${studentsCount} alumno${studentsCount === 1 ? '' : 's'}` : null}
        />
      )}

      <div className="admin-two-col" style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="admin-panel">
          <div className="admin-panel-head" style={{ marginBottom: 4 }}><span className="admin-panel-title">Por revisar</span></div>
          <p className="admin-panel-caption" style={{ marginTop: 0 }}>Lo que tus alumnos te enviaron.</p>
          {toReview.length === 0 ? (
            <p className="admin-cell-sub" style={{ margin: 0 }}>No tienes entregas por revisar.</p>
          ) : toReview.map((r) => (
            <div key={`${r.course.id}-${r.moduleId}`} className="dash-list-row">
              <div>
                <div className="dash-list-row-title">{r.title}</div>
                <div className="dash-list-row-sub">{r.course.title}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <span className={`admin-status ${r.late ? 'admin-status-rose' : 'admin-status-amber'}`}>{r.count} nueva{r.count === 1 ? '' : 's'}{r.late ? ` · ${r.late} tarde` : ''}</span>
                <button className="admin-btn-edit" onClick={() => enterCourse(r.course, r.practiceId ? `/teacher/curso/${r.course.id}/practicas?practica=${r.practiceId}` : `/teacher/curso/${r.course.id}/entregas?modulo=${r.moduleId}`)}>Revisar</button>
              </div>
            </div>
          ))}
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head" style={{ marginBottom: 4 }}><span className="admin-panel-title">Alumnos que necesitan atención</span></div>
          <p className="admin-panel-caption" style={{ marginTop: 0 }}>Faltas seguidas, entregas vencidas o asistencia bajo 75%.</p>
          {attention.length === 0 ? (
            <p className="admin-cell-sub" style={{ margin: 0 }}>Todos tus alumnos van al día.</p>
          ) : attention.map((a) => (
            <div key={`${a.course.id}-${a.uid}`} className="dash-list-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="dash-post-avatar">{initials(a.studentName)}</div>
                <div>
                  <div className="dash-list-row-title">{a.studentName}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {a.reasons.map((r) => <span key={r.key} className={`admin-status admin-status-${r.tone}`} style={{ fontSize: '.68rem', padding: '2px 8px' }}>{r.label}</span>)}
                    {courses.length > 1 && <span className="admin-cell-sub">{a.course.title}</span>}
                  </div>
                </div>
              </div>
              {a.email
                ? <a className="admin-btn-ghost" href={`mailto:${a.email}`}><Mail size={13} /> Escribir</a>
                : <button className="admin-btn-ghost" disabled title="Este alumno no tiene correo registrado"><Mail size={13} /> Escribir</button>}
            </div>
          ))}
        </div>
      </div>

      <div className="admin-page-head">
        <h2 className="admin-page-title" style={{ fontSize: '1.15rem', marginBottom: 0 }}>Gestiona tus cursos</h2>
        <button className="admin-btn-ghost" onClick={() => navigate('/teacher/cursos')}>Ver mis cursos</button>
      </div>
      <div className="home-courses-grid">
        {courses.map((c) => (
          <div className="home-course-card" key={c.id} role="link" tabIndex={0} aria-label={`Abrir ${c.title}`} onClick={() => enterCourse(c)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enterCourse(c); } }}>
            <div className="home-course-thumb"><img src={COURSE_THUMBNAILS[c.id]} alt={c.title} /></div>
            <div className="home-course-body">
              <div className="home-course-meta-row">
                <span className="home-course-tag">{c.cardTag}</span>
                <span className="home-course-live"><Video size={13} /> En vivo</span>
              </div>
              <div className="home-course-title"><span>{c.cardTitle[0]}</span><span className="accent">{c.cardTitle[1]}</span></div>
              <p className="home-course-desc">{c.cardDesc}</p>
              <div className="home-course-info"><Clock3 size={14} /> {c.duration} <span className="home-course-info-dot" /> {c.level}</div>
              <span className="home-course-link">Ingresar curso <ArrowRight size={16} /></span>
            </div>
          </div>
        ))}
      </div>
      {picker}
    </div>
  );
};

export default TeacherInicio;
