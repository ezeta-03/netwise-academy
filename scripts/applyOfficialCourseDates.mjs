// Fechas, horarios y nombres oficiales de los 4 talleres (los de data.js):
// - courseOfferings/{id}: startDate y schedule (el admin los puede pisar, así
//   que se dejan iguales a los oficiales para que la web muestre estos).
// - groups y liveSessions: courseTitle con el nombre oficial.
// Los pedidos (`orders`) conservan el nombre con que se compraron.
// Revisa además que cada aula empiece en la fecha y horario oficiales.
//
// Uso: node scripts/applyOfficialCourseDates.mjs            (simulación, no escribe)
//      node scripts/applyOfficialCourseDates.mjs --apply    (escribe en Firestore)
// Requiere serviceAccountKey.json en la raíz (Admin SDK, no toca las reglas).
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { COURSES } from '../src/lib/data.js';

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url)));
} catch {
  console.error('No se encontró serviceAccountKey.json en la raíz del proyecto.');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const APPLY = process.argv.includes('--apply');

const slotsOf = (c) => c.scheduleDays.map((day) => {
  const [start, end] = c.scheduleTime.split('-');
  return { day, start, end };
});
const writes = [];

for (const c of COURSES) {
  const ref = db.collection('courseOfferings').doc(String(c.id));
  const offer = (await ref.get()).data() || {};
  const schedule = slotsOf(c);
  if (offer.startDate !== c.startDate || JSON.stringify(offer.schedule) !== JSON.stringify(schedule)) {
    console.log(`oferta ${c.id}: inicio ${offer.startDate} -> ${c.startDate}; horario ${JSON.stringify(offer.schedule)} -> ${JSON.stringify(schedule)}`);
    writes.push(() => ref.set({ startDate: c.startDate, schedule }, { merge: true }));
  }
}

const byId = Object.fromEntries(COURSES.map((c) => [String(c.id), c]));
const problems = [];
for (const g of (await db.collection('groups').get()).docs) {
  const d = g.data();
  const c = byId[String(d.courseId)];
  if (!c) continue;
  if (d.courseTitle !== c.title) {
    console.log(`aula ${d.name}: "${d.courseTitle}" -> "${c.title}"`);
    writes.push(() => g.ref.update({ courseTitle: c.title }));
  }
  if (d.startDate !== c.startDate) problems.push(`${d.name}: inicia ${d.startDate}, oficial ${c.startDate}`);
  if (JSON.stringify(d.schedule) !== JSON.stringify(slotsOf(c))) problems.push(`${d.name}: horario ${d.scheduleTime}, oficial ${c.scheduleDays.join(' y ')} ${c.scheduleTime}`);
}

let sessions = 0;
for (const s of (await db.collection('liveSessions').get()).docs) {
  const c = byId[String(s.data().courseId)];
  if (c && s.data().courseTitle !== c.title) {
    sessions += 1;
    writes.push(() => s.ref.update({ courseTitle: c.title }));
  }
}
console.log(`clases con nombre a actualizar: ${sessions}`);
console.log(problems.length ? `\nAulas fuera de la fecha/horario oficial:\n  ${problems.join('\n  ')}` : '\nTodas las aulas inician en la fecha y horario oficiales.');

if (!APPLY) {
  console.log(`\nSimulación: ${writes.length} escrituras pendientes. Corre con --apply para aplicarlas.`);
  process.exit(0);
}
for (const w of writes) await w();
console.log(`\n✔ ${writes.length} escrituras aplicadas.`);
process.exit(0);
