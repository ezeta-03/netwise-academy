import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, X, Pencil, Radio, LogIn, XCircle, Trash2, Check, Link2 } from 'lucide-react';
import ModalPortal from '../../components/ModalPortal';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { fetchGroups, createGroup, updateGroup, logChange, fetchLiveSessions, cancelLiveSession, deleteLiveSession, fetchCourseContent } from '../../lib/db';
import { getLiveSessionStatus } from '../../lib/liveSessionStatus';

const GROUP_STATUS = {
  open: { label: 'Abierto', cls: 'admin-status-green' },
  'to-open': { label: 'Por abrir', cls: 'admin-status-amber' },
  closed: { label: 'Cerrado', cls: 'admin-status-gray' },
};

const GroupModal = ({ group, courses, adminName, onClose, onSaved }) => {
  const { addToast } = useUI();
  const [name, setName] = useState(group?.name || '');
  const [courseId, setCourseId] = useState(group?.courseId ?? courses[0]?.id ?? '');
  const [startDate, setStartDate] = useState(group?.startDate || '');
  const [endDate, setEndDate] = useState(group?.endDate || '');
  const [scheduleTime, setScheduleTime] = useState(group?.scheduleTime || group?.scheduleDays || '');
  const [instructor, setInstructor] = useState(group?.instructor || '');
  const [capacity, setCapacity] = useState(group?.capacity ?? 30);
  const [status, setStatus] = useState(group?.status || 'to-open');
  const [classLink, setClassLink] = useState(group?.classLink || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !instructor.trim()) { addToast('Nombre de aula y docente son obligatorios.', 'error'); return; }
    setSaving(true);
    try {
      const course = courses.find((c) => c.id.toString() === courseId.toString());
      const payload = {
        name: name.trim(), courseId, courseTitle: course?.title || '',
        startDate: startDate || null, endDate: endDate || null,
        scheduleTime: scheduleTime.trim(), instructor: instructor.trim(),
        capacity: Number(capacity) || 0, status, classLink: classLink.trim() || null,
      };
      if (group) {
        await updateGroup(group.id, payload);
        await logChange(adminName, `Editó el aula "${payload.name}".`);
        addToast('Aula actualizada.', 'success');
      } else {
        await createGroup(payload);
        await logChange(adminName, `Creó el aula "${payload.name}".`);
        addToast('Aula creada.', 'success');
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
            <input value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} placeholder="Ej. Martes y jueves · 19:00-21:00" />
          </div>
          <div className="admin-field">
            <label>Cupos</label>
            <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="30" />
          </div>
        </div>
        <div className="admin-field-row">
          <div className="admin-field">
            <label>Docente responsable</label>
            <input value={instructor} onChange={(e) => setInstructor(e.target.value)} placeholder="Ej. Valeria Torres" />
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

  if (loading) return <div className="admin-empty-hint">Cargando actividad en vivo...</div>;
  const sortedSessions = [...sessions].sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));

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
        <div className="admin-panel-head"><span className="admin-panel-title"><Radio size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Clases en vivo</span></div>
        {sortedSessions.length === 0 ? (
          <p className="admin-panel-caption" style={{ marginTop: 0 }}>Todavía no se ha programado ninguna clase en vivo.</p>
        ) : sortedSessions.map((s) => {
          const liveStatus = getLiveSessionStatus(s);
          const status = LIVE_STATUS_BADGE[liveStatus] || LIVE_STATUS_BADGE.upcoming;
          const joinable = liveStatus === 'live' || liveStatus === 'upcoming';
          const canCancel = liveStatus === 'upcoming' || liveStatus === 'live';
          return (
            <div key={s.id} style={{ padding: '12px 14px', background: '#F6F5FA', borderRadius: 10, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <span className={status.className} style={{ marginBottom: 6, display: 'inline-block' }}>{status.label}</span>
                <div style={{ fontWeight: 600, fontSize: '.9rem', color: '#14141F' }}>{s.title}</div>
                <div style={{ fontSize: '.78rem', color: '#6B6980' }}>{s.courseTitle} · {s.instructor}</div>
                <div style={{ fontSize: '.76rem', color: '#8B8A9B' }}>{new Date(s.startsAt).toLocaleString('es-PE')}</div>
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
      </div>
    </>
  );
};

const AdminGrupos = () => {
  const { currentUser } = useAuth();
  const { courses } = useCourseOfferings();
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const adminName = currentUser?.displayName || currentUser?.email || 'Admin';
  const load = () => fetchGroups().then((list) => { setGroups(list); setLoading(false); });
  useEffect(() => { load(); }, []);

  const filtered = groups.filter((g) => `${g.name} ${g.courseTitle}`.toLowerCase().includes(search.toLowerCase()));

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
                    <td><button className="admin-icon-btn" onClick={() => setModal({ mode: 'edit', group: g })}><Pencil size={14} /></button></td>
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
