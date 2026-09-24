import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { fetchLiveSessionById } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import LiveRoom from '../components/LiveRoom';

// Agenda de cada rol: a donde se vuelve si la sala se abrió directo (sin historial).
const AGENDA_BY_ROLE = { admin: '/admin/grupos', teacher: '/teacher/agenda', student: '/student/agenda' };

const ROLE_LABELS = { admin: 'Administrador', teacher: 'Docente', student: 'Estudiante' };

const scheduleLineFor = (s) => {
  const start = new Date(s.startsAt);
  const end = new Date(start.getTime() + s.durationMin * 60000);
  const day = start.toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'short' });
  const fmt = (d) => d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${fmt(start)} – ${fmt(end)}`;
};

const LiveClassRoom = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  // Salir vuelve a la pantalla de donde se entró (Agenda, Inicio, curso...); si la sala se abrió
  // directo desde un enlace, cae en la agenda del rol.
  const exitRoom = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate(AGENDA_BY_ROLE[currentUser?.role] || '/', { replace: true });
  };
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLiveSessionById(sessionId).then((data) => {
      setSession(data);
      setLoading(false);
    });
  }, [sessionId]);

  if (loading) {
    return <div className="view active" style={{ padding: '40px', textAlign: 'center', color: 'var(--text2)' }}>Cargando sala...</div>;
  }

  if (!session) {
    return (
      <div className="view active" style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text2)', marginBottom: '16px' }}>No se encontró esta clase en vivo.</p>
        <button className="btn btn-ghost btn-sm" onClick={() => exitRoom()}>← Volver</button>
      </div>
    );
  }

  if (session.status === 'cancelled') {
    return (
      <div className="view active" style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ fontWeight: 600, marginBottom: '8px' }}>{session.title}</p>
        <p style={{ color: 'var(--text2)', marginBottom: '16px' }}>❌ Esta clase en vivo fue cancelada por el docente.</p>
        <button className="btn btn-ghost btn-sm" onClick={() => exitRoom()}>← Volver</button>
      </div>
    );
  }

  return (
    <div className="view active live-room">
      <div className="live-room-header" style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', background: 'var(--bg)' }}>
        <button className="btn-icon" title="Salir" onClick={() => exitRoom()}><X size={16} /></button>
      </div>
      <div className="live-room-stage" style={{ padding: '0 20px 20px', background: 'var(--bg)' }}>
        <LiveRoom
          session={session}
          currentUser={currentUser}
          roleLabel={ROLE_LABELS[currentUser?.role] || 'Invitado'}
          scheduleLine={scheduleLineFor(session)}
          onExit={() => exitRoom()}
          canRecord={currentUser?.role === 'teacher' || currentUser?.role === 'admin'}
        />
      </div>
    </div>
  );
};

export default LiveClassRoom;
