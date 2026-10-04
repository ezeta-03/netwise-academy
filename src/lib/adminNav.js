import { LayoutGrid, BookOpen, Tag, Calendar, Users, ShoppingCart, ShieldCheck, History, Settings, Wallet, Headphones } from 'lucide-react';

// Menú del panel de Admin. Lo usan AdminLayout y el editor de contenido de un
// curso cuando lo abre el admin (/admin/curso/:id), para que siga viendo SU
// menú y no el del docente.
export const ADMIN_NAV = [
  { to: '/admin/resumen', label: 'Resumen', icon: LayoutGrid },
  { to: '/admin/cursos', label: 'Cursos y precios', icon: BookOpen, countKey: 'courses' },
  { to: '/admin/promociones', label: 'Promociones', icon: Tag },
  { to: '/admin/grupos', label: 'Aulas y horarios', icon: Calendar },
  { to: '/admin/alumnos', label: 'Alumnos y accesos', icon: Users },
  { to: '/admin/ventas', label: 'Ventas e inscripciones', icon: ShoppingCart, countKey: 'ventas' },
  { to: '/admin/pagos', label: 'Métodos de pago', icon: Wallet },
  { to: '/admin/soporte', label: 'Soporte', icon: Headphones },
];

export const ADMIN_NAV_SECONDARY = [
  { to: '/admin/equipo', label: 'Equipo y permisos', icon: ShieldCheck },
  { to: '/admin/historial', label: 'Historial de cambios', icon: History },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings },
];
