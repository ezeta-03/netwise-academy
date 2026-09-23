import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Lock, Calendar, CheckSquare, Check } from 'lucide-react';
import { fetchCourseContent, fetchCourseRubric, fetchCourseSubmissions, fetchAllEnrollments } from '../../lib/db';
import { courseRoster } from '../../lib/roster';
import { deliverableDueDate } from '../../lib/deliveryDates';
import { resolveWeights, deliverableLabel, deliverableModules } from '../../lib/weights';
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
};

const TeacherCourseCronograma = () => {
  const { course, group } = useOutletContext();
  const [modules, setModules] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [subs, setSubs] = useState([]);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchCourseContent(course.id), fetchCourseRubric(course.id), fetchCourseSubmissions(course.id), fetchAllEnrollments(course.id)]).then(([content, rubric, submissions, enrollments]) => {
      setModules(content.modules || []);
      setPolicy(rubric.policy || null);
      const deliverableIds = new Set(deliverableModules(content.modules).map((m) => m.id));
      setPendingCount(submissions.filter((s) => s.status === 'submitted' && deliverableIds.has(s.moduleId)).length);
      setSubs(submissions);
      setRoster(courseRoster(enrollments, course.id));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [course.id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- mismo patrón load() que el resto de páginas de curso
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="admin-empty-hint">Cargando cronograma...</div>;

  // Mismos entregables y pesos que el Registro de notas (ver lib/weights.js).
  const resolved = resolveWeights(modules);

  // "Calificado" sale de las notas reales: todos los alumnos del aula tienen
  // su entrega revisada en ese módulo (no de la marca manual de "completado").
  const rosterUids = new Set(roster.map((r) => r.uid));
  const gradedCount = (moduleId) => new Set(subs.filter((s) => s.moduleId === moduleId && s.status === 'reviewed' && rosterUids.has(s.uid)).map((s) => s.uid)).size;
  const isGraded = (moduleId) => roster.length > 0 && gradedCount(moduleId) === roster.length;
  const firstOpenIdx = resolved.rows.findIndex((r) => !isGraded(r.module.id));

  const rows = resolved.rows.map((r, i) => {
    const m = r.module;
    const dueIso = deliverableDueDate(m, modules.indexOf(m), group);
    const status = isGraded(m.id) ? 'graded' : (i === firstOpenIdx ? 'current' : 'scheduled');
    return {
      id: m.id, m, dueIso, status, weight: r.weight, explicit: r.explicit, graded: gradedCount(m.id),
      name: `${deliverableLabel(i, resolved.rows.length)} · ${m.title}`,
    };
  });

  const nextRow = rows[firstOpenIdx];
  const totalWeight = resolved.total;
  const formula = rows.length > 0 ? `PF = ${rows.map((r, i) => `M${i + 1} × ${r.weight}%`).join(' + ')}` : null;
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
            {rows.length > 0 && !resolved.sumsTo100 && (
              <div className="dash-notice warn"><span>Los pesos suman {totalWeight}%, no 100%. Ajusta el peso de cada entregable en Contenido → Editar módulo.</span></div>
            )}
            {rows.length > 0 && !resolved.allExplicit && (
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
                        <td><strong>{r.name}</strong><small>{r.m.deliverable?.description}</small></td>
                        <td>{r.m.weeksLabel || '—'}</td>
                        <td>{fmtDate(r.dueIso, true)}</td>
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
