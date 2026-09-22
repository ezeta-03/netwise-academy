import React, { useEffect, useState } from 'react';
import { Search, Plus, Download, X, Pencil, Trash2 } from 'lucide-react';
import ModalPortal from '../../components/ModalPortal';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { fetchAllEnrollments, adminCreateEnrollment, updateEnrollmentAccess, deleteEnrollment, fetchGroups, fetchAllUsers, logChange } from '../../lib/db';
import { downloadCsv } from '../../lib/csv';

const ACCESS_STATUS = {
  active: { label: 'Activo', cls: 'admin-status-green' },
  pending: { label: 'Pendiente', cls: 'admin-status-amber' },
};

const exportEnrollmentsCsv = (rows) => downloadCsv(
  'alumnos-y-accesos.csv',
  ['Alumno', 'Correo', 'Curso', 'Grupo', 'Acceso', 'Motivo'],
  rows.map((r) => [r.studentName || r.uid, r.studentEmail || '', r.courseTitle, r.groupName || '', r.status || 'active', r.reason || '']),
);

const EnrollmentModal = ({ enrollment, courses, groups, adminName, onClose, onSaved }) => {
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
        await adminCreateEnrollment({
          uid: selectedUid || undefined,
          studentName: studentName.trim(), studentEmail: studentEmail.trim(),
          courseId, courseTitle: course?.title || '', groupId: group?.id, groupName: group?.name,
          status, reason,
        });
        await logChange(adminName, `Matriculó a ${studentName} en "${course?.title}".`);
        addToast('Matrícula creada.', 'success');
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
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-head">
          <div className="admin-modal-title">{isEdit ? 'Editar acceso' : 'Nueva matrícula'}</div>
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
            <label>Grupo</label>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Sin asignar</option>
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
          <div className="admin-field"><label>Motivo</label><input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
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
  const { addToast } = useUI();
  const { courses } = useCourseOfferings();
  const [enrollments, setEnrollments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const adminName = currentUser?.displayName || currentUser?.email || 'Admin';

  const load = () => Promise.all([fetchAllEnrollments(), fetchGroups()]).then(([e, g]) => {
    setEnrollments(e); setGroups(g); setLoading(false);
  });
  useEffect(() => { load(); }, []);

  const handleDelete = async (e) => {
    if (!confirm(`¿Eliminar la matrícula de ${e.studentName || e.uid} en "${e.courseTitle}"? Esta acción no se puede deshacer.`)) return;
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
    const matchesSearch = `${e.studentName} ${e.studentEmail} ${e.courseTitle}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (e.status || 'active') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Alumnos y accesos</h1>
          <p className="admin-page-sub">Administra la matrícula y el acceso a cada curso.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="admin-btn-ghost" onClick={() => exportEnrollmentsCsv(filtered)}><Download size={15} /> Exportar CSV</button>
          <button className="admin-btn-edit" onClick={() => setModal({ mode: 'new' })}><Plus size={15} /> Nueva matrícula</button>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search"><Search size={15} /><input placeholder="Buscar acompaña a tus alumnos..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Todos los registros</option>
          <option value="active">Activos</option>
          <option value="pending">Pendientes</option>
        </select>
      </div>

      <div className="admin-table-wrap">
        {loading ? <div className="admin-empty-hint">Cargando alumnos...</div> : filtered.length === 0 ? (
          <div className="admin-empty-hint">Todavía no hay alumnos matriculados.</div>
        ) : (
          <table className="admin-table">
            <thead><tr><th>Alumno</th><th>Curso</th><th>Grupo</th><th>Acceso</th><th>Motivo</th><th>Acciones</th></tr></thead>
            <tbody>
              {filtered.map((e) => {
                const status = ACCESS_STATUS[e.status || 'active'];
                return (
                  <tr key={e.id || `${e.uid}_${e.courseId}`}>
                    <td><div className="admin-cell-name">{e.studentName || e.uid}</div><div className="admin-cell-sub">{e.studentEmail}</div></td>
                    <td>{e.courseTitle}</td>
                    <td className="admin-cell-sub">{e.groupName || '—'}</td>
                    <td><span className={`admin-status ${status.cls}`}>{status.label}</span></td>
                    <td className="admin-cell-sub">{e.reason || '—'}</td>
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
          </table>
        )}
      </div>

      {modal && (
        <EnrollmentModal
          enrollment={modal.mode === 'edit' ? modal.enrollment : null}
          courses={courses}
          groups={groups}
          adminName={adminName}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  );
};

export default AdminAlumnos;
