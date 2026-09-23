import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { useAuth } from '../context/AuthContext';

// Botón/gesto "atrás" en teléfono (o app instalada): nunca saca al usuario de la
// app de golpe. Retrocede paso a paso por lo que navegó; si ya no hay pasos (o
// entró directo a una pantalla interna) lo lleva al Inicio de su rol, y recién
// cuando vuelve a pedir "atrás" desde el Inicio pregunta si quiere salir.
//
// Cómo funciona: al cargar se inserta una entrada "base" detrás de la primera
// pantalla. Retroceder hasta ella no sale del sitio; se detecta en `popstate`,
// se empuja de nuevo el Inicio y, si ya estaba en el Inicio, se abre el modal.
// Al aceptar se retrocede 2 entradas (base + Inicio) para salir de verdad.

const ROOTS = new Set(['/', '/admin', '/admin/resumen', '/teacher', '/teacher/inicio', '/student', '/student/inicio']);
const HOME_BY_ROLE = { admin: '/admin/resumen', teacher: '/teacher/inicio', student: '/student/inicio' };

const normalize = (path) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

// Solo pantallas táctiles o app instalada: en escritorio el botón atrás se deja en paz.
const isTouchOrInstalled = () => {
  try {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches
      || window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  } catch { return false; }
};

const BackGuard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const pathRef = useRef(normalize(location.pathname));
  const homeRef = useRef('/');
  const exiting = useRef(false);
  // `navigate` cambia en cada ruta: se lee desde un ref para suscribir el popstate UNA sola vez.
  // (Si el listener se re-suscribiera por ruta, React lo desmontaría en pleno popstate, antes de
  // que el navegador lo invoque, y el retroceso a la entrada base pasaría sin ser detectado.)
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  // Estas refs guardan la pantalla en la que estaba el usuario ANTES de retroceder. El router
  // puede procesar el popstate antes que este componente: al llegar a la entrada base (que repite
  // la URL de la primera pantalla) NO se actualiza la ref, para no perder de dónde venía.
  useEffect(() => {
    if (window.history.state?.guardBase) return;
    pathRef.current = normalize(location.pathname);
  }, [location.pathname]);
  useEffect(() => { homeRef.current = HOME_BY_ROLE[currentUser?.role] || '/'; }, [currentUser?.role]);

  useEffect(() => {
    if (!isTouchOrInstalled()) return undefined;
    const state = window.history.state || {};
    // Recargar la página (F5) no debe apilar otra entrada base: la primera sigue en el
    // historial de la pestaña, así que la marca vive en sessionStorage.
    let installed = false;
    try { installed = sessionStorage.getItem('nw_back_guard') === '1'; } catch { /* sin storage: se instala igual */ }
    if (!installed) {
      try { sessionStorage.setItem('nw_back_guard', '1'); } catch { /* ignorar */ }
      window.history.replaceState({ ...state, guardBase: true }, '', window.location.href);
      window.history.pushState(state, '', window.location.href);
    }

    const onPop = (e) => {
      if (!e.state?.guardBase || exiting.current) return;
      const wasHome = ROOTS.has(pathRef.current);
      navigateRef.current(homeRef.current);
      if (wasHome) setOpen(true);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const stay = () => setOpen(false);
  const leave = () => {
    exiting.current = true;
    setOpen(false);
    // Base + Inicio: 2 entradas atrás queda fuera del sitio (en una app instalada la cierra).
    window.history.go(-2);
    // Si no había historial previo (pestaña nueva) el navegador no se mueve: se intenta cerrar
    // y se reactiva el guardián para no dejar al usuario sin protección.
    setTimeout(() => { window.close(); exiting.current = false; }, 500);
  };

  if (!open) return null;
  return (
    <ModalPortal>
      <div className="admin-modal-overlay" onClick={stay}>
        <div className="admin-modal back-guard-modal" role="dialog" aria-modal="true" aria-labelledby="back-guard-title" onClick={(e) => e.stopPropagation()}>
          <div className="back-guard-icon"><LogOut size={22} /></div>
          <h2 id="back-guard-title" className="admin-modal-title">¿Realmente quieres salir?</h2>
          <p className="admin-modal-sub">Vas a salir de Netwise Academy. Puedes volver cuando quieras.</p>
          <div className="admin-modal-actions back-guard-actions">
            <button type="button" className="btn btn-ghost" onClick={stay}>Quedarme</button>
            <button type="button" className="btn btn-primary" onClick={leave}>Salir</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default BackGuard;
