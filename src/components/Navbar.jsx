import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Bell, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';

const Navbar = () => {
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const { toggleSidebar, unreadCount } = useUI();

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

  return (
    <nav className="navbar" id="navbar">
      <Link to="/" className="nav-logo">
        <span className="logo-dot"></span> Netwise Academy
      </Link>
      
      <div className="nav-links">
        <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>Inicio</Link>
        <Link to="/catalog" className={`nav-link ${location.pathname === '/catalog' ? 'active' : ''}`}>Explorar</Link>
        <Link to="/my-learning" className={`nav-link ${location.pathname === '/my-learning' ? 'active' : ''}`}>Mi Aprendizaje</Link>
        <Link to="/live" className={`nav-link ${location.pathname === '/live' ? 'active' : ''}`}>En Vivo</Link>
      </div>

      <div className="nav-right">
        <div className="search-bar">
          <Search size={16} className="search-icon" />
          <input type="text" placeholder="Buscar cursos..." />
        </div>
        <button className="btn-icon" title="Notificaciones" onClick={toggleSidebar} style={{ position: 'relative' }}>
          <Bell size={18} />
          {unreadCount > 0 && <span style={{ position: 'absolute', top: -2, right: -2, background: 'var(--rose)', width: 10, height: 10, borderRadius: '50%' }}></span>}
        </button>

        
        {currentUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
          <Link to="/login" className="btn btn-primary btn-sm">Iniciar sesión</Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

