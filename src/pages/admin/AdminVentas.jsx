import React, { useEffect, useState } from 'react';
import { Search, Download, Eye, X, Check, Loader2, Ban, AlertTriangle } from 'lucide-react';
import { fetchOrders, fetchGroups, fetchCoupons, approveOrder, rejectOrder, logChange } from '../../lib/db';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { downloadCsv } from '../../lib/csv';
import ModalPortal from '../../components/ModalPortal';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';

const ORDER_STATUS = {
  paid: { label: 'Pagada', cls: 'admin-status-green' },
  pending: { label: 'Pendiente', cls: 'admin-status-amber' },
  rejected: { label: 'Rechazada', cls: 'admin-status-rose' },
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
  const { addToast, confirmDialog, refreshNotifications } = useUI();
  const adminName = currentUser?.displayName || currentUser?.email || 'Admin';

  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [groups, setGroups] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const { courses } = useCourseOfferings();
  // Aula elegida en el detalle del pedido ('' = automática, ver lib/groupAssignment.js).
  const [groupChoice, setGroupChoice] = useState('');

  useEffect(() => { fetchOrders().then((list) => { setOrders(list); setLoading(false); }).catch(() => setLoading(false)); }, []);
  useEffect(() => { fetchGroups().then(setGroups).catch(() => {}); }, []);
  useEffect(() => { fetchCoupons().then(setCoupons).catch(() => {}); }, []);

  // Lo que debió pagar según el precio vigente (mismo cálculo que el
  // checkout): el importe del pedido lo escribe el navegador del alumno, así
  // que acá se contrasta antes de aprobar. null si no se puede calcular.
  const expectedAmount = (order) => {
    const course = courses.find((c) => c.id.toString() === order.courseId?.toString());
    if (!course || course.price == null) return null;
    const original = course.promoPercent ? course.price / (1 - course.promoPercent / 100) : course.price;
    const promoDiscount = original - course.price;
    let discount = promoDiscount;
    if (order.couponId) {
      const coupon = coupons.find((c) => c.id === order.couponId);
      if (!coupon) return null;
      const couponDiscount = coupon.stackable
        ? promoDiscount + course.price * (coupon.discountPercent / 100)
        : original * (coupon.discountPercent / 100);
      discount = Math.max(promoDiscount, couponDiscount);
    }
    return Math.round((original - discount) * 100) / 100;
  };
  const amountMismatch = (order) => {
    const expected = expectedAmount(order);
    return expected !== null && Math.abs(Number(order.amount) - expected) > 0.01 ? expected : null;
  };

  const courseGroups = (order) => groups.filter((g) => g.courseId?.toString() === order.courseId?.toString() && g.status !== 'closed');

  const openOrder = (order) => {
    setViewing(order);
    setGroupChoice('');
  };

  // Sin aula elegida, approveOrder la asigna sola: la próxima aula del curso
  // con cupos (ver lib/groupAssignment.js). El admin puede elegir otra.
  const handleApprove = async (order, groupId = '') => {
    const chosen = groups.find((g) => g.id === groupId) || null;
    const expected = amountMismatch(order);
    const message = `${order.studentName} · ${order.courseTitle}\nImporte: S/ ${Number(order.amount).toFixed(2)}\nN.° de operación: ${order.proofCode || 'no informado'}`
      + (expected !== null ? `\n\nATENCIÓN: el importe no coincide con el precio vigente (S/ ${expected.toFixed(2)}).` : '')
      + '\n\nAl confirmar, el alumno queda matriculado.';
    if (!(await confirmDialog({ title: 'Validar pago y matricular', message, confirmLabel: 'Validar pago', danger: expected !== null }))) return;
    setApprovingId(order.id);
    try {
      const enrollment = await approveOrder(order, chosen);
      const group = chosen || (enrollment?.groupId ? { id: enrollment.groupId, name: enrollment.groupName } : null);
      await logChange(adminName, `Validó el pago de ${order.studentName} -- pedido ${order.code} (${order.courseTitle}).`);
      setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, status: 'paid' } : o)));
      setViewing((v) => (v?.id === order.id ? { ...v, status: 'paid' } : v));
      refreshNotifications();
      addToast(group ? `Pago validado. ${order.studentName} ya tiene acceso al curso (aula ${group.name}).` : 'Pago validado. El alumno ya tiene acceso, pero no hay aula con cupos: asígnalo en Aulas y horarios.', group ? 'success' : 'warning');
    } catch {
      addToast('No se pudo validar el pago. Intenta de nuevo.', 'error');
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (order) => {
    const reason = await confirmDialog({
      title: `Rechazar el pedido ${order.code}`, message: `${order.studentName} · ${order.courseTitle}. El alumno podrá volver a registrar su pago.`,
      input: { label: 'Motivo (el alumno lo verá)', defaultValue: 'No encontramos el pago con ese N.° de operación' },
      confirmLabel: 'Rechazar pedido', danger: true,
    });
    if (reason === null) return;
    setApprovingId(order.id);
    try {
      const patch = await rejectOrder(order, reason.trim());
      await logChange(adminName, `Rechazó el pedido ${order.code} de ${order.studentName} (${order.courseTitle})${reason.trim() ? `: ${reason.trim()}` : ''}.`);
      setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, ...patch } : o)));
      setViewing((v) => (v?.id === order.id ? { ...v, ...patch } : v));
      refreshNotifications();
      addToast('Pedido rechazado. El alumno puede volver a registrar su pago.', 'success');
    } catch {
      addToast('No se pudo rechazar el pedido. Intenta de nuevo.', 'error');
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
          <option value="rejected">Rechazadas</option>
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
                const expected = o.status === 'pending' ? amountMismatch(o) : null;
                return (
                  <tr key={o.id}>
                    <td><div className="admin-cell-name">{o.code}</div><div className="admin-cell-sub">{new Date(o.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</div></td>
                    <td>{o.studentName}</td>
                    <td>{o.courseTitle}</td>
                    <td className="admin-price">S/ {Number(o.amount).toFixed(2)}{expected !== null && <div className="admin-cell-sub" style={{ color: '#B45309' }} title="El importe del pedido no coincide con el precio vigente"><AlertTriangle size={11} /> Esperado S/ {expected.toFixed(2)}</div>}</td>
                    <td><span className={`admin-status ${status.cls}`}>{status.label}</span></td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="admin-icon-btn" onClick={() => openOrder(o)} aria-label={`Ver pedido ${o.code}`}><Eye size={14} /></button>
                      {o.status === 'pending' && (
                        <button className="admin-btn-edit" style={{ padding: '6px 10px', fontSize: '.78rem' }} disabled={approvingId === o.id} onClick={() => handleApprove(o)}>
                          {approvingId === o.id ? <Loader2 size={13} className="spin" /> : <Check size={13} />} Aprobar
                        </button>
                      )}
                      {o.status === 'pending' && (
                        <button className="admin-icon-btn" disabled={approvingId === o.id} onClick={() => handleReject(o)} aria-label={`Rechazar pedido ${o.code}`} title="Rechazar"><Ban size={14} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="admin-page-footer">NETWISE ACADEMY · ADMIN V1.4</p>

      {viewing && (
        <ModalPortal>
        <div className="admin-modal-overlay">
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <div className="admin-modal-title">Pedido {viewing.code}</div>
              <button className="admin-modal-close" onClick={() => setViewing(null)}><X size={18} /></button>
            </div>
            <div className="admin-field"><label>Alumno</label><div>{viewing.studentName}</div></div>
            <div className="admin-field"><label>Curso</label><div>{viewing.courseTitle}</div></div>
            <div className="admin-field"><label>Importe</label><div>S/ {Number(viewing.amount).toFixed(2)}</div>
              {viewing.status === 'pending' && amountMismatch(viewing) !== null && (
                <div className="checkout-error" role="alert" style={{ marginTop: 6 }}>No coincide con el precio vigente del curso (S/ {amountMismatch(viewing).toFixed(2)}). Verifica cuánto llegó a la cuenta antes de aprobar.</div>
              )}
            </div>
            <div className="admin-field"><label>Método de pago</label><div>{PAYMENT_LABELS[viewing.paymentMethod] || 'No especificado'}</div></div>
            <div className="admin-field"><label>Cupón</label><div>{viewing.couponCode || (viewing.couponId ? 'Sí (código no registrado)' : 'Sin cupón')}</div></div>
            <div className="admin-field"><label>Fecha</label><div>{new Date(viewing.createdAt).toLocaleString('es-PE')}</div></div>
            <div className="admin-field"><label>Estado</label><div>{(ORDER_STATUS[viewing.status] || ORDER_STATUS.pending).label}{viewing.status === 'rejected' && viewing.rejectReason ? ` · ${viewing.rejectReason}` : ''}</div></div>

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
              <div className="admin-field">
                <label>Aula donde se matricula</label>
                <select value={groupChoice} onChange={(e) => setGroupChoice(e.target.value)}>
                  <option value="">Automática (próxima aula con cupos)</option>
                  {courseGroups(viewing).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}

            {viewing.status === 'pending' && (
              <div className="admin-modal-actions" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
                <button className="admin-btn-edit" disabled={approvingId === viewing.id} onClick={() => handleApprove(viewing, groupChoice)}>
                  {approvingId === viewing.id ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Validar pago y matricular
                </button>
                <button className="admin-btn-ghost" disabled={approvingId === viewing.id} onClick={() => handleReject(viewing)}>
                  <Ban size={14} /> Rechazar
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
