// Enlaces que el docente escribe a mano (material, grabación): solo http(s)
// -- también https, que es lo normal. Evita que un "javascript:..." quede
// como href de un botón de descarga.
export const isSafeLink = (url) => /^https?:\/\/[^\s<>"']+$/i.test(String(url || '').trim());

// Los seeds de contenido dejan "Pendiente de subir" / "Pendiente de grabar"
// como url de materiales y grabaciones que todavía no existen. Esas cadenas
// no son enlaces: la UI las muestra como "pendiente" en vez de un botón que
// abre una pestaña rota.
export const isPendingUrl = (url) => !url || !String(url).trim() || /^pendiente/i.test(String(url).trim());
