import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Download, X, Pencil, Trash2 } from 'lucide-react';
import ModalPortal from '../../components/ModalPortal';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { fetchAllEnrollments, adminCreateEnrollment, updateEnrollmentAccess, deleteEnrollment, fetchGroups, fetchAllUsers, fetchOrders, logChange } from '../../lib/db';
import { unassignedEnrollments } from '../../lib/groupAssignment';
import { downloadCsv } from '../../lib/csv';
import { usePagedTable } from '../../hooks/usePagedTable';

const ACCESS_STATUS = {
  active: { label: 'Activo', cls: 'admin-status-green' },
  pending: { label: 'Pendiente', cls: 'admin-status-amber' },
};

const PAYMENT_SHORT = { yape: 'Yape/Plin', transfer: 'Transferencia', card: 'Tarjeta' };
const fmtDay = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Pago de una matrícula: el pedido pagado de ese alumno y curso, si existe.
const paymentOf = (e, orders) => orders.find((o) => o.status === 'paid' && o.uid === e.uid && o.courseId?.toString() === e.courseId?.toString()) || null;
const paymentLabel = (order) => (order ? [PAYMENT_SHORT[order.paymentMethod] || 'Pago', fmtDay(order.createdAt)].filter(Boolean).join(' · ') : '');

const exportEnrollmentsCsv = (rows, orders) => downloadCsv(
  'alumnos-y-accesos.csv',
  ['Alumno', 'Correo', 'Curso', 'Aula', 'Pago', 'Acceso', 'Motivo'],
  rows.map((r) => [r.studentName || r.uid, r.studentEmail || '', r.courseTitle, r.groupName || '', paymentLabel(paymentOf(r, orders)), r.status || 'active', r.reason || '']),
);

