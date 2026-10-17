import React, { useEffect, useState } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import ModalPortal from '../../components/ModalPortal';
import { useUI } from '../../context/UIContext';
import { fetchAllUsers, createStudentAccount, createOrder, adminCreateEnrollment, logChange } from '../../lib/db';
import { toPeruMobile, isEmailFormat } from '../../lib/phone';

const SALE_PAYMENT_METHODS = [
  { id: 'yape', label: 'Yape / Plin' },
  { id: 'transfer', label: 'Transferencia bancaria' },
  { id: 'card', label: 'Tarjeta' },
  { id: 'cash', label: 'Efectivo' },
  { id: 'other', label: 'Otro medio' },
];

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Venta hecha fuera de la web (pago por WhatsApp, en efectivo...): el admin la
// registra y queda igual que una compra por la web ya validada -- un pedido
// "Pagada" en Pedidos y pagos y la matrícula activa en Alumnos y accesos, en
// el aula elegida o en la próxima con cupos. Si el alumno todavía no tiene
// cuenta, se le crea; `onCreated(order, { student, newAccount })` deja al
// llamador abrir su enlace de acceso.
const RegisterSaleModal = ({ courses, groups, adminName, onClose, onCreated }) => {
  const { addToast } = useUI();
  const [mode, setMode] = useState('existing'); // 'existing' | 'new'
  const [students, setStudents] = useState(null);
  const [filter, setFilter] = useState('');
  const [selectedUid, setSelectedUid] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [courseId, setCourseId] = useState(String(courses[0]?.id ?? ''));
  const [groupId, setGroupId] = useState('');
  const [amount, setAmount] = useState(courses[0]?.price != null ? String(courses[0].price) : '');
  const [paymentMethod, setPaymentMethod] = useState('yape');
  const [proofCode, setProofCode] = useState('');
  const [paidOn, setPaidOn] = useState(todayLocal());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAllUsers()
      .then((users) => setStudents((users || [])
        .filter((u) => u.role === 'student' && !u.disabled)
        .sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''))))
      .catch(() => setStudents([]));
  }, []);

  const course = courses.find((c) => String(c.id) === courseId);
  const courseGroups = groups.filter((g) => String(g.courseId) === courseId && g.status !== 'closed');
  const visibleStudents = (students || []).filter((u) => `${u.displayName || ''} ${u.email || ''}`.toLowerCase().includes(filter.trim().toLowerCase()));
  const selected = (students || []).find((u) => u.uid === selectedUid);

  const changeCourse = (id) => {
    setCourseId(id);
    setGroupId('');
    const next = courses.find((c) => String(c.id) === id);
    if (next?.price != null) setAmount(String(next.price));
  };

  const handleSave = async () => {
    setError('');
    if (mode === 'existing' && !selected) { setError('Elige al alumno.'); return; }
    if (mode === 'new') {
      if (name.trim().length < 3) { setError('Escribe el nombre completo del alumno.'); return; }
      if (!isEmailFormat(email)) { setError('Escribe un correo válido.'); return; }
      if (!toPeruMobile(phone)) { setError('El celular debe tener 9 dígitos y empezar con 9.'); return; }
      const taken = (students || []).find((u) => (u.email || '').toLowerCase() === email.trim().toLowerCase());
      if (taken) { setError(`Ese correo ya tiene cuenta (${taken.displayName || taken.email}). Elígelo en "Ya tiene cuenta".`); return; }
    }
    if (!course) { setError('Elige el curso.'); return; }
    const value = Number(amount);
    if (amount === '' || !(value >= 0)) { setError('Escribe el importe pagado.'); return; }
    if (!paidOn) { setError('Indica la fecha del pago.'); return; }

    setSaving(true);
    try {
      const student = mode === 'existing'
        ? { uid: selected.uid, name: selected.displayName || selected.email, email: selected.email, phone: selected.phone || '' }
        : { uid: (await createStudentAccount({ name, email, phone: toPeruMobile(phone) })).uid, name: name.trim(), email: email.trim().toLowerCase(), phone: toPeruMobile(phone) };
      const group = courseGroups.find((g) => g.id === groupId) || null;
      const order = await createOrder({
        uid: student.uid, studentName: student.name, studentEmail: student.email,
        courseId: course.id, courseTitle: course.title, amount: value, status: 'paid',
        paymentMethod, proofCode: proofCode.trim() || null,
        // Mediodía del día elegido: la fecha no cambia al verla en otra zona horaria.
        createdAt: new Date(`${paidOn}T12:00:00`).toISOString(),
        extra: { manual: true, registeredBy: adminName, registeredAt: new Date().toISOString(), note: note.trim() || null },
      });
      const enrollment = await adminCreateEnrollment({
        uid: student.uid, studentName: student.name, studentEmail: student.email,
        courseId: course.id, courseTitle: course.title, groupId: group?.id || null, groupName: group?.name || null,
        status: 'active', reason: `Venta registrada por el admin (pedido ${order.code})`,
      });
      await logChange(adminName, `Registró la venta ${order.code}: ${student.name} en "${course.title}" por S/ ${value.toFixed(2)} (pago externo).`).catch(() => {});
      const groupName = group?.name || enrollment?.groupName;
      addToast(groupName ? `Venta registrada. ${student.name} ya tiene acceso (aula ${groupName}).` : 'Venta registrada. No hay aula con cupos: asígnalo en Aulas y horarios.', groupName ? 'success' : 'warning');
      onCreated(order, { student, newAccount: mode === 'new' });
    } catch (err) {
      setError(err?.code === 'auth/invalid-email' ? 'Ese correo no es válido.' : 'No se pudo registrar la venta. Intenta de nuevo.');
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="admin-modal-overlay">
        <div className="admin-modal admin-modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head">
            <div>
              <div className="admin-modal-title">Registrar venta</div>
              <div className="admin-modal-sub">Para un pago hecho fuera de la web. Queda como pedido pagado y el alumno se matricula.</div>
            </div>
            <button className="admin-modal-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
          </div>

          <div className="admin-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'existing'} className={`admin-tab ${mode === 'existing' ? 'active' : ''}`} onClick={() => { setMode('existing'); setError(''); }}>Ya tiene cuenta</button>
            <button type="button" role="tab" aria-selected={mode === 'new'} className={`admin-tab ${mode === 'new' ? 'active' : ''}`} onClick={() => { setMode('new'); setError(''); }}>Alumno nuevo</button>
          </div>

          {mode === 'existing' ? (
            <div className="admin-field">
              <label htmlFor="sale-student">Alumno</label>
              <input placeholder="Buscar por nombre o correo..." value={filter} onChange={(e) => setFilter(e.target.value)} style={{ marginBottom: 6 }} />
              <select id="sale-student" value={selectedUid} onChange={(e) => setSelectedUid(e.target.value)} disabled={!students}>
                <option value="">{students ? `Elige un alumno (${visibleStudents.length})` : 'Cargando alumnos...'}</option>
                {visibleStudents.map((u) => <option key={u.uid} value={u.uid}>{u.displayName || u.email} · {u.email}</option>)}
              </select>
            </div>
          ) : (
            <>
              <div className="admin-field"><label htmlFor="sale-name">Nombre completo</label><input id="sale-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
              <div className="admin-field-row">
                <div className="admin-field"><label htmlFor="sale-email">Correo</label><input id="sale-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} /></div>
                <div className="admin-field"><label htmlFor="sale-phone">Celular</label><input id="sale-phone" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9XX XXX XXX" maxLength={16} /></div>
              </div>
              <p className="admin-panel-caption" style={{ marginTop: -4 }}>Se le crea su cuenta y al terminar te damos su enlace para que cree su contraseña.</p>
            </>
          )}

          <div className="admin-field-row">
            <div className="admin-field">
              <label htmlFor="sale-course">Curso</label>
              <select id="sale-course" value={courseId} onChange={(e) => changeCourse(e.target.value)}>
                {courses.map((c) => <option key={c.id} value={String(c.id)}>{c.title}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="sale-group">Aula</label>
              <select id="sale-group" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">Automática (próxima aula con cupos)</option>
                {courseGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>
          <div className="admin-field-row">
            <div className="admin-field"><label htmlFor="sale-amount">Importe pagado (S/)</label><input id="sale-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="admin-field"><label htmlFor="sale-date">Fecha del pago</label><input id="sale-date" type="date" value={paidOn} max={todayLocal()} onChange={(e) => setPaidOn(e.target.value)} /></div>
          </div>
          <div className="admin-field-row">
            <div className="admin-field">
              <label htmlFor="sale-method">Medio de pago</label>
              <select id="sale-method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {SALE_PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div className="admin-field"><label htmlFor="sale-proof">N.° de operación · opcional</label><input id="sale-proof" value={proofCode} onChange={(e) => setProofCode(e.target.value)} maxLength={60} /></div>
          </div>
          <div className="admin-field"><label htmlFor="sale-note">Nota · opcional</label><input id="sale-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. Pagó por WhatsApp con Yape" maxLength={200} /></div>

          {error && <div className="checkout-error" role="alert">{error}</div>}

          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="admin-btn-edit" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />} {saving ? 'Registrando...' : 'Registrar venta'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default RegisterSaleModal;
