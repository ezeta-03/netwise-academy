import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Sparkles, Send, Plus } from 'lucide-react';
import { useUI } from '../../context/UIContext';

const SUGGESTIONS = [
  'Explicar el tema de este módulo',
  'Guiarme con mi proyecto',
  'Crear preguntas para practicar',
  'Ayudarme a revisar mi avance',
];

const TeacherCourseIA = () => {
  const { course } = useOutletContext();
  const { addToast } = useUI();
  const [input, setInput] = useState('');

  // El asistente todavía no tiene un backend de IA conectado -- por ahora
  // esta pantalla es la interfaz real, sin inventar respuestas falsas.
  const handleSend = () => {
    if (!input.trim()) return;
    addToast('El Asistente IA todavía no está conectado a un modelo. Muy pronto podrás preguntarle sobre el contenido de tus cursos.', 'info');
    setInput('');
  };

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Destraba tu siguiente paso.</h1>
          <p className="admin-page-sub">Pregunta, repasa y aplica sobre "{course.title}".</p>
        </div>
      </div>

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
    </div>
  );
};

export default TeacherCourseIA;
