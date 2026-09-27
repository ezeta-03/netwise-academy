// Compatibilidad: las páginas viejas guardadas en caché (antes del registro en
// src/lib/swUpdate.js) todavía piden este archivo. Registra el SW nuevo para
// que esos visitantes también pasen a la última versión.
if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js', { scope: '/' }); }); }
