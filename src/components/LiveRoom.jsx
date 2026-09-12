import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff, MoreHorizontal, ChevronRight, Send, Plus } from 'lucide-react';

// Sala embebida vía la IFrame API oficial de Jitsi Meet (meet.jit.si): no
// requiere cuenta ni API key. A diferencia de un <iframe src="..."> crudo,
// esta API evita el interstitial de "abrir en la app / descargar Jitsi Meet",
// y permite reemplazar TODA su UI nativa (toolbar, marca de agua, prejoin)
// por nuestros propios controles y chat, que hablan con la sala real por
// executeCommand/eventos en vez de simular algo.
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

const LiveRoom = ({ session, currentUser, roleLabel, scheduleLine, onExit, lobbyHeadline, lobbyMeta, joinLabel, secondaryAction }) => {
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const displayName = currentUser?.displayName || currentUser?.email || 'Invitado';

  useEffect(() => {
    if (!joined || !containerRef.current) return;
    let cancelled = false;

    loadJitsiScript().then(() => {
      if (cancelled || !containerRef.current) return;
      const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
        roomName: session.roomName,
        parentNode: containerRef.current,
        width: '100%',
        height: '100%',
        userInfo: { displayName },
        configOverwrite: {
          prejoinPageEnabled: false,
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

  if (!joined) {
    return (
      <div className="live-lobby">
        <div className="live-lobby-glow"></div>
        <h1 className="live-lobby-title">{lobbyHeadline || 'Abre la sala cuando sea el momento.'}</h1>
        <p className="live-lobby-course">{lobbyMeta ?? session.courseTitle}</p>
        {scheduleLine && <p className="live-lobby-schedule">{scheduleLine}</p>}
        <div className="live-lobby-controls">
          <button className={`live-round-btn ${micOn ? '' : 'off'}`} onClick={() => setMicOn((v) => !v)} title={micOn ? 'Silenciar micrófono' : 'Activar micrófono'}>
            {micOn ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
          <button className={`live-round-btn ${camOn ? '' : 'off'}`} onClick={() => setCamOn((v) => !v)} title={camOn ? 'Apagar cámara' : 'Encender cámara'}>
            {camOn ? <Video size={18} /> : <VideoOff size={18} />}
          </button>
          <button className="btn btn-primary btn-lg" onClick={() => setJoined(true)}>{joinLabel || 'Abrir Sala'}</button>
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
        <div className="live-stage-video" ref={containerRef}></div>
        <div className="live-stage-controlbar">
          <button className={`live-round-btn sm ${micOn ? '' : 'off'}`} onClick={() => exec('toggleAudio')}>{micOn ? <Mic size={16} /> : <MicOff size={16} />}</button>
          <button className={`live-round-btn sm ${camOn ? '' : 'off'}`} onClick={() => exec('toggleVideo')}>{camOn ? <Video size={16} /> : <VideoOff size={16} />}</button>
          <button className="live-round-btn sm" onClick={() => exec('toggleShareScreen')}><ScreenShare size={16} /></button>
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
