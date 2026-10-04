import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Video, Save, FileText, CheckCircle2, Check, UploadCloud, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { fetchCourseContent, saveCourseContent, uploadCourseMaterial } from '../../lib/db';
import { can } from '../../lib/permissions';
import ModuleSessionCard, { GradedBadge } from '../../components/ModuleSessionCard';
import { isPendingUrl, isSafeLink } from '../../lib/placeholders';
import { getGradingScheme } from '../../lib/gradingScheme';
import { ModulesRailPanel, GuidePanel } from '../../components/CourseGuidePanels';

const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const MAX_MATERIAL_SIZE = 2 * 1024 * 1024;
const MATERIAL_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx';
const MATERIAL_TYPE_RE = /application\/(pdf|msword|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|presentationml\.presentation))/;

const emptyModule = (n) => ({
  id: uid('m'), title: `Módulo ${n}`, weeksLabel: '', objective: '', practiceIntro: '', practiceBullets: [],
  tools: [], sessions: [], materials: [], lessons: [], deliverable: { description: '', open: true, checklist: [] },
});

const SessionForm = ({ initial, onSave, onCancel }) => {
  const [title, setTitle] = useState(initial?.title || '');
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl || '');
  const [duration, setDuration] = useState(initial?.duration || '');
  const [date, setDate] = useState(initial?.date || '');
  const canSave = title.trim() && videoUrl.trim();

  return (
    <div className="admin-panel" style={{ marginBottom: 10, background: '#F6F5FA' }}>
      <div className="admin-field"><label>Título de la sesión</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Definición del propósito de marca" /></div>
      <div className="admin-field-row">
        <div className="admin-field"><label>Fecha</label><input value={date} onChange={(e) => setDate(e.target.value)} placeholder="Ej. 10 ago. 2026" /></div>
        <div className="admin-field"><label>Duración</label><input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Ej. 108 min" /></div>
      </div>
      <div className="admin-field"><label>Link de la grabación</label><input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." /></div>
      <div className="admin-modal-actions">
        <button className="admin-btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="admin-btn-edit" disabled={!canSave || !isSafeLink(videoUrl)} title={videoUrl && !isSafeLink(videoUrl) ? 'El enlace debe empezar con http:// o https://' : undefined} onClick={() => onSave({ id: initial?.id || uid('l'), title: title.trim(), videoUrl: videoUrl.trim(), duration: duration.trim(), date: date.trim(), resources: initial?.resources || [] })}>
          <Save size={13} /> Guardar sesión
        </button>
      </div>
    </div>
  );
};

const SessionDetailForm = ({ initial, onSave, onCancel }) => {
  const [dateLabel, setDateLabel] = useState(initial?.dateLabel || '');
  const [time, setTime] = useState(initial?.time || '');
  const [title, setTitle] = useState(initial?.title || '');
  const [status, setStatus] = useState(initial?.status || (initial?.done ? 'done' : 'scheduled'));
  const [learn, setLearn] = useState(initial?.learn || '');
  const [doInClass, setDoInClass] = useState(initial?.doInClass || '');
  const [task, setTask] = useState(initial?.task || '');
  const canSave = title.trim();

  return (
    <div className="admin-panel" style={{ marginBottom: 10, background: '#F6F5FA' }}>
      <div className="admin-field-row">
        <div className="admin-field"><label>Fecha</label><input value={dateLabel} onChange={(e) => setDateLabel(e.target.value)} placeholder="Ej. lun, 10 ago" /></div>
        <div className="admin-field"><label>Horario</label><input value={time} onChange={(e) => setTime(e.target.value)} placeholder="Ej. 19:00-21:00" /></div>
      </div>
      <div className="admin-field"><label>Título de la sesión</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Mapa del ecosistema digital" /></div>
      <div className="admin-field"><label>Aprenderás</label><textarea rows={2} value={learn} onChange={(e) => setLearn(e.target.value)} /></div>
      <div className="admin-field"><label>Harás en clase</label><textarea rows={2} value={doInClass} onChange={(e) => setDoInClass(e.target.value)} /></div>
      <div className="admin-field"><label>Tu tarea para el proyecto</label><textarea rows={2} value={task} onChange={(e) => setTask(e.target.value)} /></div>
      <div className="admin-field" style={{ marginBottom: 4 }}>
        <label>Estado de la sesión</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="scheduled">Programada</option>
          <option value="next">Próxima sesión</option>
          <option value="done">Realizada</option>
        </select>
      </div>
      <div className="admin-modal-actions">
        <button className="admin-btn-ghost" onClick={onCancel}>Cancelar</button>
        <button
          className="admin-btn-edit" disabled={!canSave}
          onClick={() => onSave({
            id: initial?.id || uid('s'), dateLabel: dateLabel.trim(), time: time.trim(), title: title.trim(),
            status, learn: learn.trim(), doInClass: doInClass.trim(), task: task.trim(),
          })}
        ><Save size={13} /> Guardar sesión</button>
      </div>
    </div>
  );
};

