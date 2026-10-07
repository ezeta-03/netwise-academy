import React, { useState } from 'react';
import { X, Copy, MessageCircle, Loader2 } from 'lucide-react';
import ModalPortal from '../../components/ModalPortal';
import { useUI } from '../../context/UIContext';
import { provisionInstitutionalAccount, logChange } from '../../lib/db';
import { whatsAppLink } from '../../lib/phone';
import { INSTITUTIONAL_DOMAIN, suggestLocalPart, isValidLocalPart } from '../../lib/institutionalEmail';

const ERRORS = {
  'functions/failed-precondition': 'Google Workspace todavía no autoriza a la plataforma a crear usuarios. Falta asignarle el rol de gestión de usuarios en admin.google.com.',
  'functions/permission-denied': 'Esa dirección ya es de otra persona o de un administrador. Elige otra.',
  'functions/not-found': 'Esa cuenta no existe en Google Workspace.',
  'functions/invalid-argument': 'La dirección solo admite letras, números y puntos.',
};
const errorMessage = (err) => (err?.message === 'app/needs-firebase'
  ? 'Esta función necesita la base de datos real conectada.'
  : ERRORS[err?.code] || 'No se pudo completar. Revisa tu conexión e intenta de nuevo.');

// Correo institucional de una persona (nombre@netwiseacademy.pe): lo crea en
// Google Workspace o, si ya lo tiene, le genera otra contraseña temporal. La
// contraseña solo se muestra acá, para que el admin se la pase por WhatsApp;
// Google le pide cambiarla en su primer ingreso.
// `user`: { uid, name, email, phone }; `account`: el vínculo actual o null.
export const InstitutionalAccountModal = ({ user, account, adminName, onClose, onSaved }) => {
  const { addToast, confirmDialog } = useUI();
  const [localPart, setLocalPart] = useState(() => suggestLocalPart(user.name));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // La dirección ya existe en Google: se ofrece vincularla en vez de crearla.
  const [existsInGoogle, setExistsInGoogle] = useState(false);
  const [result, setResult] = useState(null); // { email, password, linked }

  const email = result?.email || account?.email || `${localPart}@${INSTITUTIONAL_DOMAIN}`;
  const firstName = (user.name || '').split(' ')[0] || '';
  const message = result?.password
    ? `Hola ${firstName}, este es tu correo institucional de Netwise Academy:\n\nCorreo: ${result.email}\nContraseña temporal: ${result.password}\n\nEntra en https://accounts.google.com con esos datos; Google te pedirá crear tu propia contraseña. Con esa cuenta ingresas a las clases en Google Meet${result.linked ? ' y a https://netwiseacademy.pe con el botón "Continuar con Google"' : ''}.`
    : '';

  const run = async (params, logText) => {
    setError('');
    setBusy(true);
    try {
      const data = await provisionInstitutionalAccount({ uid: user.uid, ...params });
      setResult(data);
      setExistsInGoogle(false);
      await logChange(adminName, `${logText} ${data.email} (${user.name}).`);
      onSaved?.(user.uid, { email: data.email, linked: data.linked });
    } catch (err) {
      if (err?.code === 'functions/already-exists') setExistsInGoogle(true);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const create = () => {
    if (!isValidLocalPart(localPart)) { setError('La dirección solo admite letras, números y puntos, sin espacios ni tildes.'); return; }
    run({ localPart }, 'Creó el correo institucional');
  };
  const linkExisting = () => run({ localPart, useExisting: true }, 'Vinculó el correo institucional');
  const reset = async () => {
    if (!(await confirmDialog({ title: 'Nueva contraseña', message: `¿Generar otra contraseña temporal para ${account.email}?\n\nLa contraseña actual dejará de funcionar.`, confirmLabel: 'Generar' }))) return;
    run({ reset: true }, 'Generó otra contraseña temporal para');
  };

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast(`${label} copiado.`, 'success');
    } catch {
      addToast('No se pudo copiar. Selecciona el texto y cópialo a mano.', 'error');
    }
  };

  return (
    <ModalPortal>
      <div className="admin-modal-overlay">
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head">
            <div>
              <div className="admin-modal-title">Correo institucional</div>
              <div className="admin-modal-sub">{user.name} · {user.email}</div>
            </div>
            <button className="admin-modal-close" onClick={onClose} disabled={busy} aria-label="Cerrar"><X size={18} /></button>
          </div>
          {error && <div className="checkout-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

          {result?.password ? (
            <>
              <p className="admin-cell-sub" style={{ marginBottom: 12 }}>Envíale estos datos. La contraseña es temporal y solo se muestra ahora: Google le pedirá crear la suya al entrar.</p>
              <div className="admin-field-row">
                <div className="admin-field"><label htmlFor="inst-email">Correo</label><input id="inst-email" readOnly value={result.email} onFocus={(e) => e.target.select()} /></div>
                <div className="admin-field"><label htmlFor="inst-password">Contraseña temporal</label><input id="inst-password" readOnly value={result.password} onFocus={(e) => e.target.select()} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <a className="admin-btn-edit" href={whatsAppLink(user.phone, message)} target="_blank" rel="noreferrer"><MessageCircle size={14} /> Enviar por WhatsApp</a>
                <button className="admin-btn-ghost" onClick={() => copy(message, 'Mensaje')}><Copy size={14} /> Copiar mensaje</button>
              </div>
              <p className="dash-notice" style={{ marginTop: 0 }}>
                {result.linked
                  ? 'Con esta cuenta también puede entrar a la plataforma con "Continuar con Google": llega a su mismo perfil y cursos.'
                  : 'Esta cuenta le sirve para Google Meet. A la plataforma sigue entrando como hasta ahora: no se pudo enlazar a su acceso (suele pasar si ya entraba con otra cuenta de Google).'}
              </p>
            </>
          ) : account ? (
            <>
              <div className="admin-field"><label htmlFor="inst-email">Correo</label><input id="inst-email" readOnly value={account.email} onFocus={(e) => e.target.select()} /></div>
              <p className="admin-cell-sub" style={{ marginBottom: 12 }}>Si olvidó su contraseña, genera una temporal y envíasela.</p>
            </>
          ) : (
            <>
              <div className="admin-field">
                <label htmlFor="inst-local">Dirección</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input id="inst-local" value={localPart} onChange={(e) => { setLocalPart(e.target.value.trim().toLowerCase()); setExistsInGoogle(false); }} placeholder="nombre.apellido" autoComplete="off" disabled={busy} />
                  <span className="admin-cell-sub">@{INSTITUTIONAL_DOMAIN}</span>
                </div>
              </div>
              {existsInGoogle ? (
                <div className="dash-notice warn" style={{ marginTop: 0 }}>
                  <strong>{email}</strong> ya existe en Google Workspace. Si es de {firstName || 'esta persona'}, vincúlala: se le generará otra contraseña temporal. Si es de alguien más, cambia la dirección.
                </div>
              ) : (
                <p className="admin-cell-sub" style={{ marginBottom: 12 }}>Se crea una cuenta gratuita de Google (sin buzón de Gmail) para entrar a las clases de Meet y a la plataforma.</p>
              )}
            </>
          )}

          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={onClose} disabled={busy}>{result?.password ? 'Listo' : 'Cancelar'}</button>
            {!result?.password && (
              <button className="admin-btn-edit" onClick={account ? reset : existsInGoogle ? linkExisting : create} disabled={busy}>
                {busy ? <><Loader2 size={14} className="spin" /> Un momento...</> : account ? 'Generar nueva contraseña' : existsInGoogle ? 'Vincular esta cuenta' : 'Crear correo'}
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
