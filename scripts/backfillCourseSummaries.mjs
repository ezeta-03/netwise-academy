// Genera `courseSummaries/{courseId}` (solo título/semanas de cada módulo,
// sin links de video) a partir del `courseContent` ya cargado -- necesario
// una sola vez para los cursos que guardaron su temario ANTES de que
// saveCourseContent empezara a escribir también el resumen público.
// Uso: node scripts/backfillCourseSummaries.mjs
// Requiere serviceAccountKey.json en la raíz (ver scripts/createTestAccounts.mjs)
// -- Admin SDK, así que no necesita tocar las reglas de Firestore.
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

for (const course of COURSES) {
  const courseId = course.id.toString();
  const contentSnap = await db.collection('courseContent').doc(courseId).get();
  if (!contentSnap.exists) {
    console.log(`- Curso ${courseId} (${course.title}): sin courseContent, se omite.`);
    continue;
  }
  const modules = contentSnap.data().modules || [];
  const summary = { modules: modules.map((m) => ({ id: m.id, title: m.title, weeksLabel: m.weeksLabel || '' })) };
  await db.collection('courseSummaries').doc(courseId).set(summary);
  console.log(`✔ Curso ${courseId} (${course.title}): ${modules.length} módulo(s) copiados a courseSummaries.`);
}

console.log('Backfill completado.');
process.exit(0);
