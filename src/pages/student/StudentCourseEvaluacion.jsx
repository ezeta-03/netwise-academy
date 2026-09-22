import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { ClipboardCheck, BarChart3, UsersRound, Send, ExternalLink, Clock3, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { fetchCourseContent, fetchCourseSubmissions, upsertSubmission, fetchCourseAttendance } from '../../lib/db';
import { buildGradebookRows, computeGradeSummary } from '../../lib/gradebook';
import { getOrderedSessions } from '../../lib/courseSessions';
import ModalPortal from '../../components/ModalPortal';

const formatDate = (iso) => {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' });
};

const NAV_ITEMS = [
  { key: 'entregas', label: 'Entregas y notas', sub: 'Retroalimentación por módulo', icon: ClipboardCheck },
  { key: 'notas', label: 'Mis notas', sub: 'Promedio y aprobación', icon: BarChart3 },
  { key: 'asistencia', label: 'Mi asistencia', sub: 'Registro por sesión', icon: UsersRound },
];

const EvalSidePanel = ({ vista, setVista, summary }) => (
  <>
    <div className="admin-panel" style={{ marginBottom: 20 }}>
      <div className="admin-panel-head"><span className="admin-panel-title">Mi evaluación</span></div>
      <div className="eval-nav-card">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.key} className={`eval-nav-row ${vista === item.key ? 'active' : ''}`} onClick={() => setVista(item.key)}>
              <div className="eval-nav-row-icon"><Icon size={15} /></div>
              <div><div className="eval-nav-row-title">{item.label}</div><div className="eval-nav-row-sub">{item.sub}</div></div>
            </div>
          );
        })}
      </div>
    </div>
    <div className="admin-panel">
      <div className="admin-panel-head"><span className="admin-panel-title">Mi resumen</span></div>
      <div className="dash-profile-stats" style={{ gridTemplateColumns: '1fr', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="admin-cell-sub">Promedio parcial</span><strong>{summary.promedioParcial ?? '—'}</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="admin-cell-sub">Asistencia</span><strong>{summary.asistenciaPct}%</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="admin-cell-sub">Estado</span><span className="admin-status admin-status-violet">En curso</span></div>
      </div>
    </div>
  </>
);

const SubmitModal = ({ course, module, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!note.trim()) { addToast('Pega el link de tu entrega o describe tu trabajo.', 'error'); return; }
    setSaving(true);
    try {
      await upsertSubmission({
        courseId: course.id, moduleId: module.id, moduleTitle: module.title,
        uid: currentUser.uid, studentName: currentUser.displayName || currentUser.email,
        deliverableTitle: module.deliverable?.description || module.title, status: 'submitted', note: note.trim(),
      });
      addToast('Entrega presentada. Tu docente la revisará pronto.', 'success');
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="admin-modal-overlay" onClick={onClose}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head"><div className="admin-modal-title">Presentar entrega</div><button className="admin-modal-close" onClick={onClose}><X size={18} /></button></div>
          <p className="admin-cell-sub" style={{ marginBottom: 12 }}>{module.deliverable?.description || module.title}</p>
          <div className="admin-field"><label>Link de tu archivo o descripción de tu entrega</label><textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="https://... o una breve descripción" /></div>
          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="admin-btn-edit" onClick={handleSave} disabled={saving}><Send size={13} /> {saving ? 'Enviando...' : 'Enviar entrega'}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

const EntregasNotas = ({ course, modules, submissions, onSubmitted }) => {
  const withDeliverable = modules.filter((m) => m.deliverable?.description);
  const [submitModule, setSubmitModule] = useState(null);

  const subFor = (moduleId) => submissions.find((s) => s.moduleId === moduleId) || null;
  const gradeRows = buildGradebookRows(withDeliverable, Object.fromEntries(withDeliverable.map((m) => [m.id, subFor(m.id)])));
  const summary = computeGradeSummary(gradeRows);
  const calificados = gradeRows.filter((r) => r.grade !== null).length;
  const proxima = withDeliverable.filter((m) => m.deliverable?.dueDate && !subFor(m.id)).sort((a, b) => new Date(a.deliverable.dueDate) - new Date(b.deliverable.dueDate))[0];

  const statusBadge = (sub) => {
    if (sub?.status === 'reviewed') return { label: 'Calificado', cls: 'admin-status-green' };
    if (sub?.status === 'submitted') return { label: 'En revisión', cls: 'admin-status-gray' };
    return { label: 'Por entregar', cls: 'admin-status-amber' };
  };

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head"><div><h1 className="admin-page-title">Entregas y notas</h1><p className="admin-page-sub">{course.title} · Tu nota, retroalimentación y las instrucciones de tu docente en cada módulo.</p></div></div>

      <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="admin-stat-card"><div className="admin-stat-label">Promedio parcial</div><div className="admin-stat-value">{summary.promedioParcial ?? '—'}</div><div className="admin-cell-sub">Sobre 20 · mínimo aprobatorio 15</div></div>
        <div className="admin-stat-card"><div className="admin-stat-label">Calificados</div><div className="admin-stat-value">{calificados}/{gradeRows.length}</div></div>
        <div className="admin-stat-card"><div className="admin-stat-label">Próxima entrega</div><div className="admin-stat-value" style={{ fontSize: '1rem' }}>{proxima ? formatDate(proxima.deliverable.dueDate) : 'Al día'}</div>{proxima && <div className="admin-cell-sub">{proxima.title}</div>}</div>
      </div>

      <div className="dash-eyebrow" style={{ marginBottom: 8 }}>Tus entregables</div>
      {withDeliverable.length === 0 ? <p className="admin-panel-caption">Todavía no hay entregables publicados.</p> : withDeliverable.map((m) => {
        const sub = subFor(m.id);
        const badge = statusBadge(sub);
        return (
          <div key={m.id} className="admin-panel" style={{ marginBottom: 14 }}>
            <div className="admin-panel-head">
              <div>
                <div className="dash-list-row-title">{m.title}</div>
                <div className="admin-cell-sub">{m.weeksLabel}{m.deliverable?.dueDate ? ` · Entrega ${formatDate(m.deliverable.dueDate)}` : ''}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`admin-status ${badge.cls}`}>{badge.label}</span>
                <strong>{sub?.grade ?? '—'}/20</strong>
              </div>
            </div>
            <p style={{ fontSize: '.82rem', fontWeight: 700, color: '#14141F', marginBottom: 2 }}>Qué debes entregar</p>
            <p style={{ fontSize: '.86rem', color: '#4A4860', marginBottom: 12 }}>{m.deliverable.description}</p>
            <p style={{ fontSize: '.82rem', fontWeight: 700, color: '#14141F', marginBottom: 6 }}>Tu entrega</p>
            {sub ? (
              /^https?:\/\//.test(sub.note || '') ? (
                <a className="admin-btn-ghost" href={sub.note} target="_blank" rel="noreferrer" style={{ marginBottom: 10 }}><ExternalLink size={13} /> Abrir entrega</a>
              ) : (
                <p className="admin-cell-sub" style={{ marginBottom: 10 }}>{sub.note}</p>
              )
            ) : (
              <p className="admin-panel-caption" style={{ marginTop: 0 }}>Aún no presentas esta entregable.</p>
            )}
            <button className="admin-btn-edit" style={{ marginBottom: 12 }} onClick={() => setSubmitModule(m)}><Send size={13} /> {sub ? 'Reemplazar entrega' : 'Presentar entrega'}</button>
            <p style={{ fontSize: '.82rem', fontWeight: 700, color: '#14141F', marginBottom: 2 }}>Retroalimentación del docente</p>
            <p className="admin-cell-sub" style={{ marginBottom: 0 }}>{sub?.feedback || 'Cuando presentes tu entrega, aquí verás tu nota y los comentarios de tu docente.'}</p>
          </div>
        );
      })}

      {submitModule && <SubmitModal course={course} module={submitModule} onClose={() => setSubmitModule(null)} onSaved={onSubmitted} />}
    </div>
  );
};

