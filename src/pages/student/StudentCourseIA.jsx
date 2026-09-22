import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Sparkles, Send, Plus, Headphones } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { createSupportRequest, fetchCourseContent } from '../../lib/db';
import { isAiConfigured, askAssistant } from '../../lib/groq';
import { STUDENT_SYSTEM_PROMPT } from '../../lib/aiContext';

const SUGGESTIONS = [
  'Explicar el tema de este módulo',
  'Guiarme con mi proyecto',
  'Crear preguntas para practicar',
  'Ayudarme a revisar mi avance',
];

const StudentCourseIA = () => {
  const { course } = useOutletContext();
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const [modules, setModules] = useState([]);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const threadRef = useRef(null);

  useEffect(() => { fetchCourseContent(course.id).then((data) => setModules(data.modules || [])); }, [course.id]);
  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, sending]);

  const systemInstruction = useMemo(() => STUDENT_SYSTEM_PROMPT(course, modules), [course, modules]);

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
    } catch {
      addToast('El asistente no pudo responder. Intenta de nuevo.', 'error');
      setMessages((prev) => [...prev, { role: 'assistant', text: 'No pude responder esta vez. ¿Puedes intentarlo de nuevo?' }]);
    } finally {
      setSending(false);
    }
  };

  const askHuman = async () => {
    setRequesting(true);
    try {
      await createSupportRequest({
        requesterUid: currentUser?.uid, requesterName: currentUser?.displayName || 'Estudiante', requesterRole: 'student',
        type: 'plataforma', courseTitle: course.title, message: `Pidió acompañamiento humano desde el Asistente IA de "${course.title}".`,
      });
      addToast('Le avisamos a tu docente para que te acompañe. Revisa Soporte para el estado.', 'success');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Destraba tu siguiente paso.</h1>
          <p className="admin-page-sub">Pregunta, repasa y aplica. Tu criterio sigue siendo lo más importante.</p>
        </div>
      </div>

      <div className="admin-two-col" style={{ gridTemplateColumns: '1fr 280px', alignItems: 'flex-start' }}>
        <div className="dash-ai-shell">
          <div className="dash-ai-head">
            <div className="dash-ai-title"><Sparkles size={18} color="var(--accent)" /> Netwise IA</div>
            <button className="admin-btn-ghost" onClick={() => setMessages([])} disabled={messages.length === 0}><Plus size={13} /> Nueva conversación</button>
          </div>

          {messages.length === 0 ? (
            <div className="dash-ai-empty">
              <div className="dash-ai-orb"><Sparkles size={26} /></div>
              <h2 style={{ fontSize: '1.15rem', color: '#14141F' }}>¿Qué quieres entender hoy?</h2>
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
              placeholder="Escribe tu duda sobre este módulo..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={sending}
            />
            <button className="dash-ai-send" onClick={handleSend} disabled={sending}><Send size={17} /></button>
          </div>
        </div>

        <div className="admin-banner">
          <div>
            <div className="admin-banner-title">Aprender, con acompañamiento.</div>
            <p className="admin-banner-desc">El asistente orienta tu proceso. Tu docente evalúa el proyecto y resuelve las dudas que necesitan acompañamiento.</p>
            <button className="admin-btn-ghost" style={{ marginTop: 14, color: '#fff', background: 'rgba(255,255,255,.12)', borderColor: 'rgba(255,255,255,.3)' }} onClick={askHuman} disabled={requesting}>
              <Headphones size={14} /> {requesting ? 'Enviando...' : 'Pedir ayuda humana'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentCourseIA;
