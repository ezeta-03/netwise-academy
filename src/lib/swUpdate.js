// Registro del service worker (PWA) con actualización garantizada.
//
// Antes el SW se registraba sin más (registerSW.js inyectado): tras un deploy,
// quien ya había visitado la web seguía viendo la versión vieja guardada en
// caché hasta cerrar todas las pestañas y volver. Ahora el SW nuevo se activa
// solo (skipWaiting + clientsClaim en vite.config.js) y la página se recarga
// para mostrar la versión nueva -- pero en un momento seguro: nunca con un
// formulario o modal a medio llenar; en ese caso espera a que la pestaña se
// oculte y vuelva a verse.
const CHECK_EVERY_MS = 30 * 60 * 1000;

const busy = () => {
  const el = document.activeElement;
  const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  const modalOpen = !!document.querySelector('.admin-modal-overlay, .auth-modal-overlay, [aria-modal="true"]');
  return typing || modalOpen;
};

export const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  // Si la página ya estaba controlada por un SW, un cambio de controlador
  // significa "hay versión nueva". En la primera visita no se recarga.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  const reload = () => { if (!reloading) { reloading = true; window.location.reload(); } };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    if (!busy()) { reload(); return; }
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVisible);
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
      // Busca versión nueva cada cierto tiempo y al volver a la pestaña.
      const check = () => reg.update().catch(() => {});
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    }).catch(() => {});
  });
};
