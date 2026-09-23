import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import {
  ClipboardCheck, BarChart3, UsersRound, ChevronLeft, ChevronRight, ArrowLeft,
  Download, Save, ExternalLink,
} from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { fetchCourseContent, fetchAllEnrollments, fetchCourseSubmissions, upsertSubmission, fetchCourseAttendance, setAttendance, deleteAttendance } from '../../lib/db';
import { buildGradebookRows, computeGradeSummary } from '../../lib/gradebook';
import { resolveWeights } from '../../lib/weights';
import { downloadCsv as downloadCsvFile } from '../../lib/csv';
import { APPROVAL } from '../../lib/approval';
import { getOrderedSessions } from '../../lib/courseSessions';

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

const EntregasRevision = ({ course, modules, roster, submissions, onReloadSubmissions }) => {
  const { addToast } = useUI();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState('all');
  const [reviewingUid, setReviewingUid] = useState(null);
  const [gradeDraft, setGradeDraft] = useState('');
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const withDeliverable = modules.filter((m) => m.deliverable?.description);
  const moduleId = searchParams.get('modulo') && withDeliverable.some((m) => m.id === searchParams.get('modulo'))
    ? searchParams.get('modulo') : withDeliverable[0]?.id;
  const module = withDeliverable.find((m) => m.id === moduleId);

  const setModuleId = (id) => { setReviewingUid(null); setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('vista', 'entregas'); next.set('modulo', id); return next; }); };

  if (withDeliverable.length === 0) {
    return <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B' }}>Todavía no defines entregables en "Contenido".</div>;
  }

  const rows = roster.map((r) => ({ ...r, submission: submissions.find((s) => s.uid === r.uid && s.moduleId === module.id) || null }));
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

  const reviewingRow = rows.find((r) => r.uid === reviewingUid);
  const reviewIndex = filtered.findIndex((r) => r.uid === reviewingUid);

  const openReview = (row) => {
    setReviewingUid(row.uid);
    setGradeDraft(row.submission?.grade ?? '');
    setFeedbackDraft(row.submission?.feedback || '');
  };

  const goRelative = (dir) => {
    const next = filtered[reviewIndex + dir];
    if (next) openReview(next);
  };

  const saveGrade = async () => {
    const grade = Number(gradeDraft);
    if (gradeDraft === '' || !Number.isFinite(grade) || grade < 0 || grade > 20) {
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
      addToast(`Calificación guardada para ${reviewingRow.studentName}.`, 'success');
      await onReloadSubmissions();
    } catch {
      addToast('No se pudo guardar la calificación. Intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (reviewingRow) {
    return (
      <div className="anim-fade-up d1">
        <button className="admin-btn-ghost" style={{ marginBottom: 14 }} onClick={() => setReviewingUid(null)}><ArrowLeft size={13} /> Volver a entregas</button>
        <div className="admin-page-head">
          <div>
            <span className="admin-status admin-status-gray">{reviewIndex + 1} de {filtered.length}</span>
            <h1 className="admin-page-title" style={{ marginTop: 8 }}>{reviewingRow.studentName}</h1>
            <p className="admin-page-sub">{module.deliverable?.description || module.title}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="admin-icon-btn" disabled={reviewIndex <= 0} onClick={() => goRelative(-1)}><ChevronLeft size={16} /></button>
            <button className="admin-icon-btn" disabled={reviewIndex >= filtered.length - 1} onClick={() => goRelative(1)}><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="admin-two-col" style={{ gridTemplateColumns: '1fr 320px', alignItems: 'flex-start' }}>
          <div className="admin-panel">
            <div className="admin-panel-head"><span className="admin-panel-title">Entrega del alumno</span></div>
            {reviewingRow.submission ? (
              /^https?:\/\//.test(reviewingRow.submission.note || '') ? (
                <a className="admin-btn-edit" href={reviewingRow.submission.note} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Abrir entrega</a>
              ) : (
                <p style={{ fontSize: '.88rem', color: '#4A4860' }}>{reviewingRow.submission.note || 'El alumno no dejó una descripción.'}</p>
              )
            ) : (
              <p className="admin-panel-caption" style={{ marginTop: 0 }}>Este alumno todavía no presenta su entrega.</p>
            )}
          </div>
          <div className="admin-panel">
            <div className="admin-field"><label>Nota (sobre 20)</label><input className="grade-cell-input" style={{ width: '100%' }} type="number" min="0" max="20" value={gradeDraft} onChange={(e) => setGradeDraft(e.target.value)} /></div>
            <div className="admin-field"><label>Retroalimentación</label><textarea rows={5} value={feedbackDraft} onChange={(e) => setFeedbackDraft(e.target.value)} placeholder="Qué hizo bien, qué debe mejorar y cuál es su siguiente paso." /></div>
            <button className="admin-btn-edit" style={{ width: '100%', justifyContent: 'center' }} onClick={saveGrade} disabled={saving}><Save size={13} /> {saving ? 'Guardando...' : 'Guardar calificación'}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head"><div><h1 className="admin-page-title">Entregas y revisión</h1><p className="admin-page-sub">{course.title} · Revisa el archivo completo, califica y deja retroalimentación.</p></div></div>

      <div className="admin-toolbar" style={{ gap: 8, marginBottom: 16 }}>
        {withDeliverable.map((m, i) => (
          <button key={m.id} className="admin-btn-ghost" style={m.id === module.id ? { background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'transparent' } : undefined} onClick={() => setModuleId(m.id)}>
            M{i + 1} <span className="admin-cell-sub" style={{ marginLeft: 4 }}>{resolveWeights(withDeliverable).rows.find((r) => r.module.id === m.id)?.weight}%</span>
          </button>
        ))}
      </div>

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
        {filtered.length === 0 ? <p className="admin-panel-caption" style={{ marginTop: 0 }}>No hay alumnos en esta categoría.</p> : filtered.map((row) => {
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
      </div>
    </div>
  );
};

// --- Subvista: Registro de notas ---

const RegistroNotas = ({ course, modules, roster, submissions }) => {
  const withDeliverable = modules.filter((m) => m.deliverable?.description);
  const weightById = Object.fromEntries(resolveWeights(withDeliverable).rows.map((r) => [r.module.id, r.weight]));

  const rowsByStudent = roster.map((r) => {
    const byModule = {};
    withDeliverable.forEach((m) => { byModule[m.id] = submissions.find((s) => s.uid === r.uid && s.moduleId === m.id) || null; });
    const gradeRows = buildGradebookRows(withDeliverable, byModule);
    const summary = computeGradeSummary(gradeRows);
    return { ...r, gradeRows, summary };
  });

  const exportCsv = () => {
    const header = ['Estudiante', ...withDeliverable.map((m) => m.deliverable?.description || m.title), 'Promedio'];
    const rows = rowsByStudent.map((r) => [r.studentName, ...r.gradeRows.map((g) => g.grade ?? ''), r.summary.promedioParcial ?? '']);
    downloadCsv(`registro-notas-${course.id}.csv`, [header, ...rows]);
  };

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Registro de notas</h1><p className="admin-page-sub">{course.title} · Notas por módulo, promedio final y estado de aprobación.</p></div>
        <button className="admin-btn-ghost" onClick={exportCsv}><Download size={14} /> Exportar CSV</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Estudiante</th>
              {withDeliverable.map((m, i) => <th key={m.id}>M{i + 1} <span className="admin-cell-sub">{weightById[m.id]}%</span></th>)}
              <th>Promedio</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rowsByStudent.map((r) => (
              <tr key={r.uid}>
                <td className="admin-cell-name">{r.studentName}</td>
                {r.gradeRows.map((g) => <td key={g.moduleId}>{g.grade ?? '—'}</td>)}
                <td><strong>{r.summary.promedioParcial ?? '—'}</strong></td>
                <td><span className="admin-status admin-status-violet">{r.status === 'completed' ? 'Completado' : 'En curso'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Subvista: Asistencia ---

const Asistencia = ({ course, modules, roster, attendance, onToggle }) => {
  const sessions = getOrderedSessions(modules);
  const grouped = modules.filter((m) => m.sessions?.length).map((m) => ({ module: m, sessions: sessions.filter((s) => s.moduleId === m.id) }));

  const attendanceFor = (uid, sessionId) => attendance.find((a) => a.uid === uid && a.sessionId === sessionId) || null;

  const statsFor = (uid) => {
    const taken = sessions.filter((s) => attendanceFor(uid, s.id));
    const present = taken.filter((s) => attendanceFor(uid, s.id).present).length;
    const raw = taken.length ? (present / taken.length) * 100 : null;
    return { pct: raw === null ? null : Math.round(raw), raw, faltas: taken.length - present };
  };

  const sessionsTaken = sessions.filter((s) => attendance.some((a) => a.sessionId === s.id)).length;
  const withAtt = roster.map((r) => statsFor(r.uid).raw).filter((p) => p !== null);
  const avgPct = withAtt.length ? Math.round(withAtt.reduce((sum, p) => sum + p, 0) / withAtt.length) : null;
  const bajo75 = withAtt.filter((p) => p < APPROVAL.minAttendancePct).length;

  const exportCsv = () => {
    const header = ['Estudiante', ...sessions.map((s) => s.label), 'Asist.'];
    const rows = roster.map((r) => [r.studentName, ...sessions.map((s) => { const a = attendanceFor(r.uid, s.id); return a ? (a.present ? 'P' : 'F') : ''; }), statsFor(r.uid).pct === null ? '' : `${statsFor(r.uid).pct}%`]);
    downloadCsv(`asistencia-${course.id}.csv`, [header, ...rows]);
  };

  const cycle = (row, session) => {
    const current = attendanceFor(row.uid, session.id);
    const nextPresent = current === null ? true : current.present ? false : null;
    onToggle(row, session, nextPresent);
  };

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Asistencia</h1><p className="admin-page-sub">{course.title} · Registra y consulta la asistencia de todas las sesiones en una sola tabla.</p></div>
        <button className="admin-btn-ghost" onClick={exportCsv}><Download size={14} /> Exportar CSV</button>
      </div>

      <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="admin-stat-card"><div className="admin-stat-label">Asistencia promedio</div><div className="admin-stat-value">{avgPct === null ? '—' : `${avgPct}%`}</div></div>
        <div className="admin-stat-card"><div className="admin-stat-label">Sesiones registradas</div><div className="admin-stat-value">{sessionsTaken}/{sessions.length}</div></div>
        <div className="admin-stat-card"><div className="admin-stat-label">Bajo el 75%</div><div className="admin-stat-value">{bajo75}</div></div>
      </div>

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
              </tr>
              <tr>
                {sessions.map((s) => <th key={s.id} style={{ textAlign: 'center', fontSize: '.7rem' }}>{s.label}<br />{s.dateLabel}</th>)}
              </tr>
            </thead>
            <tbody>
              {roster.map((row) => (
                <tr key={row.uid}>
                  <td className="admin-cell-name">{row.studentName}</td>
                  {sessions.map((s) => {
                    const a = attendanceFor(row.uid, s.id);
                    const cls = a === null ? 'pending' : a.present ? 'present' : 'absent';
                    return (
                      <td key={s.id} style={{ textAlign: 'center', padding: '8px 4px' }}>
                        <div className={`session-chip clickable ${cls}`} onClick={() => cycle(row, s)}>
                          <span className="session-chip-label">{a === null ? '·' : a.present ? '✓' : 'F'}</span>
                        </div>
                      </td>
                    );
                  })}
                  <td><strong>{statsFor(row.uid).pct === null ? '—' : `${statsFor(row.uid).pct}%`}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="admin-panel-caption">Haz clic en una celda para alternar Presente / Falta / Sin registrar.</p>
    </div>
  );
};

const TeacherCourseEvaluacion = () => {
  const { course } = useOutletContext();
  const { addToast } = useUI();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modules, setModules] = useState([]);
  const [roster, setRoster] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [attendance, setAttendanceRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const vista = ['entregas', 'notas', 'asistencia'].includes(searchParams.get('vista')) ? searchParams.get('vista') : 'entregas';
  const setVista = (v) => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('vista', v); next.delete('modulo'); return next; });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchCourseContent(course.id), fetchAllEnrollments(), fetchCourseSubmissions(course.id), fetchCourseAttendance(course.id)]).then(([content, enrollments, subs, att]) => {
      setModules(content.modules || []);
      setRoster(enrollments.filter((e) => e.courseId?.toString() === course.id.toString()).map((e) => ({ uid: e.uid, studentName: e.studentName || e.uid, status: e.status })));
      setSubmissions(subs);
      setAttendanceRows(att);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [course.id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial, mismo patrón que el resto del panel (ver TeacherCourseContenido)
  useEffect(() => { load(); }, [load]);

  const reloadSubmissions = useCallback(async () => {
    const subs = await fetchCourseSubmissions(course.id);
    setSubmissions(subs);
  }, [course.id]);

  const toggleAttendance = async (row, session, present) => {
    const previous = attendance;
    setAttendanceRows((prev) => {
      const others = prev.filter((a) => !(a.uid === row.uid && a.sessionId === session.id));
      return present === null ? others : [...others, { uid: row.uid, sessionId: session.id, moduleId: session.moduleId, studentName: row.studentName, present }];
    });
    try {
      if (present === null) {
        await deleteAttendance({ courseId: course.id, sessionId: session.id, uid: row.uid });
      } else {
        await setAttendance({ courseId: course.id, sessionId: session.id, moduleId: session.moduleId, uid: row.uid, studentName: row.studentName, present });
        addToast(`Asistencia de ${row.studentName} actualizada.`, 'success');
      }
    } catch {
      setAttendanceRows(previous);
      addToast('No se pudo guardar la asistencia. Intenta de nuevo.', 'error');
    }
  };

  const pendingCount = submissions.filter((s) => s.status === 'submitted').length;

  const classSummary = useMemo(() => {
    const withDeliverable = modules.filter((m) => m.deliverable?.description);
    const sessions = getOrderedSessions(modules);
    let riskCount = 0;
    let gradeSum = 0; let gradeN = 0;
    let attSum = 0; let attN = 0;
    roster.forEach((r) => {
      const byModule = {};
      withDeliverable.forEach((m) => { byModule[m.id] = submissions.find((s) => s.uid === r.uid && s.moduleId === m.id) || null; });
      const summary = computeGradeSummary(buildGradebookRows(withDeliverable, byModule));
      const taken = sessions.filter((s) => attendance.some((a) => a.uid === r.uid && a.sessionId === s.id));
      const present = taken.filter((s) => attendance.find((a) => a.uid === r.uid && a.sessionId === s.id)?.present).length;
      const attPct = taken.length ? (present / taken.length) * 100 : null;
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
  }, [modules, roster, submissions, attendance]);

  if (loading) return <div className="admin-empty-hint">Cargando evaluación...</div>;

  return (
    <div className="admin-two-col" style={{ gridTemplateColumns: '1fr 300px', alignItems: 'flex-start' }}>
      <div>
        {vista === 'entregas' && <EntregasRevision course={course} modules={modules} roster={roster} submissions={submissions} onReloadSubmissions={reloadSubmissions} />}
        {vista === 'notas' && <RegistroNotas course={course} modules={modules} roster={roster} submissions={submissions} />}
        {vista === 'asistencia' && <Asistencia course={course} modules={modules} roster={roster} attendance={attendance} onToggle={toggleAttendance} />}
      </div>
      <div>
        <EvalSidePanel vista={vista} setVista={setVista} pendingCount={pendingCount} summary={classSummary} />
      </div>
    </div>
  );
};

export default TeacherCourseEvaluacion;
