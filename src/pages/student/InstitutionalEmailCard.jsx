import React, { useEffect, useState } from 'react';
import { AtSign, Check, Copy, Loader2, Lock } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { fetchMyInstitutionalAccount, fetchMyActiveEnrollments, activateInstitutionalAccount } from '../../lib/db';

const ERRORS = {
  'functions/failed-precondition': 'Todavía no podemos activar tu correo. Si tu pago ya fue confirmado, escríbenos por Soporte.',
  'functions/resource-exhausted': 'Acabas de generar una contraseña. Espera unos minutos para pedir otra.',
  'functions/aborted': 'Tu correo ya se está creando. Espera un momento y recarga la página.',
};

// Cada cuánto se revisa si el admin ya aprobó el pago, mientras el alumno espera.
const POLL_MS = 20000;

const Step = ({ state, children }) => (
  <div className={`inst-step ${state}`}>
    <div className="inst-step-bar" />
    <div className="inst-step-label">
      {state === 'done' ? <Check size={14} /> : state === 'current' ? <Loader2 size={14} className="spin" /> : <Lock size={13} />}
      <span>{children}</span>
    </div>
  </div>
);

// Correo de la academia (nombre@netwiseacademy.pe) en el inicio del alumno.
// Mientras el admin valida el pago muestra en qué paso va; con el pago aprobado
// aparece "Activar", que crea la cuenta de Google y enseña la contraseña
// temporal una sola vez. Después queda el correo a la vista; con `hideWhenActive`
// (checkout y panel del curso) desaparece una vez activado.
const InstitutionalEmailCard = ({ uid, hasActiveEnrollment, awaitingApproval = false, onApproved, hideWhenActive = false }) => {
  const { addToast } = useUI();
  const [account, setAccount] = useState(undefined); // undefined: cargando
  const [result, setResult] = useState(null); // { email, password, linked }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyInstitutionalAccount(uid).then(setAccount).catch(() => setAccount(null));
  }, [uid]);

  // Esperando la aprobación: en cuanto hay una matrícula activa, el inicio se recarga.
  const waiting = awaitingApproval && !hasActiveEnrollment;
  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setInterval(() => {
      fetchMyActiveEnrollments(uid).then((list) => { if (Object.keys(list || {}).length > 0) onApproved?.(); }).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, uid]);

  if (account === undefined || (!account && !hasActiveEnrollment && !awaitingApproval)) return null;
  if (hideWhenActive && account && !result) return null;

  const run = async (reset) => {
    setError('');
    setBusy(true);
    try {
      const data = await activateInstitutionalAccount({ reset });
      setResult(data);
      setAccount({ email: data.email, linked: data.linked });
    } catch (err) {
      setError(ERRORS[err?.code] || 'No se pudo completar. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast(`${label} copiado.`, 'success');
    } catch {
      addToast('No se pudo copiar. Selecciónalo y cópialo a mano.', 'error');
    }
  };

  const email = result?.email || account?.email;

  return (
    <div className="admin-panel inst-card" role="status">
      <div className="inst-card-head">
        <AtSign size={18} />
        <span className="admin-panel-title">Tu correo de la academia</span>
        {email && !result?.password && <span className="admin-status admin-status-green">Activo</span>}
      </div>

      {email ? (
        <>
          <div className="admin-cell-sub">Con este correo entras a tus clases en Google Meet{account?.linked ? ' y a la plataforma, con el botón "Ingresar con tu correo de la academia"' : ''}.</div>
          {result?.password ? (
            <>
              {/* Recién activado: los tres pasos quedan cumplidos. */}
              <div className="inst-steps">
                <Step state="done">Pago registrado</Step>
                <Step state="done">Pago confirmado</Step>
                <Step state="done">Correo activado</Step>
              </div>
              <div className="inst-credentials">
                <div className="admin-field" style={{ marginBottom: 0 }}><label htmlFor="my-inst-email">Correo</label><input id="my-inst-email" readOnly value={email} onFocus={(e) => e.target.select()} /></div>
                <div className="admin-field" style={{ marginBottom: 0 }}><label htmlFor="my-inst-password">Contraseña temporal</label><input id="my-inst-password" readOnly value={result.password} onFocus={(e) => e.target.select()} /></div>
              </div>
              <ol className="inst-how">
                <li>Copia tu contraseña temporal: solo se muestra ahora.</li>
                <li>Entra a <a href="https://accounts.google.com" target="_blank" rel="noreferrer">accounts.google.com</a> con tu correo y esa contraseña.</li>
                <li>Google te pedirá crear tu propia contraseña. Desde ahí, usa siempre la tuya.</li>
              </ol>
              <div className="inst-actions">
                <button className="admin-btn-edit" onClick={() => copy(result.password, 'Contraseña')}><Copy size={14} /> Copiar contraseña</button>
                <button className="admin-btn-ghost" onClick={() => copy(email, 'Correo')}><Copy size={14} /> Copiar correo</button>
              </div>
            </>
          ) : (
            <div className="inst-actions">
              <strong style={{ color: '#14141F', fontSize: '.95rem' }}>{email}</strong>
              <button className="admin-btn-ghost" onClick={() => copy(email, 'Correo')}><Copy size={14} /> Copiar</button>
              <button className="admin-btn-ghost" onClick={() => run(true)} disabled={busy}>{busy ? <><Loader2 size={14} className="spin" /> Un momento...</> : 'Olvidé mi contraseña'}</button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="admin-cell-sub">
            {waiting
              ? 'Estamos validando tu pago. Apenas quede confirmado, aquí mismo podrás activar tu correo: no necesitas recargar la página.'
              : 'Tu pago ya está confirmado. Activa tu correo nombre@netwiseacademy.pe para entrar a tus clases en Google Meet.'}
          </div>
          <div className="inst-steps">
            <Step state="done">Pago registrado</Step>
            <Step state={waiting ? 'current' : 'done'}>{waiting ? 'Validando tu pago' : 'Pago confirmado'}</Step>
            <Step state={waiting ? 'todo' : busy ? 'current' : 'todo'}>Activa tu correo</Step>
          </div>
          {!waiting && (
            <div className="inst-actions">
              <button className="admin-btn-edit" onClick={() => run(false)} disabled={busy}>{busy ? <><Loader2 size={14} className="spin" /> Creando tu correo...</> : 'Activar mi correo'}</button>
            </div>
          )}
        </>
      )}

      {error && <div className="checkout-error" role="alert" style={{ marginTop: 12, marginBottom: 0 }}>{error}</div>}
    </div>
  );
};

export default InstitutionalEmailCard;
