import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { resolveApprovalPolicy } from '../../lib/approvalPolicy';
import { Lock, Calendar, CheckSquare, Check } from 'lucide-react';
import { fetchCourseContent, fetchCourseRubric, fetchCourseSubmissions, fetchAllEnrollments, fetchCourseGrades } from '../../lib/db';
import { courseRoster } from '../../lib/roster';
import { deliverableDueDate } from '../../lib/deliveryDates';
import { resolveWeights, deliverableModules } from '../../lib/weights';
import { getGradingModel, moduleLabel } from '../../lib/gradingScheme';
import { ModulesRailPanel, GuidePanel } from '../../components/CourseGuidePanels';

const fmtDate = (iso, withTime) => {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  const label = d.toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '');
  return withTime ? `${label} · 23:59` : label;
};

const STATUS_BADGE = {
  graded: { label: 'Calificado', cls: 'admin-status-green' },
  current: { label: 'En curso', cls: 'admin-status-amber' },
  scheduled: { label: 'Programado', cls: 'admin-status-violet' },
  overdue: { label: 'Vencida', cls: 'admin-status-rose' },
};

const TeacherCourseCronograma = () => {
  const { course, group } = useOutletContext();
  const [modules, setModules] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [subs, setSubs] = useState([]);
  const [roster, setRoster] = useState([]);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fecha de referencia fija durante la sesión de la página (evita llamar Date.now() en el render).
  const [now] = useState(() => Date.now());
  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchCourseContent(course.id), fetchCourseRubric(course.id), fetchCourseSubmissions(course.id), fetchAllEnrollments(course.id), fetchCourseGrades(course.id)]).then(([content, rubric, submissions, enrollments, grades]) => {
      setModules(content.modules || []);
      setPolicy(resolveApprovalPolicy(course.id, rubric.policy));
      const deliverableIds = new Set(deliverableModules(content.modules).map((m) => m.id));
      setPendingCount(submissions.filter((s) => s.status === 'submitted' && deliverableIds.has(s.moduleId)).length);
      setSubs(submissions);
      setScores(grades);
      setRoster(courseRoster(enrollments, course.id));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [course.id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- mismo patrón load() que el resto de páginas de curso
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="admin-empty-hint">Cargando cronograma...</div>;

  // Mismos componentes y pesos que el Registro de notas (lib/gradingScheme.js).
  const model = getGradingModel(course.id, modules);
  const resolved = resolveWeights(modules);
  const moduleComps = model.components.filter((c) => c.kind === 'module');
  const manualComps = model.components.filter((c) => c.kind === 'manual');

  // "Calificado" sale de las notas reales: todos los alumnos del aula tienen
  // su entrega revisada en ese módulo (no de la marca manual de "completado").
  const rosterUids = new Set(roster.map((r) => r.uid));
  const gradedCount = (moduleId) => new Set(subs.filter((s) => s.moduleId === moduleId && s.status === 'reviewed' && rosterUids.has(s.uid)).map((s) => s.uid)).size;
  const isGraded = (moduleId) => roster.length > 0 && gradedCount(moduleId) === roster.length;
  const scoredUids = (key) => new Set(scores.filter((g) => rosterUids.has(g.uid) && g.scores?.[key] !== null && g.scores?.[key] !== undefined && String(g.scores[key]).trim() !== '' && Number.isFinite(Number(g.scores[key]))).map((g) => g.uid));
  const isManualGraded = (key) => roster.length > 0 && scoredUids(key).size === roster.length;
  const firstOpenIdx = moduleComps.findIndex((c) => !isGraded(c.moduleId));

  const moduleRows = moduleComps.map((c, i) => {
    const m = c.module;
    const dueIso = deliverableDueDate(m, modules.indexOf(m), group);
    // Vence al final del día de entrega (23:59, hora de Perú); sin calificar y vencida -> 'overdue'.
    const isOverdue = !!dueIso && now > new Date(`${dueIso}T23:59:59-05:00`).getTime();
    const status = isGraded(m.id) ? 'graded' : (isOverdue ? 'overdue' : (i === firstOpenIdx ? 'current' : 'scheduled'));
    const label = moduleLabel(model, i, moduleComps.length);
    return {
      id: m.id, sub: m.deliverable?.description, weeks: m.weeksLabel || '—', dueIso, status, weight: c.weight,
      explicit: model.hasScheme || resolved.rows[i]?.explicit, graded: gradedCount(m.id), name: `${label} · ${m.title}`,
    };
  });
  // Notas que registra el docente directo (sustentación, participación...): sin fecha propia.
  const manualRows = manualComps.map((c) => ({
    id: c.key, sub: 'Nota que registra el docente en el Registro de notas', weeks: '—', dueIso: null,
    status: isManualGraded(c.key) ? 'graded' : 'scheduled', weight: c.weight, explicit: true, graded: scoredUids(c.key).size, name: c.label,
  }));
  const rows = [...moduleRows, ...manualRows];

  // Próxima evaluación: el primer entregable sin calificar que aún no venció; si todos
  // vencieron, el primero pendiente (que se muestra como vencido).
  const nextRow = moduleRows.find((r) => r.status === 'current' || r.status === 'scheduled')
    || moduleRows.find((r) => r.status === 'overdue')
    || manualRows.find((r) => r.status !== 'graded');
  const totalWeight = model.total;
  const weightsOk = Math.abs(totalWeight - 100) <= 0.05;
  const formula = rows.length > 0 ? `PF = ${model.components.map((c) => `${c.label} × ${c.weight}%`).join(' + ')}` : null;
  const scheduleLabel = group?.scheduleTime || group?.scheduleDays;

  return (
    <div className="anim-fade-up d1">
      <div className="admin-two-col" style={{ gridTemplateColumns: '1fr 300px', alignItems: 'flex-start' }}>
        <div>
          <span className="dash-eyebrow">GUÍA DOCENTE · {group?.name ? `Aula ${group.name}` : 'Sin aula asignada'}</span>
          <h1 className="admin-page-title">Cronograma de evaluación</h1>
          <p className="admin-page-sub" style={{ marginBottom: 20 }}>{course.title}</p>

          <div className="dash-notice">
            <Lock size={16} />
            <span>
              {group?.name ? `Las fechas se calculan con el horario de Aula ${group.name}.` : 'Las fechas se calculan con el horario del aula; este curso todavía no tiene una asignada.'}
              {' '}Solo tú ves esta información; no aparece en el campus de los estudiantes.
            </span>
          </div>

          <div className="dash-stat-cards">
            <div className="dash-stat-card">
              <div className="dash-stat-card-label"><Calendar size={14} /> Próxima evaluación</div>
              <div className="dash-stat-card-value">{nextRow ? fmtDate(nextRow.dueIso) : '—'}</div>
              <div className="dash-stat-card-sub">{nextRow ? nextRow.name : 'Todos los entregables calificados'}</div>
            </div>
            <div className="dash-stat-card">
              <div className="dash-stat-card-label">Aula</div>
              <div className="dash-stat-card-value">{group?.name || 'Sin asignar'}</div>
              <div className="dash-stat-card-sub">{scheduleLabel || 'Sin horario'}</div>
            </div>
            <div className="dash-stat-card">
              <div className="dash-stat-card-label"><Check size={14} /> Por calificar</div>
              <div className="dash-stat-card-value">{pendingCount}</div>
              <div className="dash-stat-card-sub">Entregas de este curso</div>
            </div>
          </div>

          <div className="admin-panel" style={{ marginBottom: 20 }}>
            <div className="admin-panel-head">
              <span className="admin-panel-title">Entregables del curso</span>
              {policy?.weightsNote && <span className="admin-status admin-status-amber">Pesos provisionales</span>}
            </div>
            {policy?.weightsNote && <div className="dash-notice warn"><span>{policy.weightsNote}</span></div>}
            {rows.length > 0 && !weightsOk && (
              <div className="dash-notice warn"><span>Los pesos suman {totalWeight}%, no 100%. Ajusta el peso de cada entregable en Contenido → Editar módulo.</span></div>
            )}
            {model.moduleCountMismatch && (
              <div className="dash-notice warn"><span>El esquema de notas de este curso prevé {model.moduleCountMismatch.expected} entregables y hoy hay {model.moduleCountMismatch.actual}: los pesos dentro del bloque de módulos se reparten en partes iguales.</span></div>
            )}
            {rows.length > 0 && !model.hasScheme && !resolved.allExplicit && (
              <div className="dash-notice warn"><span>Hay entregables sin peso definido: reciben en partes iguales lo que falta para llegar a 100%, igual que en el Registro de notas.</span></div>
            )}
            {rows.length === 0 ? (
              <p className="admin-panel-caption" style={{ marginTop: 0 }}>Este curso todavía no tiene módulos.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="dash-cron-table">
                  <thead>
                    <tr><th>Entregable</th><th>Semanas</th><th>Fecha de entrega</th><th>Peso</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td><strong>{r.name}</strong><small>{r.sub}</small></td>
                        <td>{r.weeks}</td>
                        <td>{r.dueIso ? fmtDate(r.dueIso, true) : '—'}</td>
                        <td>{r.weight}%{!r.explicit && <small>estimado</small>}</td>
                        <td><span className={`admin-status ${STATUS_BADGE[r.status].cls}`}>{STATUS_BADGE[r.status].label}</span><small>{r.graded}/{roster.length} calificados</small></td>
                      </tr>
                    ))}
                    <tr className="dash-cron-total"><td>Promedio final</td><td></td><td></td><td>{totalWeight}%</td><td></td></tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {policy?.approval && (
            <div className="admin-panel" style={{ marginBottom: 20 }}>
              <div className="admin-panel-head">
                <span className="admin-panel-title">Requisitos de aprobación</span>
                {policy.syllabusBadge && <span className="admin-status admin-status-green">{policy.syllabusBadge}</span>}
              </div>
              {formula && <div className="dash-cron-formula">{formula}</div>}
              <p style={{ fontSize: '.85rem', color: '#4A4860', marginBottom: 6 }}>{policy.approval.intro}</p>
              <ul className="dash-checklist">
                {(policy.approval.requirements || []).map((req, i) => <li key={i}><Check size={15} />{req}</li>)}
              </ul>
              {policy.approval.options?.length > 0 && (
                <>
                  <p style={{ fontSize: '.88rem', fontWeight: 700, color: '#14141F', marginBottom: 0 }}>{policy.approval.fallbackTitle}</p>
                  <div className="dash-cron-options">
                    {policy.approval.options.map((o, i) => (
                      <div className="dash-cron-option" key={i}>
                        <div className="dash-cron-option-title">{o.title}</div>
                        <div className="dash-cron-option-text">{o.text}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {policy?.accreditations?.length > 0 && (
            <div className="admin-panel" style={{ marginBottom: 20 }}>
              <div className="admin-panel-head"><span className="admin-panel-title">Acreditaciones</span></div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dash-cron-table">
                  <thead><tr><th>Documento</th><th>Requisito</th><th>Alcance</th></tr></thead>
                  <tbody>
                    {policy.accreditations.map((a, i) => (
                      <tr key={i}><td><strong>{a.document}</strong></td><td>{a.requirement}</td><td>{a.scope}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!policy && (
            <div className="dash-notice">
              <CheckSquare size={16} />
              <span>Este curso todavía no tiene cargados los requisitos de aprobación ni las acreditaciones.</span>
            </div>
          )}
        </div>

        <div>
          <ModulesRailPanel courseId={course.id} modules={modules} />
          <GuidePanel courseId={course.id} active="cronograma" />
        </div>
      </div>
    </div>
  );
};

export default TeacherCourseCronograma;
