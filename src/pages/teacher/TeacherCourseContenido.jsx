import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Video, Save, FileText, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { fetchCourseContent, saveCourseContent, fetchAllEnrollments, fetchSubmissions, upsertSubmission } from '../../lib/db';

const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const emptyModule = (n) => ({
  id: uid('m'), title: `Módulo ${n}`, weeksLabel: '', objective: '', practiceIntro: '', practiceBullets: [],
  materials: [], lessons: [], deliverable: { description: '', open: true },
});

const SessionForm = ({ initial, onSave, onCancel }) => {
  const [title, setTitle] = useState(initial?.title || '');
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl || '');
  const [duration, setDuration] = useState(initial?.duration || '');
  const canSave = title.trim() && videoUrl.trim();

  return (
    <div className="admin-panel" style={{ marginBottom: 10, background: '#F6F5FA' }}>
      <div className="admin-field-row">
        <div className="admin-field"><label>Título de la sesión</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Definición del propósito de marca" /></div>
        <div className="admin-field"><label>Duración</label><input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Ej. 108 min" /></div>
      </div>
      <div className="admin-field"><label>Link de la grabación</label><input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." /></div>
      <div className="admin-modal-actions">
        <button className="admin-btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="admin-btn-edit" disabled={!canSave} onClick={() => onSave({ id: initial?.id || uid('l'), title: title.trim(), videoUrl: videoUrl.trim(), duration: duration.trim(), resources: initial?.resources || [] })}>
          <Save size={13} /> Guardar sesión
        </button>
      </div>
    </div>
  );
};

const MaterialForm = ({ onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Material de clase');
  const [url, setUrl] = useState('');
  const canSave = title.trim() && url.trim();

  return (
    <div className="admin-panel" style={{ marginBottom: 10, background: '#F6F5FA' }}>
      <div className="admin-field-row">
        <div className="admin-field"><label>Título</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Guía de clase · Identidad Visual" /></div>
        <div className="admin-field">
          <label>Categoría</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option>Material de clase</option>
            <option>Plantillas</option>
            <option>Material de apoyo</option>
          </select>
        </div>
      </div>
      <div className="admin-field"><label>Enlace</label><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></div>
      <div className="admin-modal-actions">
        <button className="admin-btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="admin-btn-edit" disabled={!canSave} onClick={() => onSave({ id: uid('mat'), title: title.trim(), category, url: url.trim() })}><Save size={13} /> Guardar material</button>
      </div>
    </div>
  );
};

const ModuleEditForm = ({ module, onSave, onCancel }) => {
  const [title, setTitle] = useState(module.title);
  const [weeksLabel, setWeeksLabel] = useState(module.weeksLabel || '');
  const [objective, setObjective] = useState(module.objective || '');
  const [practiceIntro, setPracticeIntro] = useState(module.practiceIntro || '');
  const [practiceBullets, setPracticeBullets] = useState((module.practiceBullets || []).join('\n'));
  const [deliverable, setDeliverable] = useState(module.deliverable?.description || '');
  const [dueDate, setDueDate] = useState(module.deliverable?.dueDate || '');

  return (
    <div className="admin-panel">
      <div className="admin-field-row">
        <div className="admin-field"><label>Nombre del módulo</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="admin-field"><label>Semanas</label><input value={weeksLabel} onChange={(e) => setWeeksLabel(e.target.value)} placeholder="Ej. Semanas 1-2" /></div>
      </div>
      <div className="admin-field"><label>Objetivo</label><textarea rows={2} value={objective} onChange={(e) => setObjective(e.target.value)} /></div>
      <div className="admin-field"><label>Introducción de "Contenidos y práctica"</label><textarea rows={2} value={practiceIntro} onChange={(e) => setPracticeIntro(e.target.value)} /></div>
      <div className="admin-field"><label>Puntos (uno por línea)</label><textarea rows={4} value={practiceBullets} onChange={(e) => setPracticeBullets(e.target.value)} /></div>
      <div className="admin-field-row">
        <div className="admin-field" style={{ flex: 1 }}><label>Entregable</label><textarea rows={2} value={deliverable} onChange={(e) => setDeliverable(e.target.value)} /></div>
        <div className="admin-field"><label>Fecha límite (opcional)</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
      </div>
      <div className="admin-modal-actions">
        <button className="admin-btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="admin-btn-edit" onClick={() => onSave({
          ...module, title: title.trim() || module.title, weeksLabel, objective, practiceIntro,
          practiceBullets: practiceBullets.split('\n').map((b) => b.trim()).filter(Boolean),
          deliverable: { ...module.deliverable, description: deliverable, dueDate: dueDate || null },
        })}><Save size={13} /> Guardar módulo</button>
      </div>
    </div>
  );
};

