import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, X, Pencil } from 'lucide-react';
import ModalPortal from '../../components/ModalPortal';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { fetchTeamMembers, createTeamMember, updateTeamMember, fetchAllUsers, updateUserRole, logChange } from '../../lib/db';

const ROLE_BADGE = {
  Administrador: 'admin-status-green',
  Académico: 'admin-status-amber',
  Editor: 'admin-status-gray',
};

// Lista de demo: se reemplaza automáticamente por los docs reales de
// Firestore (`users`) en cuanto hay un proyecto Firebase conectado.
const MOCK_USER_ROWS = [
  { id: 1, uid: 'mock-1', name: 'Ana Estudiante', email: 'demo@netwise.com', role: 'student', joined: '12 Ene 2024' },
  { id: 2, uid: 'mock-2', name: 'Carlos Profesor', email: 'profe@netwise.com', role: 'teacher', joined: '03 Mar 2023' },
  { id: 3, uid: 'mock-3', name: 'System Admin', email: 'admin@netwise.com', role: 'admin', joined: '01 Ene 2023' },
  { id: 4, uid: 'mock-4', name: 'Luis García', email: 'luis@netwise.com', role: 'student', joined: '28 Feb 2024' },
];

const formatJoined = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
};

const MemberModal = ({ member, adminName, onClose, onSaved }) => {
  const { addToast } = useUI();
  const [name, setName] = useState(member?.name || '');
  const [email, setEmail] = useState(member?.email || '');
  const [roleLabel, setRoleLabel] = useState(member?.roleLabel || 'Editor');
  const [scope, setScope] = useState(member?.scope || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) { addToast('Nombre y correo son obligatorios.', 'error'); return; }
    setSaving(true);
    try {
      const payload = { name: name.trim(), email: email.trim(), roleLabel, scope: scope.trim() || 'Sin alcance definido' };
      if (member) {
        await updateTeamMember(member.id, payload);
        await logChange(adminName, `Editó a ${payload.name} en el equipo.`);
        addToast('Miembro actualizado.', 'success');
      } else {
        await createTeamMember(payload);
        await logChange(adminName, `Añadió a ${payload.name} al equipo.`);
        addToast('Miembro añadido.', 'success');
      }
      onSaved();
      onClose();
    } catch {
      addToast('No se pudo guardar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-head">
          <div className="admin-modal-title">{member ? 'Editar miembro' : 'Añadir miembro'}</div>
          <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="admin-field-row">
          <div className="admin-field"><label>Nombre</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="admin-field"><label>Correo</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        </div>
        <div className="admin-field">
          <label>Rol</label>
          <select value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)}>
            <option value="Administrador">Administrador</option>
            <option value="Académico">Académico</option>
            <option value="Editor">Editor</option>
          </select>
        </div>
        <div className="admin-field"><label>Alcance propuesto</label><input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Ej. Aulas, alumnos y recursos" /></div>

        <div className="admin-modal-actions">
          <button className="admin-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="admin-btn-edit" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

const AdminEquipo = () => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const [users, setUsers] = useState(MOCK_USER_ROWS);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const adminName = currentUser?.displayName || currentUser?.email || 'Admin';

  const load = () => fetchTeamMembers().then((list) => { setMembers(list); setLoading(false); });
  useEffect(() => { load(); }, []);

  useEffect(() => {
    fetchAllUsers().then((realUsers) => {
      if (!realUsers) return;
      setUsers(realUsers.map((u) => ({
        id: u.uid, uid: u.uid, name: u.displayName || u.email, email: u.email,
        role: u.role || 'student', joined: formatJoined(u.createdAt),
      })));
    });
  }, []);

  const handleRoleChange = async (targetUser, newRole) => {
    if (targetUser.uid === currentUser?.uid) return;
    const previousRole = targetUser.role;
    setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u)));
    try {
      await updateUserRole(targetUser.uid, newRole);
      await logChange(adminName, `Cambió el rol de ${targetUser.name} a "${newRole}".`);
      addToast(`Rol de ${targetUser.name} actualizado a "${newRole}".`, 'success');
    } catch {
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, role: previousRole } : u)));
      addToast(`No se pudo actualizar el rol de ${targetUser.name}. Intenta de nuevo.`, 'error');
    }
  };

  const filteredMembers = members.filter((m) => `${m.name} ${m.email}`.toLowerCase().includes(search.toLowerCase()));
  const filteredUsers = useMemo(() => users.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  }), [users, userSearch, roleFilter]);

  return (
    <div className="anim-fade-up d1">
      <span className="admin-eyebrow">Administración / Netwise Academy</span>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">El equipo detrás de la academia.</h1>
          <p className="admin-page-sub">Define quién participa y qué módulos podría administrar.</p>
        </div>
        <button className="admin-btn-edit" onClick={() => setModal({ mode: 'new' })}><Plus size={15} /> Añadir miembro</button>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search"><Search size={15} /><input placeholder="Buscar el equipo detrás de la academia..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>

      <div className="admin-table-wrap" style={{ marginBottom: 32 }}>
        {loading ? <div className="admin-empty-hint">Cargando equipo...</div> : filteredMembers.length === 0 ? (
          <div className="admin-empty-hint">Todavía no has añadido a nadie al equipo.</div>
        ) : (
          <table className="admin-table">
            <thead><tr><th>Miembro</th><th>Rol</th><th>Alcance propuesto</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {filteredMembers.map((m) => (
                <tr key={m.id}>
                  <td><div className="admin-cell-name">{m.name}</div><div className="admin-cell-sub">{m.email}</div></td>
                  <td><span className={`admin-status ${ROLE_BADGE[m.roleLabel] || 'admin-status-gray'}`}>{m.roleLabel}</span></td>
                  <td className="admin-cell-sub">{m.scope}</td>
                  <td><span className="admin-status admin-status-green">Activo</span></td>
                  <td><button className="admin-icon-btn" onClick={() => setModal({ mode: 'edit', member: m })}><Pencil size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="admin-footnote">
          <span>{filteredMembers.length} registro{filteredMembers.length === 1 ? '' : 's'} en total · Demostración</span>
          <span>Guardado local en este navegador</span>
        </div>
      </div>

      {/* Roles reales de la plataforma -- de esto depende el acceso a rutas
          protegidas (estudiante/docente/admin), separado del directorio de
          arriba que es solo una propuesta de alcance. */}
      <div className="admin-page-head">
        <div>
          <h2 className="admin-page-title" style={{ fontSize: '1.15rem' }}>Cuentas y roles de la plataforma</h2>
          <p className="admin-page-sub">El rol real de cada cuenta -- de esto depende a qué puede entrar cada quién.</p>
        </div>
      </div>
      <div className="admin-toolbar">
        <div className="admin-search"><Search size={15} /><input placeholder="Buscar por nombre o correo..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} /></div>
        <select className="admin-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">Todos los roles</option>
          <option value="student">Estudiantes</option>
          <option value="teacher">Profesores</option>
          <option value="admin">Administradores</option>
        </select>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Registro</th></tr></thead>
          <tbody>
            {filteredUsers.length > 0 ? filteredUsers.map((u) => (
              <tr key={u.id}>
                <td className="admin-cell-name">{u.name}</td>
                <td className="admin-cell-sub">{u.email}</td>
                <td>
                  <select
                    className="admin-select"
                    style={{ padding: '6px 10px', fontSize: '.82rem' }}
                    value={u.role}
                    disabled={u.uid === currentUser?.uid}
                    title={u.uid === currentUser?.uid ? 'No puedes cambiar tu propio rol de administrador.' : undefined}
                    onChange={(e) => handleRoleChange(u, e.target.value)}
                  >
                    <option value="student">student</option>
                    <option value="teacher">teacher</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="admin-cell-sub">{u.joined}</td>
              </tr>
            )) : (
              <tr><td colSpan="4" className="admin-empty-hint">No se encontraron usuarios.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="admin-page-footer">NETWISE ACADEMY · ADMIN V1.4 / Demostración HTML · Datos de ejemplo · Cambios en este navegador</p>

      {modal && (
        <MemberModal
          member={modal.mode === 'edit' ? modal.member : null}
          adminName={adminName}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  );
};

export default AdminEquipo;