const MisNotas = ({ course, modules, submissions }) => {
  const withDeliverable = modules.filter((m) => m.deliverable?.description);
  const subByModule = Object.fromEntries(withDeliverable.map((m) => [m.id, submissions.find((s) => s.moduleId === m.id) || null]));
  const rows = buildGradebookRows(withDeliverable, subByModule);
  const summary = computeGradeSummary(rows);
  const formula = rows.map((r) => `${r.title.split(' ')[0] || 'M'} × ${r.weight}%`).join(' + ');

  const checks = [
    { label: 'Nota final mínima de 15', ok: summary.promedioParcial !== null && summary.promedioParcial >= 15, detail: `Tu promedio parcial: ${summary.promedioParcial ?? '—'}` },
    { label: 'Rendimiento ponderado mínimo de 80%', ok: summary.rendimientoPct !== null && summary.rendimientoPct >= 80, detail: `Tu rendimiento parcial: ${summary.rendimientoPct ?? '—'}%` },
  ];

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head"><div><h1 className="admin-page-title">Mis notas</h1><p className="admin-page-sub">{course.title} · Cómo se calcula tu promedio y qué te falta para aprobar.</p></div></div>

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="admin-panel-head"><span className="admin-panel-title">Registro de notas</span><span className="admin-status admin-status-violet">Promedio parcial</span></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Evaluación</th><th>Peso</th><th>Nota</th></tr></thead>
            <tbody>
              {rows.map((r) => <tr key={r.moduleId}><td>{r.title}</td><td>{r.weight}%</td><td>{r.grade ?? '—'}</td></tr>)}
              <tr><td><strong>Promedio parcial (sobre lo calificado)</strong></td><td></td><td><strong>{summary.promedioParcial ?? '—'}/20</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head"><span className="admin-panel-title">Para aprobar y certificarte</span></div>
        <p className="admin-panel-caption" style={{ marginTop: 0 }}>Se confirma al completar todas tus notas; <Clock3 size={11} style={{ verticalAlign: -1 }} /> indica que aún está en curso.</p>
        {checks.map((c) => (
          <div key={c.label} className="dash-list-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {c.ok ? <CheckCircle2 size={16} color="#15803D" /> : <Clock3 size={16} color="#B45309" />}
              <div><div className="dash-list-row-title">{c.label}</div><div className="dash-list-row-sub">{c.detail}</div></div>
            </div>
          </div>
        ))}
        {formula && <p className="admin-panel-caption" style={{ marginTop: 10 }}>PF = {formula}. Si no apruebas de forma regular, puedes rendir una evaluación sustitutoria (nota mínima 16) para obtener el certificado.</p>}
      </div>
    </div>
  );
};

