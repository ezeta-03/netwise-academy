import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [activeTab, setActiveTab] = useState('login');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, register, loginWithGoogle, loginWithGithub } = useAuth();

  const doLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    const email = e.target.email.value;
    const password = e.target.password.value;
    
    try {
      await login(email, password);
      // alert("Bienvenida de vuelta"); // Reemplazado por redirección suave
      navigate('/');
    } catch (error) {
      setErrorMsg('Credenciales incorrectas. Usa: demo@netwise.com / 12345');
    }
    setLoading(false);
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
      navigate('/');
    } catch (error) {
      setErrorMsg('Error al registrar usuario: ' + error.message);
    }
    setLoading(false);
  };

  const socialLogin = async (provider) => {
    setErrorMsg('');
    try {
      if (provider === 'Google') await loginWithGoogle();
      if (provider === 'GitHub') await loginWithGithub();
      navigate('/');
    } catch (error) {
      setErrorMsg('Error al conectar con ' + provider);
    }
  };

  return (
    <div id="view-login" className="view active">
      <div className="login-left">
        <div className="login-left-content">
          <div className="login-brand"><span className="dot"></span> Netwise Academy</div>
        </div>
        <div className="floating-cards">
          <div className="float-card">
            <div className="float-card-label">Completado hoy</div>
            <div className="float-card-val">3 lecciones ✓</div>
          </div>
          <div className="float-card" style={{ animationDelay: '-1s' }}>
            <div className="float-card-label">Racha actual</div>
            <div className="float-card-val">🔥 12 días</div>
          </div>
        </div>
        <div className="login-hero-text">
          <h2>Aprende.<br /><em>Practica.</em><br />Domina.</h2>
          <p>Más de 500 cursos en tecnología, diseño y negocios. Aprende a tu ritmo con instructores expertos.</p>
          <div className="login-stats">
            <div>
              <div className="login-stat-num">500+</div>
              <div className="login-stat-label">Cursos activos</div>
            </div>
            <div>
              <div className="login-stat-num">48K</div>
              <div className="login-stat-label">Estudiantes</div>
            </div>
            <div>
              <div className="login-stat-num">98%</div>
              <div className="login-stat-label">Satisfacción</div>
            </div>
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-form-wrap anim-fade-up">
          <div className="login-tabs">
            <button 
              className={`login-tab ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => setActiveTab('login')}
            >
              Iniciar Sesión
            </button>
            <button 
              className={`login-tab ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => setActiveTab('register')}
            >
              Registrarse
            </button>
          </div>

          {activeTab === 'login' ? (
            <div id="form-login">
              <h2 className="login-form-title">Bienvenido 👋</h2>
              <p className="login-form-sub">Ingresa tus datos para continuar aprendiendo</p>
              
              {errorMsg && <div className="error-msg" style={{ display: 'block', marginBottom: '16px' }}>{errorMsg}</div>}

              <form className="form-fields" onSubmit={doLogin}>
                <div className="input-group">
                  <label>Correo electrónico</label>
                  <input className="input" type="email" name="email" placeholder="tu@email.com" defaultValue="demo@netwise.com" required />
                </div>
                <div className="input-group">
                  <label>Contraseña</label>
                  <input className="input" type="password" name="password" placeholder="••••••••" defaultValue="12345" required />
                  <a className="forgot-link">¿Olvidaste tu contraseña?</a>
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary btn-full btn-lg">
                  {loading ? 'Cargando...' : 'Entrar a Netwise Academy →'}
                </button>
              </form>
              
              <div className="divider-text">o continúa con</div>
              <div className="social-btns">
                <button type="button" className="social-btn" onClick={() => socialLogin('Google')}>🌐 Google</button>
                <button type="button" className="social-btn" onClick={() => socialLogin('GitHub')}>🐙 GitHub</button>
              </div>
              <p className="form-footer">¿No tienes cuenta? <a onClick={() => setActiveTab('register')}>Regístrate gratis</a></p>
            </div>
          ) : (
            <div id="form-register">
              <h2 className="login-form-title">Únete gratis ✨</h2>
              <p className="login-form-sub">Crea tu cuenta y empieza a aprender hoy</p>
              
              {errorMsg && <div className="error-msg" style={{ display: 'block', marginBottom: '16px' }}>{errorMsg}</div>}

              <form className="form-fields" onSubmit={doRegister}>
                <div className="input-group">
                  <label>Nombre completo</label>
                  <input className="input" type="text" name="name" placeholder="Tu nombre" required />
                </div>
                <div className="input-group">
                  <label>Correo electrónico</label>
                  <input className="input" type="email" name="email" placeholder="tu@email.com" required />
                </div>
                <div className="input-group">
                  <label>Contraseña</label>
                  <input className="input" type="password" name="password" placeholder="Mínimo 8 caracteres" required />
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
                  {loading ? 'Cargando...' : 'Crear cuenta gratis →'}
                </button>
              </form>
              
              <div className="divider-text">o regístrate con</div>
              <div className="social-btns">
                <button type="button" className="social-btn" onClick={() => socialLogin('Google')}>🌐 Google</button>
                <button type="button" className="social-btn" onClick={() => socialLogin('GitHub')}>🐙 GitHub</button>
              </div>
              <p className="form-footer">¿Ya tienes cuenta? <a onClick={() => setActiveTab('login')}>Inicia sesión</a></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
