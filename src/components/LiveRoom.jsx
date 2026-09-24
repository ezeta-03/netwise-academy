import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff, MoreHorizontal, ChevronRight, Send, Plus, Clock3, SmilePlus } from 'lucide-react';
import { canJoinLiveSession, LIVE_JOIN_WINDOW_MIN } from '../lib/liveSessionStatus';

const REACTIONS = ['👍', '❤️', '😂', '👏', '🎉', '🙌'];

// Sala embebida vía la IFrame API de 8x8 JaaS (Jitsi as a Service) -- antes
// usaba meet.jit.si directo, pero ese dominio corta la llamada a los 5
// minutos si se incrusta en otra página ("solo para demostración"). JaaS es
// el mismo motor de Jitsi sin ese límite, ligado a nuestro AppID. El proyecto
// tiene activado "Allow meeting participants to join unauthenticated" en su
// consola de JaaS, así que no hace falta firmar un JWT por participante.
const JAAS_APP_ID = 'vpaas-magic-cookie-befb8dfe88884f30b4c7d675903bea55';
const JITSI_DOMAIN = '8x8.vc';

const loadJitsiScript = () => {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  if (window.__jitsiScriptPromise) return window.__jitsiScriptPromise;
  window.__jitsiScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://${JITSI_DOMAIN}/${JAAS_APP_ID}/external_api.js`;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
  return window.__jitsiScriptPromise;
};

