import React, { useState } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ModalPortal from './ModalPortal';

const LoginModal = ({ onClose }) => {
  const { login, register, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const switchMode = (next) => {
    setMode(next);
    setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      if (mode === 'register') {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
      onClose();
    } catch (error) {
      setErrorMsg(mode === 'register' ? 'Error al registrar usuario: ' + error.message : 'Credenciales incorrectas. Usa: demo@netwise.com / 12345');
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setErrorMsg('');
    setSocialLoading(true);
    try {
      await loginWithGoogle();
      onClose();
    } catch {
      setErrorMsg('Error al conectar con Google.');
      setSocialLoading(false);
    }
  };

  return (
    <ModalPortal>
      <div className="auth-modal-overlay" onClick={onClose}>
        <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
          <button className="auth-modal-close" onClick={onClose}><X size={18} /></button>

          {mode === 'login' ? (
            <h2 className="auth-modal-title">Continúa lo que ya<br /><em>empezaste.</em></h2>
          ) : (
            <h2 className="auth-modal-title">Crea tu cuenta y<br /><em>empieza a aprender.</em></h2>
          )}

          <button type="button" className="auth-google-btn" disabled={socialLoading} onClick={handleGoogle}>
            {socialLoading ? <Loader2 size={16} className="spin" /> : <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.05l3.02-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>}
            Continuar con Google
          </button>

          <div className="auth-divider">{mode === 'login' ? 'o inicia sesión con tu correo' : 'o regístrate con tu correo'}</div>

          {errorMsg && <p style={{ color: '#FCA5A5', fontSize: '.8rem', textAlign: 'center', marginBottom: 10 }}>{errorMsg}</p>}

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="auth-field">
                <label>Nombre completo</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ingresa tu nombre" required />
              </div>
            )}
            <div className="auth-field">
              <label>Correo electrónico</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ingresa tu correo" required />
            </div>
            <div className="auth-field">
              <label>Contraseña</label>
              <div className="auth-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : 'Ingresa tu contraseña'}
                  minLength={mode === 'register' ? 8 : undefined}
                  required
                />
                <button type="button" className="auth-input-toggle" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? (
                <><Loader2 size={16} className="spin" /> {mode === 'register' ? 'Creando cuenta...' : 'Ingresando...'}</>
              ) : mode === 'register' ? 'Crear cuenta' : 'Iniciar sesión'}
            </button>
          </form>

          {mode === 'login' ? (
            <p className="auth-footer-note">¿No tienes cuenta? <a onClick={() => switchMode('register')}>Regístrate</a></p>
          ) : (
            <p className="auth-footer-note">¿Ya tienes cuenta? <a onClick={() => switchMode('login')}>Inicia sesión</a></p>
          )}
        </div>
      </div>
    </ModalPortal>
  );
};

export default LoginModal;