const MiAsistencia = ({ course, modules, attendance }) => {
  const sessions = getOrderedSessions(modules);
  const taken = sessions.filter((s) => attendance.some((a) => a.sessionId === s.id));
  const present = taken.filter((s) => attendance.find((a) => a.sessionId === s.id)?.present).length;
  const pct = taken.length ? Math.round((present / taken.length) * 100) : 100;
  const grouped = modules.filter((m) => m.sessions?.length).map((m) => ({ module: m, sessions: sessions.filter((s) => s.moduleId === m.id) }));

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head"><div><h1 className="admin-page-title">Mi asistencia</h1><p className="admin-page-sub">{course.title} · Tu registro en cada sesión en vivo.</p></div></div>

      <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="admin-stat-card"><div className="admin-stat-label">Asistencia</div><div className="admin-stat-value">{pct}%</div><div className="admin-cell-sub">Cumples el mínimo de 75%</div></div>
        <div className="admin-stat-card"><div className="admin-stat-label">Sesiones</div><div className="admin-stat-value">{taken.length}/{sessions.length}</div><div className="admin-cell-sub">Asistidas de las dictadas</div></div>
        <div className="admin-stat-card"><div className="admin-stat-label">Faltas</div><div className="admin-stat-value">{taken.length - present}</div></div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head"><span className="admin-panel-title">Detalle por sesión</span></div>
        {sessions.length === 0 ? <p className="admin-panel-caption" style={{ marginTop: 0 }}>Tu docente todavía no registra sesiones.</p> : grouped.map((g) => (
          <div key={g.module.id} className="session-module-group">
            <div className="session-module-label">{g.module.title}</div>
            <div className="session-chip-row">
              {g.sessions.map((s) => {
                const a = attendance.find((x) => x.sessionId === s.id);
                const cls = !a ? 'pending' : a.present ? 'present' : 'absent';
                return (
                  <div key={s.id} className={`session-chip ${cls}`}>
                    <span className="session-chip-label">{s.label}</span>
                    <span>{s.dateLabel || (!a ? 'Por dictar' : '')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const StudentCourseEvaluacion = () => {
  const { course } = useOutletContext();
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modules, setModules] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  const vista = ['entregas', 'notas', 'asistencia'].includes(searchParams.get('vista')) ? searchParams.get('vista') : 'entregas';
  const setVista = (v) => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('vista', v); return next; });

  const load = useCallback(() => {
    if (!currentUser) return;
    setLoading(true);
    Promise.all([fetchCourseContent(course.id), fetchCourseSubmissions(course.id), fetchCourseAttendance(course.id)]).then(([content, subs, att]) => {
      setModules(content.modules || []);
      setSubmissions(subs.filter((s) => s.uid === currentUser.uid));
      setAttendance(att.filter((a) => a.uid === currentUser.uid));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [course.id, currentUser]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial, mismo patrón que el resto del panel (ver StudentCourseProyecto)
  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => {
    const withDeliverable = modules.filter((m) => m.deliverable?.description);
    const subByModule = Object.fromEntries(withDeliverable.map((m) => [m.id, submissions.find((s) => s.moduleId === m.id) || null]));
    const g = computeGradeSummary(buildGradebookRows(withDeliverable, subByModule));
    const sessions = getOrderedSessions(modules);
    const taken = sessions.filter((s) => attendance.some((a) => a.sessionId === s.id));
    const present = taken.filter((s) => attendance.find((a) => a.sessionId === s.id)?.present).length;
    return { promedioParcial: g.promedioParcial, asistenciaPct: taken.length ? Math.round((present / taken.length) * 100) : 100 };
  }, [modules, submissions, attendance]);

  if (loading) return <div className="admin-empty-hint">Cargando tu evaluación...</div>;

  return (
    <div className="admin-two-col" style={{ gridTemplateColumns: '1fr 300px', alignItems: 'flex-start' }}>
      <div>
        {vista === 'entregas' && <EntregasNotas course={course} modules={modules} submissions={submissions} onSubmitted={load} />}
        {vista === 'notas' && <MisNotas course={course} modules={modules} submissions={submissions} />}
        {vista === 'asistencia' && <MiAsistencia course={course} modules={modules} attendance={attendance} />}
      </div>
      <div><EvalSidePanel vista={vista} setVista={setVista} summary={summary} /></div>
    </div>
  );
};

export default StudentCourseEvaluacion;
