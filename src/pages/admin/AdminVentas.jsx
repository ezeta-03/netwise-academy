import React, { useEffect, useState } from 'react';
import { Search, Download, Eye, X, Check, Loader2 } from 'lucide-react';
import { fetchOrders, approveOrder, logChange } from '../../lib/db';
import { downloadCsv } from '../../lib/csv';
import ModalPortal from '../../components/ModalPortal';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';

const ORDER_STATUS = {
  paid: { label: 'Pagada', cls: 'admin-status-green' },
  pending: { label: 'Pendiente', cls: 'admin-status-amber' },
};

const PAYMENT_LABELS = {
  yape: 'Yape Empresas / Plin Negocios',
  transfer: 'Transferencia bancaria',
  card: 'Tarjeta de crédito/débito',
};

const exportOrdersCsv = (rows) => downloadCsv(
  'pedidos-y-pagos.csv',
  ['Pedido', 'Fecha', 'Alumno', 'Curso', 'Importe', 'Estado'],
  rows.map((r) => [r.code, r.createdAt, r.studentName, r.courseTitle, r.amount, r.status]),
);

const AdminVentas = () => {
  const { currentUser } = useAuth();
  const { addToast, refreshNotifications } = useUI();
  const adminName = currentUser?.displayName || currentUser?.email || 'Admin';

  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [approvingId, setApprovingId] = useState(null);

  useEffect(() => { fetchOrders().then((list) => { setOrders(list); setLoading(false); }).catch(() => setLoading(false)); }, []);

  const handleApprove = async (order) => {
    setApprovingId(order.id);
    try {
      await approveOrder(order);
      await logChange(adminName, `Validó el pago de ${order.studentName} -- pedido ${order.code} (${order.courseTitle}).`);
      setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, status: 'paid' } : o)));
      setViewing((v) => (v?.id === order.id ? { ...v, status: 'paid' } : v));
      refreshNotifications();
      addToast('Pago validado. El alumno ya tiene acceso al curso.', 'success');
    } catch {
      addToast('No se pudo validar el pago. Intenta de nuevo.', 'error');
    } finally {
      setApprovingId(null);
    }
  };

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
        <button className="admin-btn-ghost" onClick={() => exportOrdersCsv(filtered)}><Download size={15} /> Exportar CSV</button>
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
                    <td><div className="admin-cell-name">{o.code}</div><div className="admin-cell-sub">{new Date(o.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</div></td>
                    <td>{o.studentName}</td>
                    <td>{o.courseTitle}</td>
                    <td className="admin-price">S/ {Number(o.amount).toFixed(2)}</td>
                    <td><span className={`admin-status ${status.cls}`}>{status.label}</span></td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="admin-icon-btn" onClick={() => setViewing(o)}><Eye size={14} /></button>
                      {o.status === 'pending' && (
                        <button className="admin-btn-edit" style={{ padding: '6px 10px', fontSize: '.78rem' }} disabled={approvingId === o.id} onClick={() => handleApprove(o)}>
                          {approvingId === o.id ? <Loader2 size={13} className="spin" /> : <Check size={13} />} Aprobar
                        </button>
                      )}
                    </td>
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
            <div className="admin-field"><label>Método de pago</label><div>{PAYMENT_LABELS[viewing.paymentMethod] || 'No especificado'}</div></div>
            <div className="admin-field"><label>Fecha</label><div>{new Date(viewing.createdAt).toLocaleString('es-PE')}</div></div>
            <div className="admin-field"><label>Estado</label><div>{(ORDER_STATUS[viewing.status] || ORDER_STATUS.pending).label}</div></div>

            {viewing.paymentMethod && viewing.paymentMethod !== 'card' && (
              <div className="admin-field">
                <label>N.° de operación</label>
                <div>{viewing.proofCode || <span style={{ color: '#B45309' }}>No informado</span>}</div>
              </div>
            )}

            <div className="admin-field">
              <label>Captura adjunta</label>
              {viewing.proofUrl ? (
                viewing.proofUrl.startsWith('data:application/pdf') || viewing.proofUrl.includes('.pdf') ? (
                  <a href={viewing.proofUrl} target="_blank" rel="noreferrer" className="admin-panel-link">Ver PDF adjunto ↗</a>
                ) : (
                  <a href={viewing.proofUrl} target="_blank" rel="noreferrer">
                    <img src={viewing.proofUrl} alt="Comprobante de pago" className="admin-proof-thumb" />
                  </a>
                )
              ) : (
                <div style={{ color: '#8B8A9B', fontWeight: 500 }}>No adjuntó -- valida con el N.° de operación.</div>
              )}
            </div>

            {viewing.status === 'pending' && (
              <div className="admin-modal-actions" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
                <button className="admin-btn-edit" disabled={approvingId === viewing.id} onClick={() => handleApprove(viewing)}>
                  {approvingId === viewing.id ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Validar pago y matricular
                </button>
              </div>
            )}
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default AdminVentas;
