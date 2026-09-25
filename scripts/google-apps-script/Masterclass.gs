/**
 * Inscripciones a las MASTERCLASS gratuitas (landing netwiseacademy.pe/masterclass
 * -- ver captureMasterclassLead en src/lib/db.js). Va en un Google Sheet PROPIO,
 * separado del de leads generales (Code.gs).
 *
 * ── CÓMO INSTALARLO ──────────────────────────────────────────────────────
 * 1. Crea un Google Sheet nuevo, por ejemplo "Masterclass Netwise - Octubre 2026".
 * 2. Extensiones > Apps Script.
 * 3. Borra el contenido de Code.gs que trae por defecto y pega TODO este archivo.
 * 4. Cambia SHARED_SECRET (abajo) por un texto propio, largo y difícil de
 *    adivinar (NO reutilices el del Sheet de leads).
 * 5. Guarda (Ctrl+S).
 * 6. Implementar > Nueva implementación:
 *      - Tipo: "Aplicación web".
 *      - Descripción: "Masterclass Netwise".
 *      - Ejecutar como: "Yo".
 *      - Quién tiene acceso: "Cualquier usuario".
 * 7. Autoriza el script con tu cuenta de Google cuando lo pida.
 * 8. Copia la URL que termina en "/exec".
 * 9. En el proyecto (.env.local) agrega:
 *      VITE_MASTERCLASS_WEBAPP_URL=<la URL /exec>
 *      VITE_MASTERCLASS_WEBAPP_SECRET=<el mismo texto de SHARED_SECRET>
 *    y vuelve a publicar el sitio (npm run deploy).
 *
 * Si cambias este código: Implementar > Gestionar implementaciones > editar
 * (lápiz) > Versión: "Nueva versión". Si no, la URL sigue con la versión vieja.
 *
 * Las inscripciones también quedan en Firestore (colección masterclassLeads),
 * así que si el Sheet falla o se configura tarde, no se pierde ninguna.
 * ─────────────────────────────────────────────────────────────────────────
 */

const SHEET_NAME = 'Inscripciones';
const SHARED_SECRET = 'CAMBIA-ESTA-CLAVE'; // ver paso 4

// Mismos ids que src/data/masterclasses.js
const MASTERCLASSES = [
  { id: 'branding', title: 'Branding y Gestión de Marca (06/10)' },
  { id: 'marketing', title: 'Marketing Digital (07/10)' },
  { id: 'negocios', title: 'Creación de Negocios Digitales (14/10)' },
];
// Agregadas cuando la hoja ya existía: van al final para no desplazar columnas.
const MASTERCLASSES_ADDED = [
  { id: 'redes', title: 'Estrategia de Redes Sociales (15/10)' },
];

const HEADERS = [
  'Fecha', 'Nombre', 'Apellido', 'Correo', 'WhatsApp',
  ...MASTERCLASSES.map((m) => m.title),
  'Total elegidas', 'Acepta términos', 'Acepta promociones', 'Origen',
  ...MASTERCLASSES_ADDED.map((m) => m.title),
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    if (!e || !e.postData || !e.postData.contents) return jsonResponse({ ok: false, error: 'sin datos' });

    const data = JSON.parse(e.postData.contents);
    if (SHARED_SECRET && data.secret !== SHARED_SECRET) return jsonResponse({ ok: false, error: 'no autorizado' });

    const picked = Array.isArray(data.masterclasses) ? data.masterclasses : [];
    if (!picked.length || !data.email) return jsonResponse({ ok: false, error: 'datos incompletos' });

    lock.waitLock(10000);
    const sheet = getOrCreateSheet();
    sheet.appendRow([
      data.createdAt ? new Date(data.createdAt) : new Date(),
      clean(data.firstName),
      clean(data.lastName),
      clean(data.email).toLowerCase(),
      // Apóstrofo: que Sheets no convierta el número en fórmula ni le quite el "+".
      "'" + String(data.whatsapp == null ? '' : data.whatsapp).trim().slice(0, 30),
      ...MASTERCLASSES.map((m) => (picked.indexOf(m.id) >= 0 ? 'Sí' : 'No')),
      picked.length,
      data.termsAcceptedAt ? 'Sí' : 'No',
      data.marketingConsent ? 'Sí' : 'No',
      clean(data.source) || 'landing',
      ...MASTERCLASSES_ADDED.map((m) => (picked.indexOf(m.id) >= 0 ? 'Sí' : 'No')),
    ]);
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) { /* sin lock tomado */ }
  }
}

// GET solo para comprobar en el navegador que la implementación está activa.
function doGet() {
  return jsonResponse({ ok: true, message: 'Webhook de masterclass activo. Usa POST para registrar una inscripción.' });
}

// Evita inyección de fórmulas (=, +, -, @ al inicio) y recorta el largo.
function clean(value) {
  const s = String(value == null ? '' : value).trim().slice(0, 200);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#7d33ff').setFontColor('#ffffff');
    sheet.getRange('A:A').setNumberFormat('dd/mm/yyyy hh:mm');
  } else if (sheet.getLastColumn() < HEADERS.length) {
    // Hoja creada antes de agregar masterclass: completa los encabezados nuevos.
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      .setFontWeight('bold').setBackground('#7d33ff').setFontColor('#ffffff');
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
