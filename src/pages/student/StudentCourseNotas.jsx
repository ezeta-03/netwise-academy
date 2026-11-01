import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Check, Circle, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStudentCourse } from '../../hooks/useStudentCourse';
import { getGradingModel, buildStudentRows } from '../../lib/gradingScheme';
import { computeGradeSummary } from '../../lib/gradebook';
import { attendanceStats } from '../../lib/attendance';
import { APPROVAL, evaluateApproval, evaluateSubstitute } from '../../lib/approval';
import { buildWorkItems, submissionFor, hasDelivered, daysLeft } from '../../lib/workItems';

const pct = (n) => `${String(n).replace('.', ',')}%`;
const shortDate = (iso) => new Date(iso).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'America/Lima' }).replace(/\./g, '');

// Barra de avance con la meta marcada; se pone verde cuando cumple.
export const GoalBar = ({ label, detail, value, goal, ok }) => (
  <div className="goal-bar">
    <div className="goal-bar-head"><strong>{label}</strong><span>{detail}</span></div>
    <div className="goal-bar-track">
      <div className={`goal-bar-fill ${ok ? 'is-ok' : ''}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      {goal !== undefined && <div className="goal-bar-goal" style={{ left: `${goal}%` }} />}
    </div>
  </div>
);

// Mis notas (E4): "¿cómo voy y voy a aprobar?". La nota parcial con lo ya
// calificado, solo lo que cuenta para la nota final (cada nota abre Ver mi
// entrega) y lo que falta para el certificado. Las prácticas no aparecen aquí:
// su nota está en Mi proyecto.
const StudentCourseNotas = () => {
  const { course, group } = useOutletContext();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { data } = useStudentCourse(course, group, currentUser?.uid);

  if (!data) return <div className="admin-empty-hint">Cargando tus notas...</div>;
  if (data.error) return <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B' }}>No se pudieron cargar tus notas. Recarga la página.</div>;

  const { modules, submissions, scores, practices, classList, attendance } = data;
  const model = getGradingModel(course.id, modules);
  const inRecord = new Set(practices.filter((p) => p.countsInRecord).map((p) => p.id));
  const rows = buildStudentRows(model, submissions, scores, inRecord);
  const summary = computeGradeSummary(rows);
  const att = attendanceStats(classList, attendance);
  const verdict = evaluateApproval(summary, { taken: att.taken, pct: att.raw });
  const items = buildWorkItems({ course, modules, group });

  const total = model.components.length;
  const deliveredCount = model.components.filter((c, i) => (c.kind === 'module' ? hasDelivered(submissions.find((s) => s.moduleId === c.moduleId)) : rows[i].grade !== null)).length;
  const neededDeliverables = Math.ceil(total * (APPROVAL.minPerformancePct / 100));
  const lastClass = classList.length ? classList[classList.length - 1] : null;
  const grade = summary.promedioParcial;
  const firstModule = model.components.find((c) => c.kind === 'module');
  const substitute = evaluateSubstitute(scores?.sustitutorio);

  const finalState = !summary.allGraded ? null
    : verdict.overall === 'regular' ? { label: 'Certificado', cls: 'admin-status-green', text: 'Aprobaste el curso: recibirás tu certificado.' }
      : substitute === 'ok' ? { label: 'Certificado', cls: 'admin-status-green', text: 'Aprobaste con el examen sustitutorio.' }
        : substitute === 'fail' && att.raw !== null && att.raw >= APPROVAL.minAttendancePct ? { label: 'Constancia', cls: 'admin-status-violet', text: 'Recibirás tu constancia de participación por tu asistencia.' }
          : { label: 'Sustitutorio', cls: 'admin-status-amber', text: `Tu nota final no llegó a ${APPROVAL.minFinalGrade}: puedes dar el examen sustitutorio.` };

  const statusOf = (c, i) => {
    const row = rows[i];
    if (row.grade !== null) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="work-grade">{row.grade} <small>/20</small></span>
          {c.kind === 'module' && <button className="admin-btn-ghost" onClick={() => navigate(`../entrega/modulo/${c.moduleId}`)}>Ver detalle</button>}
        </div>
      );
    }
    if (c.kind === 'module') {
      const item = items.find((it) => it.moduleId === c.moduleId && it.kind === 'module');
      const sub = item ? submissionFor(item, submissions) : null;
      if (sub && hasDelivered(sub)) return <span className="admin-status admin-status-gray">Enviada · por calificar</span>;
      const started = modules.indexOf(c.module) === 0 || classList.some((cl) => cl.moduleId === c.moduleId && cl.startsAt && new Date(cl.startsAt) <= new Date());
      if (!started) return <span className="admin-status admin-status-gray">Aún no empieza</span>;
      const days = daysLeft(item?.dueDate);
      return item?.dueDate ? <span className={`admin-status ${days !== null && days <= 7 ? 'admin-status-amber' : 'admin-status-gray'}`}>Vence {shortDate(`${item.dueDate}T12:00:00-05:00`)}</span> : <span className="admin-status admin-status-gray">Por calificar</span>;
    }
    return lastClass?.startsAt ? <span className="admin-status admin-status-gray">{shortDate(lastClass.startsAt)}</span> : <span className="admin-status admin-status-gray">Al final del curso</span>;
  };

  const checks = [
    { ok: verdict.finalGrade === 'ok', label: `Nota final de ${APPROVAL.minFinalGrade} o más.` },
    { ok: deliveredCount >= neededDeliverables, label: `Entregar al menos ${neededDeliverables} de las ${total} evaluaciones.` },
    { ok: att.raw !== null && att.raw >= APPROVAL.minAttendancePct, label: `Asistir al ${APPROVAL.minAttendancePct}% de las clases (para la constancia de participación).` },
  ];

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Mis notas</h1><p className="admin-page-sub">{course.title} · Así vas en el curso.</p></div>
      </div>

      <div className="dark-card grade-hero">
        <div>
          <div className="grade-hero-eyebrow">{summary.allGraded ? 'Nota final' : 'Nota parcial'}</div>
          <div className="grade-hero-value">{grade ?? '—'}<small>/ 20</small></div>
          <span className="grade-hero-chip">{grade === null ? 'Aún sin notas' : summary.allGraded ? 'Final' : `Parcial · ${summary.gradedCount} de ${summary.totalCount} con nota`}</span>
          <p style={{ marginTop: 10 }}>{grade === null ? `Tu primera nota llega con la entrega del ${firstModule ? `Módulo ${firstModule.index + 1}` : 'primer módulo'}.` : 'Se calcula solo con lo ya calificado, con los pesos del sílabo.'}</p>
        </div>
        <div className="grade-hero-bars">
          <GoalBar label="Nota final" detail={grade === null ? `Sin nota aún · necesitas ${APPROVAL.minFinalGrade} o más` : `${grade} · necesitas ${APPROVAL.minFinalGrade} o más`} value={grade === null ? 0 : (grade / 20) * 100} goal={(APPROVAL.minFinalGrade / 20) * 100} ok={grade !== null && grade >= APPROVAL.minFinalGrade} />
          <GoalBar label="Entregables" detail={`${deliveredCount} de ${total} entregados · necesitas al menos ${neededDeliverables}`} value={total ? (deliveredCount / total) * 100 : 0} goal={total ? (neededDeliverables / total) * 100 : undefined} ok={deliveredCount >= neededDeliverables} />
          <GoalBar label="Asistencia" detail={att.pct === null ? `Sin clases dictadas · necesitas ${APPROVAL.minAttendancePct}% o más` : `${att.pct}% · necesitas ${APPROVAL.minAttendancePct}% o más`} value={att.pct ?? 0} goal={APPROVAL.minAttendancePct} ok={att.raw !== null && att.raw >= APPROVAL.minAttendancePct} />
        </div>
      </div>

      {finalState && (
        <div className="admin-panel" style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={`admin-status ${finalState.cls}`}>Estado final · {finalState.label}</span>
          <span className="admin-cell-sub">{finalState.text}</span>
        </div>
      )}

      <div className="admin-panel" style={{ marginTop: 20 }}>
        <div className="admin-panel-head" style={{ marginBottom: 2 }}><span className="admin-panel-title">Notas por evaluación</span></div>
        <p className="admin-panel-caption" style={{ marginTop: 0 }}>Tu nota de cada módulo y de la evaluación final, según el sílabo. El detalle de cada entrega está en Mi proyecto.</p>
        {model.components.map((c, i) => (
          <div key={c.key} className="dash-list-row">
            <div>
              <div className="dash-list-row-title">{c.kind === 'module' ? `Módulo ${c.index + 1} · ${c.module.title}` : c.label}</div>
              <div className="dash-list-row-sub">{pct(c.weight)} de tu nota</div>
            </div>
            {statusOf(c, i)}
          </div>
        ))}
        {model.footer && <p className="admin-panel-caption" style={{ marginBottom: 0 }}>{model.footer}</p>}
      </div>

      <div className="admin-panel" style={{ marginTop: 20 }}>
        <div className="admin-panel-head"><span className="admin-panel-title">Qué necesitas para tu certificado</span></div>
        {checks.map((ch) => (
          <div key={ch.label} className={`cert-check ${ch.ok ? 'is-ok' : ''}`}>{ch.ok ? <Check size={14} /> : <Circle size={14} />} {ch.label}</div>
        ))}
        <div className="cert-note"><Info size={14} /> Si al final no llegas a {APPROVAL.minFinalGrade}, puedes dar el examen sustitutorio.</div>
      </div>
    </div>
  );
};

export default StudentCourseNotas;
