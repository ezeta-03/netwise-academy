import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ROLE_LABEL = { admin: 'Administrador', teacher: 'Docente', student: 'Estudiante' };

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
};

// Iniciales del usuario (arriba a la derecha): al tocarlas se abre el menú con
// sus datos y "Cerrar sesión". Es el único lugar desde donde se cierra sesión,
// igual en escritorio y en teléfono. `avatarClassName` adapta el círculo al
// panel (claro) o a la barra pública (oscura).
const UserMenu = ({ avatarClassName = 'admin-avatar' }) => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!currentUser) return null;
  const name = currentUser.displayName || currentUser.email;

  // Cerrar sesión lleva al Inicio público, no deja que la ruta protegida en la
  // que estabas te rebote sola.
  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button" className={`user-menu-trigger ${avatarClassName}`}
        aria-haspopup="menu" aria-expanded={open} aria-label={`Cuenta de ${name}`} title={name}
        onClick={() => setOpen((v) => !v)}
      >
        {getInitials(name)}
      </button>
      {open && (
        <div className="user-menu-panel" role="menu">
          <div className="user-menu-head">
            <div className="user-menu-name">{name}</div>
            {currentUser.displayName && <div className="user-menu-email">{currentUser.email}</div>}
            <span className="user-menu-role">{ROLE_LABEL[currentUser.role] || 'Usuario'}</span>
          </div>
          <button type="button" role="menuitem" className="user-menu-item user-menu-logout" onClick={handleLogout}>
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
