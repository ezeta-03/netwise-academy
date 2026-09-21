/**
 * Recibe los leads del sitio (formulario del hero de Inicio y "Descargar
 * programa" de cada curso -- ver captureProgramLead en src/lib/db.js) y los
 * agrega como fila nueva a esta hoja. No usa ninguna librería externa, todo
 * corre dentro de Google Apps Script.
 *
 * ── CÓMO INSTALARLO ──────────────────────────────────────────────────────
 * 1. Crea un Google Sheet nuevo (o abre uno que ya uses para esto).
 * 2. Extensiones > Apps Script.
 * 3. Borra el contenido de Code.gs que trae por defecto y pega TODO este
 *    archivo.
 * 4. Cambia SHARED_SECRET (abajo) por cualquier texto propio, largo y
 *    difícil de adivinar -- es lo único que evita que alguien que encuentre
 *    la URL pública pueda meter filas falsas en tu hoja.
 * 5. Guarda (el ícono de disco o Ctrl+S).
 * 6. Implementar > Nueva implementación:
 *      - Tipo: "Aplicación web".
 *      - Descripción: la que quieras (ej. "Leads Netwise Academy").
 *      - Ejecutar como: "Yo" (tu cuenta).
 *      - Quién tiene acceso: "Cualquier usuario" (Anyone) -- así el sitio
 *        puede escribir sin que el visitante inicie sesión en Google.
 * 7. Al implementar, Google va a pedirte autorizar el script (acceso a tus
 *    Sheets) -- esa autorización la das tú, desde tu propia cuenta.
 * 8. Copia la URL que termina en "/exec". Esa es tu VITE_LEADS_WEBAPP_URL.
 * 9. En el proyecto (.env.local), agrega:
 *      VITE_LEADS_WEBAPP_URL=<la URL que copiaste>
 *      VITE_LEADS_WEBAPP_SECRET=<el mismo texto que pusiste en SHARED_SECRET>
 * 10. Reinicia `npm run dev` (Vite solo lee el .env al arrancar).
 *
 * Cada vez que cambies este código, tienes que hacer "Implementar > Gestionar
 * implementaciones > editar (lápiz) > Nueva versión" para que el cambio se
 * refleje en la URL ya publicada -- si no, sigue corriendo la versión vieja.
 * ─────────────────────────────────────────────────────────────────────────
 */

const SHEET_NAME = 'Leads';
const SHARED_SECRET = 'CAMBIA-ESTA-CLAVE'; // ver paso 4 arriba

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: 'sin datos' });
    }

    const data = JSON.parse(e.postData.contents);

    if (SHARED_SECRET && data.secret !== SHARED_SECRET) {
      return jsonResponse({ ok: false, error: 'no autorizado' });
    }

    const sheet = getOrCreateSheet();
    sheet.appendRow([
      data.createdAt ? new Date(data.createdAt) : new Date(),
      data.source || '',
      data.name || '',
      data.email || '',
      data.phone || '',
      data.courseTitle || '',
      data.courseId != null ? data.courseId : '',
      data.marketingConsent ? 'Sí' : 'No',
    ]);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

// GET solo para poder abrir la URL en el navegador y confirmar que la
// implementación quedó publicada -- no escribe nada.
function doGet() {
  return jsonResponse({ ok: true, message: 'Leads webhook activo. Usa POST para registrar un lead.' });
}

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Fecha', 'Origen', 'Nombre', 'Correo', 'Teléfono', 'Taller de interés', 'Curso ID', 'Acepta marketing']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
