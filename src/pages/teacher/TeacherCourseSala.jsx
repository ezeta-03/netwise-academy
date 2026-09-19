import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Radio, LogIn, XCircle, Trash2, CalendarPlus } from 'lucide-react';
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

// Días de "scheduleDays" (data.js) -> índice de día JS (0 = domingo), para
// calcular las fechas del calendario recurrente a partir del horario del
// curso en vez de que el docente cree cada clase suelta a mano.
const DAY_INDEX = { Domingo: 0, Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6 };

const parseScheduleTime = (scheduleTime) => {
  const [from, to] = scheduleTime.split('-');
  const toMinutesOfDay = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const startMin = toMinutesOfDay(from);
  return { startHour: Math.floor(startMin / 60), startMinute: startMin % 60, durationMin: toMinutesOfDay(to) - startMin };
};

const pad2 = (n) => String(n).padStart(2, '0');

// A partir de la fecha de la primera clase, genera una entrada por cada día
// de la semana del curso (scheduleDays) durante todas sus semanas
// (course.duration, ej. "8 semanas"), respetando el horario (scheduleTime).
const buildRecurringSessions = (course, firstDate) => {
  const weeks = parseInt(course.duration, 10) || 8;
  const { startHour, startMinute, durationMin } = parseScheduleTime(course.scheduleTime);
  const base = new Date(`${firstDate}T00:00:00`);
  const baseDow = base.getDay();
  const sortedDays = [...course.scheduleDays].sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b]);

  const entries = [];
  for (let week = 0; week < weeks; week++) {
    for (const dayName of sortedDays) {
      const offset = (DAY_INDEX[dayName] - baseDow + 7) % 7;
      const date = new Date(base);
      date.setDate(date.getDate() + offset + week * 7);
      date.setHours(startHour, startMinute, 0, 0);
      const startsAt = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
      entries.push({ startsAt, durationMin, title: `Semana ${week + 1} · ${dayName}` });
    }
  }
  return entries;
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
  const [firstClassDate, setFirstClassDate] = useState(course.startDate || '');
  const [generating, setGenerating] = useState(false);
  const hasSchedule = course.scheduleDays?.length > 0 && !!course.scheduleTime;

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

  const handleGenerateSchedule = async () => {
    if (!hasSchedule) { addToast('Este curso no tiene días/horario de clase definidos.', 'error'); return; }
    if (!firstClassDate) { addToast('Elige la fecha de la primera clase.', 'error'); return; }

    const entries = buildRecurringSessions(course, firstClassDate);
    if (sessions.length > 0 && !confirm(`Ya hay ${sessions.length} clase(s) programada(s) para este curso. ¿Agregar ${entries.length} clases más del calendario completo?`)) return;

    setGenerating(true);
    try {
      for (const entry of entries) {
        await scheduleLiveSession({
          courseId: course.id, courseTitle: course.title, title: entry.title,
          instructor: currentUser?.displayName || 'Docente', instructorUid: currentUser?.uid,
          startsAt: entry.startsAt, durationMin: entry.durationMin,
        });
      }
      addToast(`Se programaron ${entries.length} clases.`, 'success');
      load();
    } finally {
      setGenerating(false);
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

      {hasSchedule && (
        <div className="admin-panel" style={{ maxWidth: 520, marginBottom: 24 }}>
          <div className="admin-panel-head"><span className="admin-panel-title"><CalendarPlus size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Generar calendario del curso</span></div>
          <p className="admin-panel-caption" style={{ marginTop: 0 }}>
            Este curso dicta {course.scheduleDays.join(' y ')} de {course.scheduleTime} durante {course.duration}.
            Elige la fecha de la primera clase y se crean todas las sesiones automáticamente.
          </p>
          <div className="admin-field"><label>Fecha de la primera clase</label><input type="date" value={firstClassDate} onChange={(e) => setFirstClassDate(e.target.value)} /></div>
          <button className="admin-btn-edit" style={{ width: '100%', justifyContent: 'center' }} onClick={handleGenerateSchedule} disabled={generating}>
            <CalendarPlus size={14} /> {generating ? 'Generando...' : 'Generar calendario completo'}
          </button>
        </div>
      )}

      <div className="admin-panel" style={{ maxWidth: 520, marginBottom: 24 }}>
        <div className="admin-panel-head"><span className="admin-panel-title"><Radio size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Programar clase suelta</span></div>
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