const MaterialForm = ({ courseId, moduleId, onSave, onCancel }) => {
  const { addToast } = useUI();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Material de clase');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const canSave = title.trim() && (file || url.trim());

  const applyFile = (f) => {
    if (!f) return;
    if (!MATERIAL_TYPE_RE.test(f.type)) { addToast('Solo se aceptan archivos PDF, DOCX o PPT.', 'error'); return; }
    if (f.size > MAX_MATERIAL_SIZE) { addToast('El archivo pesa más de 2.0MB.', 'error'); return; }
    setFile(f);
  };

  const handleSave = async () => {
    if (!file && !isSafeLink(url)) { addToast('El enlace debe empezar con http:// o https://', 'error'); return; }
    setSaving(true);
    try {
      const finalUrl = file ? await uploadCourseMaterial(courseId, moduleId, file) : url.trim();
      onSave({ id: uid('mat'), title: title.trim(), category, url: finalUrl });
    } catch {
      addToast('No se pudo subir el archivo. Intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-panel" style={{ marginBottom: 10, background: '#F6F5FA' }}>
      <div className="admin-field-row">
        <div className="admin-field"><label>Título</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Identidad Visual" /></div>
        <div className="admin-field">
          <label>Categoría</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option>Material de clase</option>
            <option>Plantillas</option>
            <option>Material de apoyo</option>
          </select>
        </div>
      </div>

      <div className="admin-field">
        <label>Sube tu archivo</label>
        <input
          ref={fileInputRef} type="file" accept={MATERIAL_ACCEPT} style={{ display: 'none' }}
          onChange={(e) => applyFile(e.target.files?.[0])}
        />
        <div
          className={`dash-upload-zone ${dragOver ? 'dragover' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); applyFile(e.dataTransfer.files?.[0]); }}
        >
          {file ? (
            <div className="dash-upload-zone-file">
              <FileText size={16} /> {file.name}
              <button type="button" className="admin-icon-btn" onClick={(e) => { e.stopPropagation(); setFile(null); }}><X size={13} /></button>
            </div>
          ) : (
            <>
              <div className="dash-upload-zone-icon"><UploadCloud size={22} /></div>
              <div className="dash-upload-zone-text">Arrastra y suelta o <span className="dash-upload-zone-link">elige el archivo</span> a subir.</div>
              <div className="dash-upload-zone-hint">Formato de archivo: PDF, DOCX, PPT. Máx 2.0MB</div>
            </>
          )}
        </div>
      </div>

      <div className="dash-upload-divider">o</div>

      <div className="admin-field"><label>Envía desde un enlace</label><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." disabled={!!file} /></div>

      <div className="admin-modal-actions">
        <button className="admin-btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="admin-btn-edit" disabled={!canSave || saving} onClick={handleSave}><Save size={13} /> {saving ? 'Guardando...' : 'Guardar material'}</button>
      </div>
    </div>
  );
};

// Lápiz de edición en línea (título, objetivo, contenidos): lo ven el docente
// del curso y el admin -- ambos pueden editar el contenido (canManageCourse).
// Sin el permiso "Editar módulos y lecciones" el lápiz no se muestra.
const CanEditContext = React.createContext(true);
const EditPencil = ({ onClick, label }) => {
  const canEdit = React.useContext(CanEditContext);
  if (!canEdit) return null;
  return <button type="button" className="inline-edit-btn" onClick={onClick} title={label} aria-label={label}><Pencil size={15} /></button>;
};

const InlineActions = ({ onSave, onCancel, disabled }) => (
  <div className="inline-edit-actions">
    <button type="button" className="admin-btn-ghost" onClick={onCancel}><X size={13} /> Cancelar</button>
    <button type="button" className="admin-btn-edit" onClick={onSave} disabled={disabled}><Save size={13} /> Guardar</button>
  </div>
);

const TitleEditor = ({ module, onSave, onCancel }) => {
  const [title, setTitle] = useState(module.title || '');
  const [weeksLabel, setWeeksLabel] = useState(module.weeksLabel || '');
  return (
    <div className="inline-edit-box">
      <div className="admin-field-row">
        <div className="admin-field" style={{ flex: 2 }}><label>Nombre del módulo</label><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
        <div className="admin-field"><label>Semanas</label><input value={weeksLabel} onChange={(e) => setWeeksLabel(e.target.value)} placeholder="Ej. Semanas 1-2" /></div>
      </div>
      <InlineActions disabled={!title.trim()} onCancel={onCancel} onSave={() => onSave({ title: title.trim(), weeksLabel: weeksLabel.trim() })} />
    </div>
  );
};

const ObjectiveEditor = ({ module, onSave, onCancel }) => {
  const [objective, setObjective] = useState(module.objective || '');
  return (
    <div className="inline-edit-box">
      <div className="admin-field"><label>Objetivo</label><textarea rows={3} value={objective} onChange={(e) => setObjective(e.target.value)} autoFocus /></div>
      <InlineActions onCancel={onCancel} onSave={() => onSave({ objective: objective.trim() })} />
    </div>
  );
};

const PracticeEditor = ({ module, onSave, onCancel }) => {
  const [practiceIntro, setPracticeIntro] = useState(module.practiceIntro || '');
  const [bullets, setBullets] = useState((module.practiceBullets || []).join('\n'));
  const [tools, setTools] = useState((module.tools || []).join(' · '));
  return (
    <div className="inline-edit-box">
      <div className="admin-field"><label>Introducción</label><textarea rows={3} value={practiceIntro} onChange={(e) => setPracticeIntro(e.target.value)} autoFocus /></div>
      <div className="admin-field"><label>Puntos (uno por línea)</label><textarea rows={5} value={bullets} onChange={(e) => setBullets(e.target.value)} /></div>
      <div className="admin-field"><label>Herramientas de las sesiones (separadas por ·)</label><input value={tools} onChange={(e) => setTools(e.target.value)} placeholder="Ej. Meta Business Suite · ChatGPT / Claude" /></div>
      <InlineActions onCancel={onCancel} onSave={() => onSave({
        practiceIntro: practiceIntro.trim(),
        practiceBullets: bullets.split('\n').map((b) => b.trim()).filter(Boolean),
        tools: tools.split('·').map((t) => t.trim()).filter(Boolean),
      })} />
    </div>
  );
};

const ModuleEditForm = ({ module, weightLocked, onSave, onCancel }) => {
  const [title, setTitle] = useState(module.title);
  const [weeksLabel, setWeeksLabel] = useState(module.weeksLabel || '');
  const [objective, setObjective] = useState(module.objective || '');
  const [practiceIntro, setPracticeIntro] = useState(module.practiceIntro || '');
  const [practiceBullets, setPracticeBullets] = useState((module.practiceBullets || []).join('\n'));
  const [tools, setTools] = useState((module.tools || []).join(' · '));
  const [deliverable, setDeliverable] = useState(module.deliverable?.description || '');
  const [dueDate, setDueDate] = useState(module.deliverable?.dueDate || '');
  const [weight, setWeight] = useState(module.deliverable?.weight ?? '');
  const [graded, setGraded] = useState(module.deliverable?.graded !== false);
  const [checklist, setChecklist] = useState((module.deliverable?.checklist || []).join('\n'));

  return (
    <div className="admin-panel">
      <div className="admin-field-row">
        <div className="admin-field"><label>Nombre del módulo</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="admin-field"><label>Semanas</label><input value={weeksLabel} onChange={(e) => setWeeksLabel(e.target.value)} placeholder="Ej. Semanas 1-2" /></div>
      </div>
      <div className="admin-field"><label>Objetivo</label><textarea rows={2} value={objective} onChange={(e) => setObjective(e.target.value)} /></div>
      <div className="admin-field"><label>Introducción de "Contenidos y práctica"</label><textarea rows={2} value={practiceIntro} onChange={(e) => setPracticeIntro(e.target.value)} /></div>
      <div className="admin-field"><label>Puntos (uno por línea)</label><textarea rows={4} value={practiceBullets} onChange={(e) => setPracticeBullets(e.target.value)} /></div>
      <div className="admin-field"><label>Herramientas de "Sesiones del módulo" (separadas por ·)</label><input value={tools} onChange={(e) => setTools(e.target.value)} placeholder="Ej. Meta Business Suite · ChatGPT / Claude" /></div>
      <div className="admin-field-row">
        <div className="admin-field" style={{ flex: 1 }}><label>Entregable</label><textarea rows={2} value={deliverable} onChange={(e) => setDeliverable(e.target.value)} /></div>
        <div className="admin-field"><label>Fecha límite (opcional)</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
        <div className="admin-field"><label>Peso en la nota final (%)</label><input type="number" min="0" max="100" value={weightLocked || !graded ? '' : weight} onChange={(e) => setWeight(e.target.value)} placeholder={!graded ? 'Sin nota' : weightLocked ? 'Lo fija el esquema de notas' : 'Ej. 25'} disabled={weightLocked || !graded} /></div>
      </div>
      <label className="admin-field-checkbox" style={{ marginBottom: 14 }}>
        <input type="checkbox" checked={graded} onChange={(e) => setGraded(e.target.checked)} />
        {' '}Este entregable se califica (lleva nota y cuenta en el promedio)
      </label>
      {!graded && <p className="admin-cell-sub" style={{ marginTop: -8, marginBottom: 14 }}>Sin nota: los alumnos lo presentan y tú lo revisas con retroalimentación, pero no cuenta en el promedio.</p>}
      <div className="admin-field"><label>Tu entregable debe incluir (uno por línea)</label><textarea rows={4} value={checklist} onChange={(e) => setChecklist(e.target.value)} /></div>
      <div className="admin-modal-actions">
        <button className="admin-btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="admin-btn-edit" onClick={() => onSave({
          ...module, title: title.trim() || module.title, weeksLabel, objective, practiceIntro,
          practiceBullets: practiceBullets.split('\n').map((b) => b.trim()).filter(Boolean),
          tools: tools.split('·').map((t) => t.trim()).filter(Boolean),
          deliverable: {
            ...module.deliverable, description: deliverable, dueDate: dueDate || null,
            weight: !graded || weight === '' ? null : Number(weight),
            graded,
            checklist: checklist.split('\n').map((c) => c.trim()).filter(Boolean),
          },
        })}><Save size={13} /> Guardar módulo</button>
      </div>
    </div>
  );
};

const TeacherCourseContenido = () => {
  const { course } = useOutletContext();
  const { currentUser } = useAuth();
  const { addToast, confirmDialog } = useUI();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modules, setModules] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingModule, setEditingModule] = useState(false);
  const [addingSession, setAddingSession] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [addingSessionDetail, setAddingSessionDetail] = useState(false);
  const [editingSessionDetail, setEditingSessionDetail] = useState(null);
  // `?subir=material` (botón de la página Materiales) abre el formulario de una vez.
  const [addingMaterial, setAddingMaterial] = useState(() => searchParams.get('subir') === 'material' && can(currentUser, 'uploadMaterials'));
  const canEdit = can(currentUser, 'editContent');
  const canUpload = can(currentUser, 'uploadMaterials');
  // Campo en edición en línea: 'title' | 'objective' | 'practice' | null.
  const [inlineField, setInlineField] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchCourseContent(course.id).then((data) => {
      const mods = data.modules || [];
      setModules(mods);
      const fromQuery = searchParams.get('modulo');
      setSelectedId(fromQuery && mods.some((m) => m.id === fromQuery) ? fromQuery : mods[0]?.id || null);
      setLoading(false);
    }).catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id]);

  useEffect(() => { load(); }, [load]);

  const persist = async (nextModules, successMsg) => {
    const previous = modules;
    setModules(nextModules);
    try {
      await saveCourseContent(course.id, nextModules, currentUser?.uid);
      if (successMsg) addToast(successMsg, 'success');
    } catch {
      setModules(previous);
      addToast('No se pudo guardar el cambio. Intenta de nuevo.', 'error');
    }
  };

  const selected = modules.find((m) => m.id === selectedId);
  const selectedIndex = modules.findIndex((m) => m.id === selectedId);
  const sessionOffset = modules.slice(0, selectedIndex).reduce((sum, m) => sum + (m.sessions?.length || 0), 0);

  const addModule = () => {
    const next = [...modules, emptyModule(modules.length + 1)];
    persist(next, `Módulo ${next.length} agregado.`);
    setSelectedId(next[next.length - 1].id);
  };

  const saveInline = (patch, msg) => {
    persist(modules.map((m) => (m.id === selected.id ? { ...m, ...patch } : m)), msg);
    setInlineField(null);
  };

  const saveModule = (updated) => {
    persist(modules.map((m) => (m.id === updated.id ? updated : m)), 'Módulo actualizado.');
    setEditingModule(false);
  };

  const deleteModule = async (id) => {
    if (!(await confirmDialog({ title: 'Eliminar módulo', message: '¿Eliminar este módulo y todo su contenido? Esta acción no se puede deshacer.', confirmLabel: 'Eliminar', danger: true }))) return;
    const next = modules.filter((m) => m.id !== id);
    persist(next, 'Módulo eliminado.');
    setSelectedId(next[0]?.id || null);
  };

  const saveSession = (session) => {
    const exists = selected.lessons.some((l) => l.id === session.id);
    const lessons = exists ? selected.lessons.map((l) => (l.id === session.id ? session : l)) : [...selected.lessons, session];
    persist(modules.map((m) => (m.id === selected.id ? { ...m, lessons } : m)), exists ? 'Sesión grabada actualizada.' : 'Sesión grabada agregada.');
    setAddingSession(false);
    setEditingSessionId(null);
  };

  const deleteSession = async (sessionId) => {
    if (!(await confirmDialog({ title: 'Eliminar sesión grabada', message: '¿Eliminar esta sesión grabada?', confirmLabel: 'Eliminar', danger: true }))) return;
    persist(modules.map((m) => (m.id === selected.id ? { ...m, lessons: m.lessons.filter((l) => l.id !== sessionId) } : m)), 'Sesión grabada eliminada.');
  };

  const saveSessionDetail = (session) => {
    const current = selected.sessions || [];
    const exists = current.some((s) => s.id === session.id);
    const sessions = exists ? current.map((s) => (s.id === session.id ? session : s)) : [...current, session];
    persist(modules.map((m) => (m.id === selected.id ? { ...m, sessions } : m)), exists ? 'Sesión actualizada.' : 'Sesión agregada.');
    setAddingSessionDetail(false);
    setEditingSessionDetail(null);
  };

  const deleteSessionDetail = async (sessionId) => {
    if (!(await confirmDialog({ title: 'Eliminar sesión', message: '¿Eliminar esta sesión del módulo?', confirmLabel: 'Eliminar', danger: true }))) return;
    persist(modules.map((m) => (m.id === selected.id ? { ...m, sessions: (m.sessions || []).filter((s) => s.id !== sessionId) } : m)), 'Sesión eliminada.');
  };

  const saveMaterial = (material) => {
    persist(modules.map((m) => (m.id === selected.id ? { ...m, materials: [...(m.materials || []), material] } : m)));
    setAddingMaterial(false);
  };

  const removeMaterial = (materialId) => {
    persist(modules.map((m) => (m.id === selected.id ? { ...m, materials: (m.materials || []).filter((x) => x.id !== materialId) } : m)));
  };

  const toggleDeliverableOpen = () => {
    persist(modules.map((m) => (m.id === selected.id ? { ...m, deliverable: { ...m.deliverable, open: !m.deliverable?.open } } : m)));
  };

  if (loading) return <div className="admin-empty-hint">Cargando contenido...</div>;

  if (modules.length === 0) {
    return (
      <div className="anim-fade-up d1">
        <div className="admin-page-head"><div><h1 className="admin-page-title">Contenido</h1><p className="admin-page-sub">{course.title}</p></div></div>
        <div className="admin-panel" style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: 16, color: '#6B6980' }}>Este curso todavía no tiene módulos.</p>
          <button className="admin-btn-edit" onClick={addModule} style={{ margin: '0 auto' }}><Plus size={15} /> Agregar el primer módulo</button>
        </div>
      </div>
    );
  }

  return (
    <CanEditContext.Provider value={canEdit}>
    <div className={`anim-fade-up d1 ${canEdit ? '' : 'content-readonly'}`}>
      <div className="admin-two-col" style={{ gridTemplateColumns: '1fr 300px', alignItems: 'flex-start' }}>
        <div>
          {!canEdit && <p className="dash-notice" style={{ marginTop: 0 }}>Tu cuenta puede ver el contenido, pero no editarlo. Si necesitas cambiar algo, pídelo a un administrador.</p>}
          {editingModule ? (
            <ModuleEditForm module={selected} weightLocked={!!getGradingScheme(course.id)} onSave={saveModule} onCancel={() => setEditingModule(false)} />
          ) : (
            <>
              <span className="dash-eyebrow">{selected.weeksLabel ? `${selected.title.toUpperCase()} · ${selected.weeksLabel}` : selected.title.toUpperCase()}</span>
              {inlineField === 'title' ? (
                <TitleEditor module={selected} onCancel={() => setInlineField(null)} onSave={(patch) => saveInline(patch, 'Título actualizado.')} />
              ) : (
                <div className="inline-edit-row">
                  <h1 className="admin-page-title">{selected.title}</h1>
                  <EditPencil label="Editar título del módulo" onClick={() => setInlineField('title')} />
                </div>
              )}
              <p className="admin-page-sub" style={{ marginBottom: 20 }}>{course.title}</p>

              {inlineField === 'objective' ? (
                <ObjectiveEditor module={selected} onCancel={() => setInlineField(null)} onSave={(patch) => saveInline(patch, 'Objetivo actualizado.')} />
              ) : (
                <div className={`dash-callout inline-edit-target ${selected.objective ? '' : 'empty'}`}>
                  <div className="dash-callout-label">Objetivo</div>
                  <div className="dash-callout-text">
                    {selected.objective || 'Todavía no defines el objetivo de este módulo.'}
                    <EditPencil label="Editar objetivo" onClick={() => setInlineField('objective')} />
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 22 }}>
                <h3 style={{ fontSize: '1rem', color: '#14141F', marginBottom: 6 }}>Contenidos y práctica</h3>
                {inlineField === 'practice' ? (
                  <PracticeEditor module={selected} onCancel={() => setInlineField(null)} onSave={(patch) => saveInline(patch, 'Contenidos actualizados.')} />
                ) : (
                  <div className="inline-edit-target">
                    {/* El lápiz va al final del último texto (último punto, o la intro). */}
                    {selected.practiceIntro && (
                      <p style={{ fontSize: '.88rem', color: '#4A4860' }}>
                        {selected.practiceIntro}
                        {!selected.practiceBullets?.length && <EditPencil label="Editar contenidos y práctica" onClick={() => setInlineField('practice')} />}
                      </p>
                    )}
                    {selected.practiceBullets?.length > 0 && (
                      <ul className="dash-bullets">
                        {selected.practiceBullets.map((b, i) => (
                          <li key={i}>
                            {b}
                            {i === selected.practiceBullets.length - 1 && <EditPencil label="Editar contenidos y práctica" onClick={() => setInlineField('practice')} />}
                          </li>
                        ))}
                      </ul>
                    )}
                    {!selected.practiceIntro && !selected.practiceBullets?.length && (
                      <p className="admin-panel-caption" style={{ margin: 0 }}>
                        Todavía no defines los contenidos de este módulo.
                        <EditPencil label="Editar contenidos y práctica" onClick={() => setInlineField('practice')} />
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <h3 style={{ fontSize: '1rem', color: '#14141F', margin: 0 }}>Sesiones del módulo</h3>
                  {canEdit && !addingSessionDetail && <button className="admin-btn-ghost" onClick={() => setAddingSessionDetail(true)}><Plus size={13} /> Agregar sesión</button>}
                </div>
                {selected.tools?.length > 0 && <div className="dash-session-tools">{selected.tools.join(' · ')}</div>}
                {(selected.sessions || []).map((s, i) => (
                  editingSessionDetail === s.id ? (
                    <SessionDetailForm key={s.id} initial={s} onSave={saveSessionDetail} onCancel={() => setEditingSessionDetail(null)} />
                  ) : (
                    <ModuleSessionCard
                      key={s.id} session={s} number={sessionOffset + i + 1}
                      onEdit={canEdit ? () => setEditingSessionDetail(s.id) : undefined}
                      onDelete={canEdit ? deleteSessionDetail : undefined}
                    />
                  )
                ))}
                {addingSessionDetail && <SessionDetailForm onSave={saveSessionDetail} onCancel={() => setAddingSessionDetail(false)} />}
                {(selected.sessions || []).length === 0 && !addingSessionDetail && (
                  <p className="admin-panel-caption" style={{ marginTop: 0 }}>Todavía no defines las sesiones en vivo de este módulo.</p>
                )}
              </div>

              <div className="admin-panel" style={{ marginBottom: 20 }}>
                <div className="admin-panel-head">
                  <span className="admin-panel-title">Materiales de este módulo</span>
                  {canUpload && !addingMaterial && <button className="admin-btn-edit" onClick={() => setAddingMaterial(true)}><Plus size={13} /> Subir material</button>}
                </div>
                {addingMaterial && <MaterialForm courseId={course.id} moduleId={selected.id} onSave={saveMaterial} onCancel={() => setAddingMaterial(false)} />}
                {(selected.materials || []).length === 0 && !addingMaterial ? (
                  <p className="admin-panel-caption" style={{ marginTop: 0 }}>Todavía no subes materiales para este módulo.</p>
                ) : selected.materials?.map((mat) => (
                  <div key={mat.id} className="dash-list-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="dash-list-row-icon"><FileText size={17} /></div>
                      <div>
                        <div className="dash-list-row-title">{mat.title}</div>
                        <div className="dash-list-row-sub">{mat.category} · {selected.title}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {isPendingUrl(mat.url) ? <span className="admin-status admin-status-gray">Pendiente de subir</span> : <a className="admin-btn-ghost" href={mat.url} target="_blank" rel="noreferrer">Descargar</a>}
                      {canUpload && <button className="admin-icon-btn content-keep" onClick={() => removeMaterial(mat.id)} aria-label={`Eliminar ${mat.title}`}><Trash2 size={13} /></button>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="admin-panel" style={{ marginBottom: 20 }}>
                <div className="admin-panel-head">
                  <span className="admin-panel-title">Sesiones grabadas</span>
                  {canEdit && !addingSession && <button className="admin-btn-edit" onClick={() => setAddingSession(true)}><Plus size={13} /> Subir sesión</button>}
                </div>
                <p className="admin-panel-caption" style={{ marginTop: 0 }}>Vuelve a ver las clases pasadas de este módulo a tu ritmo.</p>
                {selected.lessons.map((les, li) => (
                  editingSessionId === les.id ? (
                    <SessionForm key={les.id} initial={les} onSave={saveSession} onCancel={() => setEditingSessionId(null)} />
                  ) : (
                    <div key={les.id} className="dash-list-row">
                      <div>
                        <div className="dash-list-row-eyebrow">Sesión {String(li + 1).padStart(2, '0')}</div>
                        <div className="dash-list-row-title">{les.title}</div>
                        <div className="dash-list-row-sub">{les.date ? `${les.date} · ` : ''}{les.duration || 'Sin duración'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {isPendingUrl(les.videoUrl) ? <span className="admin-status admin-status-gray">Pendiente de grabar</span> : <a className="admin-btn-ghost" href={les.videoUrl} target="_blank" rel="noreferrer"><Video size={13} /> Ver grabación</a>}
                        <button className="admin-icon-btn" onClick={() => setEditingSessionId(les.id)}><Pencil size={13} /></button>
                        <button className="admin-icon-btn" onClick={() => deleteSession(les.id)}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  )
                ))}
                {addingSession && <SessionForm onSave={saveSession} onCancel={() => setAddingSession(false)} />}
              </div>

              <div className="admin-panel">
                <div className="admin-panel-head">
                  <span className="admin-panel-title">Entregable</span>
                  {selected.deliverable?.description && <GradedBadge graded={selected.deliverable.graded !== false} />}
                </div>
                <p style={{ fontSize: '.88rem', color: '#4A4860', marginBottom: selected.deliverable?.checklist?.length ? 10 : 16 }}>{selected.deliverable?.description || 'Todavía no defines el entregable de este módulo.'}</p>
                {selected.deliverable?.checklist?.length > 0 && (
                  <>
                    <p style={{ fontSize: '.82rem', fontWeight: 700, color: '#14141F', marginBottom: 0 }}>Tu entregable debe incluir</p>
                    <ul className="dash-checklist">
                      {selected.deliverable.checklist.map((c, i) => <li key={i}><Check size={15} />{c}</li>)}
                    </ul>
                  </>
                )}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className="admin-btn-edit" onClick={() => navigate(`../evaluacion?vista=entregas&modulo=${selected.id}`)}><CheckCircle2 size={14} /> Revisar entregas</button>
                  {canEdit && <button className="admin-btn-ghost" onClick={toggleDeliverableOpen}>
                    <CheckCircle2 size={14} /> Marcar como {selected.deliverable?.open === false ? 'activo' : 'completado'}
                  </button>}
                  <button className="admin-btn-ghost" onClick={() => setEditingModule(true)}><Pencil size={14} /> Editar módulo</button>
                </div>
              </div>
            </>
          )}
        </div>

        <div>
          <ModulesRailPanel
            courseId={course.id} modules={modules} activeModuleId={selectedId}
            onModuleClick={(id) => { setSelectedId(id); setEditingModule(false); setInlineField(null); setSearchParams({}); }}
            onAddModule={canEdit ? addModule : null}
            onDeleteModule={canEdit && modules.length > 1 ? () => deleteModule(selectedId) : null}
          />
          <GuidePanel courseId={course.id} />
        </div>
      </div>
    </div>
    </CanEditContext.Provider>
  );
};

export default TeacherCourseContenido;
