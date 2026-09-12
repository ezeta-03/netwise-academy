import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { fetchMyEnrollments } from '../../lib/db';
import { fetchMyDeliverables } from '../../lib/studentDeliverables';

const TABS = [
  { key: 'pending', label: 'Pendientes' },
  { key: 'submitted', label: 'En revisión' },
  { key: 'reviewed', label: 'Calificadas' },
];

const STATUS_BADGE = {
  pending: { label: 'Por entregar', cls: 'admin-status-amber' },
  submitted: { label: 'En revisión', cls: 'admin-status-gray' },
  reviewed: { label: 'Calificada', cls: 'admin-status-green' },
};

const formatDate = (iso) => {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
};

const StudentEntregas = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { courses } = useCourseOfferings();
  const [items, setItems] = useState([]);
  const [enrollments, setEnrollments] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');

  useEffect(() => {
    if (!currentUser) return;
    fetchMyEnrollments(currentUser.uid).then((map) => {
      setEnrollments(map);
      const enrolled = courses.filter((c) => map[c.id]);
      fetchMyDeliverables(currentUser.uid, enrolled).then((data) => {
        setItems(data);
        setLoading(false);
      });
    });
  }, [currentUser, courses]);

  if (loading) return <div className="admin-empty-hint">Cargando tus entregas...</div>;

  const counts = { pending: items.filter((i) => i.status === 'pending').length, submitted: items.filter((i) => i.status === 'submitted').length, reviewed: items.filter((i) => i.status === 'reviewed').length };
  const filtered = items.filter((i) => i.status === tab);

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Mis entregas</h1>
          <p className="admin-page-sub">Tus trabajos, fechas de entrega y comentarios del docente.</p>
        </div>
      </div>

      <div className="admin-toolbar" style={{ gap: 8 }}>
        {TABS.map((t) => (
          <button key={t.key} className={`admin-btn-ghost ${tab === t.key ? 'active' : ''}`} style={tab === t.key ? { background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'transparent' } : undefined} onClick={() => setTab(t.key)}>
            {t.label} <span className="admin-status admin-status-gray" style={{ marginLeft: 4 }}>{counts[t.key]}</span>
          </button>
        ))}
      </div>

      <div className="admin-panel">
        {filtered.length === 0 ? (
          <p className="admin-panel-caption" style={{ marginTop: 0 }}>No tienes entregas en esta categoría.</p>
        ) : filtered.map((item) => {
          const badge = STATUS_BADGE[item.status];
          const enrollment = enrollments[item.courseId];
          return (
            <div key={`${item.courseId}_${item.moduleId}`} className="dash-list-row">
              <div>
                <div className="admin-cell-sub" style={{ color: 'var(--accent)', fontWeight: 600 }}>{item.courseTitle}</div>
                <div className="dash-list-row-title">{item.deliverableTitle}</div>
                <div className="dash-list-row-sub">{enrollment?.groupName ? `Grupo ${enrollment.groupName}` : item.moduleTitle}</div>
                {item.dueDate && <div className="dash-list-row-sub">Fecha límite: {formatDate(item.dueDate)}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`admin-status ${badge.cls}`}>{badge.label}</span>
                <button className="admin-btn-edit" onClick={() => navigate(`/student/curso/${item.courseId}/proyecto`)}><ArrowRight size={13} /> Abrir proyecto</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StudentEntregas;
