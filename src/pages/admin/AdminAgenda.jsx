import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { fetchLiveSessions, fetchGroups } from '../../lib/db';

// Agenda del admin: las clases de TODOS los cursos y aulas, cada curso con su
// color. Es de solo consulta -- la grabación y la sala las gestiona el docente
// desde su propia agenda (/teacher/agenda, que ya no abre para el admin).
const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Fondo claro + texto oscuro del mismo tono, legibles en la celda del calendario.
const COURSE_COLORS = [
  { bg: '#EDE7FB', fg: '#6D28D9' },
  { bg: '#DBEAFE', fg: '#1D4ED8' },
  { bg: '#D1FAE5', fg: '#047857' },
  { bg: '#FEF3C7', fg: '#B45309' },
  { bg: '#FCE7F3', fg: '#BE185D' },
  { bg: '#CFFAFE', fg: '#0E7490' },
  { bg: '#FEE2E2', fg: '#B91C1C' },
  { bg: '#E0E7FF', fg: '#4338CA' },
  { bg: '#ECFCCB', fg: '#4D7C0F' },
  { bg: '#F3E8FF', fg: '#7E22CE' },
];
const NO_COURSE = { bg: '#F1F0F5', fg: '#6B6980' };

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const AdminAgenda = () => {
  const navigate = useNavigate();
  const { courses } = useCourseOfferings();
  const [sessions, setSessions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courseFilter, setCourseFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [cursor, setCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());

  useEffect(() => {
    fetchLiveSessions().then(setSessions).catch(() => {});
    fetchGroups().then(setGroups).catch(() => {});
  }, []);

  // Color fijo por curso (según su posición en el catálogo), para que no cambie
  // al filtrar.
  const colorOf = useMemo(() => {
    const map = new Map(courses.map((c, i) => [c.id.toString(), COURSE_COLORS[i % COURSE_COLORS.length]]));
    return (courseId) => map.get(courseId?.toString()) || NO_COURSE;
  }, [courses]);
  const groupName = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);
  const courseGroups = groups.filter((g) => courseFilter !== 'all' && g.courseId?.toString() === courseFilter);

  const filtered = sessions.filter((s) => (courseFilter === 'all' || s.courseId?.toString() === courseFilter)
    && (groupFilter === 'all' || s.groupId === groupFilter));
  // La leyenda muestra solo los cursos que tienen clases.
  const legend = courses.filter((c) => sessions.some((s) => s.courseId?.toString() === c.id.toString()));

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

  const eventsFor = (day) => (day
    ? filtered.filter((s) => sameDay(new Date(s.startsAt), day)).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    : []);
  const today = new Date();
  const rawMonthLabel = cursor.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  const monthLabel = rawMonthLabel.charAt(0).toUpperCase() + rawMonthLabel.slice(1);
  const selectedEvents = eventsFor(selectedDay);
  const chipStyle = (s) => { const c = colorOf(s.courseId); return { '--ev-bg': c.bg, '--ev-fg': c.fg }; };
  // En la celda no cabe "Aula · Semana 1 · Lunes": el día ya lo da la celda,
  // así que queda "Aula · S1" (el detalle completo, en el tooltip y en la lista).
  const chipText = (s) => {
    const week = /^Semana (\d+) · /.exec(s.title || '');
    return [groupName.get(s.groupId), week ? `S${week[1]}` : s.title].filter(Boolean).join(' · ');
  };
  const label = (s) => [s.courseTitle, groupName.get(s.groupId), s.title].filter(Boolean).join(' · ');

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Agenda</h1>
          <p className="admin-page-sub">Clases en vivo de todos los cursos y aulas</p>
        </div>
      </div>

      <div className="admin-toolbar">
        <div style={{ fontSize: '.85rem', color: '#6B6980' }}>Filtrar</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="admin-select" value={courseFilter} onChange={(e) => { setCourseFilter(e.target.value); setGroupFilter('all'); }}>
            <option value="all">Todos los cursos</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          {courseGroups.length > 1 && (
            <select className="admin-select" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
              <option value="all">Todas las aulas</option>
              {courseGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {legend.length > 0 && (
        <div className="agenda-legend">
          {legend.map((c) => (
            <span key={c.id} className="agenda-legend-item">
              <span className="agenda-legend-dot" style={{ background: colorOf(c.id).fg }} />{c.title}
            </span>
          ))}
        </div>
      )}

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="dash-calendar-head">
          <div className="dash-calendar-title">{monthLabel}</div>
          <div className="dash-calendar-nav">
            <button className="admin-btn-ghost" onClick={() => { setCursor(new Date()); setSelectedDay(new Date()); }}>Hoy</button>
            <button className="admin-icon-btn" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft size={15} /></button>
            <button className="admin-icon-btn" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight size={15} /></button>
          </div>
        </div>

        <div className="dash-calendar-grid">
          {DOW.map((d) => <div key={d} className="dash-calendar-dow">{d}</div>)}
          {monthDays.map((day, i) => {
            const events = eventsFor(day);
            return (
              <div
                key={i}
                className={`dash-calendar-cell ${day && sameDay(day, today) ? 'today' : ''} ${day && sameDay(day, selectedDay) ? 'selected' : ''}`}
                style={{ cursor: day ? 'pointer' : 'default' }}
                onClick={() => day && setSelectedDay(day)}
              >
                {day && <span className="dash-calendar-daynum">{day.getDate()}</span>}
                {events.length > 0 && (
                  <div className="dash-calendar-events">
                    {events.slice(0, 3).map((e) => (
                      <div key={e.id} className={`dash-calendar-event by-course ${e.status === 'cancelled' ? 'cancelled' : ''}`} style={chipStyle(e)} title={label(e)}>
                        {chipText(e)}
                      </div>
                    ))}
                    {events.length > 3 && <div className="dash-calendar-more">+{events.length - 3}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <span className="admin-panel-title dash-day-title">{selectedDay.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <span className="admin-status admin-status-gray">{selectedEvents.length} clase{selectedEvents.length === 1 ? '' : 's'}</span>
        </div>
        {selectedEvents.length === 0 ? (
          <p className="admin-panel-caption" style={{ marginTop: 0 }}>Sin clases programadas este día.</p>
        ) : selectedEvents.map((s) => (
          <div key={s.id} className="dash-list-row">
            <div>
              <div className="admin-cell-sub" style={{ color: colorOf(s.courseId).fg, fontWeight: 600 }}>
                {s.courseTitle}{groupName.get(s.groupId) ? ` · Aula ${groupName.get(s.groupId)}` : ''}
              </div>
              <div className="dash-list-row-title">{s.title}{s.status === 'cancelled' ? ' (cancelada)' : ''}</div>
              <div className="dash-list-row-sub">
                {new Date(s.startsAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} · {s.durationMin} min{s.instructor ? ` · ${s.instructor}` : ''}
              </div>
            </div>
            <button className="admin-btn-edit" onClick={() => navigate(`/live/${s.id}`)}><Video size={13} /> Abrir sala</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminAgenda;
