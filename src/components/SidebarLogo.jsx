import React from 'react';
import { Link } from 'react-router-dom';
import logoNetwise from '../assets/NETWISE ACADEMY WEB/logo_netwise.webp';
import iconNetwise from '../assets/NETWISE ACADEMY WEB/favicon/ICONO NETWISE.svg';

// Logo del sidebar: el logotipo completo con el sidebar expandido (y en el
// cajón móvil) y solo el ícono cuando está colapsado o en la barra de íconos
// de tablet. El cambio lo hace el CSS (.admin-sidebar.collapsed y el media
// query de 900px), ver .admin-sidebar-logo-img / .admin-sidebar-icon-img.
// Lleva al Inicio de la web pública (/inicio: "/" mandaría de vuelta al panel).
const SidebarLogo = () => (
  <Link to="/inicio" className="admin-sidebar-logo-link" title="Ir a la web de Netwise Academy">
    <img src={logoNetwise} alt="Netwise Academy" className="admin-sidebar-logo-img" />
    <img src={iconNetwise} alt="Netwise" className="admin-sidebar-icon-img" />
  </Link>
);

export default SidebarLogo;
