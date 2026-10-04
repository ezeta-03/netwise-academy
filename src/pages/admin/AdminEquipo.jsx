import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, X, Pencil, Ban, RotateCcw, Trash2, GraduationCap, KeyRound, Copy, Check, Loader2, MessageCircle, Mail } from 'lucide-react';
import ModalPortal from '../../components/ModalPortal';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { fetchTeamMembers, createTeamMember, updateTeamMember, fetchAllUsers, updateUserRole, updateUserStatus, deleteUserAccount, logChange, createTeacherAccount, updateCourseTeacher, sendAccessEmail, createAccessLink, saveUserPhone } from '../../lib/db';
import { toWhatsAppNumber, whatsAppLink } from '../../lib/phone';

const ROLE_LABEL = { student: 'Estudiante', teacher: 'Docente', admin: 'Administrador' };

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
    <div className="admin-modal-overlay">
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

// Enlace de acceso de una persona: lleva a la página de la academia donde crea
// su propia contraseña. El admin lo copia o lo manda por WhatsApp. `intro`
// cambia el encabezado cuando se abre justo después de crear un docente.
const AccessLinkModal = ({ user, intro, onClose, onPhoneSaved }) => {
  const { addToast } = useUI();
  const [link, setLink] = useState('');
  // Celular del destinatario: el botón de WhatsApp abre directo su chat.
  const [phone, setPhone] = useState(user.phone || '');
  const validPhone = !!toWhatsAppNumber(phone);
  const [state, setState] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [copied, setCopied] = useState(false);
  const [sendingMail, setSendingMail] = useState(false);

  const generate = () => {
    createAccessLink(user.email)
      .then((url) => { setLink(url); setState('ready'); })
      .catch(() => setState('error'));
  };
  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const retry = () => { setState('loading'); setCopied(false); generate(); };

  const firstName = (user.name || '').split(' ')[0] || '';
  const message = `Hola ${firstName}, te damos la bienvenida a Netwise Academy. Crea tu contraseña con este enlace (vence en aproximadamente una hora):\n${link}\n\nDespués entra en https://netwiseacademy.pe con tu correo ${user.email}.`;

  // Si el admin escribió o corrigió el celular acá, queda guardado en el perfil.
  const rememberPhone = () => {
    if (!user.uid || !validPhone || phone.trim() === (user.phone || '').trim()) return;
    saveUserPhone(user.uid, phone.trim()).then(() => onPhoneSaved?.(user.uid, phone.trim())).catch(() => {});
  };

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      addToast(`${label} copiado.`, 'success');
    } catch {
      addToast('No se pudo copiar. Selecciona el enlace y cópialo a mano.', 'error');
    }
  };
  const sendMail = async () => {
    setSendingMail(true);
    try {
      await sendAccessEmail(user.email);
      addToast(`Correo enviado a ${user.email}. Puede llegar a spam.`, 'success');
    } catch {
      addToast('No se pudo enviar el correo. Intenta de nuevo.', 'error');
    } finally {
      setSendingMail(false);
    }
  };

  return (
    <ModalPortal>
      <div className="admin-modal-overlay">
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head">
            <div>
              <div className="admin-modal-title">{intro || 'Enlace de acceso'}</div>
              <div className="admin-modal-sub">{user.name} · {user.email}</div>
            </div>
            <button className="admin-modal-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
          </div>

          {state === 'loading' && <p className="admin-panel-caption" style={{ marginTop: 0 }}><Loader2 size={14} className="spin" style={{ verticalAlign: -2 }} /> Generando el enlace...</p>}

          {state === 'ready' && (
            <>
              <p className="admin-cell-sub" style={{ marginBottom: 12 }}>Envíale este enlace. Al abrirlo, crea su propia contraseña en la página de Netwise Academy: tú no la ves ni tienes que inventarla.</p>
              <div className="admin-field">
                <label htmlFor="access-phone">Celular (WhatsApp)</label>
                <input id="access-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={rememberPhone} placeholder="Ej. 987 654 321" autoComplete="off" />
                {phone.trim() && !validPhone && <span className="admin-cell-sub" style={{ color: '#B45309' }}>Revisa el número: faltan dígitos. Con otro país, incluye el código (ej. +34 612 345 678).</span>}
                {!phone.trim() && <span className="admin-cell-sub">Sin número, WhatsApp te dejará elegir el contacto.</span>}
              </div>
              <div className="admin-field">
                <label htmlFor="access-link">Enlace para crear su contraseña</label>
                <input id="access-link" readOnly value={link} onFocus={(e) => e.target.select()} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <a className="admin-btn-edit" href={whatsAppLink(phone, message)} target="_blank" rel="noreferrer" onClick={rememberPhone}><MessageCircle size={14} /> {validPhone ? `Enviar por WhatsApp a ${firstName || 'su número'}` : 'Enviar por WhatsApp'}</a>
                <button className="admin-btn-ghost" onClick={() => copy(link, 'Enlace')}>{copied ? <Check size={14} /> : <Copy size={14} />} Copiar enlace</button>
                <button className="admin-btn-ghost" onClick={() => copy(message, 'Mensaje')}><Copy size={14} /> Copiar mensaje</button>
              </div>
              <p className="dash-notice" style={{ marginTop: 0 }}>El enlace sirve una sola vez y vence en aproximadamente una hora. Si vence, vuelve a abrir esta ventana desde el icono de llave para generar otro.</p>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="checkout-error" role="alert">No se pudo generar el enlace. Puedes reintentar o enviarle el correo de acceso.</div>
              <button className="admin-btn-ghost" onClick={retry}>Reintentar</button>
            </>
          )}

          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={sendMail} disabled={sendingMail} title="Correo estándar de Firebase: puede caer en spam">
              <Mail size={14} /> {sendingMail ? 'Enviando...' : 'Enviar también por correo'}
            </button>
            <button className="admin-btn-edit" onClick={onClose}>Listo</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

// Alta de un docente: crea su cuenta y le asigna cursos; al terminar se abre su
// enlace de acceso para que defina su contraseña. Si el correo ya tiene cuenta (p. ej. se registró
// como alumno), se le cambia el rol a docente en vez de crear otra.
const TeacherModal = ({ users, courses, adminName, onClose, onSaved, onCreated }) => {
  const { addToast } = useUI();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [courseIds, setCourseIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const cleanEmail = email.trim().toLowerCase();
  const existing = users.find((u) => (u.email || '').toLowerCase() === cleanEmail && cleanEmail);
  const teacherName = (uid) => users.find((u) => u.uid === uid)?.name;
  const toggleCourse = (id) => setCourseIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const handleSave = async () => {
    setError('');
    if (!existing && !name.trim()) { setError('Escribe el nombre del docente.'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) { setError('Escribe un correo válido.'); return; }
    if (existing?.role === 'admin') { setError('Ese correo es de un administrador: ya puede gestionar todos los cursos.'); return; }
    if (!existing && !toWhatsAppNumber(phone)) { setError('Escribe su celular con WhatsApp (ej. 987 654 321): por ahí le enviarás su enlace de acceso.'); return; }
    if (existing && phone.trim() && !toWhatsAppNumber(phone)) { setError('Revisa el celular: faltan dígitos.'); return; }
    setSaving(true);
    let created = null;
    try {
      const titles = courses.filter((c) => courseIds.includes(c.id)).map((c) => c.title);
      const suffix = titles.length ? ` y le asignó: ${titles.join(', ')}` : '';
      if (existing) {
        await updateUserRole(existing.uid, 'teacher');
        if (phone.trim()) await saveUserPhone(existing.uid, phone.trim());
        for (const id of courseIds) await updateCourseTeacher(id, existing.uid);
        await logChange(adminName, `Convirtió a ${existing.name} en docente${suffix}.`);
        addToast(`${existing.name} ahora es docente.`, 'success');
      } else {
        const { uid } = await createTeacherAccount({ name, email: cleanEmail, phone, courseIds });
        created = { uid, name: name.trim(), email: cleanEmail, phone: phone.trim() };
        await logChange(adminName, `Creó la cuenta de docente de ${name.trim()} (${cleanEmail})${suffix}.`);
        addToast('Docente creado.', 'success');
      }
      await onSaved();
      onClose();
      // Cuenta nueva: falta que defina su contraseña, así que se abre su enlace.
      if (created) onCreated(created);
    } catch (err) {
      setError(err?.code === 'auth/email-already-in-use'
        ? 'Ese correo ya tiene una cuenta y no pudimos recuperarla. Intenta de nuevo en un momento.'
        : err?.message === 'app/needs-firebase' ? 'Esta función necesita la base de datos real conectada.'
          : 'No se pudo crear el docente. Revisa tu conexión e intenta de nuevo.');
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
              <div className="admin-modal-title">Crear docente</div>
              <div className="admin-modal-sub">Al crearlo te daremos un enlace para que defina su contraseña.</div>
            </div>
            <button className="admin-modal-close" onClick={onClose} disabled={saving} aria-label="Cerrar"><X size={18} /></button>
          </div>
          {error && <div className="checkout-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
          <div className="admin-field"><label htmlFor="teacher-email">Correo electrónico</label><input id="teacher-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="docente@correo.com" autoComplete="off" /></div>
          {existing ? (
            <p className="dash-notice" style={{ marginTop: 0 }}>
              {existing.name} ya tiene una cuenta ({ROLE_LABEL[existing.role] || existing.role}). No se crea otra: se le cambiará el rol a Docente y conservará su contraseña.
            </p>
          ) : (
            <div className="admin-field"><label htmlFor="teacher-name">Nombre completo</label><input id="teacher-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Lucía Rivera" autoComplete="off" /></div>
          )}
          <div className="admin-field">
            <label htmlFor="teacher-phone">Celular (WhatsApp){existing ? ' · opcional' : ''}</label>
            <input id="teacher-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={existing?.phone || 'Ej. 987 654 321'} autoComplete="off" />
            <span className="admin-cell-sub">Por WhatsApp le enviarás el enlace para crear su contraseña. El correo será su usuario para entrar.</span>
          </div>
          <div className="admin-field">
            <label>Cursos a su cargo (opcional)</label>
            {courses.map((c) => {
              const current = c.teacherUid && c.teacherUid !== existing?.uid ? teacherName(c.teacherUid) : null;
              return (
                <label key={c.id} className="admin-field-checkbox" style={{ marginBottom: 6 }}>
                  <input type="checkbox" checked={courseIds.includes(c.id)} onChange={() => toggleCourse(c.id)} />
                  <span>{c.title}{current ? <span className="admin-cell-sub"> · hoy a cargo de {current} (se reemplaza)</span> : null}</span>
                </label>
              );
            })}
            <span className="admin-cell-sub">Un curso tiene un solo docente a cargo. El docente de cada aula se elige aparte, en Aulas y horarios.</span>
          </div>
          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="admin-btn-edit" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : existing ? 'Convertir en docente' : 'Crear docente'}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

const AdminEquipo = () => {
  const { currentUser } = useAuth();
  const { addToast, confirmDialog } = useUI();
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [teacherModal, setTeacherModal] = useState(false);
  const [accessFor, setAccessFor] = useState(null);
  const { courses, refresh: refreshCourses } = useCourseOfferings();

  const [users, setUsers] = useState(MOCK_USER_ROWS);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const adminName = currentUser?.displayName || currentUser?.email || 'Admin';

  const load = () => fetchTeamMembers().then((list) => { setMembers(list); setLoading(false); });
  useEffect(() => { load(); }, []);

  const loadUsers = () => fetchAllUsers().then((realUsers) => {
    if (!realUsers) return;
    setUsers(realUsers.map((u) => ({
      id: u.uid, uid: u.uid, name: u.displayName || u.email, email: u.email,
      role: u.role || 'student', joined: formatJoined(u.createdAt), disabled: !!u.disabled, phone: u.phone || '',
    })));
  });
  useEffect(() => { loadUsers(); }, []);


  const handleRoleChange = async (targetUser, newRole) => {
    if (targetUser.uid === currentUser?.uid) return;
    const previousRole = targetUser.role;
    setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u)));
    try {
      await updateUserRole(targetUser.uid, newRole);
      await logChange(adminName, `Cambió el rol de ${targetUser.name} a "${newRole}".`);
      addToast(`${targetUser.name} ahora es ${ROLE_LABEL[newRole] || newRole}.`, 'success');
    } catch {
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, role: previousRole } : u)));
      addToast(`No se pudo actualizar el rol de ${targetUser.name}. Intenta de nuevo.`, 'error');
    }
  };

  const toggleUserDisabled = async (targetUser) => {
    if (targetUser.uid === currentUser?.uid) return;
    const nextDisabled = !targetUser.disabled;
    try {
      await updateUserStatus(targetUser.uid, nextDisabled);
      await logChange(adminName, `${nextDisabled ? 'Desactivó' : 'Reactivó'} la cuenta de ${targetUser.name}.`);
      addToast(`${targetUser.name} ${nextDisabled ? 'desactivado' : 'reactivado'}.`, 'success');
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, disabled: nextDisabled } : u)));
    } catch {
      addToast('No se pudo actualizar la cuenta.', 'error');
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (targetUser.uid === currentUser?.uid) return;
    if (targetUser.role === 'admin') { addToast('Primero cámbiale el rol: no se elimina a un administrador.', 'warning'); return; }
    if (!(await confirmDialog({ title: 'Eliminar cuenta', message: `¿Eliminar la cuenta de ${targetUser.name} (${targetUser.email})?\n\nSe borran su acceso y su perfil: ya no podrá iniciar sesión y el correo queda libre para crear una cuenta nueva. Si era docente, sus cursos quedan sin docente asignado. Sus matrículas, pedidos y entregas no se borran.\n\nPara suspenderla sin perder nada, usa "Desactivar".`, confirmLabel: 'Eliminar cuenta', danger: true }))) return;
    try {
      const { coursesUnassigned } = await deleteUserAccount(targetUser.uid);
      await logChange(adminName, `Eliminó la cuenta de ${targetUser.name} (${targetUser.email}).`);
      addToast(coursesUnassigned ? `Cuenta eliminada. ${coursesUnassigned} curso(s) quedaron sin docente: asígnalos en Cursos y precios.` : 'Cuenta eliminada.', coursesUnassigned ? 'warning' : 'success');
      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
      if (coursesUnassigned) refreshCourses();
    } catch {
      addToast('No se pudo eliminar la cuenta. Intenta de nuevo.', 'error');
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
          <span>Directorio interno · no cambia permisos</span>
        </div>
      </div>

      {/* Roles reales de la plataforma -- de esto depende el acceso a rutas
          protegidas (estudiante/docente/admin), separado del directorio de
          arriba que es solo una propuesta de alcance. */}
      <div className="admin-page-head">
        <div>
          <h2 className="admin-page-title" style={{ fontSize: '1.15rem' }}>Cuentas y roles de la plataforma</h2>
          <p className="admin-page-sub">El rol real de cada cuenta: de esto depende a qué puede entrar cada quién.</p>
        </div>
        <button className="admin-btn-edit" onClick={() => setTeacherModal(true)}><GraduationCap size={15} /> Crear docente</button>
      </div>
      <div className="admin-toolbar">
        <div className="admin-search"><Search size={15} /><input placeholder="Buscar por nombre o correo..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} /></div>
        <select className="admin-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">Todos los roles</option>
          <option value="student">Estudiantes</option>
          <option value="teacher">Docentes</option>
          <option value="admin">Administradores</option>
        </select>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Nombre</th><th>Correo y celular</th><th>Rol</th><th>Registro</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {filteredUsers.length > 0 ? filteredUsers.map((u) => {
              const isSelf = u.uid === currentUser?.uid;
              return (
                <tr key={u.id}>
                  <td className="admin-cell-name">{u.name}</td>
                  <td className="admin-cell-sub">{u.email}{u.phone ? <div>{u.phone}</div> : null}</td>
                  <td>
                    <select
                      className="admin-select"
                      style={{ padding: '6px 10px', fontSize: '.82rem' }}
                      value={u.role}
                      disabled={isSelf}
                      title={isSelf ? 'No puedes cambiar tu propio rol de administrador.' : undefined}
                      onChange={(e) => handleRoleChange(u, e.target.value)}
                    >
                      <option value="student">Estudiante</option>
                      <option value="teacher">Docente</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td className="admin-cell-sub">{u.joined}</td>
                  <td><span className={`admin-status ${u.disabled ? 'admin-status-gray' : 'admin-status-green'}`}>{u.disabled ? 'Desactivado' : 'Activo'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="admin-icon-btn" onClick={() => setAccessFor({ user: u })} title="Enlace de acceso (crear o recuperar contraseña)" aria-label={`Enlace de acceso de ${u.name}`}>
                        <KeyRound size={14} />
                      </button>
                      <button
                        className="admin-icon-btn" disabled={isSelf} onClick={() => toggleUserDisabled(u)}
                        title={isSelf ? 'No puedes desactivar tu propia cuenta.' : (u.disabled ? 'Reactivar' : 'Desactivar')}
                        style={isSelf ? undefined : (u.disabled ? undefined : { color: '#BE123C' })}
                      >
                        {u.disabled ? <RotateCcw size={14} /> : <Ban size={14} />}
                      </button>
                      <button
                        className="admin-icon-btn" disabled={isSelf} onClick={() => handleDeleteUser(u)}
                        title={isSelf ? 'No puedes eliminar tu propia cuenta.' : 'Eliminar cuenta'}
                        style={isSelf ? undefined : { color: '#BE123C' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan="6" className="admin-empty-hint">No se encontraron usuarios.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="admin-page-footer">NETWISE ACADEMY · ADMIN V1.4</p>

      {modal && (
        <MemberModal
          member={modal.mode === 'edit' ? modal.member : null}
          adminName={adminName}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
      {teacherModal && (
        <TeacherModal
          users={users} courses={courses} adminName={adminName}
          onClose={() => setTeacherModal(false)}
          onSaved={async () => { await loadUsers(); await refreshCourses(); }}
          onCreated={(user) => setAccessFor({ user, intro: 'Docente creado: envíale su enlace' })}
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

export default AdminEquipo;
