import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Download, Eye, FileText, X } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import ModalPortal from '../../components/ModalPortal';
import { fetchAllEnrollments, fetchCourseProjectProfiles } from '../../lib/db';
import { aulaRoster } from '../../lib/roster';
import { usePagedTable } from '../../hooks/usePagedTable';

const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }).replace(/\./g, '') : '');
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

const STATUS = {
  ficha: { label: 'Ficha subida', cls: 'admin-status-green' },
  noFicha: { label: 'Sin ficha', cls: 'admin-status-amber' },
  none: { label: 'Sin proyecto', cls: 'admin-status-gray' },
};
const statusOf = (p) => (!p ? 'none' : p.fichaUrl ? 'ficha' : 'noFicha');

// Ver proyecto (D8): la empresa del alumno, su descripción y la ficha.
const ProjectModal = ({ row, onClose }) => {
  const p = row.profile;
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
          <div className="admin-field">
            <label>Empresa, marca o idea</label>
            <div className="dash-list-row-title">{p.name}</div>
          </div>
          {(p.description || p.activity) && (
            <div className="admin-field"><label>Breve descripción</label><p style={{ margin: 0, color: '#4A4860', fontSize: '.88rem', lineHeight: 1.5 }}>{p.description || p.activity}</p></div>
          )}
          <div className="admin-field">
            <label>Ficha de proyecto</label>
            {p.fichaUrl ? (
              <div className="ficha-file">
                <FileText size={18} />
                <div className="ficha-file-body">
                  <div className="dash-list-row-title">{p.fichaName || 'Ficha de proyecto'}</div>
                  <div className="admin-cell-sub">{p.fichaUploadedAt ? `Subida el ${fmtDay(p.fichaUploadedAt)}` : 'Ficha de proyecto'}</div>
                </div>
                <a className="admin-btn-edit" href={p.fichaUrl} target="_blank" rel="noreferrer"><Download size={13} /> Descargar</a>
              </div>
            ) : (
              <p className="admin-cell-sub" style={{ margin: 0 }}>Todavía no subió la ficha.</p>
            )}
          </div>
          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

// Proyectos (D8): los alumnos del aula con la empresa de cada uno y si ya
// subieron la ficha de proyecto. Desde aquí se descarga la ficha o se abre
// "Ver proyecto".
const TeacherCourseProyectos = () => {
  const { course, group, groups, aulaId } = useOutletContext();
  const { addToast } = useUI();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [viewing, setViewing] = useState(null);

  const load = useCallback(() => {
    Promise.all([fetchAllEnrollments(course.id), fetchCourseProjectProfiles(course.id)]).then(([enrollments, profiles]) => {
      const byUid = new Map(profiles.filter((p) => p?.uid).map((p) => [p.uid, p]));
      const roster = aulaRoster(enrollments, course.id, groups, aulaId);
      setRows(roster.map((r) => {
        const e = enrollments.find((x) => x.uid === r.uid && x.courseId?.toString() === course.id.toString()) || r;
        const profile = byUid.get(r.uid) || null;
        return { uid: r.uid, studentName: e.studentName || profile?.studentName || r.uid, studentEmail: e.studentEmail || profile?.studentEmail || '', profile, status: statusOf(profile) };
      }).sort((a, b) => String(a.studentName).localeCompare(String(b.studentName), 'es')));
      setLoading(false);
    }).catch(() => {
      addToast('No se pudieron cargar los proyectos del aula.', 'error');
      setLoading(false);
    });
    // Se recarga al cambiar de aula (o cuando llegan las aulas del curso).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id, aulaId, groups?.length]);

  useEffect(() => { load(); }, [load]);

  const counts = { ficha: rows.filter((r) => r.status === 'ficha').length, pending: rows.filter((r) => r.status !== 'ficha').length };
  const shown = rows.filter((r) => filter === 'all' || (filter === 'ficha' ? r.status === 'ficha' : r.status !== 'ficha'));
  const { rows: pageRows, pager, tableRef } = usePagedTable(shown, { label: 'alumnos' });

  if (loading) return <div className="admin-empty-hint">Cargando los proyectos del aula...</div>;

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Proyectos</h1>
          <p className="admin-page-sub">{course.title}{group?.name ? ` · ${group.name}` : ''} · La empresa de cada alumno y su ficha de proyecto.</p>
        </div>
      </div>

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="admin-panel-head" style={{ marginBottom: 4 }}>
          <span className="admin-panel-title">Proyectos de tus alumnos</span>
          <span className="admin-cell-sub">{counts.ficha} de {rows.length} con ficha</span>
        </div>
        <p className="admin-panel-caption" style={{ marginTop: 0 }}>Cada alumno crea su proyecto subiendo la ficha que compartes en Materiales del curso.</p>

        <div className="admin-chips">
          <button className={`admin-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Todos <span>{rows.length}</span></button>
          <button className={`admin-chip ${filter === 'ficha' ? 'active' : ''}`} onClick={() => setFilter('ficha')}>Con ficha <span>{counts.ficha}</span></button>
          <button className={`admin-chip ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>Sin ficha <span>{counts.pending}</span></button>
        </div>

        {rows.length === 0 ? <div className="admin-empty-hint">Todavía no hay alumnos en esta aula.</div>
          : shown.length === 0 ? <div className="admin-empty-hint">No hay alumnos en este filtro.</div> : (
            <div className="admin-table-wrap" style={{ margin: 0 }}>
              <table ref={tableRef} className="admin-table table-cards">
                <thead><tr><th>Alumno</th><th>Empresa</th><th>Ficha</th><th>Subida</th><th>Acción</th></tr></thead>
                <tbody>
                  {pageRows.map((r) => {
                    const st = STATUS[r.status];
                    return (
                      <tr key={r.uid}>
                        <td>
                          <div className="project-student">
                            <span className="project-avatar">{initials(r.studentName)}</span>
                            <div><div className="admin-cell-name">{r.studentName}</div>{r.studentEmail && <div className="admin-cell-sub">{r.studentEmail}</div>}</div>
                          </div>
                        </td>
                        <td>{r.profile?.name ? <><div className="dash-list-row-title">{r.profile.name}</div>{r.profile.description && <div className="admin-cell-sub project-desc">{r.profile.description}</div>}</> : <span className="admin-cell-sub">Aún no lo crea</span>}</td>
                        <td><span className={`admin-status ${st.cls}`}>{st.label}</span></td>
                        <td className="admin-cell-sub">{fmtDay(r.profile?.fichaUploadedAt) || '—'}</td>
                        <td>
                          <div className="project-actions">
                            {r.profile?.fichaUrl && <a className="admin-btn-ghost" href={r.profile.fichaUrl} target="_blank" rel="noreferrer" title="Descargar la ficha"><Download size={13} /> Ficha</a>}
                            {r.profile && <button className="admin-btn-ghost" onClick={() => setViewing(r)}><Eye size={13} /> Ver proyecto</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {pager}
            </div>
          )}
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head" style={{ marginBottom: 4 }}><span className="admin-panel-title">Cómo funciona</span></div>
        <div className="dash-notice" style={{ display: 'block' }}>
          Sube la ficha de proyecto en blanco en Materiales del curso (con "ficha" en el nombre). El alumno la descarga, la llena y la sube en Mi proyecto junto con el nombre de su empresa y una breve descripción. Aquí ves quién ya la subió.
        </div>
      </div>

      {viewing && <ProjectModal row={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
};

export default TeacherCourseProyectos;
