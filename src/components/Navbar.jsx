import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, LogOut, Menu, X, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useTheme } from '../context/ThemeContext';
import { useCourseOfferings } from '../context/CourseOfferingsContext';
import { COURSE_THUMBNAILS } from '../lib/courseThumbnails';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { toggleSidebar, unreadCount } = useUI();
  const { theme, toggleTheme } = useTheme();
  const { courses: COURSES } = useCourseOfferings();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenu = () => setIsMenuOpen(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchResults = searchQuery.trim()
    ? COURSES.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.summary.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  const goToSearchResult = (courseId) => {
    setSearchQuery('');
    setSearchOpen(false);
    navigate(`/course/${courseId}`);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchResults.length > 0) goToSearchResult(searchResults[0].id);
    if (e.key === 'Escape') { setSearchOpen(false); e.target.blur(); }
  };

  // Hide Navbar on Login, Player and active live-class room pages (similar to original design behavior)
  if (location.pathname === '/login' || location.pathname.startsWith('/player') || location.pathname.startsWith('/live/')) {
    return null;
  }

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length > 1) return parts[0][0] + parts[1][0];
    return parts[0].substring(0, 2).toUpperCase();
  };

  // "Mi Aprendizaje" es el dashboard de progreso del estudiante -- no aplica
  // a un docente o admin. "En Vivo" (la lista para unirse a una clase) tiene
  // sentido para estudiante y docente, pero no para admin: su propia
  // pestaña "Actividad" ya le muestra todas las clases con más control
  // (cancelar/eliminar), así que mostrarle también la vista de estudiante
  // sería redundante.
  const navItems = [
    { to: '/', label: 'Inicio' },
    { to: '/catalog', label: 'Explorar' },
    ...(currentUser?.role === 'student' ? [{ to: '/my-learning', label: 'Mi Aprendizaje' }] : []),
    ...(currentUser?.role === 'student' || currentUser?.role === 'teacher' ? [{ to: '/live', label: 'En Vivo' }] : []),
  ];

  return (
    <>
      <nav className="navbar" id="navbar">
        <Link to="/" className="nav-logo">
          <span className="logo-dot"></span> Netwise Academy
        </Link>

        <div className="nav-links">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} className={`nav-link ${location.pathname === item.to ? 'active' : ''}`}>{item.label}</Link>
          ))}
        </div>

        <div className="nav-right">
          <div className="search-bar" style={{ position: 'relative' }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar cursos..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              onKeyDown={handleSearchKeyDown}
            />
            {searchOpen && searchQuery.trim() && (
              <div className="search-dropdown">
                {searchResults.length > 0 ? searchResults.map(c => (
                  <div key={c.id} className="search-dropdown-item" onMouseDown={() => goToSearchResult(c.id)}>
                    <img src={COURSE_THUMBNAILS[c.id]} alt="" />
                    <div>
                      <div className="search-dropdown-title">{c.title}</div>
                      <div className="search-dropdown-meta">{c.instructor}</div>
                    </div>
                  </div>
                )) : (
                  <div className="search-dropdown-empty">Sin resultados para "{searchQuery}"</div>
                )}
              </div>
            )}
          </div>
          <button className="btn-icon" title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="btn-icon" title="Notificaciones" onClick={toggleSidebar} style={{ position: 'relative' }}>
            <Bell size={18} />
            {unreadCount > 0 && <span style={{ position: 'absolute', top: -2, right: -2, background: 'var(--rose)', width: 10, height: 10, borderRadius: '50%' }}></span>}
          </button>

          {currentUser ? (
            <div className="nav-right-user nav-desktop-only">
              {currentUser.role === 'admin' && (
                <Link to="/admin" className="nav-link" style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--accent)' }}>Panel Admin</Link>
              )}
              {currentUser.role === 'teacher' && (
                <Link to="/teacher" className="nav-link" style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--amber)' }}>Mis Cursos</Link>
              )}

              <Link to="/profile" className="nav-avatar" title="Mi Perfil" style={{ textDecoration: 'none' }}>
                {currentUser.displayName ? getInitials(currentUser.displayName) : getInitials(currentUser.email)}
              </Link>

              <button className="btn-icon" title="Cerrar sesión" onClick={logout}>
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm nav-desktop-only">Iniciar sesión</Link>
          )}

          <button className="hamburger-btn" title="Menú" onClick={() => setIsMenuOpen(true)}>
            <Menu size={22} />
          </button>
        </div>
      </nav>

      <div className={`overlay ${isMenuOpen ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}></div>

      <div className={`mobile-menu ${isMenuOpen ? 'open' : ''}`}>
        <div className="mm-header">
          <span className="nav-logo"><span className="logo-dot"></span> Netwise Academy</span>
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
            <Link key={item.to} to={item.to} className={`mm-link ${location.pathname === item.to ? 'active' : ''}`} onClick={closeMenu}>{item.label}</Link>
          ))}
          {currentUser?.role === 'admin' && <Link to="/admin" className="mm-link" style={{ color: 'var(--accent)' }} onClick={closeMenu}>Panel Admin</Link>}
          {currentUser?.role === 'teacher' && <Link to="/teacher" className="mm-link" style={{ color: 'var(--amber)' }} onClick={closeMenu}>Mis Cursos</Link>}
          {currentUser && <Link to="/profile" className="mm-link" onClick={closeMenu}>Mi Perfil</Link>}
        </div>

        <button className="mm-theme-toggle" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>

        <div className="mm-footer">
          {currentUser ? (
            <button className="btn btn-ghost btn-full" onClick={() => { closeMenu(); logout(); }}>
              <LogOut size={16} /> Cerrar sesión
            </button>
          ) : (
            <Link to="/login" className="btn btn-primary btn-full" onClick={closeMenu}>Iniciar sesión</Link>
          )}
        </div>
      </div>
    </>
  );
};

export default Navbar;
