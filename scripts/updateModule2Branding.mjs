// Carga el Módulo 2 del curso 2 (Branding & Marca): "Performance, Imagery,
// Judgments y Feelings" -- objetivo, contenidos y práctica, 2 sesiones del
// módulo (Sesión 03 y 04, la numeración continúa la del Módulo 1) y el
// checklist del entregable. Preserva el id y los materiales/grabaciones
// REALES del módulo; descarta los placeholders del seed.
//
// Requiere haber corrido antes scripts/updateModule1Branding.mjs (deja los
// 4 módulos creados con su título y semana).
//
// Uso: node scripts/updateModule2Branding.mjs
// Requiere serviceAccountKey.json en la raíz (Admin SDK, no toca las reglas).
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url)));
} catch {
  console.error('No se encontró serviceAccountKey.json en la raíz del proyecto.');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const PLACEHOLDERS = ['Pendiente de subir', 'Pendiente de grabar'];
const realMaterials = (m) => (m.materials || []).filter((x) => !PLACEHOLDERS.includes(x.url));
const realLessons = (m) => (m.lessons || []).filter((x) => !PLACEHOLDERS.includes(x.videoUrl));

const MODULE_2 = {
  title: 'Performance, Imagery, Judgments y Feelings',
  weeksLabel: 'Semana 2',
  objective: 'Construir los niveles 2 y 3 de la pirámide CBBE: lo que tu marca hace, lo que significa y lo que tu cliente piensa y siente de ella.',
  practiceIntro: 'Atributos funcionales frente a asociaciones simbólicas, y juicios racionales frente a respuestas emocionales. Completarás el significado de tu marca y definirás las respuestas que quieres provocar en tu cliente.',
  practiceBullets: [
    'Performance: atributos funcionales de la marca',
    'Imagery: asociaciones simbólicas, usuarios y personalidad',
    'Judgments: calidad, credibilidad, consideración y superioridad',
    'Feelings: respuestas emocionales hacia la marca',
    'Balance racional y emocional en marcas reales',
  ],
  tools: [],
  sessions: [
    {
      id: 's_3', dateLabel: '', time: '', title: 'Performance e Imagery (CBBE nivel 2)', status: 'scheduled',
      learn: 'Diferencia entre atributos funcionales (performance) y asociaciones simbólicas (imagery).',
      doInClass: 'Construcción del nivel 2 de la pirámide del proyecto propio, con retroalimentación cruzada entre participantes en salas de trabajo.',
      task: 'Construye el nivel 2 de la pirámide de tu marca: atributos funcionales y asociaciones simbólicas.',
    },
    {
      id: 's_4', dateLabel: '', time: '', title: 'Judgments y Feelings (CBBE nivel 3)', status: 'scheduled',
      learn: 'Juicios racionales frente a respuestas emocionales hacia la marca.',
      doInClass: 'Definición de los juicios y sentimientos objetivo del proyecto propio.',
      task: 'Define los juicios y sentimientos que quieres provocar en tu cliente.',
    },
  ],
  deliverable: {
    description: 'Niveles 2 y 3 de la pirámide CBBE completados.',
    checklist: [
      'Performance: 3 a 5 atributos funcionales con su evidencia (producto, servicio, precio o experiencia).',
      'Imagery: perfil del usuario, situaciones de uso, personalidad y valores de la marca.',
      'Judgments: juicios racionales objetivo (calidad, credibilidad, consideración y superioridad).',
      'Feelings: 2 o 3 sentimientos objetivo y cómo los provocará la marca.',
      'Coherencia entre el nivel 1 y los niveles 2 y 3.',
    ],
  },
};

const summaryOf = (modules) => ({ modules: modules.map((m) => ({ id: m.id, title: m.title, weeksLabel: m.weeksLabel || '' })) });

const docRef = db.collection('courseContent').doc('2');
const snap = await docRef.get();
if (!snap.exists) {
  console.error('No existe courseContent/2.');
  process.exit(1);
}

const current = snap.data().modules || [];
if (current.length < 2) {
  console.error('courseContent/2 no tiene Módulo 2. Corre primero scripts/updateModule1Branding.mjs.');
  process.exit(1);
}

const modules = current.map((m, i) => {
  if (i !== 1) return m;
  return {
    ...m,
    ...MODULE_2,
    materials: realMaterials(m),
    lessons: realLessons(m),
    deliverable: { ...(m.deliverable || {}), ...MODULE_2.deliverable, open: m.deliverable?.open ?? true },
  };
});

await docRef.set({ modules, updatedAt: new Date().toISOString(), updatedBy: snap.data().updatedBy || 'content-update' });
await db.collection('courseSummaries').doc('2').set(summaryOf(modules));

console.log('✔ Branding & Marca: Módulo 2 actualizado (Performance, Imagery, Judgments y Feelings).');
process.exit(0);
