import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import logoNetwise from '../assets/NETWISE ACADEMY WEB/logo_netwise.webp';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { toggleSidebar, unreadCount, openLoginModal } = useUI();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenu = () => setIsMenuOpen(false);

  // El navbar nace transparente para superponerse al hero, pero necesita un
  // fondo sólido apenas se hace scroll -- si no, el contenido de la página
  // se ve por debajo y encima de los links (parecía "sin fondo" al scrollear).
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Cerrar sesión debe llevar al Inicio público (no logueado), no dejar que
  // la ruta protegida en la que estabas te rebote sola a /login.
  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  // Hide Navbar on Player and active live-class room pages (similar to original design behavior)
  if (location.pathname.startsWith('/player') || location.pathname.startsWith('/live/') || location.pathname.startsWith('/admin') || location.pathname.startsWith('/teacher') || location.pathname.startsWith('/student') || location.pathname.startsWith('/checkout') || location.pathname === '/masterclass') {
    return null;
  }

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length > 1) return parts[0][0] + parts[1][0];
    return parts[0].substring(0, 2).toUpperCase();
  };

  // "Cursos" no es una página aparte -- son los talleres que ya se muestran
  // en el Inicio (sección #talleres), así que en vez de un link a /catalog
  // lleva ahí: si ya estás en el Inicio, hace scroll directo; si no, navega
  // al Inicio y le pide que haga scroll apenas monte (ver Home.jsx).
  const goToCourses = () => {
    if (location.pathname === '/') {
      document.getElementById('talleres')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/', { state: { scrollTo: 'talleres' } });
    }
    closeMenu();
  };

  // Visitante (sin sesión): solo Cursos + Nuestra Metodología, como en el
  // Figma. "Mi Aprendizaje" / "En Vivo" son navegación real de producto y
  // solo tienen sentido una vez logueado -- ver nota de roles más abajo.
  const navItems = currentUser
    ? [
        { to: '/catalog', label: 'Explorar' },
        ...(currentUser.role === 'student' ? [{ to: '/student', label: 'Mi Campus' }] : []),
      ]
    : [
        { action: goToCourses, label: 'Cursos' },
        { to: '/metodologia', label: 'Nuestra Metodología' },
      ];

  return (
    <>
      {(location.pathname === '/' || location.pathname === '/metodologia') && (
        <div className="home-promo">Promociones y descuentos disponibles hasta el 30/09</div>
      )}
      <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`} id="navbar">
        <Link to="/" className="nav-logo">
          <img src={logoNetwise} alt="Netwise Academy" className="nav-logo-img" />
        </Link>

        <div className="nav-links">
          {navItems.map((item) => (
            item.action ? (
              <button key={item.label} type="button" className="nav-link nav-link-btn" onClick={item.action}>{item.label}</button>
            ) : (
              <Link key={item.to} to={item.to} className={`nav-link ${location.pathname === item.to ? 'active' : ''}`}>{item.label}</Link>
            )
          ))}
        </div>

        <div className="nav-right">
          {currentUser ? (
            <div className="nav-right-user nav-desktop-only">
              {currentUser.role === 'admin' && (
                <Link to="/admin" className="nav-link" style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--accent)' }}>Panel Admin</Link>
              )}
              {currentUser.role === 'teacher' && (
                <Link to="/teacher" className="nav-link" style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--accent)' }}>Mis Cursos</Link>
              )}

              <button className="btn-icon" title="Notificaciones" onClick={toggleSidebar} style={{ position: 'relative' }}>
                <Bell size={18} />
                {unreadCount > 0 && <span style={{ position: 'absolute', top: -2, right: -2, background: 'var(--rose)', width: 10, height: 10, borderRadius: '50%' }}></span>}
              </button>

              <Link to="/profile" className="nav-avatar" title="Mi Perfil" style={{ textDecoration: 'none' }}>
                {currentUser.displayName ? getInitials(currentUser.displayName) : getInitials(currentUser.email)}
              </Link>

              <button className="btn-icon" title="Cerrar sesión" onClick={handleLogout}>
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="nav-right-guest nav-desktop-only">
              <button type="button" className="btn btn-primary btn-sm nav-cta" onClick={openLoginModal}>Inscribirme</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={openLoginModal}>Plataforma</button>
            </div>
          )}

          {/* En teléfono los botones de escritorio se ocultan: el acceso (o la salida) queda aquí y en el menú. */}
          {currentUser && (
            <button type="button" className="btn-icon nav-mobile-logout" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={handleLogout}>
              <LogOut size={18} />
            </button>
          )}
          {!currentUser && (
            <button type="button" className="btn btn-primary btn-sm nav-mobile-login" onClick={openLoginModal}>Iniciar sesión</button>
          )}

          <button className="hamburger-btn" title="Menú" onClick={() => setIsMenuOpen(true)}>
            <Menu size={22} />
          </button>
        </div>
      </nav>

      <div className={`overlay ${isMenuOpen ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}></div>

      <div className={`mobile-menu ${isMenuOpen ? 'open' : ''}`}>
        <div className="mm-header">
          <img src={logoNetwise} alt="Netwise Academy" className="nav-logo-img" />
          <button className="btn-icon" onClick={() => setIsMenuOpen(false)}><X size={18} /></button>
        </div>

        {currentUser && (
          <div className="mm-user-card">
            <div className="nav-avatar" style={{ width: 44, height: 44, fontSize: '1rem' }}>
              {currentUser.displayName ? getInitials(currentUser.displayName) : getInitials(currentUser.email)}
            </div>
            <div className="mm-user-info">
              <div className="mm-user-name">{currentUser.displayName || currentUser.email}</div>
              <div className="mm-user-email">{currentUser.email}</div>
            </div>
          </div>
        )}

        <div className="mm-links">
          {navItems.map((item) => (
            item.action ? (
              <button key={item.label} type="button" className="mm-link mm-link-btn" onClick={item.action}>{item.label}</button>
            ) : (
              <Link key={item.to} to={item.to} className={`mm-link ${location.pathname === item.to ? 'active' : ''}`} onClick={closeMenu}>{item.label}</Link>
            )
          ))}
          {currentUser?.role === 'admin' && <Link to="/admin" className="mm-link" style={{ color: 'var(--accent)' }} onClick={closeMenu}>Panel Admin</Link>}
          {currentUser?.role === 'teacher' && <Link to="/teacher" className="mm-link" style={{ color: 'var(--accent)' }} onClick={closeMenu}>Mis Cursos</Link>}
          {currentUser && <Link to="/profile" className="mm-link" onClick={closeMenu}>Mi Perfil</Link>}
        </div>

        <div className="mm-footer">
          {currentUser ? (
            <button className="btn btn-ghost btn-full" onClick={() => { closeMenu(); handleLogout(); }}>
              <LogOut size={16} /> Cerrar sesión
            </button>
          ) : (
            <div className="mm-footer-guest">
              <button type="button" className="btn btn-primary btn-full" onClick={() => { closeMenu(); openLoginModal(); }}>Inscribirme</button>
              <button type="button" className="btn btn-ghost btn-full" onClick={() => { closeMenu(); openLoginModal(); }}>Iniciar sesión</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Navbar;
