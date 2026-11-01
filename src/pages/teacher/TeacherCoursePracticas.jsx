import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Info, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { can } from '../../lib/permissions';
import { fetchCourseContent, fetchAllEnrollments, fetchCourseSubmissions, fetchLiveSessions, fetchPractices, savePractice, deletePractice, upsertSubmission, fetchGroupProgress } from '../../lib/db';
import { buildClassList, classLabel } from '../../lib/classList';
import { practicesForGroup, practiceKey, hasDelivered } from '../../lib/workItems';
import { getGradingModel } from '../../lib/gradingScheme';
import { usableGrade } from '../../lib/gradebook';
import { toPeruIso, peruDateTimeParts } from '../../lib/liveScheduleGenerator';
import { aulaRoster } from '../../lib/roster';
import ModalPortal from '../../components/ModalPortal';
import Switch from '../../components/Switch';
import GradeReview from '../../components/GradeReview';

const pct = (n) => `${String(n).replace('.', ',')}%`;
const avg = (list) => (list.length ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10 : null);
const initials = (name) => (name || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

// Nueva práctica / editar (D6): clase, nombre, indicaciones (texto libre),
// fecha y hora límite y "Pasa a registro" (empieza apagado). Con entregas ya
// recibidas solo se puede mover la fecha límite.
const PracticeModal = ({ course, group, classList, practice, locked, onClose, onSaved, onDelete }) => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const initialDue = practice?.dueAt ? peruDateTimeParts(practice.dueAt) : { date: '', time: '23:59' };
  const [classId, setClassId] = useState(practice?.classId || '');
  const [title, setTitle] = useState(practice?.title || '');
  const [instructions, setInstructions] = useState(practice?.instructions || '');
  const [date, setDate] = useState(initialDue.date);
  const [time, setTime] = useState(initialDue.time || '23:59');
  const [inRecord, setInRecord] = useState(!!practice?.countsInRecord);
  const [saving, setSaving] = useState(false);
  const cls = classList.find((c) => c.id === classId);
  const missing = !classId ? 'Elige la clase' : !title.trim() ? 'Escribe el nombre' : !date ? 'Elige la fecha límite' : '';

  const pickClass = (id) => {
    setClassId(id);
    const c = classList.find((x) => x.id === id);
    // Por defecto vence el día de la clase siguiente (o el mismo día si es la última).
    if (c && !date) {
      const next = classList[classList.indexOf(c) + 1] || c;
      if (next.startsAt) setDate(peruDateTimeParts(next.startsAt).date);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const data = locked
        ? { id: practice.id, dueAt: toPeruIso(`${date}T${time}`) }
        : {
          ...(practice?.id ? { id: practice.id } : {}),
          courseId: course.id, groupId: group?.id || null,
          classId, classTitle: cls ? `Sesión ${cls.number}` : '', moduleId: cls?.moduleId || null,
          title: title.trim(), instructions: instructions.trim(), dueAt: toPeruIso(`${date}T${time}`), countsInRecord: inRecord,
          ...(practice?.id ? {} : { createdBy: currentUser.uid, createdByName: currentUser.displayName || '' }),
        };
      await savePractice(data);
      addToast(practice ? 'Práctica actualizada.' : 'Práctica creada. Tus alumnos ya la ven en Mi proyecto.', 'success');
      onSaved();
      onClose();
    } catch {
      addToast('No se pudo guardar la práctica. Intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="admin-modal-overlay" onClick={() => !saving && onClose()}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head">
            <div><div className="admin-modal-title">{practice ? 'Editar práctica' : 'Nueva práctica'}</div><div className="admin-modal-sub">{course.title}{group?.name ? ` · ${group.name}` : ''}</div></div>
            <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
          </div>
          {locked && <p className="dash-notice" style={{ marginTop: 0 }}>Ya hay entregas: solo puedes cambiar la fecha límite.</p>}
          <div className="admin-field">
            <label>Clase</label>
            <select value={classId} onChange={(e) => pickClass(e.target.value)} disabled={locked}>
              <option value="">Elige la clase</option>
              {classList.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}{c.dateLabel ? ` · ${c.dateLabel}` : ''}</option>)}
            </select>
            <span className="admin-cell-sub">Elige la clase en la que la explicas. La práctica aparece con esa sesión.</span>
          </div>
          <div className="admin-field"><label>Nombre</label><input value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} placeholder="Ej. Positioning statement de tu marca" /></div>
          <div className="admin-field"><label>Indicaciones (opcional)</label><textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} disabled={locked} placeholder="Lo que el alumno ve al entregar. Texto libre: lo presenta como prefiera." /></div>
          <div className="admin-field-row">
            <div className="admin-field"><label>Fecha límite</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="admin-field"><label>Hora</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          </div>
          {!practice && (
            <div className="record-toggle">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong>Pasa a registro</strong><Switch checked={inRecord} onChange={setInRecord} label="Pasa a registro" /></div>
              <span>Empieza apagado: la nota es una guía para el alumno y no suma a su nota final. Puedes activarlo después.</span>
            </div>
          )}
          <div className="admin-modal-actions">
            {practice && !locked && onDelete && <button className="admin-btn-ghost" style={{ color: '#BE123C', marginRight: 'auto' }} onClick={onDelete} disabled={saving}>Eliminar</button>}
            {missing && <span className="admin-cell-sub" style={{ alignSelf: 'center', color: '#B45309' }}>{missing}</span>}
            <button className="admin-btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="admin-btn-edit" onClick={save} disabled={saving || !!missing}>{saving ? 'Guardando...' : practice ? 'Guardar cambios' : 'Crear práctica'}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

