import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Radio, LogIn, XCircle, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { scheduleLiveSession, fetchLiveSessions, cancelLiveSession, deleteLiveSession } from '../../lib/db';
import { getLiveSessionStatus } from '../../lib/liveSessionStatus';
import LiveRoom from '../../components/LiveRoom';

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
        startsAt, durationMin: Number(durationMin),
      });
      setTitle(''); setStartsAt('');
      addToast('Clase en vivo programada.', 'success');
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (s) => { if (!confirm(`¿Cancelar "${s.title}"?`)) return; await cancelLiveSession(s.id); addToast('Clase cancelada.', 'success'); load(); };
  const handleDelete = async (s) => { if (!confirm(`¿Eliminar "${s.title}" definitivamente?`)) return; await deleteLiveSession(s.id); addToast('Clase eliminada.', 'success'); load(); };

  if (activeSession) {
    return (
      <div className="anim-fade-up d1">
        <LiveRoom
          session={activeSession}
          currentUser={currentUser}
          roleLabel="Docente"
          scheduleLine={scheduleLineFor(activeSession)}
          onExit={() => { setActiveSession(null); load(); }}
        />
      </div>
    );
  }

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Sala de reuniones</h1><p className="admin-page-sub">{course.title}</p></div>
      </div>

      <div className="admin-panel" style={{ maxWidth: 520, marginBottom: 24 }}>
        <div className="admin-panel-head"><span className="admin-panel-title"><Radio size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Programar clase en vivo</span></div>
        <div className="admin-field"><label>Título de la sesión</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Q&A: dudas del módulo 3" /></div>
        <div className="admin-field-row">
          <div className="admin-field"><label>Fecha y hora</label><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></div>
          <div className="admin-field"><label>Duración (min)</label><input type="number" min={15} step={15} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} /></div>
        </div>
        <button className="admin-btn-edit" style={{ width: '100%', justifyContent: 'center' }} onClick={handleSchedule} disabled={saving}>
          <Radio size={14} /> {saving ? 'Programando...' : 'Programar clase en vivo'}
        </button>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head"><span className="admin-panel-title">Clases de este curso</span></div>
        {sessions.length === 0 ? <p className="admin-panel-caption" style={{ marginTop: 0 }}>Todavía no programas clases para este curso.</p> : sessions.map((s) => {
          const status = getLiveSessionStatus(s);
          const joinable = status === 'live' || status === 'upcoming';
          const canCancel = status === 'upcoming' || status === 'live';
          return (
            <div key={s.id} className="dash-list-row">
              <div>
                <div className="dash-list-row-title">{s.title}</div>
                <div className="dash-list-row-sub">{new Date(s.startsAt).toLocaleString('es-PE')} {status === 'cancelled' && '· Cancelada'} {status === 'ended' && '· Finalizada'}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {joinable && <button className="admin-btn-edit" onClick={() => setActiveSession(s)}><LogIn size={13} /> Entrar</button>}
                {canCancel
                  ? <button className="admin-btn-ghost" style={{ color: '#BE123C' }} onClick={() => handleCancel(s)}><XCircle size={13} /> Cancelar</button>
                  : <button className="admin-btn-ghost" style={{ color: '#BE123C' }} onClick={() => handleDelete(s)}><Trash2 size={13} /> Eliminar</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TeacherCourseSala;
