import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getClassCardState } from '../lib/liveSessionStatus';
import { meetLinkFor } from '../lib/classLinks';
import { useNow } from '../hooks/useNow';
import { ClassRow, MeetButton, RecordingButton } from './ClassCard';

const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const UPCOMING_DAYS = 14;

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Agenda (E2), igual para alumno y docente: arriba "Hoy · ...", a la izquierda
// el calendario del mes (chico) y a la derecha la lista de clases con el botón
// para entrar en cada fila. Sin elegir un día, la lista son los próximos 14
// días; al tocar un día, solo las de ese día.
const ClassAgenda = ({ sessions, courses, classLinks, role = 'student', subtitle }) => {
  const now = useNow();
  const today = new Date(now);
  const [courseFilter, setCourseFilter] = useState('all');
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(null);

  const titleOf = (s) => courses.find((c) => c.id.toString() === s.courseId?.toString())?.title || s.courseTitle;
  const filtered = sessions
    .filter((s) => courseFilter === 'all' || s.courseId?.toString() === courseFilter)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

  const monthDays = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const startOffset = (new Date(year, month, 1).getDay() + 6) % 7; // lunes=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [cursor]);

  const hasClass = (day) => filtered.some((s) => sameDay(new Date(s.startsAt), day) && s.status !== 'cancelled');
  const todayCount = filtered.filter((s) => sameDay(new Date(s.startsAt), today) && s.status !== 'cancelled').length;
  const horizon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + UPCOMING_DAYS).getTime();
  const list = selectedDay
    ? filtered.filter((s) => sameDay(new Date(s.startsAt), selectedDay))
    : filtered.filter((s) => getClassCardState(s, now) !== 'ended' && new Date(s.startsAt).getTime() < horizon);

  const monthLabel = capitalize(cursor.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }));
  const todayLabel = today.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  const dayTitle = selectedDay ? capitalize(selectedDay.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })) : 'Próximas clases';
  const filterCourses = courses.filter((c) => sessions.some((s) => s.courseId?.toString() === c.id.toString()));

  const goToday = () => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(null); };

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Mi agenda</h1>
          <p className="admin-page-sub">{subtitle || 'Tus clases en vivo. La de hoy va primero.'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="admin-select" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} aria-label="Filtrar por curso">
            <option value="all">Todos mis cursos</option>
            {filterCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <button className="admin-btn-ghost" onClick={() => window.open('https://calendar.google.com', '_blank')}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M12 11v3.6h5.1c-.2 1.3-1.6 3.8-5.1 3.8-3 0-5.5-2.5-5.5-5.6s2.5-5.6 5.5-5.6c1.7 0 2.9.7 3.6 1.4l2.4-2.4C16.6 4.9 14.5 4 12 4c-4.4 0-8 3.6-8 8s3.6 8 8 8c4.6 0 7.7-3.2 7.7-7.8 0-.5 0-.9-.1-1.2H12z"/></svg>
            Sincronizar con Google
          </button>
        </div>
      </div>

      <div className="agenda-today">
        <h2>Hoy · {todayLabel}</h2>
        <span className="admin-status admin-status-violet">{todayCount === 0 ? 'Sin clases' : `${todayCount} clase${todayCount === 1 ? '' : 's'}`}</span>
      </div>
      <p className="admin-panel-caption" style={{ marginTop: 0, marginBottom: 16 }}>Toca un día del calendario para ver solo sus clases. Sin elegir un día, ves todas las próximas.</p>

      <div className="agenda-layout">
        <div className="admin-panel agenda-mini">
          <div className="dash-calendar-head">
            <div className="dash-calendar-title">{monthLabel}</div>
            <div className="dash-calendar-nav">
              <button className="admin-btn-ghost agenda-mini-today" onClick={goToday}>Hoy</button>
              <button className="admin-icon-btn" aria-label="Mes anterior" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft size={14} /></button>
              <button className="admin-icon-btn" aria-label="Mes siguiente" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight size={14} /></button>
            </div>
          </div>
          <div className="agenda-mini-grid">
            {DOW.map((d, i) => <div key={i} className="agenda-mini-dow">{d}</div>)}
            {monthDays.map((day, i) => (day ? (
              <button
                key={i} type="button"
                className={`agenda-mini-day ${sameDay(day, today) ? 'is-today' : ''} ${selectedDay && sameDay(day, selectedDay) ? 'is-selected' : ''}`}
                onClick={() => setSelectedDay(selectedDay && sameDay(day, selectedDay) ? null : day)}
                aria-label={day.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
              >
                {day.getDate()}
                {hasClass(day) && <span className="agenda-mini-dot" />}
              </button>
            ) : <span key={i} />))}
          </div>
          <div className="agenda-mini-legend"><span className="agenda-mini-dot" /> Día con clase. Tócalo para ver sus clases.</div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <span className="admin-panel-title">{dayTitle}</span>
            {selectedDay
              ? <a className="admin-panel-link" style={{ cursor: 'pointer' }} onClick={() => setSelectedDay(null)}>Ver todas las próximas ×</a>
              : <span className="admin-cell-sub">Próximos {UPCOMING_DAYS} días</span>}
          </div>
          {list.length === 0 ? (
            <p className="admin-panel-caption" style={{ marginTop: 0 }}>{selectedDay ? 'No tienes clases este día.' : `No tienes clases en los próximos ${UPCOMING_DAYS} días.`}</p>
          ) : list.map((s) => (
            <ClassRow key={s.id} session={s} courseTitle={titleOf(s)}
              actions={getClassCardState(s, now) === 'ended'
                ? <RecordingButton session={s} />
                : <MeetButton session={s} meetLink={meetLinkFor(s, classLinks)} role={role} size="sm" now={now} />} />
          ))}
          {list.some((s) => getClassCardState(s, now) === 'scheduled') && (
            <p className="admin-panel-caption" style={{ marginBottom: 0 }}>El botón se activa 10 min antes de la clase.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClassAgenda;
