import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { fetchMyActiveEnrollments } from '../../lib/db';
import { fetchMyDeliverables } from '../../lib/studentDeliverables';
import { daysLeft } from '../../lib/workItems';
import WorkRow from '../../components/WorkRow';
import SubmitWorkModal from '../../components/SubmitWorkModal';

const TABS = [
  { key: 'pending', label: 'Por entregar' },
  { key: 'submitted', label: 'Enviadas' },
  { key: 'reviewed', label: 'Calificadas' },
];

// Mis entregas (E5): todo lo que hay que entregar, de todos los cursos, en un
// solo lugar. Cada fila dice si es "Práctica de clase" o "Entrega del módulo"
// y "Entregar" abre el mismo formulario que Mi proyecto. El número de "Por
// entregar" es el mismo del menú.
const StudentEntregas = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { courses } = useCourseOfferings();
  const [items, setItems] = useState([]);
  const [enrollments, setEnrollments] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [courseFilter, setCourseFilter] = useState('all');
  const [submitItem, setSubmitItem] = useState(null);

  const load = useCallback(() => {
    if (!currentUser) return;
    fetchMyActiveEnrollments(currentUser.uid).then((map) => {
      setEnrollments(map);
      const enrolled = courses.filter((c) => map[c.id]);
      return fetchMyDeliverables(currentUser.uid, enrolled).then((data) => {
        setItems(data);
        setLoading(false);
      });
    }).catch(() => setLoading(false));
  }, [currentUser, courses]);
   
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="admin-empty-hint">Cargando tus entregas...</div>;

  const myCourses = courses.filter((c) => enrollments[c.id]);
  const inCourse = items.filter((i) => courseFilter === 'all' || i.courseId?.toString() === courseFilter);
  const counts = Object.fromEntries(TABS.map((t) => [t.key, inCourse.filter((i) => i.status === t.key).length]));
  const byDue = (a, b) => String(a.dueAt || '9').localeCompare(String(b.dueAt || '9'));
  const list = inCourse.filter((i) => i.status === tab).sort(tab === 'pending' ? byDue : (a, b) => byDue(b, a));
  const view = (item) => navigate(`/student/curso/${item.courseId}/entrega/${item.kind === 'practice' ? 'practica' : 'modulo'}/${item.kind === 'practice' ? item.practiceId : item.moduleId}`);

  // "Por entregar": lo vencido arriba (en rojo), luego lo que vence esta semana y lo de más adelante.
  const sections = tab === 'pending'
    ? [
      { key: 'late', label: 'Vencidas', late: true, items: list.filter((i) => daysLeft(i.dueDate) !== null && daysLeft(i.dueDate) < 0) },
      { key: 'week', label: 'Vence esta semana', items: list.filter((i) => { const d = daysLeft(i.dueDate); return d !== null && d >= 0 && d <= 7; }) },
      { key: 'later', label: 'Más adelante', items: list.filter((i) => { const d = daysLeft(i.dueDate); return d === null || d > 7; }) },
    ].filter((s) => s.items.length)
    : [{ key: 'all', label: '', items: list }];

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Mis entregas</h1>
          <p className="admin-page-sub">Todo lo que tienes que entregar en tus cursos, en un solo lugar.</p>
        </div>
        {myCourses.length > 1 && (
          <select className="admin-select" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} aria-label="Filtrar por curso">
            <option value="all">Todos mis cursos</option>
            {myCourses.map((c) => <option key={c.id} value={c.id.toString()}>{c.title}</option>)}
          </select>
        )}
      </div>

      <div className="tabs-line">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label} <span className="count">{counts[t.key]}</span></button>
        ))}
      </div>

      <div className="entregas-layout">
        <div className="admin-panel">
          {list.length === 0 ? (
            <p className="admin-panel-caption" style={{ margin: 0 }}>{tab === 'pending' ? '¡Estás al día! No tienes nada por entregar.' : tab === 'submitted' ? 'No tienes entregas esperando nota.' : 'Todavía no tienes entregas calificadas.'}</p>
          ) : sections.map((s) => (
            <div key={s.key} style={{ marginBottom: 8 }}>
              {s.label && <div className={`work-section-label ${s.late ? 'is-late' : ''}`}>{s.label}</div>}
              {s.items.map((item) => (
                <div key={`${item.courseId}-${item.key}`}>
                  <WorkRow item={item} sub={item.sub} blocked={item.blocked} showCourse onSubmit={setSubmitItem} onView={view} />
                  {tab === 'reviewed' && item.sub?.feedback && <p className="admin-cell-sub entregas-feedback">“{item.sub.feedback.split('\n')[0]}”</p>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="dark-card entregas-tip">
          <span className="dark-card-badge">Tip</span>
          <p>¿No puedes subir tu archivo? Súbelo a Drive y pega el link en la entrega.</p>
        </div>
      </div>

      {submitItem && (
        <SubmitWorkModal
          course={{ id: submitItem.courseId, title: submitItem.courseTitle }}
          item={submitItem} existing={submitItem.sub}
          onClose={() => setSubmitItem(null)} onSaved={load}
        />
      )}
    </div>
  );
};

export default StudentEntregas;
