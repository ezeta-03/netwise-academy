import React, { useState } from 'react';
import { createInstitutionalStudent } from '../../lib/db';
import { toPeruMobile, isEmailFormat } from '../../lib/phone';
import { INSTITUTIONAL_DOMAIN, suggestLocalPart, isValidLocalPart } from '../../lib/institutionalEmail';

// Mensajes de createInstitutionalStudent que el admin puede resolver él mismo.
const SERVER_MESSAGES = ['functions/invalid-argument', 'functions/already-exists', 'functions/permission-denied'];
const creationError = (err) => {
  if (err?.message === 'app/needs-firebase') return 'Esta función necesita la base de datos real conectada.';
  if (err?.code === 'functions/already-exists' && /Google Workspace/.test(err.message)) return 'Esa dirección ya existe en Google Workspace. Elige otra.';
  if (err?.code === 'functions/failed-precondition') return 'Google Workspace todavía no autoriza a la plataforma a crear usuarios.';
  return SERVER_MESSAGES.includes(err?.code) ? err.message : 'No se pudo crear la cuenta del alumno. Intenta de nuevo.';
};

// Alta de un alumno nuevo directamente con su correo de la academia (Alumnos y
// accesos > Nueva matrícula, Ventas > Registrar venta). Devuelve los campos y
// `create()`, que valida, crea la cuenta (Google + plataforma) y resuelve con
// { uid, name, email, phone, password, exclusive }, o lanza un Error con el
// mensaje para mostrar.
export const useInstitutionalStudentForm = ({ disabled = false } = {}) => {
  const [name, setName] = useState('');
  const [localPart, setLocalPart] = useState('');
  const [localEdited, setLocalEdited] = useState(false);
  const [personalEmail, setPersonalEmail] = useState('');
  const [phone, setPhone] = useState('');

  const changeName = (value) => {
    setName(value);
    if (!localEdited) setLocalPart(suggestLocalPart(value));
  };

  const create = async () => {
    if (name.trim().length < 3) throw new Error('Escribe el nombre completo del alumno.');
    if (!isValidLocalPart(localPart)) throw new Error('La dirección solo admite letras, números y puntos, sin espacios ni tildes.');
    if (personalEmail.trim() && !isEmailFormat(personalEmail)) throw new Error('El correo personal no es válido.');
    if (phone.trim() && !toPeruMobile(phone)) throw new Error('El celular debe tener 9 dígitos y empezar con 9.');
    try {
      const data = await createInstitutionalStudent({ name: name.trim(), localPart, personalEmail: personalEmail.trim(), phone: toPeruMobile(phone) || '' });
      return { ...data, name: name.trim(), phone: toPeruMobile(phone) || '' };
    } catch (err) {
      throw new Error(creationError(err));
    }
  };

  const fields = (
    <>
      <div className="admin-field"><label htmlFor="inst-new-name">Nombre completo</label><input id="inst-new-name" value={name} onChange={(e) => changeName(e.target.value)} maxLength={120} disabled={disabled} /></div>
      <div className="admin-field">
        <label htmlFor="inst-new-local">Correo de la academia</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input id="inst-new-local" value={localPart} onChange={(e) => { setLocalPart(e.target.value.trim().toLowerCase()); setLocalEdited(true); }} placeholder="nombre.apellido" autoComplete="off" disabled={disabled} />
          <span className="admin-cell-sub">@{INSTITUTIONAL_DOMAIN}</span>
        </div>
      </div>
      <div className="admin-field-row">
        <div className="admin-field"><label htmlFor="inst-new-personal">Correo personal · opcional</label><input id="inst-new-personal" type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} placeholder="Para contacto y recuperar su cuenta" maxLength={160} disabled={disabled} /></div>
        <div className="admin-field"><label htmlFor="inst-new-phone">Celular · opcional</label><input id="inst-new-phone" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9XX XXX XXX" maxLength={16} disabled={disabled} /></div>
      </div>
      <p className="admin-panel-caption" style={{ marginTop: -4 }}>Se crea su cuenta de Google y su acceso a la plataforma con este correo: entra con el botón "Ingresar con tu correo de la academia". Al terminar te damos su contraseña temporal.</p>
    </>
  );

  return { fields, create };
};
