import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Radio, LogIn, XCircle, Trash2, Film } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { scheduleLiveSession, fetchLiveSessions, cancelLiveSession, deleteLiveSession } from '../../lib/db';
import { getLiveSessionStatus } from '../../lib/liveSessionStatus';
import { toPeruIso } from '../../lib/liveScheduleGenerator';
import LiveRoom from '../../components/LiveRoom';
import RecordingLinkModal from '../../components/RecordingLinkModal';

const scheduleLineFor = (s) => {
  const start = new Date(s.startsAt);
  const end = new Date(start.getTime() + s.durationMin * 60000);
  const day = start.toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'short' });
  const fmt = (d) => d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${fmt(start)} – ${fmt(end)}`;
};

const TeacherCourseSala = () => {
  const { course } = useOutletContext();
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [durationMin, setDurationMin] = useState(60);
  const [sessions, setSessions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkCancelling, setBulkCancelling] = useState(false);
  const [recordingFor, setRecordingFor] = useState(null);

  const load = useCallback(() => {
    fetchLiveSessions().then((all) => setSessions(all.filter((s) => s.courseId?.toString() === course.id.toString())));
  }, [course.id]);
  useEffect(() => { load(); }, [load]);

  const handleSchedule = async () => {
    if (!title || !startsAt) { addToast('Completa el título y la fecha/hora.', 'error'); return; }
    setSaving(true);
    try {
      await scheduleLiveSession({
        courseId: course.id, courseTitle: course.title, title,
        instructor: currentUser?.displayName || 'Docente', instructorUid: currentUser?.uid,
        startsAt: toPeruIso(startsAt), durationMin: Number(durationMin),
      });
      setTitle(''); setStartsAt('');
      addToast('Clase en vivo programada.', 'success');
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (s) => {
    if (!confirm(`¿Cancelar "${s.title}"?`)) return;
    try {
      await cancelLiveSession(s.id);
      addToast('Clase cancelada.', 'success');
      load();
    } catch {
      addToast('No se pudo cancelar la clase.', 'error');
    }
  };
  const handleDelete = async (s) => {
    if (!confirm(`¿Eliminar "${s.title}" definitivamente?`)) return;
    try {
      await deleteLiveSession(s.id);
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

  const cancelableIds = sessions.filter((s) => { const st = getLiveSessionStatus(s); return st === 'upcoming' || st === 'live'; }).map((s) => s.id);

  if (activeSession) {
    return (
      <div className="anim-fade-up d1">
        <LiveRoom
          session={activeSession}
          currentUser={currentUser}
          roleLabel="Docente"
          scheduleLine={scheduleLineFor(activeSession)}
          onExit={() => { setActiveSession(null); load(); }}
          canRecord
        />
      </div>
    );
  }

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Sala de reuniones</h1><p className="admin-page-sub">{course.title}</p></div>
      </div>

      <p className="admin-panel-caption" style={{ marginTop: -8, marginBottom: 20 }}>El calendario completo del curso lo genera el Admin al crear el aula. Usa esto para una clase suelta -- recuperación, Q&A extra, etc.</p>

      <div className="admin-panel" style={{ maxWidth: 520, marginBottom: 24 }}>
        <div className="admin-panel-head"><span className="admin-panel-title"><Radio size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Programar clase suelta</span></div>
        <div className="admin-field"><label>Título de la sesión</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Q&A: dudas del módulo 3" /></div>
        <div className="admin-field-row">
          <div className="admin-field"><label>Fecha y hora (hora de Perú)</label><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></div>
          <div className="admin-field"><label>Duración (min)</label><input type="number" min={15} step={15} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} /></div>
        </div>
        <button className="admin-btn-edit" style={{ width: '100%', justifyContent: 'center' }} onClick={handleSchedule} disabled={saving}>
          <Radio size={14} /> {saving ? 'Programando...' : 'Programar clase en vivo'}
        </button>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <span className="admin-panel-title">Clases de este curso</span>
          {selected.length > 0 && (
            <button className="admin-btn-ghost" style={{ color: '#BE123C' }} onClick={handleBulkCancel} disabled={bulkCancelling}>
              <XCircle size={13} /> {bulkCancelling ? 'Cancelando...' : `Cancelar ${selected.length} seleccionada${selected.length === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
        {sessions.length === 0 ? <p className="admin-panel-caption" style={{ marginTop: 0 }}>Todavía no programas clases para este curso.</p> : (
          <>
            {cancelableIds.length > 0 && (
              <label className="admin-field-checkbox" style={{ marginBottom: 8, fontSize: '.78rem' }}>
                <input
                  type="checkbox"
                  checked={selected.length === cancelableIds.length}
                  onChange={(e) => setSelected(e.target.checked ? cancelableIds : [])}
                /> Seleccionar todas las cancelables
              </label>
            )}
            {sessions.map((s) => {
              const status = getLiveSessionStatus(s);
              const joinable = status === 'live' || status === 'upcoming';
              const canCancel = status === 'upcoming' || status === 'live';
              return (
                <div key={s.id} className="dash-list-row">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {canCancel && <input type="checkbox" style={{ marginTop: 4, width: 15, height: 15, accentColor: 'var(--accent)' }} checked={selected.includes(s.id)} onChange={() => toggleSelect(s.id)} />}
                    <div>
                      <div className="dash-list-row-title">{s.title}</div>
                      <div className="dash-list-row-sub">{new Date(s.startsAt).toLocaleString('es-PE')} {status === 'cancelled' && '· Cancelada'} {status === 'ended' && '· Finalizada'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {joinable && <button className="admin-btn-edit" onClick={() => setActiveSession(s)}><LogIn size={13} /> Entrar</button>}
                    {status !== 'cancelled' && (
                      <button className="admin-btn-ghost" onClick={() => setRecordingFor(s)} title="Publicar el enlace de la grabación para los alumnos">
                        <Film size={13} /> {s.recordingUrl ? 'Grabación ✓' : 'Grabación'}
                      </button>
                    )}
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
      {recordingFor && (
        <RecordingLinkModal session={recordingFor} onClose={() => setRecordingFor(null)}
          onSaved={(updated) => setSessions((list) => list.map((x) => (x.id === updated.id ? updated : x)))} />
      )}
    </div>
  );
};

export default TeacherCourseSala;
