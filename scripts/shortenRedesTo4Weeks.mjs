// "Estrategias de Redes Sociales" pasa de 8 a 4 semanas (programa
// actualizado: un módulo por semana, 2 sesiones por semana). Deja los 4
// módulos del curso 1 como "Semana 1".."Semana 4" -- de ahí sale la duración
// del calendario de cada aula (courseWeeksFromModules) -- y resincroniza las
// aulas del curso con la misma lógica que "Editar aula" (planScheduleSync):
// se borran solo las clases futuras generadas que caen después de la semana 4.
//
// Uso: node scripts/shortenRedesTo4Weeks.mjs            (simulación, no escribe)
//      node scripts/shortenRedesTo4Weeks.mjs --apply    (escribe en Firestore)
// Requiere serviceAccountKey.json en la raíz (Admin SDK, no toca las reglas).
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { buildRecurringSessions } from '../src/lib/liveScheduleGenerator.js';
import { planScheduleSync } from '../src/lib/scheduleSync.js';
import { courseWeeksFromModules } from '../src/lib/deliveryDates.js';

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
const COURSE_ID = 1;

const summaryOf = (modules) => ({ modules: modules.map((m) => ({ id: m.id, title: m.title, weeksLabel: m.weeksLabel || '' })) });

const contentRef = db.collection('courseContent').doc(String(COURSE_ID));
const snap = await contentRef.get();
const current = snap.data()?.modules || [];
if (current.length !== 4) {
  console.error(`courseContent/${COURSE_ID} tiene ${current.length} módulos; se esperaban 4.`);
  process.exit(1);
}
const modules = current.map((m, i) => ({ ...m, weeksLabel: `Semana ${i + 1}` }));
const weeks = courseWeeksFromModules(modules);
console.log(`Módulos: ${current.map((m) => m.weeksLabel).join(', ')} -> ${modules.map((m) => m.weeksLabel).join(', ')} (${weeks} semanas)`);

const groups = (await db.collection('groups').where('courseId', '==', COURSE_ID).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const sessions = (await db.collection('liveSessions').where('courseId', '==', COURSE_ID).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

const plans = groups.map((g) => {
  const desired = g.startDate && g.schedule?.length
    ? buildRecurringSessions({ slots: g.schedule, weeksLabel: String(weeks) }, g.startDate, g.endDate || null)
    : [];
  const plan = planScheduleSync({
    desired, existing: sessions, groupId: g.id, endDate: g.endDate || null, closed: g.status === 'closed',
    adoptLegacy: groups.length <= 1, instructor: g.instructor || '', instructorUid: g.instructorUid || '',
  });
  console.log(`\n${g.name}: ${plan.toCreate.length} nuevas, ${plan.toDelete.length} a borrar, ${plan.toUpdate.length} a actualizar, ${plan.unchanged} sin cambios`);
  plan.toDelete.forEach((s) => console.log(`  - borrar ${s.startsAt} ${s.title || ''}`));
  plan.toCreate.forEach((e) => console.log(`  + crear  ${e.startsAt} ${e.title || ''}`));
  return { g, plan };
});

if (!APPLY) {
  console.log('\nSimulación: no se escribió nada. Corre con --apply para aplicarlo.');
  process.exit(0);
}

await contentRef.set({ modules, updatedAt: new Date().toISOString(), updatedBy: snap.data().updatedBy || 'content-update' });
await db.collection('courseSummaries').doc(String(COURSE_ID)).set(summaryOf(modules));
for (const { g, plan } of plans) {
  if (plan.toCreate.length) {
    console.error(`${g.name}: el plan pide crear clases; revisa el aula desde el admin (no se crean desde aquí).`);
    continue;
  }
  for (const s of plan.toDelete) await db.collection('liveSessions').doc(s.id).delete();
  for (const s of plan.toUpdate) await db.collection('liveSessions').doc(s.id).update(s.patch);
}
console.log('\n✔ Redes Sociales: 4 semanas aplicadas en los módulos y en el calendario de sus aulas.');
process.exit(0);