// "Asignar aula": ubica en un aula a un alumno que ya pagó, sin tocar nada más.
const AssignGroupModal = ({ enrollment, groups, adminName, onClose, onSaved }) => {
  const { addToast } = useUI();
  const courseGroups = groups.filter((g) => g.courseId?.toString() === enrollment.courseId?.toString());
  const [groupId, setGroupId] = useState(enrollment.groupId || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const group = courseGroups.find((g) => g.id === groupId);
      await updateEnrollmentAccess(enrollment.id, enrollment.uid, enrollment.courseId, { status: enrollment.status || 'active', groupId: group?.id, groupName: group?.name, reason: enrollment.reason || '' });
      await logChange(adminName, group ? `Asignó a ${enrollment.studentName} al aula "${group.name}".` : `Dejó a ${enrollment.studentName} sin aula en "${enrollment.courseTitle}".`);
      addToast(group ? `Asignado al aula ${group.name}.` : 'Quedó sin aula.', 'success');
      onSaved();
      onClose();
    } catch {
      addToast('No se pudo asignar el aula.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="admin-modal-overlay">
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head">
            <div>
              <div className="admin-modal-title">Asignar aula</div>
              <div className="admin-modal-sub">{enrollment.studentName || enrollment.uid}</div>
            </div>
            <button className="admin-modal-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
          </div>
          <div className="admin-field-row">
            <div className="admin-field"><label>Curso</label><input value={enrollment.courseTitle || ''} readOnly disabled /></div>
            <div className="admin-field">
              <label htmlFor="assign-aula">Aula</label>
              <select id="assign-aula" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">Sin aula</option>
                {courseGroups.map((g) => <option key={g.id} value={g.id}>{g.name}{g.startDate ? ` · inicia ${fmtDay(g.startDate)}` : ''}</option>)}
              </select>
            </div>
          </div>
          {courseGroups.length === 0 && <p className="admin-panel-caption">Este curso todavía no tiene aulas: créala en Aulas y horarios.</p>}
          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="admin-btn-edit" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

const EnrollmentModal = ({ enrollment, courses, groups, payment, adminName, onClose, onSaved }) => {
  const { addToast } = useUI();
  const isEdit = !!enrollment;
  const [students, setStudents] = useState([]);
  const [selectedUid, setSelectedUid] = useState('');
  const [studentName, setStudentName] = useState(enrollment?.studentName || '');
  const [studentEmail, setStudentEmail] = useState(enrollment?.studentEmail || '');
  const [courseId, setCourseId] = useState(enrollment?.courseId ?? courses[0]?.id ?? '');
  const [groupId, setGroupId] = useState(enrollment?.groupId || '');
  const [status, setStatus] = useState(enrollment?.status || 'active');
  const [reason, setReason] = useState(enrollment?.reason || 'Matrícula de ejemplo');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) return;
    fetchAllUsers().then((users) => setStudents((users || []).filter((u) => u.role === 'student')));
  }, [isEdit]);

  const courseGroups = groups.filter((g) => g.courseId?.toString() === courseId?.toString());

  const handleSelectStudent = (uid) => {
    setSelectedUid(uid);
    const user = students.find((u) => u.uid === uid);
    if (user) { setStudentName(user.displayName || ''); setStudentEmail(user.email || ''); }
  };

  const handleSave = async () => {
    if (!studentName.trim() || !studentEmail.trim()) { addToast('Nombre y correo son obligatorios.', 'error'); return; }
    setSaving(true);
    try {
      const course = courses.find((c) => c.id.toString() === courseId.toString());
      const group = courseGroups.find((g) => g.id === groupId);
      if (isEdit) {
        await updateEnrollmentAccess(enrollment.id, enrollment.uid, enrollment.courseId, { status, groupId: group?.id, groupName: group?.name, reason });
        await logChange(adminName, `Actualizó el acceso de ${studentName} a "${course?.title}".`);
        addToast('Acceso actualizado.', 'success');
      } else {
        const created = await adminCreateEnrollment({
          uid: selectedUid || undefined,
          studentName: studentName.trim(), studentEmail: studentEmail.trim(),
          courseId: course?.id ?? courseId, courseTitle: course?.title || '', groupId: group?.id, groupName: group?.name,
          status, reason,
        });
        await logChange(adminName, `Matriculó a ${studentName} en "${course?.title}".`);
        addToast(created?.groupName ? `Matrícula creada en el aula ${created.groupName}.` : 'Matrícula creada.', 'success');
      }
      onSaved();
      onClose();
    } catch {
      addToast('No se pudo guardar la matrícula.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
    <div className="admin-modal-overlay">
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-head">
          <div>
            <div className="admin-modal-title">{isEdit ? 'Editar matrícula' : 'Nueva matrícula'}</div>
            {isEdit && <div className="admin-modal-sub">{enrollment.studentName || enrollment.uid}</div>}
          </div>
          <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {!isEdit && (
          <>
            <div className="admin-field">
              <label>Alumno ya registrado · opcional</label>
              <select value={selectedUid} onChange={(e) => handleSelectStudent(e.target.value)}>
                <option value="">Escribir datos manualmente (sin cuenta todavía)</option>
                {students.map((u) => <option key={u.uid} value={u.uid}>{u.displayName || u.email} · {u.email}</option>)}
              </select>
              <p className="admin-panel-caption" style={{ marginTop: 4, marginBottom: 0 }}>
                Elige uno si ya tiene cuenta en la plataforma -- así la matrícula queda conectada a su usuario real. Si todavía no se registra, deja esto en blanco y llena los datos abajo.
              </p>
            </div>
            <div className="admin-field-row">
              <div className="admin-field"><label>Nombre del alumno</label><input value={studentName} onChange={(e) => { setStudentName(e.target.value); setSelectedUid(''); }} /></div>
              <div className="admin-field"><label>Correo</label><input type="email" value={studentEmail} onChange={(e) => { setStudentEmail(e.target.value); setSelectedUid(''); }} /></div>
            </div>
          </>
        )}
        <div className="admin-field-row">
          <div className="admin-field">
            <label>Curso</label>
            <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setGroupId(''); }} disabled={isEdit}>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div className="admin-field">
            <label>Aula</label>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">{isEdit ? 'Sin aula' : 'Automática (próxima aula con cupos)'}</option>
              {courseGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>
        <div className="admin-field-row">
          <div className="admin-field">
            <label>Acceso</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Activo</option>
              <option value="pending">Pendiente</option>
            </select>
          </div>
          {isEdit
            ? <div className="admin-field"><label>Pago</label><input value={payment || reason || 'Sin pedido registrado'} readOnly disabled /></div>
            : <div className="admin-field"><label>Motivo</label><input value={reason} onChange={(e) => setReason(e.target.value)} /></div>}
        </div>

        <div className="admin-modal-actions">
          <button className="admin-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="admin-btn-edit" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

const AdminAlumnos = () => {
  const { currentUser } = useAuth();
  const { addToast, confirmDialog } = useUI();
  const { courses } = useCourseOfferings();
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [assigning, setAssigning] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const adminName = currentUser?.displayName || currentUser?.email || 'Admin';

  const load = () => Promise.all([fetchAllEnrollments(), fetchGroups(), fetchOrders().catch(() => [])]).then(([e, g, o]) => {
    setEnrollments(e); setGroups(g); setOrders(o); setLoading(false);
  });
  useEffect(() => { load(); }, []);

  const handleDelete = async (e) => {
    if (!(await confirmDialog({ title: 'Eliminar matrícula', message: `¿Eliminar la matrícula de ${e.studentName || e.uid} en "${e.courseTitle}"? Esta acción no se puede deshacer.`, confirmLabel: 'Eliminar', danger: true }))) return;
    try {
      await deleteEnrollment(e);
      await logChange(adminName, `Eliminó la matrícula de ${e.studentName || e.uid} en "${e.courseTitle}".`);
      addToast('Matrícula eliminada.', 'success');
      load();
    } catch {
      addToast('No se pudo eliminar la matrícula.', 'error');
    }
  };

  const filtered = enrollments.filter((e) => {
    const matchesSearch = `${e.studentName} ${e.studentEmail} ${e.courseTitle} ${e.groupName || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (e.status || 'active') === statusFilter;
    const matchesCourse = courseFilter === 'all' || e.courseId?.toString() === courseFilter;
    return matchesSearch && matchesStatus && matchesCourse;
  });
  const { rows: pageRows, pager, tableRef } = usePagedTable(filtered, { label: 'matrículas' });

  // Alumnos activos sin aula válida (misma regla que Aulas > Asignar alumnos).
  const withoutAula = unassignedEnrollments(enrollments, groups);
  const validGroup = (e) => groups.find((g) => g.id === e.groupId && g.courseId?.toString() === e.courseId?.toString()) || null;

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Alumnos y accesos</h1>
          <p className="admin-page-sub">Matrículas pagadas de cada curso y el aula asignada a cada alumno.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="admin-btn-ghost" onClick={() => exportEnrollmentsCsv(filtered, orders)}><Download size={15} /> Exportar CSV</button>
          <button className="admin-btn-edit" onClick={() => setModal({ mode: 'new' })}><Plus size={15} /> Nueva matrícula</button>
        </div>
      </div>

      {withoutAula.length > 0 && (
        <div className="dash-notice warn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span><strong>{withoutAula.length} alumno{withoutAula.length === 1 ? '' : 's'} pagado{withoutAula.length === 1 ? '' : 's'}</strong> todavía no {withoutAula.length === 1 ? 'tiene' : 'tienen'} aula.</span>
          <button className="admin-btn-edit" onClick={() => navigate('/admin/grupos', { state: { tab: 'asignar' } })}>Asignar alumnos a aulas</button>
        </div>
      )}

      <div className="admin-toolbar">
        <div className="admin-search"><Search size={15} /><input placeholder="Buscar por alumno, correo, curso o aula..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select className="admin-select" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} aria-label="Filtrar por curso">
          <option value="all">Todos los cursos</option>
          {courses.map((c) => <option key={c.id} value={c.id.toString()}>{c.title}</option>)}
        </select>
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrar por acceso">
          <option value="all">Todos los accesos</option>
          <option value="active">Activos</option>
          <option value="pending">Pendientes</option>
        </select>
      </div>

      <div className="admin-table-wrap">
        {loading ? <div className="admin-empty-hint">Cargando alumnos...</div> : filtered.length === 0 ? (
          <div className="admin-empty-hint">Todavía no hay alumnos matriculados.</div>
        ) : (
          <><table ref={tableRef} className="admin-table table-cards">
            <thead><tr><th>Alumno</th><th>Curso</th><th>Aula</th><th>Pago</th><th>Acceso</th><th>Acciones</th></tr></thead>
            <tbody>
              {pageRows.map((e) => {
                const status = ACCESS_STATUS[e.status || 'active'] || ACCESS_STATUS.pending;
                const group = validGroup(e);
                const order = paymentOf(e, orders);
                return (
                  <tr key={e.id || `${e.uid}_${e.courseId}`}>
                    <td><div className="admin-cell-name">{e.studentName || e.uid}</div><div className="admin-cell-sub">{e.studentEmail}{e.demo ? ' · ejemplo' : ''}</div></td>
                    <td>{e.courseTitle}</td>
                    <td>
                      {group ? (
                        <><div className="admin-cell-name">{group.name}</div>{group.startDate && <div className="admin-cell-sub">Inicia {fmtDay(group.startDate)}</div>}</>
                      ) : (
                        <button className="admin-btn-ghost" style={{ color: '#B45309', borderColor: '#F5D9A8', padding: '5px 10px', fontSize: '.78rem' }} onClick={() => setAssigning(e)}>Asignar aula</button>
                      )}
                    </td>
                    <td>
                      {order
                        ? <><span className="admin-status admin-status-green">Pagado</span><div className="admin-cell-sub" style={{ marginTop: 4 }}>{paymentLabel(order)}</div></>
                        : <><span className="admin-status admin-status-gray">Sin pedido</span><div className="admin-cell-sub" style={{ marginTop: 4 }}>{e.reason || 'Matrícula manual'}</div></>}
                    </td>
                    <td><span className={`admin-status ${status.cls}`}>{status.label}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="admin-icon-btn" onClick={() => setModal({ mode: 'edit', enrollment: e })} title="Editar"><Pencil size={14} /></button>
                        <button className="admin-icon-btn" onClick={() => handleDelete(e)} title="Eliminar" style={{ color: '#BE123C' }}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>{pager}</>
        )}
      </div>

      {modal && (
        <EnrollmentModal
          enrollment={modal.mode === 'edit' ? modal.enrollment : null}
          courses={courses}
          groups={groups}
          payment={modal.mode === 'edit' ? paymentLabel(paymentOf(modal.enrollment, orders)) : ''}
          adminName={adminName}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
      {assigning && <AssignGroupModal enrollment={assigning} groups={groups} adminName={adminName} onClose={() => setAssigning(null)} onSaved={load} />}
    </div>
  );
};

export default AdminAlumnos;
