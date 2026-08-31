import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, Eye, EyeOff, Loader2, AlertCircle, ArrowRight } from 'lucide-react';

const Login = () => {
  const [activeTab, setActiveTab] = useState('login');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { currentUser, login, register, loginWithGoogle, loginWithGithub } = useAuth();

  // La sesión (currentUser) se confirma de forma asíncrona a través del
  // listener de Firebase Auth, que puede tardar un tick más que la propia
  // promesa de login/registro. Navegar aquí -en reacción al cambio real de
  // sesión- evita el bug de tener que enviar el formulario dos veces.
  useEffect(() => {
    if (currentUser) navigate('/', { replace: true });
  }, [currentUser, navigate]);

  const doLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    const email = e.target.email.value;
    const password = e.target.password.value;

    try {
      await login(email, password);
      // No hay navigate aquí: el useEffect de arriba se encarga en cuanto
      // currentUser quede confirmado.
    } catch {
      setErrorMsg('Credenciales incorrectas. Usa: demo@netwise.com / 12345');
      setLoading(false);
    }
  };

  const doRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    const name = e.target.name.value;
    const email = e.target.email.value;
    const password = e.target.password.value;

    try {
      await register(email, password, name);
    } catch (error) {
      setErrorMsg('Error al registrar usuario: ' + error.message);
      setLoading(false);
    }
  };

  const socialLogin = async (provider) => {
    setErrorMsg('');
    setSocialLoading(provider);
    try {
      if (provider === 'Google') await loginWithGoogle();
      if (provider === 'GitHub') await loginWithGithub();
    } catch {
      setErrorMsg('Error al conectar con ' + provider);
      setSocialLoading(null);
    }
  };

  const switchTab = (tab) => {
    setErrorMsg('');
    setActiveTab(tab);
  };

  return (
    <div id="view-login" className="view active">
      <div className="login-bg-glow"></div>
      <div className="login-bg-grid"></div>

      <div className="login-card anim-fade-up">
        <div className="login-card-brand">
          <div className="brand-row"><span className="dot"></span> Netwise Academy</div>
          <div className="brand-tagline">Aprende. Practica. Domina.</div>
        </div>

        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => switchTab('login')}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            className={`login-tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => switchTab('register')}
          >
            Registrarse
          </button>
        </div>

        {activeTab === 'login' ? (
            <div id="form-login">
              <h2 className="login-form-title">Bienvenido 👋</h2>
              <p className="login-form-sub">Ingresa tus datos para continuar aprendiendo</p>
              <p className="demo-hint">Demo: demo@netwise.com / 12345</p>

              {errorMsg && (
                <div className="error-msg">
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form className="form-fields" onSubmit={doLogin}>
                <div className="input-group">
                  <label>Correo electrónico</label>
                  <div className="input-icon-wrap">
                    <Mail size={17} className="input-icon" />
                    <input
                      className="input has-icon"
                      type="email"
                      name="email"
                      placeholder="tu@email.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>
                <div className="input-group">
                  <div className="input-label-row">
                    <label>Contraseña</label>
                    <a className="forgot-link">¿Olvidaste tu contraseña?</a>
                  </div>
                  <div className="input-icon-wrap">
                    <Lock size={17} className="input-icon" />
                    <input
                      className="input has-icon has-toggle"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary btn-full btn-lg">
                  {loading ? (
                    <><Loader2 size={18} className="spin" /> Ingresando...</>
                  ) : (
                    <>Entrar a Netwise Academy <ArrowRight size={16} /></>
                  )}
                </button>
              </form>

              <div className="divider-text">o continúa con</div>
              <div className="social-btns">
                <button
                  type="button"
                  className="social-btn"
                  disabled={socialLoading !== null}
                  onClick={() => socialLogin('Google')}
                >
                  {socialLoading === 'Google' ? <Loader2 size={16} className="spin" /> : '🌐'} Google
                </button>
                <button
                  type="button"
                  className="social-btn"
                  disabled={socialLoading !== null}
                  onClick={() => socialLogin('GitHub')}
                >
                  {socialLoading === 'GitHub' ? <Loader2 size={16} className="spin" /> : '🐙'} GitHub
                </button>
              </div>
              <p className="form-footer">¿No tienes cuenta? <a onClick={() => switchTab('register')}>Regístrate gratis</a></p>
            </div>
          ) : (
            <div id="form-register">
              <h2 className="login-form-title">Únete gratis ✨</h2>
              <p className="login-form-sub">Crea tu cuenta y empieza a aprender hoy</p>

              {errorMsg && (
                <div className="error-msg">
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form className="form-fields" onSubmit={doRegister}>
                <div className="input-group">
                  <label>Nombre completo</label>
                  <div className="input-icon-wrap">
                    <User size={17} className="input-icon" />
                    <input className="input has-icon" type="text" name="name" placeholder="Tu nombre" autoComplete="name" required />
                  </div>
                </div>
                <div className="input-group">
                  <label>Correo electrónico</label>
                  <div className="input-icon-wrap">
                    <Mail size={17} className="input-icon" />
                    <input className="input has-icon" type="email" name="email" placeholder="tu@email.com" autoComplete="email" required />
                  </div>
                </div>
                <div className="input-group">
                  <label>Contraseña</label>
                  <div className="input-icon-wrap">
                    <Lock size={17} className="input-icon" />
                    <input
                      className="input has-icon has-toggle"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>
                <div className="input-group">
                  <label>¿Qué quieres aprender?</label>
                  <select className="input" name="interest">
                    <option>Desarrollo Web</option>
                    <option>Diseño UX/UI</option>
                    <option>Marketing</option>
                    <option>Negocios</option>
                  </select>
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary btn-full btn-lg">
                  {loading ? (
                    <><Loader2 size={18} className="spin" /> Creando cuenta...</>
                  ) : (
                    <>Crear cuenta gratis <ArrowRight size={16} /></>
                  )}
                </button>
              </form>

              <div className="divider-text">o regístrate con</div>
              <div className="social-btns">
                <button
                  type="button"
                  className="social-btn"
                  disabled={socialLoading !== null}
                  onClick={() => socialLogin('Google')}
                >
                  {socialLoading === 'Google' ? <Loader2 size={16} className="spin" /> : '🌐'} Google
                </button>
                <button
                  type="button"
                  className="social-btn"
                  disabled={socialLoading !== null}
                  onClick={() => socialLogin('GitHub')}
                >
                  {socialLoading === 'GitHub' ? <Loader2 size={16} className="spin" /> : '🐙'} GitHub
                </button>
              </div>
              <p className="form-footer">¿Ya tienes cuenta? <a onClick={() => switchTab('login')}>Inicia sesión</a></p>
            </div>
          )}
      </div>
    </div>
  );
};

export default Login;
