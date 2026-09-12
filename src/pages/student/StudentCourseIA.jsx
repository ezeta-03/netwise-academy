import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Sparkles, Send, Plus, Headphones } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { createSupportRequest } from '../../lib/db';

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
  const [input, setInput] = useState('');
  const [requesting, setRequesting] = useState(false);

  // El asistente todavía no tiene un backend de IA conectado -- por ahora
  // esta pantalla es la interfaz real, sin inventar respuestas falsas.
  const handleSend = () => {
    if (!input.trim()) return;
    addToast('El Asistente IA todavía no está conectado a un modelo. Muy pronto podrás preguntarle sobre el contenido de tus cursos.', 'info');
    setInput('');
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
            <button className="admin-btn-ghost" onClick={() => addToast('Nueva conversación disponible cuando el asistente esté conectado.', 'info')}><Plus size={13} /> Nueva conversación</button>
          </div>

          <div className="dash-ai-empty">
            <div className="dash-ai-orb"><Sparkles size={26} /></div>
            <h2 style={{ fontSize: '1.15rem', color: '#14141F' }}>¿Qué quieres entender hoy?</h2>
            <div className="dash-ai-chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="dash-ai-chip" onClick={() => setInput(s)}>{s}</button>
              ))}
            </div>
          </div>

          <div className="dash-ai-input-row">
            <input
              placeholder="Escribe tu duda sobre este módulo..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button className="dash-ai-send" onClick={handleSend}><Send size={17} /></button>
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
