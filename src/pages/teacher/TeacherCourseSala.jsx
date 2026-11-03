import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Plus, Pencil, Upload, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { scheduleLiveSession, fetchLiveSessions, cancelLiveSession, deleteLiveSession, updateLiveSession } from '../../lib/db';
import { can } from '../../lib/permissions';
import { getClassCardState, isPendingClass } from '../../lib/liveSessionStatus';
import { toPeruIso, peruDateTimeParts } from '../../lib/liveScheduleGenerator';
import { isMeetLink } from '../../lib/classLinks';
import { useNow } from '../../hooks/useNow';
import ClassCard, { ClassRow, RecordingButton } from '../../components/ClassCard';
import RecordingLinkModal from '../../components/RecordingLinkModal';
import ModalPortal from '../../components/ModalPortal';

const minutesBetween = (start, end) => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
};
const addMinutes = (time, mins) => {
  const [h, m] = time.split(':').map(Number);
  const t = (h * 60 + m + mins) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

// Programar o editar una clase: fecha (calendario), hora de inicio y de fin y
// tema. No pide link: toda clase usa el Meet fijo del aula.
const ClassFormModal = ({ session, onClose, onSubmit, onCancelClass, onDelete }) => {
  const initial = session ? peruDateTimeParts(session.startsAt) : { date: '', time: '19:00' };
  const [date, setDate] = useState(initial.date);
  const [start, setStart] = useState(initial.time || '19:00');
  const [end, setEnd] = useState(addMinutes(initial.time || '19:00', Number(session?.durationMin) > 0 ? Number(session.durationMin) : 120));
  const [title, setTitle] = useState(session?.title || '');
  const [saving, setSaving] = useState(false);
  const duration = start && end ? minutesBetween(start, end) : 0;
  const missing = !date ? 'Elige la fecha' : !title.trim() ? 'Escribe el tema' : duration <= 0 ? 'La hora de fin debe ser después del inicio' : '';

  const submit = async () => {
    setSaving(true);
    try { await onSubmit({ title: title.trim(), startsAt: toPeruIso(`${date}T${start}`), durationMin: duration }); } finally { setSaving(false); }
  };

  return (
    <ModalPortal>
      <div className="admin-modal-overlay" onClick={onClose}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head">
            <div><div className="admin-modal-title">{session ? 'Editar clase' : 'Programar clase'}</div><div className="admin-modal-sub">Usa el enlace de Meet del aula. Los alumnos reciben el aviso.</div></div>
            <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="admin-field"><label>Tema</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Sesión 5 · Brand Resonance" autoFocus /></div>
          <div className="admin-field"><label>Fecha (hora de Perú)</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="admin-field-row">
            <div className="admin-field"><label>Hora de inicio</label><input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="admin-field"><label>Hora de fin</label><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div className="admin-modal-actions">
            {session && onCancelClass && <button className="admin-btn-ghost" style={{ color: '#BE123C', marginRight: 'auto' }} onClick={onCancelClass} disabled={saving}>Cancelar clase</button>}
            {session && onDelete && <button className="admin-btn-ghost" style={{ color: '#BE123C', marginRight: 'auto' }} onClick={onDelete} disabled={saving}>Eliminar</button>}
            {missing && <span className="admin-cell-sub" style={{ alignSelf: 'center', color: '#B45309' }}>{missing}</span>}
            <button className="admin-btn-edit" onClick={submit} disabled={saving || !!missing}>{saving ? 'Guardando...' : session ? 'Guardar cambios' : 'Programar clase'}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

// Clases en vivo del docente (D2): la clase de hoy con "Iniciar clase en Meet"
// (directo, sin sala intermedia), las próximas para editarlas o programar
// otra, y las anteriores para subir la grabación. Lee la misma lista de clases
// que la Agenda y el Inicio.
const TeacherCourseSala = () => {
  const { course, group } = useOutletContext();
  const { currentUser } = useAuth();
  const { addToast, confirmDialog } = useUI();
  const navigate = useNavigate();
  const now = useNow();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formFor, setFormFor] = useState(null); // null | 'new' | session
  const [recordingFor, setRecordingFor] = useState(null);

  const load = useCallback(() => {
    fetchLiveSessions(course.id).then(setSessions).catch(() => {}).finally(() => setLoading(false));
  }, [course.id]);
  useEffect(() => { load(); }, [load]);

  const canSchedule = can(currentUser, 'scheduleClasses');
  // Con varias aulas, solo las clases del aula con la que trabaja el docente.
  const mine = sessions.filter((s) => !group?.id || !s.groupId || s.groupId === group.id);
  const byDate = [...mine].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const active = byDate.filter((s) => isPendingClass(s, now));
  const main = active[0] || null;
  const upcoming = byDate.filter((s) => s !== main && getClassCardState(s, now) !== 'ended');
  const past = byDate.filter((s) => getClassCardState(s, now) === 'ended').reverse();
  const meetLink = isMeetLink(group?.classLink) ? group.classLink : null;

  const handleCreate = async (data) => {
    try {
      await scheduleLiveSession({
        courseId: course.id, courseTitle: course.title, ...data,
        instructor: currentUser?.displayName || 'Docente', instructorUid: currentUser?.uid,
        groupId: group?.id || null,
      });
      addToast('Clase programada.', 'success');
      setFormFor(null);
      load();
    } catch {
      addToast('No se pudo programar la clase. Intenta de nuevo.', 'error');
    }
  };

  const handleUpdate = async (data) => {
    try {
      await updateLiveSession(formFor.id, { ...data, rescheduledAt: new Date().toISOString() });
      addToast('Clase actualizada.', 'success');
      setFormFor(null);
      load();
    } catch {
      addToast('No se pudo guardar el cambio. Intenta de nuevo.', 'error');
    }
  };

  const handleCancel = async (s) => {
    if (!(await confirmDialog({ title: 'Cancelar clase', message: `¿Cancelar "${s.title}"? Tus alumnos la verán como cancelada.`, confirmLabel: 'Sí, cancelar', cancelLabel: 'Volver', danger: true }))) return;
    try {
      await cancelLiveSession(s.id);
      addToast('Clase cancelada.', 'success');
      setFormFor(null);
      load();
    } catch {
      addToast('No se pudo cancelar la clase.', 'error');
    }
  };

  const handleDelete = async (s) => {
    if (!(await confirmDialog({ title: 'Eliminar clase', message: `¿Eliminar "${s.title}" definitivamente? Desaparece de la agenda de docentes y alumnos.`, confirmLabel: 'Eliminar', danger: true }))) return;
    try {
      await deleteLiveSession(s.id);
      addToast('Clase eliminada.', 'success');
      setFormFor(null);
      load();
    } catch {
      addToast('No se pudo eliminar la clase.', 'error');
    }
  };

  if (loading) return <div className="admin-empty-hint">Cargando clases en vivo...</div>;

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Clases en vivo</h1><p className="admin-page-sub">El enlace de Meet de {group?.name || 'tu aula'} es siempre el mismo. Inicia la clase y deja la grabación.</p></div>
      </div>

      {main ? (
        <ClassCard session={main} courseTitle={course.title} meetLink={meetLink} role="teacher" />
      ) : (
        <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B', marginBottom: 20 }}>
          <p style={{ margin: 0 }}>No hay clases por delante en esta aula.</p>
        </div>
      )}

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="admin-panel-head" style={{ marginBottom: 4 }}>
          <span className="admin-panel-title">Próximas clases</span>
          {canSchedule && <button className="admin-btn-edit" onClick={() => setFormFor('new')}><Plus size={14} /> Programar clase</button>}
        </div>
        <p className="admin-panel-caption" style={{ marginTop: 0 }}>Todas usan el mismo enlace de Meet del aula.</p>
        {upcoming.length === 0
          ? <p className="admin-cell-sub" style={{ margin: 0 }}>No hay más clases programadas.</p>
          : upcoming.map((s) => (
            <ClassRow key={s.id} session={s} showRelative={false}
              actions={canSchedule && getClassCardState(s, now) !== 'cancelled'
                ? <button className="admin-btn-ghost" onClick={() => setFormFor(s)}><Pencil size={13} /> Editar</button>
                : canSchedule && <button className="admin-btn-ghost" style={{ color: '#BE123C' }} onClick={() => handleDelete(s)}>Eliminar</button>} />
          ))}
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head" style={{ marginBottom: 4 }}><span className="admin-panel-title">Clases anteriores</span></div>
        <p className="admin-panel-caption" style={{ marginTop: 0 }}>Avances y grabación de cada sesión.</p>
        {past.length === 0
          ? <p className="admin-cell-sub" style={{ margin: 0 }}>Todavía no hay clases dictadas.</p>
          : past.map((s, i) => (
            <ClassRow key={s.id} session={s} past
              actions={i === 0 ? (
                <>
                  <button className="admin-btn-ghost" onClick={() => setRecordingFor(s)}>{s.recordingUrl ? <><CheckCircle2 size={13} /> Grabación subida</> : <><Upload size={13} /> Subir grabación</>}</button>
                  <button className="admin-btn-edit" onClick={() => navigate('../practicas')}><CheckCircle2 size={13} /> Revisar avances</button>
                </>
              ) : (
                s.recordingUrl
                  ? <><RecordingButton session={s} /><button className="admin-btn-ghost" onClick={() => setRecordingFor(s)} title="Cambiar el enlace de la grabación"><Pencil size={13} /></button></>
                  : <button className="admin-btn-ghost" onClick={() => setRecordingFor(s)}><Upload size={13} /> Subir grabación</button>
              )} />
          ))}
      </div>

      {formFor && (
        <ClassFormModal
          session={formFor === 'new' ? null : formFor}
          onClose={() => setFormFor(null)}
          onSubmit={formFor === 'new' ? handleCreate : handleUpdate}
          onCancelClass={formFor !== 'new' ? () => handleCancel(formFor) : null}
        />
      )}
      {recordingFor && (
        <RecordingLinkModal session={recordingFor} onClose={() => setRecordingFor(null)}
          onSaved={(updated) => setSessions((list) => list.map((x) => (x.id === updated.id ? updated : x)))} />
      )}
    </div>
  );
};

export default TeacherCourseSala;
