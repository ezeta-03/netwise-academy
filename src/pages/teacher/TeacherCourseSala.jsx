import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Plus, Pencil, Upload, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { scheduleLiveSession, fetchLiveSessions, cancelLiveSession, deleteLiveSession, updateLiveSession, scheduleGeneralClass, updateGeneralClass, cancelGeneralClass, deleteGeneralClass, createClassMeet } from '../../lib/db';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { classMeetLink, isGeneralClass } from '../../lib/generalClasses';
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
// tema. Arriba se elige para quién es:
// - "Solo mi aula" (por defecto): usa el Meet fijo del aula y les llega solo a
//   sus alumnos.
// - "Varios cursos": una clase general (masterclass, inducción) para los
//   cursos que marque, con su propio enlace de Meet (el que pegue o uno nuevo).
const ClassFormModal = ({ session, course, courseOptions, onClose, onSubmit, onCancelClass }) => {
  const initial = session ? peruDateTimeParts(session.startsAt) : { date: '', time: '19:00' };
  const editing = !!session;
  const [mode, setMode] = useState(session?.general ? 'general' : 'aula');
  const [date, setDate] = useState(initial.date);
  const [start, setStart] = useState(initial.time || '19:00');
  const [end, setEnd] = useState(addMinutes(initial.time || '19:00', Number(session?.durationMin) > 0 ? Number(session.durationMin) : 120));
  const [title, setTitle] = useState(session?.title || '');
  const [picked, setPicked] = useState(() => new Set((session?.generalCourseIds || [course.id]).map(String)));
  const [link, setLink] = useState(session?.meetLink || '');
  const [saving, setSaving] = useState(false);
  const general = mode === 'general';
  const duration = start && end ? minutesBetween(start, end) : 0;
  const cleanLink = link.trim();
  const missing = !title.trim() ? 'Escribe el tema' : !date ? 'Elige la fecha' : duration <= 0 ? 'La hora de fin debe ser después del inicio'
    : general && picked.size === 0 ? 'Marca al menos un curso'
      : general && cleanLink && !isMeetLink(cleanLink) ? 'El enlace debe empezar con https://' : '';
  const allPicked = courseOptions.length > 0 && courseOptions.every((c) => picked.has(String(c.id)));
  const toggle = (id) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(String(id))) next.delete(String(id)); else next.add(String(id));
    return next;
  });
  const n = picked.size;

  const submit = async () => {
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(), startsAt: toPeruIso(`${date}T${start}`), durationMin: duration,
        ...(general ? { general: true, courses: courseOptions.filter((c) => picked.has(String(c.id))).map((c) => ({ id: c.id, title: c.title })), meetLink: cleanLink } : {}),
      });
    } finally { setSaving(false); }
  };

  return (
    <ModalPortal>
      <div className="admin-modal-overlay" onClick={onClose}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head">
            <div>
              <div className="admin-modal-title">{editing ? 'Editar clase' : 'Programar clase'}</div>
              <div className="admin-modal-sub">{general
                ? 'Una clase para alumnos de varios cursos (masterclass, inducción). Les llega a todos los alumnos de los cursos que marques.'
                : 'Usa el enlace de Meet del aula. Les llega solo a tus alumnos.'}</div>
            </div>
            <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
          </div>

          {!editing && (
            <div className="admin-tabs class-mode-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={!general} className={`admin-tab ${!general ? 'active' : ''}`} onClick={() => setMode('aula')}>Solo mi aula</button>
              <button type="button" role="tab" aria-selected={general} className={`admin-tab ${general ? 'active' : ''}`} onClick={() => setMode('general')}>Varios cursos</button>
            </div>
          )}

          {general && (
            <div className="admin-field">
              <div className="class-courses-head">
                <label>Cursos</label>
                <button type="button" className="class-courses-all" onClick={() => setPicked(allPicked ? new Set() : new Set(courseOptions.map((c) => String(c.id))))}>
                  {allPicked ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
              </div>
              <div className="class-courses-list">
                {courseOptions.map((c) => (
                  <label key={c.id} className="admin-field-checkbox class-course-option">
                    <input type="checkbox" checked={picked.has(String(c.id))} onChange={() => toggle(c.id)} />
                    <span>{c.title}{c.id.toString() === course.id.toString() && <span className="admin-cell-sub"> · tu curso</span>}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="admin-field"><label>Tema</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={general ? 'Ej. Masterclass · Cómo presentar tu Brand Deck' : 'Ej. Sesión 5 · Brand Resonance'} autoFocus /></div>
          <div className="admin-field"><label>Fecha (hora de Perú)</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="admin-field-row">
            <div className="admin-field"><label>Hora de inicio</label><input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="admin-field"><label>Hora de fin</label><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>

          {general && (
            <div className="admin-field">
              <label>Enlace de Meet (opcional)</label>
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/..." inputMode="url" />
              <p className="admin-panel-caption" style={{ margin: '6px 0 0' }}>Si la clase ya tiene enlace, pégalo. Si lo dejas vacío, se crea uno nuevo para esta clase.</p>
            </div>
          )}

          <div className="admin-modal-actions">
            {editing && onCancelClass && <button className="admin-btn-ghost" style={{ color: '#BE123C', marginRight: 'auto' }} onClick={onCancelClass} disabled={saving}>Cancelar clase</button>}
            {missing && <span className="admin-cell-sub" style={{ alignSelf: 'center', color: '#B45309' }}>{missing}</span>}
            <button className="admin-btn-edit" onClick={submit} disabled={saving || !!missing}>
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : general ? `Programar para ${n} curso${n === 1 ? '' : 's'}` : 'Programar clase'}
            </button>
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
  const { courses } = useCourseOfferings();
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
  // Cursos a los que puede llegar una clase general: el suyo primero.
  const isThis = (c) => c.id.toString() === course.id.toString();
  const courseOptions = courses.filter((c) => c.visible !== false || isThis(c))
    .sort((a, b) => Number(isThis(b)) - Number(isThis(a)) || String(a.title).localeCompare(String(b.title), 'es'));
  // Una clase general la edita quien la programó (o el admin).
  const canEdit = (s) => canSchedule && (!isGeneralClass(s) || currentUser?.role === 'admin' || s.instructorUid === currentUser?.uid);
  // Con varias aulas, solo las clases del aula con la que trabaja el docente.
  const mine = sessions.filter((s) => !group?.id || !s.groupId || s.groupId === group.id);
  const byDate = [...mine].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const active = byDate.filter((s) => isPendingClass(s, now));
  const main = active[0] || null;
  const upcoming = byDate.filter((s) => s !== main && getClassCardState(s, now) !== 'ended');
  const past = byDate.filter((s) => getClassCardState(s, now) === 'ended').reverse();
  const meetLink = classMeetLink(main, group?.classLink);

  // Enlace de la clase general: el que pegó el docente o uno nuevo.
  const generalLink = async (data) => {
    if (data.meetLink) return data.meetLink;
    try {
      return await createClassMeet();
    } catch {
      addToast('No se pudo crear el enlace de Meet de la clase. Pega uno en "Enlace de Meet" e intenta de nuevo.', 'error');
      return null;
    }
  };

  const handleCreate = async (data) => {
    try {
      if (data.general) {
        const link = await generalLink(data);
        if (!link) return;
        await scheduleGeneralClass({
          courses: data.courses, title: data.title, startsAt: data.startsAt, durationMin: data.durationMin, meetLink: link,
          instructor: currentUser?.displayName || 'Docente', instructorUid: currentUser?.uid,
        });
        addToast(`Clase general programada para ${data.courses.length} curso${data.courses.length === 1 ? '' : 's'}.`, 'success');
        setFormFor(null);
        load();
        return;
      }
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
      if (isGeneralClass(formFor)) {
        const link = await generalLink(data);
        if (!link) return;
        await updateGeneralClass(formFor, { courses: data.courses, title: data.title, startsAt: data.startsAt, durationMin: data.durationMin, meetLink: link, rescheduledAt: new Date().toISOString() });
        addToast('Clase general actualizada.', 'success');
        setFormFor(null);
        load();
        return;
      }
      await updateLiveSession(formFor.id, { ...data, rescheduledAt: new Date().toISOString() });
      addToast('Clase actualizada.', 'success');
      setFormFor(null);
      load();
    } catch {
      addToast('No se pudo guardar el cambio. Intenta de nuevo.', 'error');
    }
  };

  const handleCancel = async (s) => {
    const general = isGeneralClass(s);
    if (!(await confirmDialog({ title: 'Cancelar clase', message: general ? `¿Cancelar "${s.title}"? Los alumnos de todos sus cursos la verán como cancelada.` : `¿Cancelar "${s.title}"? Tus alumnos la verán como cancelada.`, confirmLabel: 'Sí, cancelar', cancelLabel: 'Volver', danger: true }))) return;
    try {
      if (general) await cancelGeneralClass(s); else await cancelLiveSession(s.id);
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
      if (isGeneralClass(s)) await deleteGeneralClass(s); else await deleteLiveSession(s.id);
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
        <ClassCard session={main} courseTitle={course.title} meetLink={meetLink} role="teacher"
          secondary={canEdit(main) && <button className="admin-btn-ghost" onClick={() => setFormFor(main)}><Pencil size={14} /> Editar o cancelar</button>} />
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
        <p className="admin-panel-caption" style={{ marginTop: 0 }}>Las de tu aula usan su enlace de Meet; una clase general, el suyo.</p>
        {upcoming.length === 0
          ? <p className="admin-cell-sub" style={{ margin: 0 }}>No hay más clases programadas.</p>
          : upcoming.map((s) => (
            <ClassRow key={s.id} session={s} showRelative={false} role="teacher"
              actions={canEdit(s) && getClassCardState(s, now) !== 'cancelled'
                ? <button className="admin-btn-ghost" onClick={() => setFormFor(s)}><Pencil size={13} /> Editar</button>
                : canEdit(s) && <button className="admin-btn-ghost" style={{ color: '#BE123C' }} onClick={() => handleDelete(s)}>Eliminar</button>} />
          ))}
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head" style={{ marginBottom: 4 }}><span className="admin-panel-title">Clases anteriores</span></div>
        <p className="admin-panel-caption" style={{ marginTop: 0 }}>Avances y grabación de cada sesión.</p>
        {past.length === 0
          ? <p className="admin-cell-sub" style={{ margin: 0 }}>Todavía no hay clases dictadas.</p>
          : past.map((s, i) => (
            <ClassRow key={s.id} session={s} past role="teacher"
              actions={isGeneralClass(s) ? (
                s.recordingUrl ? <RecordingButton session={s} />
                  : canEdit(s) ? <button className="admin-btn-ghost" onClick={() => setRecordingFor(s)}><Upload size={13} /> Subir grabación</button> : null
              ) : i === 0 ? (
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
          course={course}
          courseOptions={courseOptions}
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
