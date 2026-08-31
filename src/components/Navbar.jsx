import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Bell, LogOut, Menu, X, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useTheme } from '../context/ThemeContext';

const Navbar = () => {
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const { toggleSidebar, unreadCount } = useUI();
  const { theme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenu = () => setIsMenuOpen(false);

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

  const navItems = [
    { to: '/', label: 'Inicio' },
    { to: '/catalog', label: 'Explorar' },
    { to: '/my-learning', label: 'Mi Aprendizaje' },
    { to: '/live', label: 'En Vivo' },
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
          <div className="search-bar">
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Buscar cursos..." />
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
