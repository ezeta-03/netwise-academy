import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Lock, ArrowLeft, FileText } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { fetchAssistantSettings, saveAssistantSettings, fetchGroups, fetchCourseContent, fetchPractices } from '../../lib/db';

// Las mismas de arranque que usa la función askAssistant (functions/index.js).
const DEFAULTS = {
  studentInstructions: 'Eres el tutor de Netwise Academy. Ayudas al estudiante a entender los temas de su curso con ejemplos simples y preguntas que lo hagan pensar. Respondes en español, con un tono cercano y claro. Si no sabes algo, lo dices.',
  teacherInstructions: 'Eres el asistente de Netwise Academy para docentes. Ayudas a preparar clases, redactar retroalimentación, generar preguntas de repaso y criterios de rúbrica. Respondes en español, breve y práctico.',
  offTopicMessage: 'Solo puedo ayudarte con temas de tu curso. Para otras dudas, escribe a Soporte.',
};
const NEVER = [
  { title: 'Responder temas que no son del curso' },
  { title: 'Hacer las entregas por el alumno', sub: 'Explica y guía, pero no entrega el trabajo resuelto.' },
  { title: 'Dar o adelantar notas' },
];
const fmt = (iso) => new Date(iso).toLocaleString('es-PE', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Lima' }).replace(/\./g, '');

// Asistente IA (A6): el admin decide cómo responde (para alumnos y docentes),
// ve con qué archivos responde cada aula y la privacidad. Las instrucciones se
// guardan en settings/assistant y las aplica el servidor al instante.
const AdminAsistente = () => {
  const navigate = useNavigate();
  const { addToast } = useUI();
  const { courses } = useCourseOfferings();
  const [cfg, setCfg] = useState(null);
  const [tab, setTab] = useState('student');
  const [aulas, setAulas] = useState([]);
  const [contents, setContents] = useState({});
  const [practices, setPractices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAssistantSettings().then((s) => setCfg({ ...DEFAULTS, ...s })).catch(() => setCfg(DEFAULTS));
    fetchGroups().then((list) => setAulas(list.filter((g) => g.status !== 'closed'))).catch(() => {});
    const ids = courses.map((c) => c.id);
    Promise.all(ids.map((id) => fetchCourseContent(id).then((c) => [id, c.modules || []]).catch(() => [id, []]))).then((pairs) => setContents(Object.fromEntries(pairs)));
    if (ids.length) fetchPractices(ids).then(setPractices).catch(() => {});
  }, [courses]);

  const save = async (patch, msg) => {
    setSaving(true);
    try {
      await saveAssistantSettings(patch);
      setCfg((c) => ({ ...c, ...patch }));
      addToast(msg || 'Guardado. El asistente ya responde así.', 'success');
    } catch {
      addToast('No se pudo guardar. Intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!cfg) return <div className="admin-empty-hint">Cargando asistente...</div>;

  const courseOf = (g) => courses.find((c) => c.id.toString() === g.courseId?.toString());
  const materialsOf = (g) => (contents[courseOf(g)?.id] || []).flatMap((m) => m.materials || []).filter((m) => m.title);
  const practicesOf = (g) => practices.filter((p) => p.courseId?.toString() === g.courseId?.toString() && (!p.groupId || p.groupId === g.id));
  const filesOf = (g) => (courseOf(g)?.syllabus ? 1 : 0) + materialsOf(g).length;

  if (selected) {
    const course = courseOf(selected);
    const mods = contents[course?.id] || [];
    const due = [...mods.filter((m) => m.deliverable?.description).map((m, i) => ({ label: `Entrega del Módulo ${i + 1}`, when: m.deliverable.dueDate || 'según el calendario del aula' })),
      ...practicesOf(selected).map((p) => ({ label: `Práctica · ${p.title}`, when: p.dueAt ? fmt(p.dueAt) : '—' }))];
    return (
      <div className="anim-fade-up d1">
        <button className="admin-panel-link entrega-back" onClick={() => setSelected(null)}><ArrowLeft size={14} /> Volver al Asistente IA</button>
        <div className="admin-page-head">
          <div><h1 className="admin-page-title">Asistente de {selected.name}</h1><p className="admin-page-sub">{course?.title} · Con esto responde a los alumnos de esta aula.</p></div>
        </div>
        <div className="ai-sources-grid">
          <div className="admin-panel">
            <div className="ai-step">1</div><div className="admin-panel-title">Del curso</div>
            <p className="admin-cell-sub">El sílabo, que se sube en Cursos y precios.</p>
            {course?.syllabus ? (
              <div className="submit-work-file"><span className="submit-work-ext">PDF</span><div className="submit-work-file-name" style={{ flex: 1 }}>{course.syllabus.name}</div><a className="admin-btn-ghost" href={course.syllabus.url} target="_blank" rel="noreferrer">Ver</a></div>
            ) : <div className="dash-notice warn" style={{ marginTop: 0 }}>Falta el sílabo: el asistente no puede responder sobre el curso.</div>}
            <button className="admin-btn-ghost" onClick={() => navigate('/admin/cursos')}>Ir a Cursos y precios</button>
          </div>
          <div className="admin-panel">
            <div className="ai-step">2</div><div className="admin-panel-title">Del aula</div>
            <p className="admin-cell-sub">Los materiales que sube el docente y las fechas de entrega. Se toman solos.</p>
            {materialsOf(selected).length === 0 ? <p className="admin-cell-sub">El docente aún no sube materiales.</p> : materialsOf(selected).map((m) => (
              <div key={m.id || m.title} className="ai-file-row"><FileText size={13} /> {m.title}</div>
            ))}
            {due.length > 0 && <div className="submit-work-label" style={{ marginTop: 10 }}>Fechas de entrega</div>}
            {due.map((d) => <div key={d.label} className="ai-file-row"><span style={{ flex: 1 }}>{d.label}</span><span className="admin-cell-sub">{d.when}</span></div>)}
          </div>
          <div className="admin-panel">
            <div className="ai-step">3</div><div className="admin-panel-title">Del alumno que pregunta</div>
            <p className="admin-cell-sub">Solo su empresa, la de Mi proyecto, para darle ejemplos con su marca. Nunca usa lo de otros alumnos ni lo de otras aulas.</p>
            <span className="admin-status admin-status-violet">Automático</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fade-up d1">
      <span className="admin-eyebrow">Administración / Netwise Academy</span>
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Asistente IA</h1><p className="admin-page-sub">Aquí decides cómo responde el asistente y qué archivos usa en cada aula. Los cambios se aplican al instante.</p></div>
      </div>

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="admin-panel-head" style={{ marginBottom: 2 }}><span className="admin-panel-title">Con qué responde el asistente</span></div>
        <p className="admin-panel-caption" style={{ marginTop: 0 }}>Cuando un alumno pregunta, el asistente usa solo estas tres cosas de su aula:</p>
        <div className="ai-sources-grid">
          <div className="ai-source-card"><div className="ai-step">1</div><strong>Del curso</strong><span>El sílabo del curso.</span><em>Se sube en Cursos y precios</em></div>
          <div className="ai-source-card"><div className="ai-step">2</div><strong>Del aula</strong><span>Materiales del docente y fechas de entrega.</span><em>Lo pone el docente</em></div>
          <div className="ai-source-card"><div className="ai-step">3</div><strong>Del alumno</strong><span>Solo su empresa, la de Mi proyecto.</span><em>Automático</em></div>
        </div>
      </div>

      <div className="admin-two-col" style={{ gridTemplateColumns: 'minmax(0, 1fr) 340px', alignItems: 'flex-start', marginBottom: 20 }}>
        <div className="admin-panel">
          <div className="admin-panel-head" style={{ marginBottom: 2 }}><span className="admin-panel-title">Cómo debe responder</span></div>
          <p className="admin-panel-caption" style={{ marginTop: 0 }}>Escríbelo como se lo explicarías a un tutor nuevo.</p>
          <div className="chip-row" style={{ marginBottom: 10 }}>
            <button className={`chip ${tab === 'student' ? 'active' : ''}`} onClick={() => setTab('student')}>Para estudiantes</button>
            <button className={`chip ${tab === 'teacher' ? 'active' : ''}`} onClick={() => setTab('teacher')}>Para docentes</button>
          </div>
          <textarea className="admin-input" rows={5} value={tab === 'student' ? cfg.studentInstructions : cfg.teacherInstructions}
            onChange={(e) => setCfg((c) => ({ ...c, [tab === 'student' ? 'studentInstructions' : 'teacherInstructions']: e.target.value }))} />
          <div className="admin-modal-actions"><button className="admin-btn-edit" disabled={saving} onClick={() => save({ studentInstructions: cfg.studentInstructions, teacherInstructions: cfg.teacherInstructions })}>Guardar</button></div>
        </div>
        <div className="admin-panel">
          <div className="admin-panel-head" style={{ marginBottom: 2 }}><span className="admin-panel-title">Archivos por aula</span></div>
          <p className="admin-panel-caption" style={{ marginTop: 0 }}>Entra a un aula para ver qué usa el asistente.</p>
          {aulas.length === 0 ? <p className="admin-cell-sub">No hay aulas abiertas.</p> : aulas.map((g) => (
            <button key={g.id} type="button" className="ai-aula-row" onClick={() => setSelected(g)}>
              <div><strong>{courseOf(g)?.title || g.courseTitle}</strong><span>{g.name} · {filesOf(g)} archivo{filesOf(g) === 1 ? '' : 's'}</span></div>
              {courseOf(g)?.syllabus ? <span className="admin-status admin-status-green">Listo</span> : <span className="admin-status admin-status-amber">Falta el sílabo</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-two-col" style={{ gridTemplateColumns: 'minmax(0, 1fr) 340px', alignItems: 'flex-start' }}>
        <div className="admin-panel">
          <div className="admin-panel-head" style={{ marginBottom: 2 }}><span className="admin-panel-title">Lo que nunca hace</span></div>
          <p className="admin-panel-caption" style={{ marginTop: 0 }}>Aplica en todos los cursos. No se puede apagar.</p>
          {NEVER.map((n) => (
            <div key={n.title} className="never-row"><X size={13} /><div><strong>{n.title}</strong>{n.sub && <span>{n.sub}</span>}</div></div>
          ))}
          <div className="admin-field" style={{ marginTop: 12 }}>
            <label>Si preguntan algo que no es del curso, responde:</label>
            <input value={cfg.offTopicMessage} onChange={(e) => setCfg((c) => ({ ...c, offTopicMessage: e.target.value }))} onBlur={() => save({ offTopicMessage: cfg.offTopicMessage }, 'Mensaje guardado.')} />
          </div>
        </div>
        <div className="admin-panel">
          <div className="admin-panel-head" style={{ marginBottom: 2 }}><span className="admin-panel-title">Privacidad</span></div>
          <p className="admin-panel-caption" style={{ marginTop: 0 }}>Cuánto se guardan las conversaciones.</p>
          <div className="dash-list-row-title" style={{ marginBottom: 10 }}>Se borran a los 2 meses, en todos los cursos</div>
          <div className="cert-note" style={{ alignItems: 'flex-start' }}><Lock size={14} /><span><strong style={{ color: 'var(--accent)' }}>El alumno verá este aviso</strong><br />«Tus conversaciones se guardan para que puedas volver a ellas y se borran a los 2 meses.»</span></div>
        </div>
      </div>
    </div>
  );
};

export default AdminAsistente;
