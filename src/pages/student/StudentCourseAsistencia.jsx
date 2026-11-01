import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStudentCourse } from '../../hooks/useStudentCourse';
import { attendanceStats } from '../../lib/attendance';
import { APPROVAL } from '../../lib/approval';
import { GoalBar } from './StudentCourseNotas';
import { classLabel } from '../../lib/classList';

const fmtTime = (d) => d.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Lima' });

// Mi asistencia (E11): la versión del alumno de la Asistencia del docente (D3),
// sobre la misma lista de clases. Arriba cuánto lleva frente al 75% que
// necesita para su constancia; abajo cada sesión con lo que marcó el docente.
const StudentCourseAsistencia = () => {
  const { course, group } = useOutletContext();
  const { currentUser } = useAuth();
  const { data } = useStudentCourse(course, group, currentUser?.uid);

  if (!data) return <div className="admin-empty-hint">Cargando tu asistencia...</div>;
  if (data.error) return <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B' }}>No se pudo cargar tu asistencia. Recarga la página.</div>;

  const { classList, attendance } = data;
  const st = attendanceStats(classList, attendance);
  const total = classList.length;
  const needed = Math.ceil(total * (APPROVAL.minAttendancePct / 100));
  const dictated = classList.filter((c) => c.done).length;
  const recordOf = (id) => attendance.find((a) => a.sessionId === id) || null;

  const tagOf = (c) => {
    const r = recordOf(c.id);
    if (r?.excused) return <span className="admin-status admin-status-gray">No aplica</span>;
    if (r) return r.present ? <span className="admin-status admin-status-green">{r.late ? 'Presente · tarde' : 'Presente'}</span> : <span className="admin-status admin-status-rose">Falta</span>;
    if (c.done) return <span className="admin-status admin-status-rose">Falta</span>;
    const today = c.startsAt && new Date(c.startsAt).toDateString() === new Date().toDateString();
    return today ? <span className="admin-status admin-status-violet" title="Se marca al terminar la clase">Hoy</span> : null;
  };

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Mi asistencia</h1><p className="admin-page-sub">{course.title} · Lo que marca tu docente en cada clase.</p></div>
      </div>

      <div className="dark-card grade-hero">
        <div>
          <div className="grade-hero-eyebrow">Tu asistencia</div>
          <div className="grade-hero-value">{st.pct ?? '—'}<small>%</small></div>
          <span className="grade-hero-chip is-ok">{st.present} de {st.taken} clase{st.taken === 1 ? '' : 's'}</span>
          <p style={{ marginTop: 10 }}>Cuentan solo las clases que ya pasaron.</p>
        </div>
        <div className="grade-hero-bars">
          <GoalBar label="Para tu constancia" detail={`${st.present} de ${needed} clases que necesitas (${APPROVAL.minAttendancePct}%)`} value={needed ? (st.present / needed) * 100 : 0} ok={st.present >= needed && needed > 0} />
          <GoalBar label="Clases del curso" detail={`${dictated} de ${total} dictadas${total - dictated > 0 ? ` · faltan ${total - dictated}` : ''}`} value={total ? (dictated / total) * 100 : 0} />
        </div>
      </div>

      <div className="admin-panel" style={{ marginTop: 20 }}>
        <div className="admin-panel-head"><span className="admin-panel-title">Asistencia por sesión</span></div>
        {total === 0 ? <p className="admin-panel-caption" style={{ marginTop: 0 }}>Todavía no hay clases programadas.</p> : classList.map((c) => {
          const start = c.startsAt ? new Date(c.startsAt) : null;
          const end = start ? new Date(start.getTime() + (Number(c.durationMin) > 0 ? Number(c.durationMin) : 60) * 60000) : null;
          return (
            <div key={c.id} className="dash-list-row">
              <div>
                <div className="dash-list-row-title">{classLabel(c)}</div>
                <div className="dash-list-row-sub">
                  {[c.moduleTitle, start ? `${start.toDateString() === new Date().toDateString() ? 'Hoy, ' : ''}${c.dateLabel} · ${fmtTime(start)} – ${fmtTime(end)}` : c.dateLabel].filter(Boolean).join(' · ')}
                </div>
              </div>
              {tagOf(c)}
            </div>
          );
        })}
        <p className="admin-panel-caption" style={{ marginBottom: 0 }}>«No aplica» no cuenta en tu porcentaje. Si ves algo que no corresponde, escríbele a tu docente o a Soporte.</p>
      </div>
    </div>
  );
};

export default StudentCourseAsistencia;
