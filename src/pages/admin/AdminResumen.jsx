import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Calendar, Users, ShoppingCart, ArrowRight } from 'lucide-react';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { fetchAllEnrollments, fetchOrders, fetchGroups, fetchAuditLog } from '../../lib/db';

const AdminResumen = () => {
  const navigate = useNavigate();
  const { courses } = useCourseOfferings();
  const [enrollments, setEnrollments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [groups, setGroups] = useState([]);
  const [lastChange, setLastChange] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchAllEnrollments(), fetchOrders(), fetchGroups(), fetchAuditLog()]).then(
      ([e, o, g, log]) => {
        setEnrollments(e);
        setOrders(o);
        setGroups(g);
        setLastChange(log[0] || null);
        setLoading(false);
      }
    );
  }, []);

  const visibleCount = courses.filter((c) => c.visible !== false).length;
  const openCount = courses.filter((c) => c.enrollmentsOpen !== false).length;
  const activeAccessCount = enrollments.filter((e) => e.status !== 'pending').length;
  const salesTotal = orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

  const pendingOrders = orders.filter((o) => o.status === 'pending').length;
  const groupsToOpen = groups.filter((g) => g.status === 'to-open').length;
  const pendingAccess = enrollments.filter((e) => e.status === 'pending').length;

  const reviewItems = [
    { label: 'Pedidos pendientes de validación', count: pendingOrders, to: '/admin/ventas' },
    { label: 'Grupos por abrir', count: groupsToOpen, to: '/admin/grupos' },
    { label: 'Accesos pendientes', count: pendingAccess, to: '/admin/alumnos' },
  ].filter((i) => i.count > 0);

  if (loading) return <div className="admin-empty-hint">Cargando resumen...</div>;

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Resumen</h1>
          <p className="admin-page-sub">Administra tu academia desde un solo lugar.</p>
        </div>
      </div>

      <div className="admin-banner">
        <div>
          <span className="admin-banner-badge">PRIMER PASO</span>
          <div className="admin-banner-title">De un buen curso a una gran experiencia.</div>
          <p className="admin-banner-desc">Actualiza tu oferta, organiza tus próximos grupos y prepara todo para recibir a tus alumnos.</p>
        </div>
        <button className="admin-btn-edit" onClick={() => navigate('/admin/cursos')}>
          <ArrowRight size={15} /> Gestionar cursos
        </button>
      </div>

      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Cursos visibles <LayoutGrid size={16} /></div>
          <div className="admin-stat-value">{visibleCount}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Cursos con inscripción <Calendar size={16} /></div>
          <div className="admin-stat-value">{openCount}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Accesos activos <Users size={16} /></div>
          <div className="admin-stat-value">{activeAccessCount}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Ventas de ejemplo <ShoppingCart size={16} /></div>
          <div className="admin-stat-value">S/ {salesTotal.toFixed(2)}</div>
        </div>
      </div>

      <div className="admin-two-col">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <span className="admin-panel-title">Últimos cambios</span>
            <a className="admin-panel-link" onClick={() => navigate('/admin/historial')} style={{ cursor: 'pointer' }}>Ver historial →</a>
          </div>
          {lastChange ? (
            <div className="admin-panel-empty">✓ <div><strong>{lastChange.message}</strong><small>{new Date(lastChange.createdAt).toLocaleString('es-PE')}</small></div></div>
          ) : (
            <div className="admin-panel-empty">✓ <div>Todo listo para empezar<small>Los cambios que recibas aparecerán aquí.</small></div></div>
          )}
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head"><span className="admin-panel-title">Por revisar</span></div>
          {reviewItems.length === 0 ? (
            <p className="admin-panel-caption" style={{ marginTop: 0 }}>Nada pendiente por ahora.</p>
          ) : (
            reviewItems.map((item) => (
              <div key={item.label} className="admin-review-row" style={{ cursor: 'pointer' }} onClick={() => navigate(item.to)}>
                {item.label} <span className="admin-review-count">{item.count}</span>
              </div>
            ))
          )}
          <p className="admin-panel-caption">Información de ejemplo para explorar el panel.</p>
        </div>
      </div>
    </div>
  );
};

export default AdminResumen;
