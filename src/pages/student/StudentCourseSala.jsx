import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { fetchLiveSessions } from '../../lib/db';
import { sessionsForStudent } from '../../lib/groupAssignment';
import { getLiveSessionStatus } from '../../lib/liveSessionStatus';
import LiveRoom from '../../components/LiveRoom';
import WorkRoomCard from '../../components/WorkRoomCard';

const scheduleLineFor = (s) => {
  const start = new Date(s.startsAt);
  const end = new Date(start.getTime() + s.durationMin * 60000);
  const day = start.toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'short' });
  const fmt = (d) => d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${fmt(start)} – ${fmt(end)}`;
};

// Sala del alumno: la próxima clase de su aula (en Google Meet) y la sala de
// trabajo del aula para reunirse con compañeros fuera de clase.
const StudentCourseSala = () => {
  const { course, group, enrollment } = useOutletContext();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLiveSessions(course.id)
      .then((all) => setSessions(sessionsForStudent(all, { [course.id]: enrollment })))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [course.id, enrollment]);

  if (loading) return <div className="admin-empty-hint">Cargando sala de reuniones...</div>;

  const mainSession = sessions
    .filter((s) => getLiveSessionStatus(s) === 'live' || getLiveSessionStatus(s) === 'upcoming')
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Sala de reuniones</h1><p className="admin-page-sub">{course.title}</p></div>
      </div>

      {mainSession ? (
        <div style={{ marginBottom: 32 }}>
          <LiveRoom
            session={mainSession}
            lobbyHeadline="Tu sala está lista. Esperamos al docente."
            lobbyMeta={mainSession.courseTitle}
            scheduleLine={scheduleLineFor(mainSession)}
          />
        </div>
      ) : (
        <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B', marginBottom: 32 }}>
          <p style={{ margin: 0 }}>Tu docente todavía no programa una clase en vivo.</p>
        </div>
      )}

      <WorkRoomCard group={group} />
    </div>
  );
};

export default StudentCourseSala;
