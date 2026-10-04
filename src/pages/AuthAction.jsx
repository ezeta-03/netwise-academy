import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Eye, EyeOff, Loader2, KeyRound, AlertTriangle, MailCheck } from 'lucide-react';
import { verifyPasswordResetCode, confirmPasswordReset, applyActionCode, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import logoNetwise from '../assets/NETWISE ACADEMY WEB/logo_netwise.webp';

const MIN_PASSWORD = 8;

// Página propia para los enlaces que Firebase manda por correo (definir o
// recuperar la contraseña, verificar el correo), en vez de la pantalla genérica
// de Firebase. Para que los correos apunten aquí, la "URL de acción" de las
// plantillas debe ser https://<dominio>/auth/accion (consola de Firebase >
// Authentication > Plantillas). Firebase agrega ?mode=...&oobCode=...
const AuthAction = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { openLoginModal } = useUI();
  const mode = params.get('mode');
  const oobCode = params.get('oobCode') || '';

  // 'checking' | 'form' | 'done' | 'verified' | 'invalid' | 'resent'
  const [stage, setStage] = useState('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [resendEmail, setResendEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    const settle = (next) => { if (!cancelled) setStage(next); };
    if (!oobCode) { Promise.resolve().then(() => settle('invalid')); return () => { cancelled = true; }; }
    if (mode === 'resetPassword') {
      verifyPasswordResetCode(auth, oobCode)
        .then((accountEmail) => { if (!cancelled) { setEmail(accountEmail); setStage('form'); } })
        .catch(() => settle('invalid'));
    } else if (mode === 'verifyEmail' || mode === 'recoverEmail') {
      applyActionCode(auth, oobCode).then(() => settle('verified')).catch(() => settle('invalid'));
    } else {
      Promise.resolve().then(() => settle('invalid'));
    }
    return () => { cancelled = true; };
  }, [mode, oobCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < MIN_PASSWORD) { setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setSaving(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStage('done');
    } catch (err) {
      if (err?.code === 'auth/weak-password') setError('Esa contraseña es muy débil. Usa una más larga o con números y símbolos.');
      else if (err?.code === 'auth/expired-action-code' || err?.code === 'auth/invalid-action-code') setStage('invalid');
      else setError('No se pudo guardar la contraseña. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleResend = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await sendPasswordResetEmail(auth, resendEmail.trim().toLowerCase());
    } catch (err) {
      // Un correo sin cuenta no se delata: se muestra el mismo mensaje.
      if (err?.code === 'auth/invalid-email') { setError('Escribe un correo válido.'); setSaving(false); return; }
    }
    setSaving(false);
    setStage('resent');
  };

  // Al login: el Inicio público con la ventana de inicio de sesión abierta. Si
  // en este navegador ya hay una sesión, el Inicio lleva directo a su panel.
  const goToLogin = () => {
    navigate('/', { replace: true });
    if (!currentUser) openLoginModal();
  };

  return (
    <div className="view active auth-action">
      <div className="checkout-topbar">
        <img src={logoNetwise} alt="Netwise Academy" />
      </div>
      <div className="checkout-body">
        <div className="auth-action-card">
          {stage === 'checking' && (
            <div className="auth-action-center" role="status">
              <Loader2 size={28} className="spin" />
              <p className="auth-action-desc">Comprobando tu enlace...</p>
            </div>
          )}

          {stage === 'form' && (
            <form onSubmit={handleSubmit} noValidate>
              <div className="auth-action-icon"><KeyRound size={24} /></div>
              <h1 className="auth-action-title">Crea tu contraseña</h1>
              <p className="auth-action-desc">Para tu cuenta de Netwise Academy <strong>{email}</strong>. La usarás junto con tu correo para entrar a la plataforma.</p>
              {error && <div className="checkout-error" role="alert">{error}</div>}
              <div className="admin-field">
                <label htmlFor="new-password">Nueva contraseña</label>
                <div className="auth-input-wrap">
                  <input id="new-password" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={`Mínimo ${MIN_PASSWORD} caracteres`} autoComplete="new-password" autoFocus />
                  <button type="button" className="auth-input-toggle auth-action-toggle" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              <div className="admin-field">
                <label htmlFor="confirm-password">Repite la contraseña</label>
                <input id="confirm-password" type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Escríbela otra vez" autoComplete="new-password" />
              </div>
              <button type="submit" className="checkout-submit-btn" disabled={saving}>
                {saving ? <Loader2 size={16} className="spin" /> : 'Guardar contraseña'}
              </button>
            </form>
          )}

          {stage === 'done' && (
            <div className="auth-action-center">
              <div className="auth-action-icon auth-action-icon-ok"><Check size={26} /></div>
              <h1 className="auth-action-title">¡Listo! Tu contraseña fue guardada</h1>
              <p className="auth-action-desc">Ya puedes entrar a Netwise Academy con tu correo <strong>{email}</strong> y tu nueva contraseña.</p>
              <button type="button" className="checkout-submit-btn" onClick={goToLogin}>Iniciar sesión</button>
            </div>
          )}

          {stage === 'verified' && (
            <div className="auth-action-center">
              <div className="auth-action-icon auth-action-icon-ok"><Check size={26} /></div>
              <h1 className="auth-action-title">Correo confirmado</h1>
              <p className="auth-action-desc">Tu correo quedó verificado. Ya puedes entrar a Netwise Academy.</p>
              <button type="button" className="checkout-submit-btn" onClick={goToLogin}>Iniciar sesión</button>
            </div>
          )}

          {stage === 'invalid' && (
            <form onSubmit={handleResend} noValidate>
              <div className="auth-action-icon auth-action-icon-warn"><AlertTriangle size={24} /></div>
              <h1 className="auth-action-title">Este enlace ya no es válido</h1>
              <p className="auth-action-desc">Puede que haya vencido o que ya lo hayas usado. Escribe tu correo y te enviamos uno nuevo para crear tu contraseña.</p>
              {error && <div className="checkout-error" role="alert">{error}</div>}
              <div className="admin-field">
                <label htmlFor="resend-email">Correo electrónico</label>
                <input id="resend-email" type="email" value={resendEmail} onChange={(e) => setResendEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" />
              </div>
              <button type="submit" className="checkout-submit-btn" disabled={saving || !resendEmail.trim()}>
                {saving ? <Loader2 size={16} className="spin" /> : 'Enviarme un enlace nuevo'}
              </button>
              <button type="button" className="auth-action-link" onClick={goToLogin}>Volver a iniciar sesión</button>
            </form>
          )}

          {stage === 'resent' && (
            <div className="auth-action-center">
              <div className="auth-action-icon auth-action-icon-ok"><MailCheck size={24} /></div>
              <h1 className="auth-action-title">Revisa tu correo</h1>
              <p className="auth-action-desc">Si <strong>{resendEmail.trim()}</strong> tiene una cuenta en Netwise Academy, en unos minutos recibirás un enlace nuevo. Revisa también la carpeta de spam.</p>
              <button type="button" className="checkout-submit-btn" onClick={goToLogin}>Volver a iniciar sesión</button>
            </div>
          )}
        </div>
        <p className="auth-action-foot">Netwise Academy · ¿Necesitas ayuda? Escríbenos por WhatsApp.</p>
      </div>
    </div>
  );
};

export default AuthAction;