const SubmissionsTable = ({ course, module, onClose }) => {
  const { addToast } = useUI();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.all([fetchAllEnrollments(), fetchSubmissions(course.id, module.id)]).then(([enrollments, subs]) => {
      const courseEnrollments = enrollments.filter((e) => e.courseId?.toString() === course.id.toString());
      setRows(courseEnrollments.map((e) => ({
        uid: e.uid, studentName: e.studentName || e.uid,
        submission: subs.find((s) => s.uid === e.uid) || null,
      })));
      setLoading(false);
    });
  }, [course.id, module.id]);

  useEffect(() => { load(); }, [load]);

  const markReviewed = async (row) => {
    await upsertSubmission({
      courseId: course.id, moduleId: module.id, moduleTitle: module.title,
      uid: row.uid, studentName: row.studentName,
      deliverableTitle: module.deliverable?.description || module.title,
      status: 'reviewed',
    });
    addToast(`Entrega de ${row.studentName} marcada como revisada.`, 'success');
    load();
  };

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <span className="dash-eyebrow">{module.title}</span>
          <h1 className="admin-page-title">Evaluaciones</h1>
          <p className="admin-page-sub">{course.title}</p>
        </div>
        <button className="admin-btn-ghost" onClick={onClose}>← Volver al módulo</button>
      </div>
      <div className="admin-table-wrap">
        {loading ? <div className="admin-empty-hint">Cargando entregas...</div> : rows.length === 0 ? (
          <div className="admin-empty-hint">Todavía no hay alumnos matriculados en este curso.</div>
        ) : (
          <table className="admin-table">
            <thead><tr><th>Estudiante</th><th>Entregable</th><th>Estado</th><th>Evaluación</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const status = row.submission?.status === 'reviewed' ? { label: 'Revisado', cls: 'admin-status-green' } : { label: 'Pendiente', cls: 'admin-status-amber' };
                return (
                  <tr key={row.uid}>
                    <td className="admin-cell-name">{row.studentName}</td>
                    <td>{module.deliverable?.description || module.title}</td>
                    <td><span className={`admin-status ${status.cls}`}>{status.label}</span></td>
                    <td>
                      {row.submission?.status === 'reviewed'
                        ? <span className="admin-cell-sub">Ya revisado</span>
                        : <button className="admin-btn-ghost" onClick={() => markReviewed(row)}><CheckCircle2 size={13} /> Revisar</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const TeacherCourseContenido = () => {
  const { course } = useOutletContext();
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modules, setModules] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingModule, setEditingModule] = useState(false);
  const [addingSession, setAddingSession] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [reviewing, setReviewing] = useState(false);

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

  const addModule = () => {
    const next = [...modules, emptyModule(modules.length + 1)];
    persist(next);
    setSelectedId(next[next.length - 1].id);
  };

  const saveModule = (updated) => {
    persist(modules.map((m) => (m.id === updated.id ? updated : m)), 'Módulo actualizado.');
    setEditingModule(false);
  };

  const deleteModule = (id) => {
    if (!confirm('¿Eliminar este módulo y todo su contenido?')) return;
    const next = modules.filter((m) => m.id !== id);
    persist(next);
    setSelectedId(next[0]?.id || null);
  };

  const saveSession = (session) => {
    const exists = selected.lessons.some((l) => l.id === session.id);
    const lessons = exists ? selected.lessons.map((l) => (l.id === session.id ? session : l)) : [...selected.lessons, session];
    persist(modules.map((m) => (m.id === selected.id ? { ...m, lessons } : m)));
    setAddingSession(false);
    setEditingSessionId(null);
  };

  const deleteSession = (sessionId) => {
    if (!confirm('¿Eliminar esta sesión grabada?')) return;
    persist(modules.map((m) => (m.id === selected.id ? { ...m, lessons: m.lessons.filter((l) => l.id !== sessionId) } : m)));
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

  if (reviewing && selected) {
    return <SubmissionsTable course={course} module={selected} onClose={() => setReviewing(false)} />;
  }

  return (
    <div className="anim-fade-up d1">
      <div className="admin-two-col" style={{ gridTemplateColumns: '1fr 300px', alignItems: 'flex-start' }}>
        <div>
          {editingModule ? (
            <ModuleEditForm module={selected} onSave={saveModule} onCancel={() => setEditingModule(false)} />
          ) : (
            <>
              <span className="dash-eyebrow">{selected.weeksLabel ? `${selected.title.toUpperCase()} · ${selected.weeksLabel}` : selected.title.toUpperCase()}</span>
              <h1 className="admin-page-title">{selected.title}</h1>
              <p className="admin-page-sub" style={{ marginBottom: 20 }}>{course.title}</p>

              {selected.objective && (
                <div className="dash-callout">
                  <div className="dash-callout-label">Objetivo</div>
                  <div className="dash-callout-text">{selected.objective}</div>
                </div>
              )}

              {(selected.practiceIntro || selected.practiceBullets?.length > 0) && (
                <div style={{ marginBottom: 22 }}>
                  <h3 style={{ fontSize: '1rem', color: '#14141F', marginBottom: 6 }}>Contenidos y práctica</h3>
                  {selected.practiceIntro && <p style={{ fontSize: '.88rem', color: '#4A4860' }}>{selected.practiceIntro}</p>}
                  {selected.practiceBullets?.length > 0 && (
                    <ul className="dash-bullets">{selected.practiceBullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
                  )}
                </div>
              )}

              <div className="admin-panel" style={{ marginBottom: 20 }}>
                <div className="admin-panel-head">
                  <span className="admin-panel-title">Materiales de este módulo</span>
                  {!addingMaterial && <button className="admin-btn-edit" onClick={() => setAddingMaterial(true)}><Plus size={13} /> Subir material</button>}
                </div>
                {addingMaterial && <MaterialForm onSave={saveMaterial} onCancel={() => setAddingMaterial(false)} />}
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
                      <a className="admin-btn-ghost" href={mat.url} target="_blank" rel="noreferrer">Descargar</a>
                      <button className="admin-icon-btn" onClick={() => removeMaterial(mat.id)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="admin-panel" style={{ marginBottom: 20 }}>
                <div className="admin-panel-head">
                  <span className="admin-panel-title">Sesiones grabadas</span>
                  <span className="admin-status admin-status-gray">{selected.lessons.length} sesión{selected.lessons.length === 1 ? '' : 'es'}</span>
                </div>
                {selected.lessons.map((les) => (
                  editingSessionId === les.id ? (
                    <SessionForm key={les.id} initial={les} onSave={saveSession} onCancel={() => setEditingSessionId(null)} />
                  ) : (
                    <div key={les.id} className="dash-list-row">
                      <div>
                        <div className="dash-list-row-title">{les.title}</div>
                        <div className="dash-list-row-sub">{les.duration || 'Sin duración'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <a className="admin-btn-ghost" href={les.videoUrl} target="_blank" rel="noreferrer"><Video size={13} /> Ver grabación</a>
                        <button className="admin-icon-btn" onClick={() => setEditingSessionId(les.id)}><Pencil size={13} /></button>
                        <button className="admin-icon-btn" onClick={() => deleteSession(les.id)}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  )
                ))}
                {addingSession ? (
                  <SessionForm onSave={saveSession} onCancel={() => setAddingSession(false)} />
                ) : (
                  <button className="admin-btn-ghost" style={{ marginTop: 10 }} onClick={() => setAddingSession(true)}><Plus size={13} /> Agregar sesión</button>
                )}
              </div>

              <div className="admin-panel">
                <div className="admin-panel-head"><span className="admin-panel-title">Entregable</span></div>
                <p style={{ fontSize: '.88rem', color: '#4A4860', marginBottom: 16 }}>{selected.deliverable?.description || 'Todavía no defines el entregable de este módulo.'}</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className="admin-btn-edit" onClick={() => setReviewing(true)}><CheckCircle2 size={14} /> Revisar entregas</button>
                  <button className="admin-btn-ghost" onClick={() => setEditingModule(true)}><Pencil size={14} /> Editar módulo</button>
                  <button className="admin-btn-ghost" onClick={toggleDeliverableOpen}>
                    <CheckCircle2 size={14} /> Marcar como {selected.deliverable?.open === false ? 'activo' : 'pendiente'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head"><span className="admin-panel-title">Módulos</span></div>
          <div className="dash-modules-rail">
            {modules.map((m, i) => (
              <div
                key={m.id}
                className={`dash-module-item ${m.id === selectedId ? 'active' : ''} ${m.deliverable?.open === false ? 'done' : ''}`}
                onClick={() => { setSelectedId(m.id); setEditingModule(false); setReviewing(false); setSearchParams({}); }}
              >
                <div className="dash-module-num">{m.deliverable?.open === false ? <CheckCircle2 size={13} /> : i + 1}</div>
                <div>
                  <div className="dash-module-title">{m.title}</div>
                  {m.weeksLabel && <div className="dash-module-sub">{m.weeksLabel}</div>}
                </div>
              </div>
            ))}
          </div>
          <button className="admin-btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={addModule}>
            <Plus size={14} /> Agregar módulo
          </button>
          {modules.length > 1 && (
            <button className="admin-btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 8, color: 'var(--rose)' }} onClick={() => deleteModule(selectedId)}>
              <Trash2 size={14} /> Eliminar módulo actual
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherCourseContenido;
