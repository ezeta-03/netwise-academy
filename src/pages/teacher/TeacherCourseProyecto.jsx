import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { X } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import ModalPortal from '../../components/ModalPortal';
import { fetchAllEnrollments, fetchCourseContent, updateEnrollmentFollowUp } from '../../lib/db';
import { courseRoster } from '../../lib/roster';

const FOLLOW_UP = {
  ok: { label: 'Al día', cls: 'admin-status-green' },
  'needs-support': { label: 'Necesita acompañamiento', cls: 'admin-status-amber' },
};

const StudentDetailModal = ({ row, onClose, onSaved }) => {
  const { addToast } = useUI();
  const [followUp, setFollowUp] = useState(row.followUp || 'ok');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateEnrollmentFollowUp(row.id, row.uid, row.courseId, followUp);
      addToast('Seguimiento actualizado.', 'success');
      onSaved();
      onClose();
    } catch {
      addToast('No se pudo actualizar el seguimiento. Intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-head">
          <div>
            <div className="admin-modal-title">{row.studentName}</div>
            <div className="admin-modal-sub">{row.studentEmail}</div>
          </div>
          <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="admin-field"><label>Progreso</label><div className="admin-price">{row.progress}%</div></div>
        <div className="admin-field"><label>Sesiones vistas</label><div>{row.attended} / {row.totalSessions}</div></div>
        <div className="admin-field">
          <label>Seguimiento</label>
          <select value={followUp} onChange={(e) => setFollowUp(e.target.value)}>
            <option value="ok">Al día</option>
            <option value="needs-support">Necesita acompañamiento</option>
          </select>
        </div>
        <div className="admin-modal-actions">
          <button className="admin-btn-ghost" onClick={onClose}>Cerrar</button>
          <button className="admin-btn-edit" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

const TeacherCourseProyecto = () => {
  const { course, group } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const { addToast } = useUI();

  const load = useCallback(() => {
    Promise.all([fetchAllEnrollments(course.id), fetchCourseContent(course.id)]).then(([enrollments, content]) => {
      const totalSessions = (content.modules || []).reduce((sum, m) => sum + (m.lessons?.length || 0), 0) || 1;
      const courseEnrollments = courseRoster(enrollments, course.id).map((r) => enrollments.find((e) => e.uid === r.uid && e.courseId?.toString() === course.id.toString()));
      setRows(courseEnrollments.map((e) => ({
        id: e.id, uid: e.uid, studentName: e.studentName || e.uid, studentEmail: e.studentEmail,
        progress: e.progress || 0, attended: (e.completedLessonIds || []).length, totalSessions,
        followUp: e.followUp || 'ok', courseId: e.courseId,
      })));
      setLoading(false);
    }).catch(() => {
      addToast('No se pudo cargar el seguimiento de alumnos.', 'error');
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="admin-empty-hint">Cargando el proyecto del grupo...</div>;

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Nadie se queda sin un siguiente paso.</h1>
          <p className="admin-page-sub">{group?.name ? `Grupo ${group.name}` : course.title} · {group?.capacity ? `${group.capacity} matriculados` : `${rows.length} matriculados`} · Muestra de {rows.length} estudiantes</p>
        </div>
      </div>

      <div className="admin-table-wrap">
        {rows.length === 0 ? <div className="admin-empty-hint">Todavía no hay alumnos matriculados en este curso.</div> : (
          <table className="admin-table">
            <thead><tr><th>Estudiante</th><th>Progreso</th><th>Asistencia</th><th>Seguimiento</th><th>Acción</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const fu = FOLLOW_UP[r.followUp] || FOLLOW_UP.ok;
                return (
                  <tr key={r.uid}>
                    <td className="admin-cell-name">{r.studentName}</td>
                    <td>{r.progress}%</td>
                    <td>{r.attended}/{r.totalSessions} sesiones</td>
                    <td><span className={`admin-status ${fu.cls}`}>{fu.label}</span></td>
                    <td><button className="admin-btn-ghost" onClick={() => setViewing(r)}>Ver ficha</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {viewing && <StudentDetailModal row={viewing} onClose={() => setViewing(null)} onSaved={load} />}
    </div>
  );
};

export default TeacherCourseProyecto;
