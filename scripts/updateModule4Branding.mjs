// Carga el Módulo 4 del curso 2 (Branding & Marca): "Medición de Brand
// Equity y Brand Deck Ejecutivo" -- objetivo, contenidos y práctica, 2
// sesiones del módulo (Sesión 07 y 08, la numeración continúa la de los
// módulos anteriores) y el checklist del entregable. Preserva el id y los
// materiales/grabaciones REALES del módulo; descarta los placeholders.
//
// Requiere haber corrido antes scripts/updateModule1Branding.mjs (deja los
// 4 módulos creados con su título y semana).
//
// Uso: node scripts/updateModule4Branding.mjs
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

const MODULE_4 = {
  title: 'Medición de Brand Equity y Brand Deck Ejecutivo',
  weeksLabel: 'Semana 4',
  objective: 'Definir cómo medirás el valor de tu marca y presentar tu estrategia completa en un Brand Deck Ejecutivo.',
  practiceIntro: 'Indicadores de brand equity y construcción del Brand Deck Ejecutivo. Traducirás todo tu trabajo (CBBE, posicionamiento y arquitectura) en una presentación de 8 a 10 láminas y la sustentarás ante el grupo.',
  practiceBullets: [
    'Indicadores de brand equity: awareness, asociaciones, preferencia y lealtad',
    'Del CBBE al brand deck: estructura de 8 a 10 láminas',
    'Construcción del brand deck con acompañamiento del facilitador',
    'Sustentación ejecutiva y retroalimentación cruzada',
  ],
  tools: [],
  sessions: [
    {
      id: 's_7', dateLabel: '', time: '', title: 'Medición de brand equity y brand deck (parte 1)', status: 'scheduled',
      learn: 'Indicadores clave para medir brand equity: awareness, asociaciones, preferencia y lealtad.',
      doInClass: 'Traducción de lo trabajado (CBBE, posicionamiento y arquitectura) al formato de brand deck ejecutivo; se completan las primeras 5 o 6 láminas con acompañamiento directo del facilitador.',
      task: 'Define tus indicadores de brand equity y completa las láminas 1 a 6 de tu brand deck.',
    },
    {
      id: 's_8', dateLabel: '', time: '', title: 'Brand deck (parte 2) y sustentación', status: 'scheduled',
      learn: 'Finalización del brand deck (láminas restantes), revisión final y ajustes con la retroalimentación del facilitador.',
      doInClass: 'Finalización del brand deck (láminas restantes), revisión final y ajustes con la retroalimentación del facilitador.',
      task: 'Termina tu brand deck y sustenta tu estrategia de marca.',
    },
  ],
  deliverable: {
    description: 'Brand Deck Ejecutivo completo (8 a 10 láminas) y sustentación en vivo.',
    checklist: [
      'Brand deck de 8 a 10 láminas con el diagnóstico, la pirámide CBBE, el positioning statement y la arquitectura de marca.',
      'Indicadores de brand equity (awareness, asociaciones, preferencia y lealtad) con su método de medición.',
      'Avance de las láminas 1 a 6 revisado en la sesión 7.',
      'Sustentación en vivo del brand deck ante el grupo.',
      'Ajustes finales a partir de la retroalimentación del facilitador.',
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
if (current.length < 4) {
  console.error('courseContent/2 no tiene Módulo 4. Corre primero scripts/updateModule1Branding.mjs.');
  process.exit(1);
}

const modules = current.map((m, i) => {
  if (i !== 3) return m;
  return {
    ...m,
    ...MODULE_4,
    materials: realMaterials(m),
    lessons: realLessons(m),
    deliverable: { ...(m.deliverable || {}), ...MODULE_4.deliverable, open: m.deliverable?.open ?? true },
  };
});

await docRef.set({ modules, updatedAt: new Date().toISOString(), updatedBy: snap.data().updatedBy || 'content-update' });
await db.collection('courseSummaries').doc('2').set(summaryOf(modules));

console.log('✔ Branding & Marca: Módulo 4 actualizado (Medición de Brand Equity y Brand Deck Ejecutivo).');
process.exit(0);
