import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import {
  ClipboardCheck, BarChart3, UsersRound, ChevronLeft, ChevronRight, ArrowLeft,
  Download, Check, ExternalLink,
} from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';
import { fetchCourseContent, fetchAllEnrollments, fetchCourseSubmissions, upsertSubmission, fetchCourseAttendance, setAttendance, deleteAttendance, fetchCourseGrades, setCourseScore, fetchGroupProgress, setGroupSessionDone } from '../../lib/db';
import { computeGradeSummary } from '../../lib/gradebook';
import { getGradingModel, buildStudentRows, effectiveModuleWeights } from '../../lib/gradingScheme';
import { allDeliverableModules } from '../../lib/weights';
import { downloadCsv as downloadCsvFile } from '../../lib/csv';
import { APPROVAL } from '../../lib/approval';
import { getOrderedSessions, withAulaSessions } from '../../lib/courseSessions';
import { attendanceStats } from '../../lib/attendance';
import { aulaRoster, NO_AULA } from '../../lib/roster';
import SubmissionViewer from '../../components/SubmissionViewer';
import { describeSubmission } from '../../lib/submissionPreview';
import { usePagedTable } from '../../hooks/usePagedTable';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
};

const formatDate = (iso) => {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
};

// Escapado, protección contra fórmulas y BOM viven en lib/csv.js.
const downloadCsv = (filename, rows) => downloadCsvFile(filename, rows[0], rows.slice(1));

const NAV_ITEMS = [
  { key: 'entregas', label: 'Entregas y revisión', sub: 'Revisa y califica', icon: ClipboardCheck },
  { key: 'notas', label: 'Registro de notas', sub: 'Notas por módulo y promedio', icon: BarChart3 },
  { key: 'asistencia', label: 'Asistencia', sub: 'Resumen y registro por sesión', icon: UsersRound },
];

