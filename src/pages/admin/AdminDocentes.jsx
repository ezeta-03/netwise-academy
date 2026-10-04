import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, GraduationCap, KeyRound, BookOpen, Pencil, Ban, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { fetchAllUsers, fetchGroups, updateUserStatus, logChange } from '../../lib/db';
import { TeacherModal, AccessLinkModal } from './TeacherAccess';

const initialsOf = (name) => {
  const parts = String(name || '?').trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
};

// Docentes de la academia: quiénes son, qué cursos y aulas tienen, si su acceso
// está activo, y desde aquí se registran, editan o suspenden. "Cobertura por
// curso" avisa de los cursos que se quedaron sin docente.
const AdminDocentes = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { addToast, confirmDialog } = useUI();
  const { courses, refresh: refreshCourses } = useCourseOfferings();
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modal, setModal] = useState(null); // { teacher } | { teacher: null }
  const [accessFor, setAccessFor] = useState(null);

  const adminName = currentUser?.displayName || currentUser?.email || 'Admin';

  const load = () => Promise.all([fetchAllUsers(), fetchGroups().catch(() => [])]).then(([all, g]) => {
    setUsers((all || []).map((u) => ({
      uid: u.uid, name: u.displayName || u.email, email: u.email, role: u.role || 'student', disabled: !!u.disabled,
      phone: u.phone || '', specialty: u.specialty || '', bio: u.bio || '', permissions: u.permissions || null,
    })));
    setGroups(g);
    setLoading(false);
  }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const teachers = useMemo(() => users.filter((u) => u.role === 'teacher'), [users]);
  const coursesOf = (uid) => courses.filter((c) => c.teacherUid === uid);
  const aulasOf = (uid) => groups.filter((g) => g.instructorUid === uid && g.status !== 'closed');
  const uncovered = courses.filter((c) => !c.teacherUid || !users.some((u) => u.uid === c.teacherUid));

  const filtered = teachers.filter((t) => {
    const text = `${t.name} ${t.email} ${t.specialty} ${coursesOf(t.uid).map((c) => c.title).join(' ')}`.toLowerCase();
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active') === !t.disabled;
    return text.includes(search.toLowerCase()) && matchesStatus;
  });

  const toggleSuspended = async (t) => {
    const next = !t.disabled;
    if (next && !(await confirmDialog({ title: 'Suspender acceso', message: `${t.name} no podrá iniciar sesión hasta que lo reactives. Sus cursos, aulas y calificaciones no se tocan.`, confirmLabel: 'Suspender', danger: true }))) return;
    try {
      await updateUserStatus(t.uid, next);
      await logChange(adminName, `${next ? 'Suspendió' : 'Reactivó'} el acceso del docente ${t.name}.`);
      setUsers((list) => list.map((u) => (u.uid === t.uid ? { ...u, disabled: next } : u)));
      addToast(next ? `Acceso de ${t.name} suspendido.` : `Acceso de ${t.name} reactivado.`, 'success');
    } catch {
      addToast('No se pudo actualizar el acceso.', 'error');
    }
  };

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Docentes de la academia.</h1>
          <p className="admin-page-sub">Registra docentes, crea su acceso a la plataforma y asígnalos a cursos y aulas.</p>
        </div>
        <button className="admin-btn-edit" onClick={() => setModal({ teacher: null })}><Plus size={15} /> Registrar docente</button>
      </div>

      <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="admin-stat-card"><div className="admin-stat-label">Docentes registrados <GraduationCap size={16} /></div><div className="admin-stat-value">{teachers.length}</div></div>
        <div className="admin-stat-card"><div className="admin-stat-label">Con acceso activo <KeyRound size={16} /></div><div className="admin-stat-value">{teachers.filter((t) => !t.disabled).length}</div></div>
        <div className="admin-stat-card"><div className="admin-stat-label">Cursos sin docente <BookOpen size={16} /></div><div className="admin-stat-value">{uncovered.length}</div></div>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search"><Search size={15} /><input placeholder="Buscar por nombre, correo o curso..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrar por estado">
          <option value="all">Todos los estados</option>
          <option value="active">Acceso activo</option>
          <option value="suspended">Suspendidos</option>
        </select>
      </div>

      <div className="admin-table-wrap" style={{ marginBottom: 20 }}>
        {loading ? <div className="admin-empty-hint">Cargando docentes...</div> : filtered.length === 0 ? (
          <div className="admin-empty-hint">{teachers.length === 0 ? 'Todavía no has registrado ningún docente.' : 'Ningún docente coincide con la búsqueda.'}</div>
        ) : (
          <table className="admin-table">
            <thead><tr><th>Docente</th><th>Especialidad</th><th>Cursos asignados</th><th>Aulas</th><th>Acceso</th><th>Acciones</th></tr></thead>
            <tbody>
              {filtered.map((t) => {
                const myCourses = coursesOf(t.uid);
                const myAulas = aulasOf(t.uid);
                return (
                  <tr key={t.uid}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="admin-avatar" aria-hidden="true">{initialsOf(t.name)}</div>
                        <div><div className="admin-cell-name">{t.name}</div><div className="admin-cell-sub">{t.email}{t.phone ? ` · ${t.phone}` : ''}</div></div>
                      </div>
                    </td>
                    <td className="admin-cell-sub">{t.specialty || '—'}</td>
                    <td>
                      {myCourses.length === 0 ? <span className="admin-cell-sub">Sin cursos</span> : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {myCourses.map((c) => <span key={c.id} className="admin-status admin-status-violet">{c.title}</span>)}
                        </div>
                      )}
                    </td>
                    <td className="admin-cell-sub">
                      {myAulas.length === 0 ? '—' : myAulas.map((g) => <div key={g.id}>{g.name}{g.scheduleTime ? ` · ${g.scheduleTime}` : ''}</div>)}
                    </td>
                    <td><span className={`admin-status ${t.disabled ? 'admin-status-gray' : 'admin-status-green'}`}>{t.disabled ? 'Suspendido' : 'Acceso activo'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="admin-btn-ghost" onClick={() => setModal({ teacher: t })}><Pencil size={13} /> Editar</button>
                        <button className="admin-btn-ghost" onClick={() => toggleSuspended(t)}>{t.disabled ? <><RotateCcw size={13} /> Reactivar</> : <><Ban size={13} /> Suspender</>}</button>
                        <button className="admin-icon-btn" onClick={() => setAccessFor({ user: t })} title="Enlace de acceso (crear o recuperar contraseña)" aria-label={`Enlace de acceso de ${t.name}`}><KeyRound size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="admin-footnote"><span>{filtered.length} docente{filtered.length === 1 ? '' : 's'}</span><span>Para eliminar una cuenta, usa Equipo y permisos</span></div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <span className="admin-panel-title">Cobertura por curso</span>
          <a className="admin-panel-link" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/cursos')}>Ver cursos</a>
        </div>
        {courses.map((c) => {
          const teacher = users.find((u) => u.uid === c.teacherUid);
          return (
            <div key={c.id} className="dash-list-row">
              <div><div className="dash-list-row-title">{c.title}</div><div className="dash-list-row-sub">{teacher ? teacher.name : 'Nadie a cargo todavía'}</div></div>
              <span className={`admin-status ${teacher ? 'admin-status-green' : 'admin-status-amber'}`}>{teacher ? '1 docente' : 'Sin docente'}</span>
            </div>
          );
        })}
      </div>

      {modal && (
        <TeacherModal
          teacher={modal.teacher} users={users} courses={courses} adminName={adminName}
          onClose={() => setModal(null)}
          onSaved={async () => { await load(); await refreshCourses(); }}
          onCreated={(user) => setAccessFor({ user, intro: 'Docente registrado: envíale su enlace' })}
        />
      )}
      {accessFor && (
        <AccessLinkModal
          user={accessFor.user} intro={accessFor.intro} onClose={() => setAccessFor(null)}
          onPhoneSaved={(uid, phone) => setUsers((list) => list.map((u) => (u.uid === uid ? { ...u, phone } : u)))}
        />
      )}
    </div>
  );
};

export default AdminDocentes;
