// Sube el sílabo (PDF) de los 4 cursos a producción, igual que el botón
// "Sílabo" de Cursos y precios (A8): el PDF va a Storage (syllabi/{curso}/...),
// su link a courseOfferings/{curso}.syllabus y su texto a courseSyllabi/{curso},
// que es lo que lee el Asistente IA. Usa los mismos PDF que ya ofrece la web.
//
// Uso: node scripts/uploadSyllabi.mjs            (solo los cursos sin sílabo)
//      node scripts/uploadSyllabi.mjs --force    (reemplaza los que ya tienen)
//      node scripts/uploadSyllabi.mjs --dry-run  (muestra qué haría)
// Requiere serviceAccountKey.json en la raíz (Admin SDK, no toca las reglas).
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const DIR = new URL('../src/assets/NETWISE ACADEMY WEB/descargables/', import.meta.url);
const COURSES = [
  { id: 1, title: 'Estrategias de Redes Sociales', file: 'ESTRATEGIAS DE REDES SOCIALES_1.pdf' },
  { id: 2, title: 'Branding y Gestión de Marca', file: 'BRANDING Y GESTION DE MARCA_1.pdf' },
  { id: 3, title: 'Marketing Digital Aplicado', file: 'MARKETING DIGITAL APLICADO_1.pdf' },
  { id: 4, title: 'Creación de Negocios Digitales', file: 'CREACION NEGOCIOS DIGITALES.pdf' },
];
const MAX_CHARS = 40000;

const serviceAccount = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url)));
const bucketName = process.env.NW_BUCKET || `${serviceAccount.project_id}.firebasestorage.app`;
initializeApp({ credential: cert(serviceAccount), storageBucket: bucketName });
const db = getFirestore();
const bucket = getStorage().bucket();

const pdfText = async (bytes) => {
  const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, isEvalSupported: false }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages && text.length < MAX_CHARS; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    text += `${content.items.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim()}\n`;
  }
  return { text: text.slice(0, MAX_CHARS), pages: pdf.numPages };
};

for (const c of COURSES) {
  const offering = (await db.doc(`courseOfferings/${c.id}`).get()).data() || {};
  if (offering.syllabus?.url && !FORCE) { console.log(`· ${c.title}: ya tiene sílabo (${offering.syllabus.name}), se deja.`); continue; }
  const bytes = readFileSync(new URL(c.file, DIR));
  const { text, pages } = await pdfText(bytes);
  const name = `Silabo - ${c.title}.pdf`;
  console.log(`${DRY ? '[dry-run] ' : ''}${c.title}: ${pages} páginas, ${text.length} caracteres de texto.`);
  if (DRY) continue;
  const path = `syllabi/${c.id}/${Date.now()}_${name.replace(/[^\w.-]+/g, '_')}`;
  const token = randomUUID();
  await bucket.file(path).save(bytes, { contentType: 'application/pdf', metadata: { metadata: { firebaseStorageDownloadTokens: token } } });
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  const uploadedAt = new Date().toISOString();
  await db.doc(`courseOfferings/${c.id}`).set({ syllabus: { url, name, uploadedAt, pages, chars: text.length } }, { merge: true });
  await db.doc(`courseSyllabi/${c.id}`).set({ courseId: c.id, courseTitle: c.title, text, updatedAt: uploadedAt });
  console.log(`  ✔ subido y guardado.`);
}
process.exit(0);
