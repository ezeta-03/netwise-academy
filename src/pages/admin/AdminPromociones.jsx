import React, { useEffect, useState } from 'react';
import { Search, Plus, X, Pencil, Check } from 'lucide-react';
import ModalPortal from '../../components/ModalPortal';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { fetchCoupons, createCoupon, updateCoupon, logChange } from '../../lib/db';

const couponStatus = (c) => {
  if (c.endDate && new Date(c.endDate) < new Date()) return { label: 'Vencido', cls: 'admin-status-gray' };
  if (c.maxUses && c.usedCount >= c.maxUses) return { label: 'Agotado', cls: 'admin-status-amber' };
  if (c.active === false) return { label: 'Pausado', cls: 'admin-status-gray' };
  return { label: 'Disponible', cls: 'admin-status-green' };
};

const CouponModal = ({ coupon, courses, adminName, onClose, onSaved }) => {
  const { addToast } = useUI();
  const [code, setCode] = useState(coupon?.code || '');
  const [scope, setScope] = useState(coupon?.scope || 'all');
  const [discountPercent, setDiscountPercent] = useState(coupon?.discountPercent ?? '');
  const [stackable, setStackable] = useState(coupon?.stackable ?? false);
  const [active, setActive] = useState(coupon?.active ?? true);
  const [startDate, setStartDate] = useState(coupon?.startDate || '');
  const [endDate, setEndDate] = useState(coupon?.endDate || '');
  const [maxUses, setMaxUses] = useState(coupon?.maxUses ?? 100);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!code.trim()) { addToast('El código es obligatorio.', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        code: code.trim().toUpperCase(), scope, discountPercent: Number(discountPercent) || 0,
        stackable, active, startDate: startDate || null, endDate: endDate || null, maxUses: Number(maxUses) || 0,
      };
      if (coupon) {
        await updateCoupon(coupon.id, payload);
        await logChange(adminName, `Editó el cupón "${payload.code}".`);
        addToast('Cupón actualizado.', 'success');
      } else {
        await createCoupon(payload);
        await logChange(adminName, `Creó el cupón "${payload.code}".`);
        addToast('Cupón creado.', 'success');
      }
      onSaved();
      onClose();
    } catch {
      addToast('No se pudo guardar el cupón.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal admin-modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-head">
          <div className="admin-modal-title">{coupon ? 'Editar cupón' : 'Crear cupón'}</div>
          <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="admin-banner">
          <p style={{ fontSize: '.92rem', lineHeight: 1.5, color: '#fff', margin: 0 }}>Sin acumulación, el cupón se calcula sobre el precio regular. Siempre se conserva el menor precio disponible para el alumno.</p>
        </div>

        <div className="admin-field-row">
          <div className="admin-field">
            <label>Código del cupón</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej. NETWISE10" />
          </div>
          <div className="admin-field">
            <label>Descuento · %</label>
            <input type="number" min="1" max="100" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} placeholder="10" />
          </div>
        </div>
        <div className="admin-field-row">
          <div className="admin-field">
            <label>Aplicar a</label>
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="all">Todos los cursos</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div className="admin-field">
            <label>Límite de usos</label>
            <input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="100" />
          </div>
        </div>
        <div className="admin-field-row">
          <div className="admin-field">
            <label>Fecha de inicio · opcional</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="admin-field">
            <label>Fecha de fin · opcional</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="admin-field-row">
          <label className="admin-field-checkbox">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Cupón activo
          </label>
          <label className="admin-field-checkbox">
            <input type="checkbox" checked={stackable} onChange={(e) => setStackable(e.target.checked)} /> Acumular con precio promocional
          </label>
        </div>

        <div className="admin-modal-actions">
          <button className="admin-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="admin-btn-edit" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'} <Check size={14} /></button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

const AdminPromociones = () => {
  const { currentUser } = useAuth();
  const { courses } = useCourseOfferings();
  const [coupons, setCoupons] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { mode: 'new' } | { mode: 'edit', coupon }

  const adminName = currentUser?.displayName || currentUser?.email || 'Admin';

  const load = () => fetchCoupons().then((list) => { setCoupons(list); setLoading(false); });
  useEffect(() => { load(); }, []);

  const filtered = coupons.filter((c) => c.code.toLowerCase().includes(search.toLowerCase()));

  const scopeLabel = (scope) => scope === 'all' ? 'Todos los cursos' : (courses.find((c) => c.id.toString() === scope.toString())?.title || scope);
  const vigenciaLabel = (c) => {
    const from = c.startDate ? new Date(c.startDate + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) : 'Sin inicio';
    const to = c.endDate ? `Hasta ${new Date(c.endDate + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}` : 'Hasta sin fecha límite';
    return <>{from}<br />{to}</>;
  };

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Promociones</h1>
          <p className="admin-page-sub">Crea cupones y define su alcance, vigencia y condiciones.</p>
        </div>
        <button className="admin-btn-edit" onClick={() => setModal({ mode: 'new' })}><Plus size={15} /> Crear cupón</button>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={15} />
          <input placeholder="Buscar promociones que impulsan..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="admin-table-wrap">
        {loading ? <div className="admin-empty-hint">Cargando cupones...</div> : filtered.length === 0 ? (
          <div className="admin-empty-hint">Todavía no has creado ningún cupón.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Código</th><th>Cursos</th><th>Descuento</th><th>Vigencia</th><th>Usos</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const status = couponStatus(c);
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="admin-cell-name">{c.code}</div>
                      <div className="admin-cell-sub">{c.stackable ? 'Acumulable con ofertas' : 'No acumulable'}</div>
                    </td>
                    <td>{scopeLabel(c.scope)}</td>
                    <td>{c.discountPercent}%</td>
                    <td className="admin-cell-sub">{vigenciaLabel(c)}</td>
                    <td>{c.usedCount || 0} / {c.maxUses}</td>
                    <td><span className={`admin-status ${status.cls}`}>{status.label}</span></td>
                    <td><button className="admin-icon-btn" onClick={() => setModal({ mode: 'edit', coupon: c })}><Pencil size={14} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <CouponModal
          coupon={modal.mode === 'edit' ? modal.coupon : null}
          courses={courses}
          adminName={adminName}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  );
};

export default AdminPromociones;
