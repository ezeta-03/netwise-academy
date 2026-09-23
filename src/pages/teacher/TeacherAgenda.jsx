import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { fetchLiveSessions } from '../../lib/db';

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const TeacherAgenda = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { courses: allCourses } = useCourseOfferings();
  // Un admin ve todo; un docente solo su(s) curso(s) asignado(s).
  // useMemo: sin él `courses` es un array nuevo en cada render y el efecto de
  // abajo (que depende de él) se volvía a disparar sin parar para un docente.
  const courses = useMemo(
    () => (currentUser?.role === 'admin' ? allCourses : allCourses.filter((c) => c.teacherUid === currentUser?.uid)),
    [allCourses, currentUser?.role, currentUser?.uid],
  );
  const myCourseIds = useMemo(() => new Set(courses.map((c) => c.id.toString())), [courses]);
  const [sessions, setSessions] = useState([]);
  const [courseFilter, setCourseFilter] = useState('all');
  const [cursor, setCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());

  useEffect(() => { fetchLiveSessions().then((all) => setSessions(all.filter((s) => myCourseIds.has(s.courseId?.toString())))); }, [myCourseIds]);

  const filtered = sessions.filter((s) => courseFilter === 'all' || s.courseId?.toString() === courseFilter);

  const monthDays = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7; // lunes=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [cursor]);

  const eventsFor = (day) => day ? filtered.filter((s) => sameDay(new Date(s.startsAt), day)) : [];
  const today = new Date();
  const monthLabel = cursor.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

  const selectedEvents = eventsFor(selectedDay);

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Mi agenda</h1>
          <p className="admin-page-sub">Clases y reuniones</p>
        </div>
        <button className="admin-btn-ghost" onClick={() => window.open('https://calendar.google.com', '_blank')}>
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M12 11v3.6h5.1c-.2 1.3-1.6 3.8-5.1 3.8-3 0-5.5-2.5-5.5-5.6s2.5-5.6 5.5-5.6c1.7 0 2.9.7 3.6 1.4l2.4-2.4C16.6 4.9 14.5 4 12 4c-4.4 0-8 3.6-8 8s3.6 8 8 8c4.6 0 7.7-3.2 7.7-7.8 0-.5 0-.9-.1-1.2H12z"/></svg>
          Sincronizar con Google
        </button>
      </div>

      <div className="admin-toolbar">
        <div style={{ fontSize: '.85rem', color: '#6B6980' }}>Filtrar por curso</div>
        <select className="admin-select" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
          <option value="all">Todos mis cursos</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="dash-calendar-head">
          <div className="dash-calendar-title" style={{ textTransform: 'capitalize' }}>{monthLabel}</div>
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
            const isToday = day && sameDay(day, today);
            return (
              <div
                key={i}
                className={`dash-calendar-cell ${isToday ? 'today' : ''}`}
                style={{ cursor: day ? 'pointer' : 'default' }}
                onClick={() => day && setSelectedDay(day)}
              >
                {day && <span className="dash-calendar-daynum">{day.getDate()}</span>}
                {events.slice(0, 2).map((e) => <div key={e.id} className="dash-calendar-event">{e.title}</div>)}
              </div>
            );
          })}
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <span className="admin-panel-title" style={{ textTransform: 'capitalize' }}>{selectedDay.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <span className="admin-status admin-status-gray">{selectedEvents.length} evento{selectedEvents.length === 1 ? '' : 's'}</span>
        </div>
        {selectedEvents.length === 0 ? (
          <p className="admin-panel-caption" style={{ marginTop: 0 }}>Sin clases programadas este día.</p>
        ) : selectedEvents.map((s) => (
          <div key={s.id} className="dash-list-row">
            <div>
              <div className="admin-cell-sub" style={{ color: 'var(--accent)', fontWeight: 600 }}>{s.courseTitle}</div>
              <div className="dash-list-row-title">{s.title}</div>
              <div className="dash-list-row-sub">{new Date(s.startsAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} · {s.durationMin} min · Clase en vivo</div>
            </div>
            <button className="admin-btn-edit" onClick={() => navigate(`/live/${s.id}`)}><Video size={13} /> Abrir sala</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeacherAgenda;