// Prácticas y avances (D4): las prácticas de clase del aula, cuántos
// entregaron, cuántos faltan calificar y el promedio, cada una con su
// interruptor "Pasa a registro". Abajo, cómo se calcula la nota final según el
// sílabo. Al alumno no se le avisa si una práctica pasa o no a registro.
const TeacherCoursePracticas = () => {
  const { course, group, groups, aulaId } = useOutletContext();
  const { currentUser } = useAuth();
  const { addToast, confirmDialog } = useUI();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [modal, setModal] = useState(null); // null | 'new' | practice
  const [reviewUid, setReviewUid] = useState(null);
  const [filter, setFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const groupId = group?.id || null;

  const load = useCallback(async () => {
    const [content, enrollments, subs, live, practices, doneIds] = await Promise.all([
      fetchCourseContent(course.id), fetchAllEnrollments(course.id), fetchCourseSubmissions(course.id),
      fetchLiveSessions(course.id).catch(() => []), fetchPractices(course.id).catch(() => []), fetchGroupProgress(groupId).catch(() => []),
    ]);
    const modules = content.modules || [];
    setData({ modules, enrollments, subs, practices, classList: buildClassList({ liveSessions: live, modules, groupId, doneIds }) });
  }, [course.id, groupId]);
  useEffect(() => { load().catch(() => setData((d) => d || { error: true })); }, [load]);

  const roster = useMemo(() => (data?.enrollments ? aulaRoster(data.enrollments, course.id, groups, aulaId) : []), [data, course.id, groups, aulaId]);

  if (!can(currentUser, 'grade')) {
    return <div className="admin-panel" style={{ textAlign: 'center', color: '#6B6980' }}>Tu cuenta no tiene habilitado calificar. Pídele a un administrador que active esa función.</div>;
  }
  if (!data) return <div className="admin-empty-hint">Cargando prácticas...</div>;
  if (data.error) return <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B' }}>No se pudieron cargar las prácticas. Recarga la página.</div>;

  const practices = practicesForGroup(data.practices, groupId).filter((p) => !groupId || p.groupId === groupId || !p.groupId)
    .sort((a, b) => String(b.dueAt || '').localeCompare(String(a.dueAt || '')));
  const uids = new Set(roster.map((r) => r.uid));
  const subsOf = (p) => data.subs.filter((s) => s.moduleId === practiceKey(p.id) && uids.has(s.uid));
  const statsOf = (p) => {
    const subs = subsOf(p);
    const delivered = subs.filter(hasDelivered);
    const toGrade = subs.filter((s) => s.status === 'submitted').length;
    const grades = subs.map(usableGrade).filter((g) => g !== null);
    return { delivered: delivered.length, toGrade, average: avg(grades), graded: grades.length };
  };
  const moduleNumber = (moduleId) => data.modules.findIndex((m) => m.id === moduleId) + 1;
  const model = getGradingModel(course.id, data.modules);
  const inRecordCount = practices.filter((p) => p.countsInRecord).length;
  const allGrades = practices.flatMap((p) => subsOf(p).map(usableGrade).filter((g) => g !== null));
  const totalToGrade = practices.reduce((sum, p) => sum + statsOf(p).toGrade, 0);

  const toggleRecord = async (p, value) => {
    try {
      await savePractice({ id: p.id, countsInRecord: value });
      setData((d) => ({ ...d, practices: d.practices.map((x) => (x.id === p.id ? { ...x, countsInRecord: value } : x)) }));
      addToast(value ? 'La práctica pasa a registro: su nota cuenta en su módulo.' : 'La práctica queda como referencial.', 'success');
    } catch {
      addToast('No se pudo cambiar. Intenta de nuevo.', 'error');
    }
  };

  const removePractice = async (p) => {
    if (!(await confirmDialog({ title: 'Eliminar práctica', message: `¿Eliminar "${p.title}"? Desaparece de Mi proyecto de tus alumnos.`, confirmLabel: 'Eliminar', danger: true }))) return;
    try {
      await deletePractice(p.id);
      setModal(null);
      addToast('Práctica eliminada.', 'success');
      load();
    } catch {
      addToast('No se pudo eliminar la práctica.', 'error');
    }
  };

  const reviewing = practices.find((p) => p.id === searchParams.get('practica')) || null;
  const pageHead = (
    <div className="admin-page-head">
      <div><h1 className="admin-page-title">Prácticas y avances</h1><p className="admin-page-sub">{course.title}{group?.name ? ` · ${group.name}` : ''} · Califica las prácticas de clase y elige cuáles pasan al registro.</p></div>
      {!reviewing && <button className="admin-btn-edit" onClick={() => setModal('new')}><Plus size={14} /> Nueva práctica</button>}
    </div>
  );

  // --- Calificar una práctica (D5) ---
  if (reviewing) {
    const rows = roster.map((r) => ({ ...r, submission: data.subs.find((s) => s.uid === r.uid && s.moduleId === practiceKey(reviewing.id)) || null }));
    const statusOf = (row) => (row.submission?.status === 'reviewed'
      ? { key: 'revisado', label: hasDelivered(row.submission) ? 'Calificado' : 'Calificado sin entrega', cls: 'admin-status-green' }
      : hasDelivered(row.submission) ? { key: 'por_revisar', label: 'Por revisar', cls: 'admin-status-amber' } : { key: 'sin_entrega', label: 'Sin entrega', cls: 'admin-status-gray' });
    const filtered = rows.filter((r) => filter === 'all' || statusOf(r).key === filter);
    const reviewRow = filtered.find((r) => r.uid === reviewUid);
    const idx = filtered.findIndex((r) => r.uid === reviewUid);
    const back = () => { setReviewUid(null); setSearchParams({}); };

    const saveGrade = async ({ grade: draft, parts }) => {
      const grade = Number(draft);
      if (draft === '' || !Number.isFinite(grade) || grade < 0 || grade > 20) { addToast('Ingresa una nota entre 0 y 20.', 'error'); return; }
      setSaving(true);
      try {
        await upsertSubmission({
          courseId: course.id, moduleId: practiceKey(reviewing.id), moduleTitle: reviewing.title, uid: reviewRow.uid, studentName: reviewRow.studentName,
          deliverableTitle: reviewing.classTitle ? `${reviewing.classTitle} · ${reviewing.title}` : reviewing.title, status: 'reviewed', grade,
          feedback: [parts.good, parts.improve, parts.next].filter((t) => t.trim()).join('\n\n'),
          extra: { kind: 'practice', practiceId: reviewing.id, parentModuleId: reviewing.moduleId || null, feedbackParts: { good: parts.good.trim(), improve: parts.improve.trim(), next: parts.next.trim() } },
        });
        addToast(`Calificación guardada para ${reviewRow.studentName}.`, 'success');
        const subs = await fetchCourseSubmissions(course.id);
        setData((d) => ({ ...d, subs }));
      } catch {
        addToast('No se pudo guardar la calificación. Intenta de nuevo.', 'error');
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="anim-fade-up d1">
        {pageHead}
        {reviewRow ? (
          <GradeReview
            key={reviewRow.uid}
            student={reviewRow} index={idx} total={filtered.length} sub={reviewRow.submission}
            subtitle={`Práctica de ${reviewing.classTitle || 'clase'} · ${reviewing.title}`}
            statusLabel={statusOf(reviewRow).label} statusCls={statusOf(reviewRow).cls}
            onBack={() => setReviewUid(null)}
            onPrev={idx > 0 ? () => setReviewUid(filtered[idx - 1].uid) : null}
            onNext={idx < filtered.length - 1 ? () => setReviewUid(filtered[idx + 1].uid) : null}
            onSave={saveGrade} saving={saving}
            inRecord={reviewing.countsInRecord} onToggleRecord={(v) => toggleRecord(reviewing, v)}
          />
        ) : (
          <>
            <button className="admin-btn-ghost" style={{ marginBottom: 14 }} onClick={back}>← Volver a las prácticas</button>
            <div className="admin-panel" style={{ marginBottom: 14 }}>
              <div className="dash-list-row-title">{reviewing.classTitle ? `${reviewing.classTitle} · ` : ''}{reviewing.title}</div>
              <div className="admin-cell-sub">{reviewing.instructions || 'Sin indicaciones.'}</div>
            </div>
            <div className="admin-toolbar" style={{ gap: 8, marginBottom: 12 }}>
              {[['all', 'Todos'], ['por_revisar', 'Por revisar'], ['revisado', 'Calificados'], ['sin_entrega', 'Sin entrega']].map(([key, label]) => (
                <button key={key} className="admin-btn-ghost" style={filter === key ? { background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'transparent' } : undefined} onClick={() => setFilter(key)}>{label}</button>
              ))}
            </div>
            <div className="admin-panel">
              {filtered.length === 0 ? <p className="admin-panel-caption" style={{ marginTop: 0 }}>No hay alumnos en esta categoría.</p> : filtered.map((row) => {
                const st = statusOf(row);
                const g = usableGrade(row.submission);
                return (
                  <div key={row.uid} className="dash-list-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="dash-post-avatar">{initials(row.studentName)}</div>
                      <div><div className="dash-list-row-title">{row.studentName}</div><div className="dash-list-row-sub">{g !== null ? `Nota ${g}/20` : st.label}</div></div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span className={`admin-status ${st.cls}`}>{st.label}</span>
                      <button className={st.key === 'por_revisar' ? 'admin-btn-edit' : 'admin-btn-ghost'} onClick={() => setReviewUid(row.uid)}>{st.key === 'por_revisar' ? 'Calificar' : st.key === 'revisado' ? 'Ver' : 'Calificar'}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="anim-fade-up d1">
      {pageHead}
      <div className="admin-two-col" style={{ gridTemplateColumns: '1fr 300px', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div className="cert-note" style={{ marginTop: 0, marginBottom: 18 }}><Info size={14} /> Las prácticas empiezan como referenciales: el alumno ve su nota para saber cómo va, pero no suma a su nota final. Activa «Pasa a registro» solo en las que quieras que cuenten.</div>

          <div className="admin-panel" style={{ marginBottom: 20 }}>
            <div className="admin-panel-head"><span className="admin-panel-title">Prácticas del curso</span><span className="admin-cell-sub" style={{ fontWeight: 600 }}>Pasa a registro</span></div>
            {practices.length === 0 ? (
              <p className="admin-panel-caption" style={{ marginTop: 0 }}>Todavía no creas prácticas para esta aula. Usa «Nueva práctica» y elige la clase en la que la explicas.</p>
            ) : practices.map((p) => {
              const st = statsOf(p);
              const n = moduleNumber(p.moduleId);
              const today = p.dueAt && new Date(p.dueAt).toDateString() === new Date().toDateString();
              return (
                <div key={p.id} className="dash-list-row" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div className="dash-list-row-title">{p.classTitle ? `${p.classTitle} · ` : ''}{p.title}</div>
                    <div className="dash-list-row-sub">
                      {st.delivered === 0 ? `${today ? 'Hoy · ' : ''}aún sin entregas` : `${st.delivered} de ${roster.length} entregados${st.toGrade ? ` · ${st.toGrade} por calificar` : st.average !== null ? ` · promedio ${String(st.average).replace('.', ',')}` : ''}`}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {st.toGrade > 0 && <span className="admin-status admin-status-amber" style={{ fontSize: '.68rem' }}>{st.toGrade} por calificar</span>}
                      {st.toGrade === 0 && st.graded > 0 && <span className="admin-status admin-status-green" style={{ fontSize: '.68rem' }}>Calificado</span>}
                      {p.countsInRecord
                        ? <span className="admin-status admin-status-violet" style={{ fontSize: '.68rem' }}>Cuenta en {n > 0 ? `Módulo ${n}` : 'su módulo'}</span>
                        : <span className="admin-status admin-status-gray" style={{ fontSize: '.68rem' }}>Solo referencial</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <button className="admin-icon-btn" aria-label={`Editar ${p.title}`} onClick={() => setModal(p)}><Pencil size={14} /></button>
                    <button className={st.toGrade > 0 ? 'admin-btn-edit' : 'admin-btn-ghost'} onClick={() => { setFilter(st.toGrade > 0 ? 'por_revisar' : 'all'); setSearchParams({ practica: p.id }); }}>{st.toGrade > 0 ? 'Calificar' : 'Ver notas'}</button>
                    <Switch checked={!!p.countsInRecord} onChange={(v) => toggleRecord(p, v)} label={`Pasa a registro: ${p.title}`} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head" style={{ marginBottom: 2 }}><span className="admin-panel-title">Cómo se calcula la nota final</span></div>
            <p className="admin-panel-caption" style={{ marginTop: 0 }}>Según el sílabo de {course.title}.</p>
            <div className="grade-blocks">
              {model.blocks.filter((b) => b.components.length).map((b, i) => (
                <div key={b.key} className={`grade-block ${i === 0 ? 'is-main' : ''}`} style={{ flex: b.weight }}>
                  <strong>{pct(b.weight)}</strong><span>{b.label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
              {model.components.filter((c) => c.kind === 'module').map((c) => <span key={c.key} className="admin-status admin-status-violet" style={{ fontSize: '.68rem' }}>Módulo {c.index + 1} · {pct(c.weight)}</span>)}
            </div>
            <p className="admin-cell-sub" style={{ margin: 0 }}>Para el certificado: nota final de 16 o más y 80% de entregables. Las prácticas en «Pasa a registro» se promedian dentro de su módulo.</p>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head"><span className="admin-panel-title">Resumen del aula</span></div>
          <div className="dash-profile-stats" style={{ gridTemplateColumns: '1fr', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="admin-cell-sub">Prácticas en registro</span><strong>{inRecordCount} de {practices.length}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="admin-cell-sub">Promedio referencial</span><strong>{avg(allGrades) === null ? '—' : String(avg(allGrades)).replace('.', ',')}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="admin-cell-sub">Por calificar</span><strong>{totalToGrade}</strong></div>
          </div>
          <p className="admin-panel-caption" style={{ marginBottom: 0 }}>El alumno ve su nota, pero no si pasa a registro.</p>
        </div>
      </div>

      {modal && (
        <PracticeModal
          course={course} group={group} classList={data.classList}
          practice={modal === 'new' ? null : modal}
          locked={modal !== 'new' && subsOf(modal).some(hasDelivered)}
          onClose={() => setModal(null)} onSaved={load}
          onDelete={modal !== 'new' ? () => removePractice(modal) : null}
        />
      )}
    </div>
  );
};

export default TeacherCoursePracticas;
