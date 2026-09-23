import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Lock, Plus, Pencil, Trash2, Save, Check, CheckSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { fetchCourseContent, fetchCourseRubric, saveCourseRubric } from '../../lib/db';
import { resolveWeights, deliverableLabel } from '../../lib/weights';
import { ModulesRailPanel, GuidePanel } from '../../components/CourseGuidePanels';

// "5" -> 5, "2,5" -> 2.5, "0-2" -> 2 (el máximo del rango): los puntos de un
// nivel pueden escribirse como rango y parseInt los truncaba o contaba mal.
const pointsValue = (text) => {
  const nums = String(text ?? '').match(/\d+(?:[.,]\d+)?/g);
  return nums ? Math.max(...nums.map((n) => Number(n.replace(',', '.')))) : 0;
};

const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const LEVELS = [
  { key: 'destacado', label: 'Destacado', defaultPoints: '5' },
  { key: 'logrado', label: 'Logrado', defaultPoints: '4' },
  { key: 'enProceso', label: 'En proceso', defaultPoints: '3' },
  { key: 'inicial', label: 'Inicial', defaultPoints: '0-2' },
];

const emptyLevels = () => Object.fromEntries(LEVELS.map((l) => [l.key, { points: l.defaultPoints, desc: '' }]));

const CriterionForm = ({ initial, onSave, onCancel }) => {
  const [title, setTitle] = useState(initial?.title || '');
  const [levels, setLevels] = useState(initial?.levels || emptyLevels());
  const canSave = title.trim();

  const setLevel = (key, field, value) => setLevels((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  return (
    <div className="admin-panel" style={{ marginBottom: 14, background: '#F6F5FA' }}>
      <div className="admin-field"><label>Criterio</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Diagnóstico y uso de datos" /></div>
      {LEVELS.map((l) => (
        <div className="admin-field-row" key={l.key}>
          <div className="admin-field" style={{ maxWidth: 110 }}>
            <label>{l.label} · puntos</label>
            <input value={levels[l.key].points} onChange={(e) => setLevel(l.key, 'points', e.target.value)} placeholder={l.defaultPoints} />
          </div>
          <div className="admin-field" style={{ flex: 1 }}>
            <label>Descripción de "{l.label}"</label>
            <input value={levels[l.key].desc} onChange={(e) => setLevel(l.key, 'desc', e.target.value)} placeholder="¿Cómo se ve este nivel?" />
          </div>
        </div>
      ))}
      <div className="admin-modal-actions">
        <button className="admin-btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="admin-btn-edit" disabled={!canSave} onClick={() => onSave({ id: initial?.id || uid('crit'), title: title.trim(), levels })}>
          <Save size={13} /> Guardar criterio
        </button>
      </div>
    </div>
  );
};

const TeacherCourseRubrica = () => {
  const { course, group } = useOutletContext();
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const [modules, setModules] = useState([]);
  const [rubric, setRubric] = useState({ criteria: [], status: 'pending' });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchCourseContent(course.id), fetchCourseRubric(course.id)]).then(([content, rub]) => {
      setModules(content.modules || []);
      setRubric(rub);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [course.id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- mismo patrón load() que el resto de páginas de curso (ver TeacherCourseContenido)
  useEffect(() => { load(); }, [load]);

  const persist = async (next, successMsg) => {
    const previous = rubric;
    setRubric(next);
    try {
      await saveCourseRubric(course.id, next, currentUser?.uid);
      if (successMsg) addToast(successMsg, 'success');
    } catch {
      setRubric(previous);
      addToast('No se pudo guardar el cambio. Intenta de nuevo.', 'error');
    }
  };

  const saveCriterion = (criterion) => {
    const exists = rubric.criteria.some((c) => c.id === criterion.id);
    const criteria = exists ? rubric.criteria.map((c) => (c.id === criterion.id ? criterion : c)) : [...rubric.criteria, criterion];
    persist({ ...rubric, criteria }, 'Criterio guardado.');
    setAdding(false);
    setEditingId(null);
  };

  const deleteCriterion = (id) => {
    if (!confirm('¿Eliminar este criterio de la rúbrica?')) return;
    persist({ ...rubric, criteria: rubric.criteria.filter((c) => c.id !== id) });
  };

  const toggleStatus = () => {
    persist({ ...rubric, status: rubric.status === 'validated' ? 'pending' : 'validated' });
  };

  if (loading) return <div className="admin-empty-hint">Cargando rúbrica...</div>;

  const totalPoints = rubric.criteria.reduce((sum, c) => sum + pointsValue(c.levels?.destacado?.points), 0);
  const resolved = resolveWeights(modules);

  return (
    <div className="anim-fade-up d1">
      <div className="admin-two-col" style={{ gridTemplateColumns: '1fr 300px', alignItems: 'flex-start' }}>
        <div>
          <span className="dash-eyebrow">GUÍA DOCENTE · {group?.name ? `Aula ${group.name}` : 'Sin aula asignada'}</span>
          <h1 className="admin-page-title">Rúbrica de evaluación</h1>
          <p className="admin-page-sub" style={{ marginBottom: 20 }}>{course.title}</p>

          <div className="dash-notice">
            <Lock size={16} />
            <span>Una sola rúbrica para calificar todos los entregables del curso. Solo tú ves esta información; no aparece en el campus de los estudiantes.</span>
          </div>

          <div className="admin-panel" style={{ marginBottom: 20 }}>
            <div className="admin-panel-head">
              <span className="admin-panel-title">Rúbrica del curso · {totalPoints} puntos</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className="admin-status admin-status-violet">{rubric.criteria.length} criterio{rubric.criteria.length === 1 ? '' : 's'}</span>
                <span className={`admin-status ${rubric.status === 'validated' ? 'admin-status-green' : 'admin-status-amber'}`} style={{ cursor: 'pointer' }} onClick={toggleStatus}>
                  {rubric.status === 'validated' ? 'Validado con coordinación' : 'Por validar con coordinación'}
                </span>
              </div>
            </div>

            {rubric.criteria.length === 0 && !adding && (
              <p className="admin-panel-caption" style={{ marginTop: 0 }}>Todavía no defines los criterios de esta rúbrica.</p>
            )}

            {rubric.criteria.map((c, i) => (
              editingId === c.id ? (
                <CriterionForm key={c.id} initial={c} onSave={saveCriterion} onCancel={() => setEditingId(null)} />
              ) : (
                <div className="dash-rubric-criterion" key={c.id}>
                  <div className="dash-rubric-criterion-head">
                    <div className="dash-rubric-criterion-num">{i + 1}</div>
                    <div className="dash-rubric-criterion-title">{c.title}</div>
                    <button className="admin-icon-btn" onClick={() => setEditingId(c.id)}><Pencil size={13} /></button>
                    <button className="admin-icon-btn" onClick={() => deleteCriterion(c.id)}><Trash2 size={13} /></button>
                  </div>
                  <div className="dash-rubric-levels">
                    {LEVELS.map((l) => (
                      <div className={`dash-rubric-level ${l.key.toLowerCase()}`} key={l.key}>
                        <div className="dash-rubric-level-label">{l.label} · {c.levels[l.key]?.points}</div>
                        <div className="dash-rubric-level-desc">{c.levels[l.key]?.desc || 'Sin descripción.'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}

            {adding && <CriterionForm onSave={saveCriterion} onCancel={() => setAdding(false)} />}
            {!adding && !editingId && (
              <button className="admin-btn-ghost" style={{ marginTop: rubric.criteria.length ? 0 : 10 }} onClick={() => setAdding(true)}><Plus size={13} /> Agregar criterio</button>
            )}
          </div>

          <div className="admin-panel" style={{ marginBottom: 20 }}>
            <div className="admin-panel-head">
              <span className="admin-panel-title">Se aplica a</span>
              <span className="admin-status admin-status-violet">{resolved.rows.length} entregable{resolved.rows.length === 1 ? '' : 's'}</span>
            </div>
            {resolved.rows.length === 0 ? (
              <p className="admin-panel-caption" style={{ marginTop: 0 }}>Este curso todavía no tiene entregables definidos.</p>
            ) : resolved.rows.map((r, i) => (
              <div className="dash-rubric-applies-row" key={r.module.id}>
                <Check size={15} />
                <span>
                  <strong>{deliverableLabel(i, resolved.rows.length)} · {r.module.title}</strong>
                  {' · '}
                  <span className="dash-rubric-applies-weight">{r.weight}% de la nota final{r.explicit ? '' : ' (estimado)'}</span>
                </span>
              </div>
            ))}
          </div>

          <div className={`dash-notice ${rubric.criteria.length > 0 && totalPoints !== 20 ? 'warn' : ''}`}>
            <CheckSquare size={16} />
            <span>
              Las notas de los entregables se registran sobre 20 (escala vigesimal).
              {rubric.criteria.length > 0 && totalPoints !== 20
                ? ` Esta rúbrica suma ${totalPoints} puntos: ajusta los criterios para que el máximo sea 20.`
                : ' Esta rúbrica es una guía para calificar: el estudiante no la ve.'}
            </span>
          </div>
        </div>

        <div>
          <ModulesRailPanel courseId={course.id} modules={modules} />
          <GuidePanel courseId={course.id} active="rubrica" />
        </div>
      </div>
    </div>
  );
};

export default TeacherCourseRubrica;
