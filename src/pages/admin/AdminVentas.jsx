import React, { useEffect, useState } from 'react';
import { Search, Download, Eye, X } from 'lucide-react';
import { fetchOrders } from '../../lib/db';
import ModalPortal from '../../components/ModalPortal';

const ORDER_STATUS = {
  paid: { label: 'Pagada', cls: 'admin-status-green' },
  pending: { label: 'Pendiente', cls: 'admin-status-amber' },
};

const downloadCsv = (rows) => {
  const header = ['Pedido', 'Fecha', 'Alumno', 'Curso', 'Importe', 'Estado'];
  const lines = rows.map((r) => [r.code, r.createdAt, r.studentName, r.courseTitle, r.amount, r.status].join(','));
  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'pedidos-y-pagos.csv'; a.click();
  URL.revokeObjectURL(url);
};

const AdminVentas = () => {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);

  useEffect(() => { fetchOrders().then((list) => { setOrders(list); setLoading(false); }); }, []);

  const filtered = orders.filter((o) => {
    const matchesSearch = `${o.code} ${o.studentName} ${o.courseTitle}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="anim-fade-up d1">
      <span className="admin-eyebrow">Administración / Netwise Academy</span>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Pedidos y pagos</h1>
          <p className="admin-page-sub">Revisa importes y estados de pago. Las matrículas se gestionan en Alumnos y accesos.</p>
        </div>
        <button className="admin-btn-ghost" onClick={() => downloadCsv(filtered)}><Download size={15} /> Exportar CSV</button>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search"><Search size={15} /><input placeholder="Buscar pedido..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Todos los registros</option>
          <option value="paid">Pagadas</option>
          <option value="pending">Pendientes</option>
        </select>
      </div>

      <div className="admin-table-wrap">
        {loading ? <div className="admin-empty-hint">Cargando pedidos...</div> : filtered.length === 0 ? (
          <div className="admin-empty-hint">Todavía no se ha registrado ningún pedido.</div>
        ) : (
          <table className="admin-table">
            <thead><tr><th>Pedido</th><th>Alumno</th><th>Curso</th><th>Importe</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {filtered.map((o) => {
                const status = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
                return (
                  <tr key={o.id}>
                    <td><div className="admin-cell-name">{o.code}</div><div className="admin-cell-sub">{new Date(o.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short.', year: 'numeric' })}</div></td>
                    <td>{o.studentName}</td>
                    <td>{o.courseTitle}</td>
                    <td className="admin-price">S/ {Number(o.amount).toFixed(2)}</td>
                    <td><span className={`admin-status ${status.cls}`}>{status.label}</span></td>
                    <td><button className="admin-icon-btn" onClick={() => setViewing(o)}><Eye size={14} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="admin-page-footer">NETWISE ACADEMY · ADMIN V1.4 / Demostración HTML · Datos de ejemplo · Cambios en este navegador</p>

      {viewing && (
        <ModalPortal>
        <div className="admin-modal-overlay" onClick={() => setViewing(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <div className="admin-modal-title">Pedido {viewing.code}</div>
              <button className="admin-modal-close" onClick={() => setViewing(null)}><X size={18} /></button>
            </div>
            <div className="admin-field"><label>Alumno</label><div>{viewing.studentName}</div></div>
            <div className="admin-field"><label>Curso</label><div>{viewing.courseTitle}</div></div>
            <div className="admin-field"><label>Importe</label><div>S/ {Number(viewing.amount).toFixed(2)}</div></div>
            <div className="admin-field"><label>Fecha</label><div>{new Date(viewing.createdAt).toLocaleString('es-PE')}</div></div>
            <div className="admin-field"><label>Estado</label><div>{(ORDER_STATUS[viewing.status] || ORDER_STATUS.pending).label}</div></div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default AdminVentas;
