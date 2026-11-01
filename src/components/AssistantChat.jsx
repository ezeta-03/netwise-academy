import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { fetchMyConversations } from '../lib/db';
import { isAiConfigured, askAssistant } from '../lib/groq';

const when = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  return d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
};

// Asistente IA (E13): la conversación abierta, con "Basado en:" bajo cada
// respuesta y atajos de preguntas; a la derecha "Tus conversaciones". Las
// instrucciones y los archivos los pone el servidor (lo configura el admin en A6).
const AssistantChat = ({ course, groupId, subtitle, starters, followUps, placeholder }) => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const threadRef = useRef(null);

  const load = useCallback(() => fetchMyConversations(currentUser?.uid, course.id).then(setConversations).catch(() => {}), [currentUser?.uid, course.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, sending]);

  const open = (c) => { setActiveId(c.id); setMessages(c.messages || []); };
  const fresh = () => { setActiveId(null); setMessages([]); };
  const active = conversations.find((c) => c.id === activeId);

  const send = async (raw) => {
    const text = (raw ?? input).trim();
    if (!text || sending) return;
    if (!isAiConfigured()) { addToast('El Asistente IA todavía no está conectado a un modelo.', 'info'); return; }
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setSending(true);
    try {
      const reply = await askAssistant({ courseId: course.id, groupId, conversationId: activeId, message: text });
      setMessages((prev) => [...prev, { role: 'assistant', text: reply.text, sources: reply.sources }]);
      setActiveId(reply.conversationId);
      load();
    } catch (err) {
      const limit = err?.code === 'functions/resource-exhausted';
      addToast(limit ? err.message : 'El asistente no pudo responder. Intenta de nuevo.', limit ? 'info' : 'error');
      setMessages((prev) => [...prev, { role: 'assistant', text: 'No pude responder esta vez. ¿Puedes intentarlo de nuevo?', failed: true }]);
    } finally {
      setSending(false);
    }
  };

  const lastIsBot = messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !messages[messages.length - 1].failed;

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Asistente IA</h1><p className="admin-page-sub">{subtitle}</p></div>
      </div>

      <div className="admin-two-col" style={{ gridTemplateColumns: 'minmax(0, 1fr) 280px', alignItems: 'flex-start' }}>
        <div className="admin-panel ai-chat">
          <div className="admin-panel-head ai-chat-head"><span className="admin-panel-title">{active?.title || 'Nueva conversación'}</span></div>
          <div className="ai-thread" ref={threadRef}>
            {messages.length === 0 ? (
              <div className="ai-empty">
                <div className="dash-ai-orb"><Sparkles size={24} /></div>
                <strong>¿Qué quieres entender hoy?</strong>
                <div className="chip-row" style={{ justifyContent: 'center', marginTop: 10 }}>
                  {starters.map((s) => <button key={s} type="button" className="chip" onClick={() => send(s)}>{s}</button>)}
                </div>
              </div>
            ) : messages.map((m, i) => (m.role === 'user' ? (
              <div key={i} className="ai-msg-user">{m.text}</div>
            ) : (
              <div key={i} className="ai-msg-bot">
                <div className="ai-bot-icon"><Sparkles size={13} /></div>
                <div className="ai-bot-bubble">
                  <p>{m.text}</p>
                  {m.sources?.length > 0 && (
                    <div className="ai-sources">Basado en: {m.sources.map((src) => <span key={src} className="ai-source">{src}</span>)}</div>
                  )}
                </div>
              </div>
            )))}
            {sending && <div className="ai-msg-bot"><div className="ai-bot-icon"><Sparkles size={13} /></div><div className="ai-bot-bubble"><p>Pensando...</p></div></div>}
            {lastIsBot && !sending && (
              <div className="chip-row" style={{ marginLeft: 40 }}>
                {followUps.map((s) => <button key={s} type="button" className="chip" onClick={() => send(s)}>{s}</button>)}
              </div>
            )}
          </div>
          <div className="ai-input-row">
            <input className="admin-input" placeholder={placeholder} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} disabled={sending} />
            <button className="dash-ai-send" onClick={() => send()} disabled={sending || !input.trim()} aria-label="Enviar"><Send size={17} /></button>
          </div>
          <p className="admin-cell-sub" style={{ margin: '8px 0 0' }}>Tus conversaciones se guardan para que puedas volver a ellas y se borran a los 2 meses. El asistente no hace tu trabajo ni pone notas.</p>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <span className="admin-panel-title">Tus conversaciones</span>
            <button className="admin-btn-ghost" style={{ padding: '5px 10px', color: 'var(--accent)' }} onClick={fresh}><Plus size={13} /> Nueva</button>
          </div>
          {conversations.length === 0 ? <p className="admin-panel-caption" style={{ marginTop: 0 }}>Aquí quedan tus conversaciones de este curso.</p> : conversations.map((c) => (
            <button key={c.id} type="button" className={`ai-conv ${c.id === activeId ? 'active' : ''}`} onClick={() => open(c)}>
              <strong>{c.title}</strong><span>{when(c.updatedAt)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AssistantChat;
