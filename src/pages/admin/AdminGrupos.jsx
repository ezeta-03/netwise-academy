import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, X, Pencil, Radio, LogIn, XCircle, Trash2, Check, Link2, Ban, RotateCcw } from 'lucide-react';
import ModalPortal from '../../components/ModalPortal';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { fetchGroups, createGroup, updateGroup, deleteGroup, logChange, fetchLiveSessions, scheduleLiveSession, cancelLiveSession, deleteLiveSession, fetchCourseContent, fetchAllUsers } from '../../lib/db';
import { getLiveSessionStatus } from '../../lib/liveSessionStatus';
import { buildRecurringSessions } from '../../lib/liveScheduleGenerator';
import { courseWeeksFromModules } from '../../lib/deliveryDates';

const GROUP_STATUS = {
  open: { label: 'Abierto', cls: 'admin-status-green' },
  'to-open': { label: 'Por abrir', cls: 'admin-status-amber' },
  closed: { label: 'Cerrado', cls: 'admin-status-gray' },
};

// Horarios reales que ya dicta algún curso (data.js), para elegir en vez de
// escribir uno nuevo a mano -- evita horarios inconsistentes entre aulas.
// Se guardan días/hora por separado (no solo el texto) porque hacen falta
// para generar el calendario de clases al crear el aula.
const buildScheduleOptions = (courses) => {
  const map = new Map();
  courses.filter((c) => c.scheduleDays?.length && c.scheduleTime).forEach((c) => {
    const label = `${c.scheduleDays.join(' y ')} · ${c.scheduleTime}`;
    if (!map.has(label)) map.set(label, { label, days: c.scheduleDays, time: c.scheduleTime });
  });
  return [...map.values()];
};

const GroupModal = ({ group, courses, adminName, onClose, onSaved }) => {
  const { addToast } = useUI();
  const [name, setName] = useState(group?.name || '');
  const [courseId, setCourseId] = useState(group?.courseId ?? courses[0]?.id ?? '');
  const [startDate, setStartDate] = useState(group?.startDate || '');
  const [endDate, setEndDate] = useState(group?.endDate || '');
  const scheduleOptions = buildScheduleOptions(courses);
  const [scheduleTime, setScheduleTime] = useState(group?.scheduleTime || scheduleOptions[0]?.label || '');
  const [teachers, setTeachers] = useState([]);
  const [instructor, setInstructor] = useState(group?.instructor || '');
  const [instructorUid, setInstructorUid] = useState(group?.instructorUid || '');
  const [capacity, setCapacity] = useState(group?.capacity ?? 30);
  const [status, setStatus] = useState(group?.status || 'to-open');
  const [classLink, setClassLink] = useState(group?.classLink || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAllUsers().then((users) => setTeachers((users || []).filter((u) => u.role === 'teacher')));
  }, []);

  const handleSelectInstructor = (uid) => {
    const t = teachers.find((u) => u.uid === uid);
    setInstructorUid(uid);
    setInstructor(t ? (t.displayName || t.email) : '');
  };

  const handleSave = async () => {
    if (!name.trim() || !instructor.trim()) { addToast('Nombre de aula y docente son obligatorios.', 'error'); return; }
    setSaving(true);
    try {
      const course = courses.find((c) => c.id.toString() === courseId.toString());
      const payload = {
        name: name.trim(), courseId, courseTitle: course?.title || '',
        startDate: startDate || null, endDate: endDate || null,
        scheduleTime: scheduleTime.trim(), instructor: instructor.trim(), instructorUid: instructorUid || null,
        capacity: Number(capacity) || 0, status, classLink: classLink.trim() || null,
      };
      if (group) {
        await updateGroup(group.id, payload);
        await logChange(adminName, `Editó el aula "${payload.name}".`);
        addToast('Aula actualizada.', 'success');
      } else {
        await createGroup(payload);
        await logChange(adminName, `Creó el aula "${payload.name}".`);

        // Genera el calendario completo de una vez -- para que el docente ya
        // tenga todo listo al entrar, en vez de tener que armarlo él mismo.
        const scheduleOpt = scheduleOptions.find((o) => o.label === scheduleTime.trim());
        if (startDate && scheduleOpt && instructorUid) {
          // Las semanas salen de los módulos del curso (así el calendario cubre
          // exactamente lo que el contenido dicta); sin módulos, la duración
          // publicada del curso.
          const content = await fetchCourseContent(courseId).catch(() => ({ modules: [] }));
          const weeks = courseWeeksFromModules(content.modules) || course?.duration;
          const entries = buildRecurringSessions({ scheduleDays: scheduleOpt.days, scheduleTime: scheduleOpt.time, weeksLabel: String(weeks) }, startDate);
          for (const entry of entries) {
            await scheduleLiveSession({
              courseId, courseTitle: course?.title || '', title: entry.title,
              instructor: instructor.trim(), instructorUid,
              startsAt: entry.startsAt, durationMin: entry.durationMin,
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
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
        </div>
        <div className="admin-field-row">
          <div className="admin-field">
            <label>Fecha de inicio</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="admin-field">
            <label>Fecha de cierre</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="admin-field-row">
          <div className="admin-field">
            <label>Horario · hora de Perú</label>
            <select value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)}>
              {scheduleOptions.length === 0 && <option value="">Sin horarios definidos todavía</option>}
              {scheduleOptions.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
            </select>
          </div>
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