const EvalSidePanel = ({ vista, setVista, pendingCount, summary }) => (
  <>
    <div className="admin-panel" style={{ marginBottom: 20 }}>
      <div className="admin-panel-head"><span className="admin-panel-title">Evaluación</span></div>
      <div className="eval-nav-card">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.key} className={`eval-nav-row ${vista === item.key ? 'active' : ''}`} onClick={() => setVista(item.key)}>
              <div className="eval-nav-row-icon"><Icon size={15} /></div>
              <div>
                <div className="eval-nav-row-title">{item.label}</div>
                <div className="eval-nav-row-sub">{item.key === 'entregas' && pendingCount > 0 ? `${pendingCount} por revisar` : item.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    <div className="admin-panel">
      <div className="admin-panel-head"><span className="admin-panel-title">Resumen del aula</span></div>
      <div className="dash-profile-stats" style={{ gridTemplateColumns: '1fr', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="admin-cell-sub">Promedio parcial</span><strong>{summary.promedioParcial ?? '—'}</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="admin-cell-sub">Asistencia promedio</span><strong>{summary.asistenciaPromedio === null ? '—' : `${summary.asistenciaPromedio}%`}</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="admin-cell-sub">Estudiantes en riesgo</span><strong>{summary.enRiesgo}</strong></div>
      </div>
      <p className="admin-panel-caption" style={{ marginTop: 12, marginBottom: 0 }}>Muestra de {summary.total} estudiante{summary.total === 1 ? '' : 's'}.</p>
    </div>
  </>
);

// --- Subvista: Entregas y revisión ---

const EntregasRevision = ({ course, aulaLabel, modules, roster, submissions, onReloadSubmissions, onFocusChange }) => {
  const { addToast } = useUI();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState('all');
  const [reviewingUid, setReviewingUid] = useState(null);
  const [gradeDraft, setGradeDraft] = useState('');
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // Mientras se revisa una entrega, la pantalla usa todo el ancho (el visor
  // necesita el espacio del panel lateral).
  useEffect(() => {
    onFocusChange?.(!!reviewingUid);
    return () => onFocusChange?.(false);
  }, [reviewingUid, onFocusChange]);

  const withDeliverable = modules.filter((m) => m.deliverable?.description);
  const moduleId = searchParams.get('modulo') && withDeliverable.some((m) => m.id === searchParams.get('modulo'))
    ? searchParams.get('modulo') : withDeliverable[0]?.id;
  const module = withDeliverable.find((m) => m.id === moduleId);

  const setModuleId = (id) => { setReviewingUid(null); setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('vista', 'entregas'); next.set('modulo', id); return next; }); };

  const rows = roster.map((r) => ({ ...r, submission: submissions.find((s) => s.uid === r.uid && s.moduleId === module?.id) || null }));
  const entregados = rows.filter((r) => r.submission).length;
  const porRevisar = rows.filter((r) => r.submission?.status === 'submitted').length;

  const statusOf = (row) => {
    if (!row.submission) return { key: 'sin_entrega', label: 'Sin entrega', cls: 'admin-status-gray' };
    if (row.submission.status === 'reviewed') return { key: 'revisado', label: 'Revisado', cls: 'admin-status-green' };
    return { key: 'por_revisar', label: 'Por revisar', cls: 'admin-status-amber' };
  };

  const filtered = rows.filter((row) => {
    const st = statusOf(row).key;
    if (filter === 'por_revisar') return st === 'por_revisar';
    if (filter === 'revisados') return st === 'revisado';
    if (filter === 'sin_entrega') return st === 'sin_entrega';
    return true;
  });
  const { rows: listRows, pager: listPager } = usePagedTable(filtered, { label: 'alumnos' });

  if (withDeliverable.length === 0) {
    return <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B' }}>Todavía no defines entregables en "Contenido".</div>;
  }

  const reviewingRow = rows.find((r) => r.uid === reviewingUid);
  const reviewIndex = filtered.findIndex((r) => r.uid === reviewingUid);

  const openReview = (row) => {
    setReviewingUid(row.uid);
    // Una reentrega llega con la nota/comentario de la versión anterior (las
    // reglas no dejan que el alumno los borre): el formulario arranca vacío
    // para no volver a guardar la nota vieja sin revisar la nueva versión.
    const isReviewed = row.submission?.status === 'reviewed';
    setGradeDraft(isReviewed ? (row.submission?.grade ?? '') : '');
    setFeedbackDraft(isReviewed ? (row.submission?.feedback || '') : '');
  };

  const goRelative = (dir) => {
    const next = filtered[reviewIndex + dir];
    if (next) openReview(next);
  };

  const isGraded = module.deliverable?.graded !== false;

  const saveGrade = async () => {
    const grade = isGraded ? Number(gradeDraft) : null;
    if (isGraded && (gradeDraft === '' || !Number.isFinite(grade) || grade < 0 || grade > 20)) {
      addToast('Ingresa una nota entre 0 y 20 para dejar la entrega revisada.', 'error');
      return;
    }
    setSaving(true);
    try {
      await upsertSubmission({
        courseId: course.id, moduleId: module.id, moduleTitle: module.title,
        uid: reviewingRow.uid, studentName: reviewingRow.studentName,
        deliverableTitle: module.deliverable?.description || module.title,
        status: 'reviewed', grade, feedback: feedbackDraft,
      });
      addToast(isGraded ? `Calificación guardada para ${reviewingRow.studentName}.` : `Revisión guardada para ${reviewingRow.studentName}.`, 'success');
      await onReloadSubmissions();
    } catch {
      addToast('No se pudo guardar la calificación. Intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const weights = effectiveModuleWeights(course.id, modules);
  const moduleTabs = (
    <div className="review-module-tabs">
      {withDeliverable.map((m, i) => (
        <button key={m.id} className={`review-module-tab ${m.id === module.id ? 'active' : ''}`} onClick={() => setModuleId(m.id)} title={m.title}>
          <strong>M{i + 1}</strong>
          <span>{m.deliverable?.graded === false ? 'Sin nota' : `${weights[m.id]}%`}</span>
        </button>
      ))}
    </div>
  );
  const pageHead = (
    <div className="admin-page-head"><div><h1 className="admin-page-title">Entregas y revisión</h1><p className="admin-page-sub">{course.title}{aulaLabel ? ` · ${aulaLabel}` : ''} · Revisa el archivo completo, califica y deja retroalimentación.</p></div></div>
  );

  if (reviewingRow) {
    const sub = reviewingRow.submission;
    const status = statusOf(reviewingRow);
    const info = describeSubmission(sub);
    const deliveredAt = sub?.submittedAt || sub?.updatedAt;
    return (
      <div className="anim-fade-up d1">
        {pageHead}
        {moduleTabs}
        <div className="review-head">
          <div>
            <div className="review-student">
              <h2>{reviewingRow.studentName}</h2>
              <span className="admin-status admin-status-gray">{reviewIndex + 1} de {filtered.length}</span>
            </div>
            <p className="admin-page-sub">{module.deliverable?.description || module.title}</p>
          </div>
          <div className="review-head-meta">
            <span className={`admin-status ${status.cls}`}>{status.label}</span>
            {deliveredAt && <span className="admin-cell-sub">Entregado: {new Date(deliveredAt).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' })}</span>}
          </div>
        </div>
        <div className="review-nav">
          <button className="admin-btn-ghost" onClick={() => setReviewingUid(null)}><ArrowLeft size={13} /> Volver a entregas</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="admin-icon-btn" aria-label="Entrega anterior" disabled={reviewIndex <= 0} onClick={() => goRelative(-1)}><ChevronLeft size={16} /></button>
            <button className="admin-icon-btn" aria-label="Entrega siguiente" disabled={reviewIndex >= filtered.length - 1} onClick={() => goRelative(1)}><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="review-grid">
          <div className="admin-panel">
            <div className="admin-panel-head">
              <div>
                <span className="admin-panel-title">Archivo entregado</span>
                <div className="admin-cell-sub">{info.name || 'Sin entrega'}</div>
              </div>
              {info.src && info.kind !== 'embed' && <a className="admin-btn-ghost" href={info.src} target="_blank" rel="noreferrer" download={info.name}><Download size={13} /> Descargar</a>}
              {info.link && <a className="admin-btn-ghost" href={info.link} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Abrir enlace</a>}
            </div>
            <SubmissionViewer key={`${reviewingRow.uid}-${sub?.updatedAt || ''}`} submission={sub} />
            {sub?.fileUrl && sub?.note && <p className="admin-cell-sub" style={{ margin: '12px 0 0' }}>Comentario del alumno: {sub.note}</p>}
          </div>
          <div className="admin-panel review-grade-panel">
            {sub?.status === 'submitted' && sub?.grade != null && (
              <p className="admin-panel-caption" style={{ marginTop: 0 }}>
                Reentrega: la versión anterior tenía {sub.grade}/20{sub.feedback ? ` · "${sub.feedback}"` : ''}. Califica la nueva versión.
              </p>
            )}
            {isGraded ? (
              <div className="admin-field">
                <label htmlFor="review-grade-input">Nota</label>
                <div className="review-grade">
                  <input id="review-grade-input" type="number" inputMode="decimal" min="0" max="20" step="0.5" placeholder="—" value={gradeDraft} onChange={(e) => setGradeDraft(e.target.value)} />
                  <span>/ 20</span>
                </div>
              </div>
            ) : (
              <p className="dash-notice" style={{ marginTop: 0 }}>Este entregable no lleva nota: deja tu retroalimentación y márcalo como revisado.</p>
            )}
            <div className="admin-field"><label htmlFor="review-feedback-input">Retroalimentación</label><textarea id="review-feedback-input" rows={7} value={feedbackDraft} onChange={(e) => setFeedbackDraft(e.target.value)} placeholder="Qué hizo bien, qué debe mejorar y cuál es su siguiente paso." /></div>
            <button className="admin-btn-edit" style={{ width: '100%', justifyContent: 'center' }} onClick={saveGrade} disabled={saving || !sub}><Check size={14} /> {saving ? 'Guardando...' : isGraded ? 'Guardar calificación' : 'Marcar como revisado'}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fade-up d1">
      {pageHead}

      {moduleTabs}

      <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 20 }}>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Entregados</div>
          <div className="admin-stat-value">{entregados}/{roster.length}</div>
          {module.deliverable?.dueDate && <div className="admin-cell-sub">Vence: {formatDate(module.deliverable.dueDate)}</div>}
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Por revisar</div>
          <div className="admin-stat-value">{porRevisar}</div>
          <div className="admin-cell-sub">Entregas pendientes de calificar</div>
        </div>
      </div>

      <div className="admin-toolbar" style={{ gap: 8, marginBottom: 12 }}>
        {[['all', 'Todos'], ['por_revisar', 'Por revisar'], ['revisados', 'Revisados'], ['sin_entrega', 'Sin entrega']].map(([key, label]) => (
          <button key={key} className="admin-btn-ghost" style={filter === key ? { background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'transparent' } : undefined} onClick={() => setFilter(key)}>{label}</button>
        ))}
      </div>

      <div className="admin-panel">
        {filtered.length === 0 ? <p className="admin-panel-caption" style={{ marginTop: 0 }}>No hay alumnos en esta categoría.</p> : listRows.map((row) => {
          const status = statusOf(row);
          return (
            <div key={row.uid} className="dash-list-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="dash-post-avatar">{getInitials(row.studentName)}</div>
                <div>
                  <div className="dash-list-row-title">{row.studentName}</div>
                  <div className="dash-list-row-sub">{row.submission ? `Entregado · ${new Date(row.submission.updatedAt).toLocaleDateString('es-PE')}` : 'Sin entrega'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`admin-status ${status.cls}`}>{status.label}</span>
                <button className="admin-btn-edit" disabled={!row.submission} onClick={() => openReview(row)}><ExternalLink size={13} /> Revisar</button>
              </div>
            </div>
          );
        })}
        {listPager}
      </div>
    </div>
  );
};

// --- Subvista: Registro de notas ---

const RegistroNotas = ({ course, aulaLabel, fileTag, modules, roster, submissions, attendance, scores, onGradeSaved }) => {
  const { addToast } = useUI();
  const model = getGradingModel(course.id, modules);
  const sessions = getOrderedSessions(modules);
  const scoresByUid = Object.fromEntries((scores || []).map((g) => [g.uid, g.scores || {}]));

  const rowsByStudent = roster.map((r) => {
    const gradeRows = buildStudentRows(model, submissions.filter((sub) => sub.uid === r.uid), scoresByUid[r.uid]);
    return { ...r, gradeRows, summary: computeGradeSummary(gradeRows), att: attendanceStats(sessions, attendance.filter((a) => a.uid === r.uid)) };
  });
  const { rows: gradeRowsPage, pager: gradePager } = usePagedTable(rowsByStudent, { label: 'alumnos' });

  // Guarda la nota de una celda al salir del campo. Módulo -> queda como entrega
  // revisada con esa nota; componente manual -> courseGrades. Vacío borra solo
  // las manuales (la nota de un módulo se corrige, no se borra).
  const saveCell = async (student, comp, text, current) => {
    const clean = String(text).trim().replace(',', '.');
    if (clean === '') {
      if (comp.kind !== 'manual') return current === null; // la nota de un módulo no se borra: se restaura
      if (current === null) return true;
    }
    // Solo decimales simples: nada de "0x10" ni "1e1" (Number() los aceptaría).
    const n = clean === '' ? null : (/^\d+(\.\d+)?$/.test(clean) ? Number(clean) : NaN);
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > 20)) {
      addToast('La nota debe estar entre 0 y 20.', 'error');
      return false;
    }
    if (n === current) return true;
    try {
      if (comp.kind === 'module') {
        await upsertSubmission({
          courseId: course.id, moduleId: comp.moduleId, moduleTitle: comp.module.title, uid: student.uid, studentName: student.studentName,
          deliverableTitle: comp.module.deliverable?.description || comp.module.title, status: 'reviewed', grade: n,
        });
      } else {
        await setCourseScore({ courseId: course.id, uid: student.uid, studentName: student.studentName, key: comp.key, value: n });
      }
      await onGradeSaved();
      addToast(n === null ? `Nota de ${student.studentName} borrada.` : `Nota de ${student.studentName} guardada: ${n}/20.`, 'success');
      return true;
    } catch {
      addToast('No se pudo guardar la nota. Intenta de nuevo.', 'error');
      return false;
    }
  };

  const exportCsv = () => {
    const header = ['Estudiante', ...model.components.map((c) => (c.kind === 'module' ? `${c.label} (${c.blockLabel})` : c.label)), 'Promedio', 'Asistencia'];
    const rows = rowsByStudent.map((r) => [r.studentName, ...r.gradeRows.map((g) => g.grade ?? ''), r.summary.promedioParcial ?? '', r.att.pct === null ? '' : `${r.att.pct}%`]);
    downloadCsv(`registro-notas-${fileTag}.csv`, [header, ...rows]);
  };

  // Un bloque sin componentes (ej. curso sin entregables) no se dibuja.
  const blocks = model.blocks.filter((b) => b.components.length > 0);
  const moduleBlocks = blocks.filter((b) => b.components[0].kind === 'module');
  const hasModuleBlock = moduleBlocks.length > 0;

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Registro de notas</h1><p className="admin-page-sub">{course.title}{aulaLabel ? ` · ${aulaLabel}` : ''} · {model.subtitle}</p></div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <span className="admin-panel-title">Notas del aula</span>
            <div className="admin-cell-sub">{course.title}</div>
          </div>
          <button className="admin-btn-ghost" onClick={exportCsv}><Download size={14} /> Exportar CSV</button>
        </div>
        <div className="admin-table-wrap grade-grid-wrap">
          <table className="admin-table grade-grid">
            <thead>
              <tr>
                <th rowSpan={hasModuleBlock ? 2 : 1} className="grade-grid-student">Estudiante</th>
                {blocks.map((b) => (b.components[0].kind === 'module'
                  ? <th key={b.key} colSpan={b.components.length} className="grade-block-head">{b.label} · {b.weight}%</th>
                  : <th key={b.key} rowSpan={hasModuleBlock ? 2 : 1} className="grade-block-head manual">{b.label} · {b.weight}%</th>))}
                <th rowSpan={hasModuleBlock ? 2 : 1}>Promedio</th>
                <th rowSpan={hasModuleBlock ? 2 : 1}>Asist.</th>
              </tr>
              {hasModuleBlock && (
                <tr>
                  {moduleBlocks.flatMap((b) => b.components).map((c) => (
                    <th key={c.key} className="grade-sub-head">{c.label}<br /><span>{c.weightInBlock}% {model.hasScheme && model.blocks.length > 1 ? 'del bloque' : 'de la nota'}</span></th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {gradeRowsPage.map((r) => (
                <tr key={r.uid}>
                  <td className="admin-cell-name grade-grid-student">{r.studentName}</td>
                  {model.components.map((c, i) => {
                    const grade = r.gradeRows[i].grade;
                    return (
                      <td key={c.key} className="grade-grid-cell">
                        <input
                          key={`${r.uid}-${c.key}-${grade}`}
                          className="grade-grid-input" type="text" inputMode="decimal" placeholder="—" defaultValue={grade ?? ''}
                          aria-label={`Nota de ${r.studentName} en ${c.label}`}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                          onBlur={async (e) => { const el = e.currentTarget; const ok = await saveCell(r, c, el.value, grade); if (!ok) el.value = grade ?? ''; }}
                        />
                      </td>
                    );
                  })}
                  <td><strong>{r.summary.promedioParcial ?? '—'}</strong></td>
                  <td>{r.att.pct === null ? '—' : `${r.att.pct}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {gradePager}
        {model.footer && <p className="admin-panel-caption" style={{ marginBottom: 0 }}>{model.footer}</p>}
      </div>
    </div>
  );
};

// --- Subvista: Asistencia ---

// `doneIds`: sesiones que ESTA aula ya tuvo; `onToggleDone` las marca (null si
// no hay un aula concreta elegida). `globalDone`: Realizadas desde Contenido.
const Asistencia = ({ course, aulaLabel, fileTag, modules, roster, attendance, onToggle, doneIds, globalDoneIds, onToggleDone }) => {
  const { rows: rosterPage, pager: rosterPager } = usePagedTable(roster, { label: 'alumnos' });
  const sessions = getOrderedSessions(modules);
  const grouped = modules.filter((m) => m.sessions?.length).map((m) => ({ module: m, sessions: sessions.filter((s) => s.moduleId === m.id) }));

  const attendanceFor = (uid, sessionId) => attendance.find((a) => a.uid === uid && a.sessionId === sessionId) || null;

  // Sesión dictada sin registro = falta (ver lib/attendance.js).
  const statsFor = (uid) => {
    const st = attendanceStats(sessions, attendance.filter((a) => a.uid === uid));
    return { pct: st.pct, raw: st.raw, faltas: st.absent, sinRegistrar: st.unregistered };
  };
  const latesFor = (uid) => attendance.filter((a) => a.uid === uid && a.present && a.late).length;

  const sessionsTaken = sessions.filter((s) => s.done || attendance.some((a) => a.sessionId === s.id)).length;
  const totalSinRegistrar = roster.reduce((sum, r) => sum + statsFor(r.uid).sinRegistrar, 0);
  const withAtt = roster.map((r) => statsFor(r.uid).raw).filter((p) => p !== null);
  const avgPct = withAtt.length ? Math.round(withAtt.reduce((sum, p) => sum + p, 0) / withAtt.length) : null;
  const bajo75 = withAtt.filter((p) => p < APPROVAL.minAttendancePct).length;

  const exportCsv = () => {
    const header = ['Estudiante', ...sessions.map((s) => s.label), 'Asist.', 'Faltas', 'Tardanzas'];
    const rows = roster.map((r) => [r.studentName, ...sessions.map((s) => { const a = attendanceFor(r.uid, s.id); return a ? (a.excused ? 'NA' : a.present ? (a.late ? 'T' : 'P') : 'F') : ''; }), statsFor(r.uid).pct === null ? '' : `${statsFor(r.uid).pct}%`, statsFor(r.uid).faltas, latesFor(r.uid)]);
    downloadCsv(`asistencia-${fileTag}.csv`, [header, ...rows]);
  };

  const cycle = (row, session) => {
    const current = attendanceFor(row.uid, session.id);
    // Presente -> Tardanza -> Falta -> No aplica -> Sin registrar.
    const next = current === null ? { present: true }
      : current.excused ? null
        : current.present ? (current.late ? { present: false } : { present: true, late: true })
          : { present: false, excused: true };
    onToggle(row, session, next);
  };

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Asistencia</h1><p className="admin-page-sub">{course.title}{aulaLabel ? ` · ${aulaLabel}` : ''} · Lista de asistencia propia de esta aula.</p></div>
        <button className="admin-btn-ghost" onClick={exportCsv}><Download size={14} /> Exportar CSV</button>
      </div>

      <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="admin-stat-card"><div className="admin-stat-label">Asistencia promedio</div><div className="admin-stat-value">{avgPct === null ? '—' : `${avgPct}%`}</div></div>
        <div className="admin-stat-card"><div className="admin-stat-label">Sesiones registradas</div><div className="admin-stat-value">{sessionsTaken}/{sessions.length}</div></div>
        <div className="admin-stat-card"><div className="admin-stat-label">Bajo el {APPROVAL.minAttendancePct}%</div><div className="admin-stat-value">{bajo75}</div></div>
      </div>

      {totalSinRegistrar > 0 && (
        <div className="dash-notice warn">
          <span>Hay {totalSinRegistrar} registro{totalSinRegistrar === 1 ? '' : 's'} sin tomar en sesiones ya realizadas (marcados con «!»). Cuentan como falta hasta que registres la asistencia.</span>
        </div>
      )}

      {sessions.length > 0 && (
        <div className="attendance-legend">
          <span><i className="session-chip present">✓</i> Presente</span>
          <span><i className="session-chip late">T</i> Tardanza</span>
          <span><i className="session-chip absent">F</i> Falta</span>
          <span><i className="session-chip excused">N/A</i> No aplica</span>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B' }}>Todavía no defines sesiones en "Contenido".</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th rowSpan={2}>Estudiante</th>
                {grouped.map((g) => <th key={g.module.id} colSpan={g.sessions.length} style={{ textAlign: 'center' }}>{g.module.title}</th>)}
                <th rowSpan={2}>Asist.</th>
                <th rowSpan={2}>Faltas</th>
              </tr>
              <tr>
                {sessions.map((s) => {
                  const fromContent = globalDoneIds.has(s.id);
                  return (
                    <th key={s.id} style={{ textAlign: 'center', fontSize: '.7rem' }}>
                      {s.label}<br />{s.dateLabel}
                      {onToggleDone && (
                        <label style={{ display: 'block', marginTop: 4, cursor: fromContent ? 'default' : 'pointer' }} title={fromContent ? 'Marcada como Realizada en Contenido: vale para todas las aulas' : 'Esta aula ya tuvo la sesión'}>
                          <input type="checkbox" aria-label={`${s.label} realizada en esta aula`} checked={fromContent || doneIds.has(s.id)} disabled={fromContent} onChange={(e) => onToggleDone(s, e.target.checked)} />
                        </label>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rosterPage.map((row) => (
                <tr key={row.uid}>
                  <td className="admin-cell-name">{row.studentName}</td>
                  {sessions.map((s) => {
                    const a = attendanceFor(row.uid, s.id);
                    const missing = a === null && s.done;
                    const cls = a === null ? (missing ? 'missing' : 'pending') : a.excused ? 'excused' : a.present ? (a.late ? 'late' : 'present') : 'absent';
                    return (
                      <td key={s.id} style={{ textAlign: 'center', padding: '8px 4px' }}>
                        <div className={`session-chip clickable ${cls}`} onClick={() => cycle(row, s)}>
                          <span className="session-chip-label" title={missing ? 'Sin registrar: cuenta como falta' : a?.excused ? 'No aplica: no cuenta en su porcentaje' : undefined}>{a === null ? (missing ? '!' : '·') : a.excused ? 'N/A' : a.present ? (a.late ? 'T' : '✓') : 'F'}</span>
                        </div>
                      </td>
                    );
                  })}
                  <td><strong>{statsFor(row.uid).pct === null ? '—' : `${statsFor(row.uid).pct}%`}</strong></td>
                  <td>{statsFor(row.uid).faltas}{latesFor(row.uid) > 0 && <div className="admin-cell-sub">{latesFor(row.uid)} tard.</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rosterPager}
        </div>
      )}
      <p className="admin-panel-caption">{onToggleDone ? 'La casilla bajo cada sesión marca que ESTA aula ya la tuvo (se marca sola al tomar lista); cada aula lleva su propio avance. ' : ''}Haz clic en una celda para alternar Presente / Tardanza / Falta / No aplica / Sin registrar. La tardanza cuenta como asistencia. «No aplica» (N/A) saca esa sesión del porcentaje del alumno: úsalo si se matriculó después o si la falta está justificada.</p>
    </div>
  );
};

const TeacherCourseEvaluacion = () => {
  const { course, group, groups, aulaId } = useOutletContext();
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const [searchParams, setSearchParams] = useSearchParams();
  const [courseModules, setModules] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  // Sesiones que ya tuvo el aula elegida (cada aula avanza por separado).
  const [doneIds, setDoneIds] = useState([]);
  const [reviewFocus, setReviewFocus] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [attendance, setAttendanceRows] = useState([]);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  const vista = ['entregas', 'notas', 'asistencia'].includes(searchParams.get('vista')) ? searchParams.get('vista') : 'entregas';
  const setVista = (v) => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('vista', v); next.delete('modulo'); return next; });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchCourseContent(course.id), fetchAllEnrollments(course.id), fetchCourseSubmissions(course.id), fetchCourseAttendance(course.id), fetchCourseGrades(course.id)]).then(([content, enrollments, subs, att, grades]) => {
      setModules(content.modules || []);
      setEnrollments(enrollments);
      setSubmissions(subs);
      setAttendanceRows(att);
      setScores(grades);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [course.id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial, mismo patrón que el resto del panel (ver TeacherCourseContenido)
  useEffect(() => { load(); }, [load]);

  const groupId = group?.id || null;
  useEffect(() => {
    let cancelled = false;
    fetchGroupProgress(groupId).then((ids) => { if (!cancelled) setDoneIds(ids); }).catch(() => { if (!cancelled) setDoneIds([]); });
    return () => { cancelled = true; };
  }, [groupId]);

  // Todo lo que se muestra es del aula elegida: su lista de alumnos y, de
  // ellos, sus entregas, notas y asistencia; las sesiones con el avance de esa aula.
  const roster = useMemo(() => aulaRoster(enrollments, course.id, groups, aulaId), [enrollments, course.id, groups, aulaId]);
  const rosterUids = useMemo(() => new Set(roster.map((r) => r.uid)), [roster]);
  const modules = useMemo(() => withAulaSessions(courseModules, doneIds), [courseModules, doneIds]);
  const globalDoneIds = useMemo(() => new Set(getOrderedSessions(courseModules).filter((s) => s.done).map((s) => s.id)), [courseModules]);
  const aulaDoneIds = useMemo(() => new Set(doneIds), [doneIds]);
  const aulaLabel = group ? `Aula ${group.name}` : (aulaId === NO_AULA ? 'Alumnos sin aula' : '');
  const fileTag = `${course.id}${group ? `-${group.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}` : (aulaId === NO_AULA ? '-sin-aula' : '')}`;

  // `silent`: marca automática al tomar lista -- si falla, la asistencia ya quedó
  // guardada y no se molesta al docente con un aviso.
  const toggleSessionDone = async (session, done, silent = false) => {
    if (!groupId) return;
    const previous = doneIds;
    setDoneIds((ids) => (done ? [...new Set([...ids, session.id])] : ids.filter((id) => id !== session.id)));
    try {
      await setGroupSessionDone({ groupId, courseId: course.id, sessionId: session.id, done });
    } catch {
      setDoneIds(previous);
      if (!silent) addToast('No se pudo actualizar la sesión de esta aula. Intenta de nuevo.', 'error');
    }
  };

  const reloadSubmissions = useCallback(async () => {
    const subs = await fetchCourseSubmissions(course.id);
    setSubmissions(subs);
  }, [course.id]);

  // Recarga entregas y notas manuales sin pantalla de carga (al editar una celda).
  const reloadGrades = useCallback(async () => {
    const [subs, grades] = await Promise.all([fetchCourseSubmissions(course.id), fetchCourseGrades(course.id)]);
    setSubmissions(subs);
    setScores(grades);
  }, [course.id]);

  // `next`: { present, excused } o null para borrar el registro.
  const toggleAttendance = async (row, session, next) => {
    const previous = attendance;
    setAttendanceRows((prev) => {
      const others = prev.filter((a) => !(a.uid === row.uid && a.sessionId === session.id));
      return next === null ? others : [...others, { uid: row.uid, sessionId: session.id, moduleId: session.moduleId, studentName: row.studentName, present: !!next.present, excused: !!next.excused, late: !!next.late }];
    });
    try {
      if (next === null) {
        await deleteAttendance({ courseId: course.id, sessionId: session.id, uid: row.uid });
      } else {
        await setAttendance({ courseId: course.id, sessionId: session.id, moduleId: session.moduleId, uid: row.uid, studentName: row.studentName, present: !!next.present, excused: !!next.excused, late: !!next.late });
        // Tomar lista en una sesión la deja como dictada para TODA el aula: quien
        // quede sin marcar cuenta como falta, no desaparece del porcentaje.
        if (groupId && !aulaDoneIds.has(session.id) && !globalDoneIds.has(session.id)) await toggleSessionDone(session, true, true);
        addToast(`Asistencia de ${row.studentName} actualizada.`, 'success');
      }
    } catch {
      setAttendanceRows(previous);
      addToast('No se pudo guardar la asistencia. Intenta de nuevo.', 'error');
    }
  };

  const deliverableIds = new Set(allDeliverableModules(modules).map((m) => m.id));
  const pendingCount = submissions.filter((s) => s.status === 'submitted' && deliverableIds.has(s.moduleId) && rosterUids.has(s.uid)).length;

  const classSummary = useMemo(() => {
    const model = getGradingModel(course.id, modules);
    const scoresByUid = Object.fromEntries(scores.map((g) => [g.uid, g.scores || {}]));
    const sessions = getOrderedSessions(modules);
    let riskCount = 0;
    let gradeSum = 0; let gradeN = 0;
    let attSum = 0; let attN = 0;
    roster.forEach((r) => {
      const summary = computeGradeSummary(buildStudentRows(model, submissions.filter((sub) => sub.uid === r.uid), scoresByUid[r.uid]));
      const attPct = attendanceStats(sessions, attendance.filter((a) => a.uid === r.uid)).raw;
      if (attPct !== null) { attSum += attPct; attN += 1; }
      if (summary.promedioParcial !== null) { gradeSum += summary.promedioParcial; gradeN += 1; }
      if ((summary.promedioParcial !== null && summary.promedioParcial < APPROVAL.minFinalGrade) || (attPct !== null && attPct < APPROVAL.minAttendancePct)) riskCount += 1;
    });
    return {
      promedioParcial: gradeN ? Math.round((gradeSum / gradeN) * 100) / 100 : null,
      asistenciaPromedio: attN ? Math.round(attSum / attN) : null,
      enRiesgo: riskCount,
      total: roster.length,
    };
  }, [course.id, modules, roster, submissions, attendance, scores]);

  if (!can(currentUser, 'grade')) {
    return <div className="admin-panel" style={{ textAlign: 'center', color: '#6B6980' }}>Tu cuenta no tiene habilitado ver fichas ni calificar entregas. Pídele a un administrador que active esa función.</div>;
  }
  if (loading) return <div className="admin-empty-hint">Cargando evaluación...</div>;

  const focused = vista === 'entregas' && reviewFocus;

  return (
    <div className="admin-two-col" style={{ gridTemplateColumns: focused ? '1fr' : '1fr 300px', alignItems: 'flex-start' }}>
      <div style={{ minWidth: 0 }}>
        {vista === 'entregas' && <EntregasRevision course={course} aulaLabel={aulaLabel} modules={modules} roster={roster} submissions={submissions} onReloadSubmissions={reloadSubmissions} onFocusChange={setReviewFocus} />}
        {vista === 'notas' && <RegistroNotas course={course} aulaLabel={aulaLabel} fileTag={fileTag} modules={modules} roster={roster} submissions={submissions} attendance={attendance} scores={scores} onGradeSaved={reloadGrades} />}
        {vista === 'asistencia' && <Asistencia course={course} aulaLabel={aulaLabel} fileTag={fileTag} modules={modules} roster={roster} attendance={attendance} onToggle={toggleAttendance} doneIds={aulaDoneIds} globalDoneIds={globalDoneIds} onToggleDone={groupId ? (session, done) => toggleSessionDone(session, done) : null} />}
      </div>
      {!focused && (
        <div>
          <EvalSidePanel vista={vista} setVista={setVista} pendingCount={pendingCount} summary={classSummary} />
        </div>
      )}
    </div>
  );
};

export default TeacherCourseEvaluacion;
