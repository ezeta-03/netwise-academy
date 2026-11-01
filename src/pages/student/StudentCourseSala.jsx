import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { FolderOpen } from 'lucide-react';
import { fetchLiveSessions } from '../../lib/db';
import { sessionsForStudent } from '../../lib/groupAssignment';
import { getClassCardState } from '../../lib/liveSessionStatus';
import { isMeetLink } from '../../lib/classLinks';
import { useNow } from '../../hooks/useNow';
import ClassCard, { ClassRow, RecordingButton } from '../../components/ClassCard';

// Clases en vivo del alumno (E3): arriba la clase de hoy (o la próxima) con
// "Entrar a Meet" directo, y debajo, lado a lado, las próximas clases y las
// anteriores con su grabación. Es el único lugar donde se ven las grabaciones.
const StudentCourseSala = () => {
  const { course, group, enrollment } = useOutletContext();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const now = useNow();
  const navigate = useNavigate();

  useEffect(() => {
    fetchLiveSessions(course.id)
      .then((all) => setSessions(sessionsForStudent(all, { [course.id]: enrollment })))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [course.id, enrollment]);

  if (loading) return <div className="admin-empty-hint">Cargando clases en vivo...</div>;

  const meetLink = isMeetLink(group?.classLink) ? group.classLink : null;
  const byDate = [...sessions].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const pending = byDate.filter((s) => { const st = getClassCardState(s, now); return st !== 'ended' && st !== 'cancelled'; });
  const main = pending[0] || null;
  const upcoming = pending.slice(1);
  const past = byDate.filter((s) => getClassCardState(s, now) === 'ended').reverse();

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Clases en vivo</h1><p className="admin-page-sub">Entra directo a Meet. Sin sala de espera ni pasos extra.</p></div>
      </div>

      {main ? (
        <ClassCard session={main} courseTitle={course.title} meetLink={meetLink}
          secondary={<button className="admin-btn-ghost" onClick={() => navigate('../materiales')}><FolderOpen size={14} /> Materiales del curso</button>} />
      ) : (
        <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B', marginBottom: 20 }}>
          <p style={{ margin: 0 }}>No tienes clases por delante en este curso.</p>
        </div>
      )}

      <div className="admin-two-col" style={{ marginTop: 6 }}>
        <div className="admin-panel">
          <div className="admin-panel-head" style={{ marginBottom: 4 }}><span className="admin-panel-title">Próximas clases</span></div>
          <p className="admin-panel-caption" style={{ marginTop: 0 }}>El botón para entrar se activa 10 minutos antes.</p>
          {upcoming.length === 0
            ? <p className="admin-cell-sub" style={{ margin: 0 }}>No hay más clases programadas.</p>
            : upcoming.map((s) => <ClassRow key={s.id} session={s} />)}
        </div>
        <div className="admin-panel">
          <div className="admin-panel-head" style={{ marginBottom: 4 }}><span className="admin-panel-title">Clases anteriores</span></div>
          <p className="admin-panel-caption" style={{ marginTop: 0 }}>Mira la grabación de cada clase.</p>
          {past.length === 0
            ? <p className="admin-cell-sub" style={{ margin: 0 }}>Todavía no hay clases dictadas.</p>
            : past.map((s) => <ClassRow key={s.id} session={s} past actions={<RecordingButton session={s} />} />)}
        </div>
      </div>
    </div>
  );
};

export default StudentCourseSala;
