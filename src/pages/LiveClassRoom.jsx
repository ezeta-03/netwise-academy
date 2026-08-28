import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { fetchLiveSessionById } from '../lib/db';
import { useAuth } from '../context/AuthContext';

// Sala embebida vía la IFrame API oficial de Jitsi Meet (meet.jit.si): no
// requiere cuenta ni API key. A diferencia de un <iframe src="..."> crudo,
// esta API evita el interstitial de "abrir en la app / descargar Jitsi Meet"
// que Jitsi muestra cuando detecta que se está navegando a la página completa.
// Para producción con marca propia / grabación en la nube, cambiar
// `JITSI_DOMAIN` por un servidor Jitsi self-hosted, o reemplazar este
// componente por el SDK de LiveKit / Daily.co usando el mismo
// `session.roomName` como identificador de sala.
const JITSI_DOMAIN = 'meet.jit.si';

const loadJitsiScript = () => {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  if (window.__jitsiScriptPromise) return window.__jitsiScriptPromise;

  window.__jitsiScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://${JITSI_DOMAIN}/external_api.js`;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
  return window.__jitsiScriptPromise;
};

const LiveClassRoom = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);
  const apiRef = useRef(null);

  useEffect(() => {
    fetchLiveSessionById(sessionId).then((data) => {
      setSession(data);
      setLoading(false);
    });
  }, [sessionId]);

  useEffect(() => {
    if (!session || !containerRef.current) return;

    let cancelled = false;

    loadJitsiScript().then(() => {
      if (cancelled || !containerRef.current) return;
      apiRef.current = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
        roomName: session.roomName,
        parentNode: containerRef.current,
        width: '100%',
        height: '100%',
        userInfo: { displayName: currentUser?.displayName || 'Invitado' },
        configOverwrite: {
          prejoinPageEnabled: false,
          disableDeepLinking: true, // evita el prompt de "abrir en la app"
        },
        interfaceConfigOverwrite: {
          MOBILE_APP_PROMO: false,
        },
      });
    });

    return () => {
      cancelled = true;
      apiRef.current?.dispose();
      apiRef.current = null;
    };
  }, [session, currentUser]);

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

  return (
    <div className="view active live-room">
      <div className="live-room-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div>
          <div style={{ fontWeight: 600 }}>{session.title}</div>
          <div style={{ fontSize: '.8rem', color: 'var(--text3)' }}>{session.courseTitle} · {session.instructor}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/live')}><X size={14} /> Salir</button>
      </div>
      <div className="live-room-stage">
        <div ref={containerRef}></div>
      </div>
    </div>
  );
};

export default LiveClassRoom;
