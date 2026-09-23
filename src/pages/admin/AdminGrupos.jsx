import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, X, Pencil, Radio, LogIn, XCircle, Trash2, Check, Link2, Ban, RotateCcw } from 'lucide-react';
import ModalPortal from '../../components/ModalPortal';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { fetchGroups, createGroup, updateGroup, deleteGroup, logChange, fetchLiveSessions, scheduleLiveSession, updateLiveSession, cancelLiveSession, deleteLiveSession, fetchCourseContent, fetchAllUsers } from '../../lib/db';
import { getLiveSessionStatus } from '../../lib/liveSessionStatus';
import { buildRecurringSessions, buildScheduleLabel, validSlots, parseScheduleLabel } from '../../lib/liveScheduleGenerator';
import { courseWeeksFromModules } from '../../lib/deliveryDates';
import { planScheduleSync } from '../../lib/scheduleSync';

const GROUP_STATUS = {
  open: { label: 'Abierto', cls: 'admin-status-green' },
  'to-open': { label: 'Por abrir', cls: 'admin-status-amber' },
  closed: { label: 'Cerrado', cls: 'admin-status-gray' },
};

// Horarios reales que ya dicta algún curso (data.js), para elegir en vez de
// escribir uno nuevo a mano -- evita horarios inconsistentes entre aulas.
// Se guardan días/hora por separado (no solo el texto) porque hacen falta
// para generar el calendario de clases al crear el aula.
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const slotUid = () => `sl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const pad5 = (t) => String(t).padStart(5, '0');
const withId = (s) => ({ id: slotUid(), day: s.day, start: pad5(s.start), end: pad5(s.end) });

const buildScheduleOptions = (courses) => {
  const map = new Map();
  courses.filter((c) => c.scheduleDays?.length && c.scheduleTime).forEach((c) => {
    const [start, end] = c.scheduleTime.split('-').map((t) => t.trim());
    const label = `${c.scheduleDays.join(' y ')} · ${c.scheduleTime}`;
    if (!map.has(label)) map.set(label, { label, slots: c.scheduleDays.map((day) => ({ day, start, end })) });
  });
  return [...map.values()];
};

// Franjas iniciales del editor: las estructuradas del aula (`schedule`), las
// deducidas del texto de un aula antigua ("Martes y Jueves · 19:00-21:00"), o
// el primer horario tipo como punto de partida.
const initialSlots = (group, options) => {
  if (Array.isArray(group?.schedule) && group.schedule.length) return group.schedule.map(withId);
  const m = String(group?.scheduleTime || '').match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  const days = parseScheduleLabel(group?.scheduleTime);
  if (m && days.length) return days.map((day) => withId({ day, start: m[1], end: m[2] }));
  if (options[0]) return options[0].slots.map(withId);
  return [withId({ day: 'Martes', start: '19:00', end: '21:00' })];
};

const GroupModal = ({ group, courses, adminName, onClose, onSaved }) => {
  const { addToast } = useUI();
  const [name, setName] = useState(group?.name || '');
  const [courseId, setCourseId] = useState(group?.courseId ?? courses[0]?.id ?? '');
  const [startDate, setStartDate] = useState(group?.startDate || '');
  const [endDate, setEndDate] = useState(group?.endDate || '');
  const scheduleOptions = buildScheduleOptions(courses);
  const [slots, setSlots] = useState(() => initialSlots(group, scheduleOptions));
  const [teachers, setTeachers] = useState([]);
  const [instructor, setInstructor] = useState(group?.instructor || '');
  const [instructorUid, setInstructorUid] = useState(group?.instructorUid || '');
  const [capacity, setCapacity] = useState(group?.capacity ?? 30);
  const [status, setStatus] = useState(group?.status || 'to-open');
  const [classLink, setClassLink] = useState(group?.classLink || '');
  const [saving, setSaving] = useState(false);

  // Solo al EDITAR: qué clases tiene ya el aula, cuántas aulas tiene el curso y
  // las semanas del contenido -- para calcular qué cambiaría en el calendario.
  const [groupSessions, setGroupSessions] = useState([]);
  const [siblingCount, setSiblingCount] = useState(1);
  const [courseModules, setCourseModules] = useState([]);
  const [syncChoice, setSyncChoice] = useState(null);

  useEffect(() => {
    if (!group) return;
    Promise.all([fetchLiveSessions(), fetchGroups(), fetchCourseContent(group.courseId).catch(() => ({ modules: [] }))]).then(([sessions, groups, content]) => {
      const same = (x) => x?.toString() === group.courseId?.toString();
      setGroupSessions(sessions.filter((s) => same(s.courseId)));
      setSiblingCount(groups.filter((g) => same(g.courseId)).length);
      setCourseModules(content.modules || []);
    });
  }, [group]);

  useEffect(() => {
    fetchAllUsers().then((users) => setTeachers((users || []).filter((u) => u.role === 'teacher')));
  }, []);

  const handleSelectInstructor = (uid) => {
    const t = teachers.find((u) => u.uid === uid);
    setInstructorUid(uid);
    setInstructor(t ? (t.displayName || t.email) : '');
  };

  const courseForPlan = courses.find((c) => c.id.toString() === courseId.toString());
  const weeksForPlan = courseWeeksFromModules(courseModules) || courseForPlan?.duration;
  const plan = useMemo(() => {
    if (!group) return null;
    const slotsOk = validSlots(slots);
    const common = { existing: groupSessions, groupId: group.id, endDate: endDate || null, closed: status === 'closed', adoptLegacy: siblingCount <= 1, instructor: instructor.trim(), instructorUid };
    // Sin fecha de inicio u horario válido no se sabe qué clases deberían existir:
    // no se propone ningún cambio (borrar todo por un campo vacío sería peligroso).
    if (!startDate || slotsOk.length === 0 || slotsOk.length < slots.length) {
      return { ...planScheduleSync({ ...common, desired: [] }), toCreate: [], toDelete: [], toUpdate: [], hasChanges: false, invalid: true };
    }
    return planScheduleSync({ ...common, desired: buildRecurringSessions({ slots: slotsOk, weeksLabel: String(weeksForPlan) }, startDate) });
  }, [group, slots, startDate, endDate, status, instructor, instructorUid, groupSessions, siblingCount, weeksForPlan]);
  // Con calendario ya generado por el sistema se sincroniza por defecto; un aula
  // sin calendario (o con clases antiguas sin aula asociada) solo si se pide.
  const applySync = syncChoice ?? ((plan?.mineCount || 0) > 0);
  const untaggedFuture = groupSessions.filter((s) => !s.groupId && getLiveSessionStatus(s) === 'upcoming').length;

  const updateSlot = (id, patch) => setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const addSlot = () => setSlots((prev) => {
    const last = prev[prev.length - 1];
    return [...prev, withId(last ? { ...last, day: DAYS[(DAYS.indexOf(last.day) + 1) % 7] } : { day: 'Lunes', start: '19:00', end: '21:00' })];
  });
  const applyPreset = (label) => {
    const opt = scheduleOptions.find((o) => o.label === label);
    if (opt) setSlots(opt.slots.map(withId));
  };

  const handleSave = async () => {
    if (!name.trim() || !instructor.trim()) { addToast('Nombre de aula y docente son obligatorios.', 'error'); return; }
    const cleanSlots = validSlots(slots);
    if (cleanSlots.length === 0 || cleanSlots.length < slots.length) {
      addToast('Revisa el horario: cada franja necesita día, hora de inicio y hora de fin distintas (y sin repetir).', 'error');
      return;
    }
    setSaving(true);
    try {
      const course = courses.find((c) => c.id.toString() === courseId.toString());
      const payload = {
        name: name.trim(), courseId, courseTitle: course?.title || '',
        startDate: startDate || null, endDate: endDate || null,
        schedule: cleanSlots, scheduleTime: buildScheduleLabel(cleanSlots), instructor: instructor.trim(), instructorUid: instructorUid || null,
        capacity: Number(capacity) || 0, status, classLink: classLink.trim() || null,
      };
      if (group) {
        await updateGroup(group.id, payload);
        await logChange(adminName, `Editó el aula "${payload.name}".`);
        if (applySync && plan?.hasChanges) {
          // Solo se toca lo futuro y generado por el sistema (lib/scheduleSync.js).
          const canCreate = !!instructorUid;
          for (const s of plan.toDelete) await deleteLiveSession(s.id);
          if (canCreate) {
            for (const e of plan.toCreate) {
              await scheduleLiveSession({
                courseId, courseTitle: course?.title || '', title: e.title, instructor: instructor.trim(), instructorUid,
                startsAt: e.startsAt, durationMin: e.durationMin, groupId: group.id, generated: true,
              });
            }
          }
          for (const s of plan.toUpdate) await updateLiveSession(s.id, { instructor: instructor.trim(), instructorUid });
          addToast(`Aula actualizada. Calendario: ${canCreate ? plan.toCreate.length : 0} nuevas, ${plan.toDelete.length} eliminadas, ${plan.toUpdate.length} con nuevo docente.`, 'success');
        } else {
          addToast('Aula actualizada.', 'success');
        }
      } else {
        const created = await createGroup(payload);
        await logChange(adminName, `Creó el aula "${payload.name}".`);

        // Genera el calendario completo de una vez -- para que el docente ya
        // tenga todo listo al entrar, en vez de tener que armarlo él mismo.
        if (startDate && instructorUid) {
          // Las semanas salen de los módulos del curso (así el calendario cubre
          // exactamente lo que el contenido dicta); sin módulos, la duración
          // publicada del curso.
          const content = await fetchCourseContent(courseId).catch(() => ({ modules: [] }));
          const weeks = courseWeeksFromModules(content.modules) || course?.duration;
          const entries = buildRecurringSessions({ slots: cleanSlots, weeksLabel: String(weeks) }, startDate);
          for (const entry of entries) {
            await scheduleLiveSession({
              courseId, courseTitle: course?.title || '', title: entry.title,
              instructor: instructor.trim(), instructorUid,
              startsAt: entry.startsAt, durationMin: entry.durationMin, groupId: created.id, generated: true,
            });
          }
          if (entries.length === 0) {
            addToast('Aula creada, pero el horario o la fecha de inicio no son válidos: no se generó el calendario de clases.', 'warning');
          } else {
            addToast(`Aula creada y ${entries.length} clases programadas.`, 'success');
          }
        } else {
          addToast('Aula creada. Agrega fecha de inicio para generar el calendario de clases.', 'info');
        }
      }
      onSaved();
      onClose();
    } catch {
      addToast('No se pudo guardar el aula.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal admin-modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-head">
          <div className="admin-modal-title">{group ? 'Editar aula' : 'Crear aula'}</div>
          <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="admin-field-row">
          <div className="admin-field">
            <label>Nombre del aula</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Lima 02" />
          </div>
          <div className="admin-field">
            <label>Curso</label>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={!!group} title={group ? 'Para cambiar de curso crea un aula nueva' : undefined}>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
        </div>
        <div className="admin-field-row">
          <div className="admin-field">
            <label>Fecha de inicio</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!!plan?.hasStarted} title={plan?.hasStarted ? 'El aula ya inició: para un nuevo grupo crea otra aula' : undefined} />
          </div>
          <div className="admin-field">
            <label>Fecha de cierre</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="admin-field">
          <label>Horario semanal · hora de Perú</label>
          <div className="sched-editor">
            {slots.map((s) => (
              <div className="sched-row" key={s.id}>
                <select value={s.day} onChange={(e) => updateSlot(s.id, { day: e.target.value })}>
                  {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <input type="time" value={s.start} onChange={(e) => updateSlot(s.id, { start: e.target.value })} />
                <span className="sched-to">a</span>
                <input type="time" value={s.end} onChange={(e) => updateSlot(s.id, { end: e.target.value })} />
                <button type="button" className="admin-icon-btn" title="Quitar horario" disabled={slots.length === 1} onClick={() => setSlots((prev) => prev.filter((x) => x.id !== s.id))}><X size={13} /></button>
              </div>
            ))}
            <div className="sched-actions">
              <button type="button" className="admin-btn-ghost" onClick={addSlot}><Plus size={13} /> Agregar horario</button>
              {scheduleOptions.length > 0 && (
                <select defaultValue="" onChange={(e) => { applyPreset(e.target.value); e.target.value = ''; }}>
                  <option value="" disabled>Usar un horario tipo…</option>
                  {scheduleOptions.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
                </select>
              )}
            </div>
            <div className="admin-cell-sub" style={{ marginTop: 6 }}>{buildScheduleLabel(slots) || 'Completa al menos un horario válido.'}</div>
          </div>
        </div>
        <div className="admin-field-row">
          <div className="admin-field">
            <label>Cupos</label>
            <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="30" />
          </div>
        </div>
        <div className="admin-field-row">
          <div className="admin-field">
            <label>Docente responsable</label>
            <select value={instructorUid} onChange={(e) => handleSelectInstructor(e.target.value)}>
              <option value="">Sin asignar</option>
              {teachers.map((t) => <option key={t.uid} value={t.uid}>{t.displayName || t.email}</option>)}
            </select>
          </div>
          <div className="admin-field">
            <label>Estado</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="to-open">Por abrir</option>
              <option value="open">Abierto</option>
              <option value="closed">Cerrado</option>
            </select>
          </div>
        </div>
        <div className="admin-field">
          <label>Enlace de clase · opcional</label>
          <input value={classLink} onChange={(e) => setClassLink(e.target.value)} placeholder="https://..." />
        </div>

        {group && plan && (
          <div className={`dash-notice ${plan.mineCount > 0 && plan.futureCount === 0 ? 'warn' : ''}`} style={{ display: 'block', marginTop: 4 }}>
            <strong style={{ display: 'block', marginBottom: 4 }}>Calendario de clases</strong>
            {plan.mineCount === 0 ? (
              <span>
                Esta aula no tiene un calendario generado por el sistema.
                {untaggedFuture > 0 ? ` El curso ya tiene ${untaggedFuture} clase(s) futuras sin aula asociada: generarlo podría duplicarlas.` : ''}
              </span>
            ) : plan.invalid ? (
              <span>Completa la fecha de inicio y un horario válido para poder actualizar el calendario de clases.</span>
            ) : plan.futureCount === 0 && !plan.hasChanges ? (
              <span>Todas las clases de esta aula ya pasaron. Para un nuevo grupo o una nueva edición, crea otra aula en vez de editar esta.</span>
            ) : plan.hasChanges ? (
              <span>
                Con estos cambios: {plan.toCreate.length} clase(s) nueva(s), {plan.toDelete.length} eliminada(s), {plan.toUpdate.length} con otro docente y {plan.unchanged} sin cambios.
                Las {plan.pastCount} ya realizadas o canceladas no se tocan, ni las clases sueltas del docente.
              </span>
            ) : (
              <span>Sin cambios en el calendario ({plan.unchanged} clases futuras al día).</span>
            )}
            {(plan.hasChanges || plan.mineCount === 0) && (
              <label className="admin-field-checkbox" style={{ marginTop: 8 }}>
                <input type="checkbox" checked={applySync} onChange={(e) => setSyncChoice(e.target.checked)} />
                {plan.mineCount === 0 ? ' Generar el calendario ahora' : ' Aplicar estos cambios al calendario de clases'}
              </label>
            )}
          </div>
        )}
        <div className="admin-modal-actions">
          <button className="admin-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="admin-btn-edit" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'} <Check size={14} /></button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

const LIVE_STATUS_BADGE = {
  live:      { label: '🔴 En vivo', className: 'badge badge-rose' },
  upcoming:  { label: '📅 Próxima', className: 'badge badge-sky' },
  ended:     { label: '✔ Finalizada', className: 'badge badge-accent' },
  cancelled: { label: '❌ Cancelada', className: 'badge badge-rose' },
};

const LiveClassesPanel = ({ courses }) => {
  const { addToast } = useUI();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [contentCounts, setContentCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [bulkCancelling, setBulkCancelling] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      fetchLiveSessions(),
      Promise.all(courses.map((c) =>
        fetchCourseContent(c.id).then((data) => [c.id, (data.modules || []).reduce((sum, m) => sum + m.lessons.length, 0)])
      )),
    ]).then(([allSessions, counts]) => {
      setSessions(allSessions);
      setContentCounts(Object.fromEntries(counts));
      setLoading(false);
    });
  }, [courses]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (session) => {
    if (!confirm(`¿Cancelar "${session.title}"? Los estudiantes verán la clase marcada como cancelada.`)) return;
    try {
      await cancelLiveSession(session.id);
      addToast('Clase cancelada.', 'success');
      load();
    } catch {
      addToast('No se pudo cancelar la clase.', 'error');
    }
  };
  const handleDelete = async (session) => {
    if (!confirm(`¿Eliminar "${session.title}" definitivamente? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteLiveSession(session.id);
      addToast('Clase eliminada.', 'success');
      load();
    } catch {
      addToast('No se pudo eliminar la clase.', 'error');
    }
  };

  const toggleSelect = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleBulkCancel = async () => {
    if (!confirm(`¿Cancelar ${selected.length} clase${selected.length === 1 ? '' : 's'} seleccionada${selected.length === 1 ? '' : 's'}?`)) return;
    setBulkCancelling(true);
    try {
      await Promise.all(selected.map((id) => cancelLiveSession(id)));
      addToast(`${selected.length} clase${selected.length === 1 ? '' : 's'} cancelada${selected.length === 1 ? '' : 's'}.`, 'success');
      setSelected([]);
      load();
    } catch {
      addToast('No se pudieron cancelar todas las clases seleccionadas.', 'error');
    } finally {
      setBulkCancelling(false);
    }
  };

  if (loading) return <div className="admin-empty-hint">Cargando actividad en vivo...</div>;
  const sortedSessions = [...sessions].sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));
  const cancelableIds = sortedSessions.filter((s) => { const st = getLiveSessionStatus(s); return st === 'upcoming' || st === 'live'; }).map((s) => s.id);

  return (
    <>
      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="admin-panel-head"><span className="admin-panel-title">Contenido publicado por curso</span></div>
        <div style={{ display: 'grid', gap: 10 }}>
          {courses.map((c) => {
            const count = contentCounts[c.id] || 0;
            return (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F6F5FA', borderRadius: 10 }}>
                <span style={{ fontSize: '.88rem', color: '#14141F', fontWeight: 500 }}>{c.title}</span>
                <span className={`admin-status ${count > 0 ? 'admin-status-green' : 'admin-status-amber'}`}>
                  {count > 0 ? `${count} lección${count === 1 ? '' : 'es'}` : 'Sin contenido'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <span className="admin-panel-title"><Radio size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Clases en vivo</span>
          {selected.length > 0 && (
            <button className="admin-btn-ghost" style={{ color: '#BE123C' }} onClick={handleBulkCancel} disabled={bulkCancelling}>
              <XCircle size={13} /> {bulkCancelling ? 'Cancelando...' : `Cancelar ${selected.length} seleccionada${selected.length === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
        {sortedSessions.length === 0 ? (
          <p className="admin-panel-caption" style={{ marginTop: 0 }}>Todavía no se ha programado ninguna clase en vivo.</p>
        ) : (
          <>
            <label className="admin-field-checkbox" style={{ marginBottom: 8, fontSize: '.78rem' }}>
              <input
                type="checkbox"
                checked={cancelableIds.length > 0 && selected.length === cancelableIds.length}
                onChange={(e) => setSelected(e.target.checked ? cancelableIds : [])}
              /> Seleccionar todas las cancelables
            </label>
            {sortedSessions.map((s) => {
              const liveStatus = getLiveSessionStatus(s);
              const status = LIVE_STATUS_BADGE[liveStatus] || LIVE_STATUS_BADGE.upcoming;
              const joinable = liveStatus === 'live' || liveStatus === 'upcoming';
              const canCancel = liveStatus === 'upcoming' || liveStatus === 'live';
              return (
                <div key={s.id} style={{ padding: '12px 14px', background: '#F6F5FA', borderRadius: 10, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {canCancel && <input type="checkbox" style={{ marginTop: 4, width: 15, height: 15, accentColor: 'var(--accent)' }} checked={selected.includes(s.id)} onChange={() => toggleSelect(s.id)} />}
                    <div>
                      <span className={status.className} style={{ marginBottom: 6, display: 'inline-block' }}>{status.label}</span>
                      <div style={{ fontWeight: 600, fontSize: '.9rem', color: '#14141F' }}>{s.title}</div>
                      <div style={{ fontSize: '.78rem', color: '#6B6980' }}>{s.courseTitle} · {s.instructor}</div>
                      <div style={{ fontSize: '.76rem', color: '#8B8A9B' }}>{new Date(s.startsAt).toLocaleString('es-PE')}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {joinable && <button className="admin-btn-ghost" onClick={() => navigate(`/live/${s.id}`)}><LogIn size={13} /> Ver sala</button>}
                    {canCancel
                      ? <button className="admin-btn-ghost" style={{ color: '#BE123C' }} onClick={() => handleCancel(s)}><XCircle size={13} /> Cancelar</button>
                      : <button className="admin-btn-ghost" style={{ color: '#BE123C' }} onClick={() => handleDelete(s)}><Trash2 size={13} /> Eliminar</button>}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </>
  );
};

const AdminGrupos = () => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const { courses } = useCourseOfferings();
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const adminName = currentUser?.displayName || currentUser?.email || 'Admin';
  const load = () => fetchGroups().then((list) => { setGroups(list); setLoading(false); });
  useEffect(() => { load(); }, []);

  const filtered = groups.filter((g) => `${g.name} ${g.courseTitle}`.toLowerCase().includes(search.toLowerCase()));

  const toggleClosed = async (g) => {
    const nextStatus = g.status === 'closed' ? 'open' : 'closed';
    try {
      await updateGroup(g.id, { status: nextStatus });
      await logChange(adminName, `${nextStatus === 'closed' ? 'Desactivó' : 'Reactivó'} el aula "${g.name}".`);
      load();
    } catch {
      addToast('No se pudo actualizar el aula.', 'error');
    }
  };

  const handleDeleteGroup = async (g) => {
    if (!confirm(`¿Eliminar el aula "${g.name}" definitivamente? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteGroup(g.id);
      await logChange(adminName, `Eliminó el aula "${g.name}".`);
      addToast('Aula eliminada.', 'success');
      load();
    } catch {
      addToast('No se pudo eliminar el aula.', 'error');
    }
  };

  const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Aulas y horarios</h1>
          <p className="admin-page-sub">Fechas, cupos y docentes para cada edición de un curso.</p>
        </div>
        <button className="admin-btn-edit" onClick={() => setModal({ mode: 'new' })}><Plus size={15} /> Crear aula</button>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search"><Search size={15} /><input placeholder="Buscar cada grupo, bien organizado..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>

      <div className="admin-table-wrap" style={{ marginBottom: 24 }}>
        {loading ? <div className="admin-empty-hint">Cargando aulas...</div> : filtered.length === 0 ? (
          <div className="admin-empty-hint">Todavía no has creado ninguna aula.</div>
        ) : (
          <table className="admin-table">
            <thead><tr><th>Grupo / Curso</th><th>Fechas</th><th>Horario y docente</th><th>Cupos activo</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {filtered.map((g) => {
                const status = GROUP_STATUS[g.status] || GROUP_STATUS.open;
                return (
                  <tr key={g.id}>
                    <td>
                      <div className="admin-cell-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {g.name}
                        {g.classLink && <a href={g.classLink} target="_blank" rel="noreferrer" title="Enlace de clase" onClick={(e) => e.stopPropagation()}><Link2 size={13} color="var(--accent)" /></a>}
                      </div>
                      <div className="admin-cell-sub">{g.courseTitle}</div>
                    </td>
                    <td className="admin-cell-sub">{fmtDate(g.startDate)}<br />{fmtDate(g.endDate)}</td>
                    <td className="admin-cell-sub">{g.scheduleTime || g.scheduleDays || 'Sin horario'}<br />Hora de Perú · {g.instructor}</td>
                    <td>{g.enrolledCount || 0} / {g.capacity}</td>
                    <td><span className={`admin-status ${status.cls}`}>{status.label}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="admin-icon-btn" onClick={() => setModal({ mode: 'edit', group: g })} title="Editar"><Pencil size={14} /></button>
                        <button className="admin-icon-btn" onClick={() => toggleClosed(g)} title={g.status === 'closed' ? 'Reactivar' : 'Desactivar'} style={g.status === 'closed' ? undefined : { color: '#BE123C' }}>
                          {g.status === 'closed' ? <RotateCcw size={14} /> : <Ban size={14} />}
                        </button>
                        <button className="admin-icon-btn" onClick={() => handleDeleteGroup(g)} title="Eliminar" style={{ color: '#BE123C' }}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <LiveClassesPanel courses={courses} />

      {modal && (
        <GroupModal
          group={modal.mode === 'edit' ? modal.group : null}
          courses={courses}
          adminName={adminName}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  );
};

export default AdminGrupos;
