import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Sparkles, Send, Plus } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { fetchCourseContent } from '../../lib/db';
import { isAiConfigured, askAssistant } from '../../lib/groq';
import { TEACHER_SYSTEM_PROMPT } from '../../lib/aiContext';

const SUGGESTIONS = [
  'Ayúdame a redactar retroalimentación para una entrega',
  'Genera 5 preguntas de repaso de este módulo',
  'Propón criterios de rúbrica para el entregable',
  'Prepara el guion de la próxima sesión',
];

const TeacherCourseIA = () => {
  const { course } = useOutletContext();
  const { addToast } = useUI();
  const [modules, setModules] = useState([]);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const threadRef = useRef(null);

  useEffect(() => { fetchCourseContent(course.id).then((data) => setModules(data.modules || [])); }, [course.id]);
  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, sending]);

  const systemInstruction = useMemo(() => TEACHER_SYSTEM_PROMPT(course, modules), [course, modules]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    if (!isAiConfigured()) {
      addToast('El Asistente IA todavía no está conectado a un modelo.', 'info');
      return;
    }

    const history = messages;
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setSending(true);
    try {
      const reply = await askAssistant({ systemInstruction, history, message: text });
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      // Tope diario de la Cloud Function (functions/index.js) -- mensaje propio.
      const limit = err?.code === 'functions/resource-exhausted';
      addToast(limit ? err.message : 'El asistente no pudo responder. Intenta de nuevo.', limit ? 'info' : 'error');
      setMessages((prev) => [...prev, { role: 'assistant', text: 'No pude responder esta vez. ¿Puedes intentarlo de nuevo?' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Destraba tu siguiente paso.</h1>
          <p className="admin-page-sub">Prepara clases, retroalimentación y rúbricas sobre "{course.title}".</p>
        </div>
      </div>

      <div className="dash-ai-shell">
        <div className="dash-ai-head">
          <div className="dash-ai-title"><Sparkles size={18} color="var(--accent)" /> Netwise IA</div>
          <button className="admin-btn-ghost" onClick={() => setMessages([])} disabled={messages.length === 0}><Plus size={13} /> Nueva conversación</button>
        </div>

        {messages.length === 0 ? (
          <div className="dash-ai-empty">
            <div className="dash-ai-orb"><Sparkles size={26} /></div>
            <h2 style={{ fontSize: '1.15rem', color: '#14141F' }}>¿En qué te ayudo hoy?</h2>
            <div className="dash-ai-chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="dash-ai-chip" onClick={() => setInput(s)}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="dash-ai-thread" ref={threadRef}>
            {messages.map((m, i) => (
              <div key={i} className={`dash-ai-msg ${m.role === 'user' ? 'dash-ai-msg-user' : 'dash-ai-msg-bot'}`} style={{ whiteSpace: 'pre-wrap', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {m.text}
              </div>
            ))}
            {sending && <div className="dash-ai-msg dash-ai-msg-bot" style={{ alignSelf: 'flex-start' }}>Pensando...</div>}
          </div>
        )}

        <div className="dash-ai-input-row">
          <input
            placeholder="Escribe tu pregunta sobre este curso..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={sending}
          />
          <button className="dash-ai-send" onClick={handleSend} disabled={sending}><Send size={17} /></button>
        </div>
      </div>
    </div>
  );
};

export default TeacherCourseIA;
