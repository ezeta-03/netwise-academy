import React, { useEffect, useState } from 'react';
import { X, Copy, Check, Loader2, MessageCircle, Mail } from 'lucide-react';
import ModalPortal from '../../components/ModalPortal';
import { useUI } from '../../context/UIContext';
import { logChange, createTeacherAccount, updateTeacherProfile, updateUserRole, updateCourseTeacher, sendAccessEmail, createAccessLink, saveUserPhone } from '../../lib/db';
import { toWhatsAppNumber, whatsAppLink } from '../../lib/phone';
import { TEACHER_PERMISSIONS, resolvePermissions } from '../../lib/permissions';

const ROLE_LABEL = { student: 'Estudiante', teacher: 'Docente', admin: 'Administrador' };

// Enlace de acceso de una persona: lleva a la página de la academia donde crea
// su propia contraseña. El admin lo copia o lo manda por WhatsApp. `intro`
// cambia el encabezado cuando se abre justo después de crear un docente.
export const AccessLinkModal = ({ user, intro, onClose, onPhoneSaved }) => {
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

// Registrar o editar un docente (Admin > Docentes, y "Crear docente" en Equipo).
// Alta: crea su cuenta, guarda su ficha, le asigna cursos y funciones, y al
// terminar abre su enlace de acceso. Si el correo ya tiene cuenta (p. ej. se
// registró como alumno) se le convierte en docente en vez de crear otra.
// `teacher`: el docente a editar ({ uid, name, email, phone, specialty, bio,
// permissions }); sin él, es un alta.
export const TeacherModal = ({ teacher = null, users, courses, adminName, onClose, onSaved, onCreated }) => {
  const { addToast } = useUI();
  const isEdit = !!teacher;
  const [name, setName] = useState(teacher?.name || '');
  const [email, setEmail] = useState(teacher?.email || '');
  const [phone, setPhone] = useState(teacher?.phone || '');
  const [specialty, setSpecialty] = useState(teacher?.specialty || '');
  const [bio, setBio] = useState(teacher?.bio || '');
  const [courseIds, setCourseIds] = useState(() => (teacher ? courses.filter((c) => c.teacherUid === teacher.uid).map((c) => c.id) : []));
  const [permissions, setPermissions] = useState(() => resolvePermissions(teacher?.permissions));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const cleanEmail = email.trim().toLowerCase();
  const existing = isEdit ? null : users.find((u) => (u.email || '').toLowerCase() === cleanEmail && cleanEmail);
  const ownerUid = teacher?.uid || existing?.uid;
  const teacherName = (uid) => users.find((u) => u.uid === uid)?.name;
  const toggleCourse = (id) => setCourseIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const togglePermission = (key) => setPermissions((p) => ({ ...p, [key]: !p[key] }));

  // Deja asignados los cursos marcados y libera los que este docente tenía y se desmarcaron.
  const syncCourses = async (uid) => {
    for (const c of courses) {
      const wanted = courseIds.includes(c.id);
      if (wanted && c.teacherUid !== uid) await updateCourseTeacher(c.id, uid);
      if (!wanted && c.teacherUid === uid) await updateCourseTeacher(c.id, null);
    }
  };

  const handleSave = async () => {
    setError('');
    if (!existing && !name.trim()) { setError('Escribe el nombre del docente.'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) { setError('Escribe un correo válido.'); return; }
    if (existing?.role === 'admin') { setError('Ese correo es de un administrador: ya puede gestionar todos los cursos.'); return; }
    if (!isEdit && !existing && !toWhatsAppNumber(phone)) { setError('Escribe su celular con WhatsApp (ej. 987 654 321): por ahí le enviarás su enlace de acceso.'); return; }
    if ((isEdit || existing) && phone.trim() && !toWhatsAppNumber(phone)) { setError('Revisa el celular: faltan dígitos.'); return; }
    setSaving(true);
    let created = null;
    try {
      const titles = courses.filter((c) => courseIds.includes(c.id)).map((c) => c.title);
      const suffix = titles.length ? ` · cursos: ${titles.join(', ')}` : '';
      const ficha = { specialty: specialty.trim(), bio: bio.trim(), permissions };
      if (isEdit) {
        await updateTeacherProfile(teacher.uid, { displayName: name.trim(), phone: phone.trim(), ...ficha });
        await syncCourses(teacher.uid);
        await logChange(adminName, `Editó al docente ${name.trim()}${suffix}.`);
        addToast('Docente actualizado.', 'success');
      } else if (existing) {
        await updateUserRole(existing.uid, 'teacher');
        await updateTeacherProfile(existing.uid, { ...(phone.trim() ? { phone: phone.trim() } : {}), ...ficha });
        await syncCourses(existing.uid);
        await logChange(adminName, `Convirtió a ${existing.name} en docente${suffix}.`);
        addToast(`${existing.name} ahora es docente.`, 'success');
      } else {
        const { uid } = await createTeacherAccount({ name, email: cleanEmail, phone, courseIds, ...ficha });
        created = { uid, name: name.trim(), email: cleanEmail, phone: phone.trim() };
        await logChange(adminName, `Registró al docente ${name.trim()} (${cleanEmail})${suffix}.`);
        addToast('Docente registrado.', 'success');
      }
      await onSaved();
      onClose();
      // Cuenta nueva: falta que defina su contraseña, así que se abre su enlace.
      if (created) onCreated?.(created);
    } catch (err) {
      setError(err?.code === 'auth/email-already-in-use'
        ? 'Ese correo ya tiene una cuenta y no pudimos recuperarla. Intenta de nuevo en un momento.'
        : err?.message === 'app/needs-firebase' ? 'Esta función necesita la base de datos real conectada.'
          : 'No se pudo guardar el docente. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="admin-modal-overlay">
        <div className="admin-modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head">
            <div className="admin-modal-title">{isEdit ? 'Editar docente' : 'Registrar docente'}</div>
            <button className="admin-modal-close" onClick={onClose} disabled={saving} aria-label="Cerrar"><X size={18} /></button>
          </div>
          {error && <div className="checkout-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

          <div className="admin-modal-section">Datos del docente</div>
          <div className="admin-field-row">
            <div className="admin-field"><label htmlFor="teacher-email">Correo de acceso</label><input id="teacher-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" autoComplete="off" readOnly={isEdit} disabled={isEdit} /></div>
            {!existing && <div className="admin-field"><label htmlFor="teacher-name">Nombre completo</label><input id="teacher-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Valeria Torres" autoComplete="off" /></div>}
          </div>
          {existing && (
            <p className="dash-notice" style={{ marginTop: 0 }}>
              {existing.name} ya tiene una cuenta ({ROLE_LABEL[existing.role] || existing.role}). No se crea otra: se le cambiará el rol a Docente y conservará su contraseña.
            </p>
          )}
          <div className="admin-field-row">
            <div className="admin-field">
              <label htmlFor="teacher-phone">Celular (WhatsApp){isEdit || existing ? ' · opcional' : ''}</label>
              <input id="teacher-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={existing?.phone || '+51 9xx xxx xxx'} autoComplete="off" />
            </div>
            <div className="admin-field"><label htmlFor="teacher-specialty">Especialidad</label><input id="teacher-specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Ej. Branding y estrategia de marca" /></div>
          </div>
          <div className="admin-field">
            <label htmlFor="teacher-bio">Biografía corta · se muestra a los alumnos</label>
            <input id="teacher-bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} placeholder="Ej. 8 años creando marcas para emprendimientos en Lima" />
          </div>
          {!isEdit && !existing && <p className="admin-cell-sub" style={{ marginTop: -6, marginBottom: 12 }}>Por WhatsApp le enviarás el enlace para crear su contraseña. El correo será su usuario para entrar.</p>}

          <div className="admin-modal-section">Asignación</div>
          <div className="admin-field">
            <label>Cursos que dictará</label>
            <div className="admin-check-grid">
              {courses.map((c) => {
                const current = c.teacherUid && c.teacherUid !== ownerUid ? teacherName(c.teacherUid) : null;
                return (
                  <label key={c.id} className="admin-check-card">
                    <input type="checkbox" checked={courseIds.includes(c.id)} onChange={() => toggleCourse(c.id)} />
                    <span>{c.title}{current ? <span className="admin-cell-sub"> · hoy: {current} (se reemplaza)</span> : null}</span>
                  </label>
                );
              })}
            </div>
            <span className="admin-cell-sub">Un curso tiene un solo docente a cargo. El docente de cada aula se elige aparte, en Aulas y horarios.</span>
          </div>

          <div className="admin-modal-section">Funciones</div>
          <div className="admin-field">
            <label>Permisos del panel docente</label>
            <div className="admin-check-grid">
              {TEACHER_PERMISSIONS.map((p) => (
                <label key={p.key} className="admin-check-card">
                  <input type="checkbox" checked={!!permissions[p.key]} onChange={() => togglePermission(p.key)} />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="admin-btn-edit" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : existing ? 'Convertir en docente' : 'Registrar y dar acceso'}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