const LiveRoom = ({ session, currentUser, roleLabel, scheduleLine, onExit, lobbyHeadline, lobbyMeta, joinLabel, secondaryAction }) => {
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [now, setNow] = useState(Date.now());
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const displayName = currentUser?.displayName || currentUser?.email || 'Invitado';

  // Solo las clases programadas (con startsAt) tienen ventana de entrada; una
  // sala privada ad-hoc (sin horario) se puede abrir siempre. Se refresca
  // cada 15s mientras se espera, para que el botón se habilite solo apenas
  // se abre la ventana, sin que el docente/alumno tenga que recargar.
  const hasSchedule = !!session?.startsAt;
  const joinable = !hasSchedule || canJoinLiveSession(session);
  useEffect(() => {
    if (joined || joinable) return;
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, [joined, joinable]);
  const minutesUntilOpen = hasSchedule
    ? Math.max(0, Math.ceil((new Date(session.startsAt).getTime() - LIVE_JOIN_WINDOW_MIN * 60000 - now) / 60000))
    : 0;

  useEffect(() => {
    if (!joined || !containerRef.current) return;
    let cancelled = false;

    loadJitsiScript().then(() => {
      if (cancelled || !containerRef.current) return;
      const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
        roomName: `${JAAS_APP_ID}/${session.roomName}`,
        parentNode: containerRef.current,
        width: '100%',
        height: '100%',
        userInfo: { displayName },
        configOverwrite: {
          // Jitsi reemplazó prejoinPageEnabled por prejoinConfig.enabled y ya
          // no respeta el viejo: sin esto el alumno veía la pantalla "Join
          // meeting" de Jitsi encima de nuestro propio lobby. Se dejan ambos.
          prejoinConfig: { enabled: false },
          prejoinPageEnabled: false,
          // Sin esto Jitsi muestra el nombre técnico de la sala
          // ("Netwise Academy 1 1790282...").
          subject: session.title || session.courseTitle || 'Clase en vivo',
          disableDeepLinking: true,
          startWithAudioMuted: !micOn,
          startWithVideoMuted: !camOn,
          toolbarButtons: [],
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [],
          MOBILE_APP_PROMO: false,
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          HIDE_INVITE_MORE_HEADER: true,
          DEFAULT_BACKGROUND: '#141223',
          DISABLE_VIDEO_BACKGROUND: false,
        },
      });
      apiRef.current = api;

      api.addListener('audioMuteStatusChanged', ({ muted }) => setMicOn(!muted));
      api.addListener('videoMuteStatusChanged', ({ muted }) => setCamOn(!muted));
      api.addListener('incomingMessage', (m) => {
        setMessages((prev) => [...prev, { author: m.nick || 'Invitado', text: m.message, self: false }]);
      });
      api.addListener('outgoingMessage', (m) => {
        setMessages((prev) => [...prev, { author: displayName, text: m.message, self: true }]);
      });
      // Reacciones: no hay botón nativo (quitamos toda la UI de Jitsi), así
      // que las mandamos como un mensaje broadcast entre participantes y las
      // mostramos como un emoji flotante propio sobre el video.
      api.addListener('endpointTextMessageReceived', ({ eventData }) => {
        try {
          const msg = JSON.parse(eventData?.text || '{}');
          if (msg.type === 'reaction') addFloatingReaction(msg.emoji);
        } catch {
          // mensaje de otro tipo, se ignora
        }
      });
      api.addListener('readyToClose', () => onExit());
    });

    return () => {
      cancelled = true;
      apiRef.current?.dispose();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);

  const exec = (...args) => apiRef.current?.executeCommand(...args);
  const sendMessage = () => {
    if (!draft.trim()) return;
    exec('sendChatMessage', draft.trim());
    setDraft('');
  };
  const hangup = () => { exec('hangup'); onExit(); };

  const addFloatingReaction = (emoji) => {
    const id = `${Date.now()}-${Math.random()}`;
    const left = 10 + Math.random() * 80; // % dentro del stage, para que no salgan siempre del mismo punto
    setFloatingReactions((prev) => [...prev, { id, emoji, left }]);
    setTimeout(() => setFloatingReactions((prev) => prev.filter((r) => r.id !== id)), 2200);
  };
  const sendReaction = (emoji) => {
    exec('sendEndpointTextMessage', undefined, JSON.stringify({ type: 'reaction', emoji }));
    addFloatingReaction(emoji); // sendEndpointTextMessage no hace eco a quien lo manda
    setReactionPickerOpen(false);
  };

  if (!joined) {
    return (
      <div className="live-lobby">
        <div className="live-lobby-glow"></div>
        <h1 className="live-lobby-title">{lobbyHeadline || 'Abre la sala cuando sea el momento.'}</h1>
        <p className="live-lobby-course">{lobbyMeta ?? session.courseTitle}</p>
        {scheduleLine && <p className="live-lobby-schedule">{scheduleLine}</p>}
        {!joinable && (
          <p className="live-lobby-wait"><Clock3 size={14} /> Podrás entrar {minutesUntilOpen > 0 ? `en ${minutesUntilOpen} min` : 'en unos segundos'} (se habilita {LIVE_JOIN_WINDOW_MIN} min antes de la hora).</p>
        )}
        <div className="live-lobby-controls">
          <button className={`live-round-btn ${micOn ? '' : 'off'}`} onClick={() => setMicOn((v) => !v)} title={micOn ? 'Silenciar micrófono' : 'Activar micrófono'}>
            {micOn ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
          <button className={`live-round-btn ${camOn ? '' : 'off'}`} onClick={() => setCamOn((v) => !v)} title={camOn ? 'Apagar cámara' : 'Encender cámara'}>
            {camOn ? <Video size={18} /> : <VideoOff size={18} />}
          </button>
          <button className="btn btn-primary btn-lg" onClick={() => setJoined(true)} disabled={!joinable} title={joinable ? undefined : `Disponible ${LIVE_JOIN_WINDOW_MIN} min antes de la clase`}>
            {joinable ? (joinLabel || 'Abrir Sala') : 'Todavía no disponible'}
          </button>
          {secondaryAction && <button className="btn btn-ghost btn-lg" onClick={secondaryAction.onClick}><Plus size={16} /> {secondaryAction.label}</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="live-room-active">
    <div className="live-stage-wrap">
      <div className="live-stage">
        <div className="live-stage-head">
          <span className="live-stage-eyebrow"><Video size={13} /> Aula en vivo</span>
          <h2 className="live-stage-title">{session.courseTitle}</h2>
        </div>
        <div className="live-stage-video" ref={containerRef}>
          <div className="live-reactions-layer">
            {floatingReactions.map((r) => (
              <span key={r.id} className="live-reaction-emoji" style={{ left: `${r.left}%` }}>{r.emoji}</span>
            ))}
          </div>
        </div>
        <div className="live-stage-controlbar">
          <button className={`live-round-btn sm ${micOn ? '' : 'off'}`} onClick={() => exec('toggleAudio')}>{micOn ? <Mic size={16} /> : <MicOff size={16} />}</button>
          <button className={`live-round-btn sm ${camOn ? '' : 'off'}`} onClick={() => exec('toggleVideo')}>{camOn ? <Video size={16} /> : <VideoOff size={16} />}</button>
          <button className="live-round-btn sm" onClick={() => exec('toggleShareScreen')}><ScreenShare size={16} /></button>
          <div className="live-reaction-picker-wrap">
            {reactionPickerOpen && (
              <div className="live-reaction-picker">
                {REACTIONS.map((emoji) => (
                  <button key={emoji} className="live-reaction-option" onClick={() => sendReaction(emoji)}>{emoji}</button>
                ))}
              </div>
            )}
            <button className="live-round-btn sm" onClick={() => setReactionPickerOpen((v) => !v)} title="Reaccionar"><SmilePlus size={16} /></button>
          </div>
          <button className="live-round-btn sm hangup" onClick={hangup}><PhoneOff size={16} /></button>
          <button className="live-round-btn sm" onClick={() => setChatOpen((v) => !v)}><MoreHorizontal size={16} /></button>
        </div>
      </div>

      <div className={`live-chat ${chatOpen ? '' : 'collapsed'}`}>
        <div className="live-chat-head">
          <span>Chat</span>
          <button className="live-chat-toggle" onClick={() => setChatOpen((v) => !v)}><ChevronRight size={16} /></button>
        </div>
        {chatOpen && (
          <>
            <div className="live-chat-body">
              {messages.length === 0 ? (
                <p className="admin-panel-caption" style={{ marginTop: 0 }}>Los mensajes de la sala aparecerán aquí.</p>
              ) : messages.map((m, i) => (
                <div key={i} className={`live-chat-msg ${m.self ? 'self' : ''}`}>
                  <span className="live-chat-msg-author">{m.self ? `Tú · ${roleLabel}` : m.author}</span>
                  <div>{m.text}</div>
                </div>
              ))}
            </div>
            <div className="live-chat-input">
              <input placeholder="Escribe un mensaje..." value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} />
              <button onClick={sendMessage}><Send size={15} /></button>
            </div>
          </>
        )}
      </div>
    </div>
    {secondaryAction && (
      <button className="btn btn-ghost btn-lg live-room-extra-action" onClick={secondaryAction.onClick}><Plus size={16} /> {secondaryAction.label}</button>
    )}
    </div>
  );
};

export default LiveRoom;
