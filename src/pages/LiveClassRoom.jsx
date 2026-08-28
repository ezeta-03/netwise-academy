import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { fetchLiveSessionById } from '../lib/db';
import { useAuth } from '../context/AuthContext';

// Sala embebida vía Jitsi Meet (meet.jit.si): no requiere cuenta ni API key.
// Para producción con marca propia / grabación en la nube, cambiar `JITSI_DOMAIN`
// por un servidor Jitsi self-hosted, o reemplazar el iframe por el SDK de
// LiveKit / Daily.co usando el mismo `session.roomName` como identificador de sala.
const JITSI_DOMAIN = 'meet.jit.si';

const LiveClassRoom = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
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
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/live')}>← Volver a Clases en vivo</button>
      </div>
    );
  }

  const displayName = encodeURIComponent(currentUser?.displayName || 'Invitado');
  const jitsiUrl = `https://${JITSI_DOMAIN}/${session.roomName}#userInfo.displayName="${displayName}"&config.prejoinPageEnabled=false`;

  return (
    <div className="view active" style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div>
          <div style={{ fontWeight: 600 }}>{session.title}</div>
          <div style={{ fontSize: '.8rem', color: 'var(--text3)' }}>{session.courseTitle} · {session.instructor}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/live')}><X size={14} /> Salir</button>
      </div>
      <div style={{ flex: 1, background: '#000' }}>
        <iframe
          title="Sala de clase en vivo"
          src={jitsiUrl}
          style={{ width: '100%', height: '100%', minHeight: 'calc(100vh - 130px)', border: 'none' }}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
        ></iframe>
      </div>
    </div>
  );
};

export default LiveClassRoom;
