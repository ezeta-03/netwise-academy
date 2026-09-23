// Carga el Módulo 3 del curso 2 (Branding & Marca): "Brand Resonance,
// Posicionamiento y Arquitectura" -- objetivo, contenidos y práctica, 2
// sesiones del módulo (Sesión 05 y 06, la numeración continúa la de los
// módulos anteriores) y el checklist del entregable. Preserva el id y los
// materiales/grabaciones REALES del módulo; descarta los placeholders.
//
// Requiere haber corrido antes scripts/updateModule1Branding.mjs (deja los
// 4 módulos creados con su título y semana).
//
// Uso: node scripts/updateModule3Branding.mjs
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

const MODULE_3 = {
  title: 'Brand Resonance, Posicionamiento y Arquitectura',
  weeksLabel: 'Semana 3',
  objective: 'Cerrar la pirámide con la resonancia de marca, redactar tu positioning statement en formato Kellogg y definir la arquitectura de tu marca.',
  practiceIntro: 'Resonancia de marca, positioning statement de Kellogg y modelos de arquitectura de marca. Completarás la pirámide CBBE, formalizarás el posicionamiento de tu marca y ordenarás sus líneas o servicios.',
  practiceBullets: [
    'Brand resonance: lealtad, apego, comunidad y compromiso activo',
    'Positioning statement formato Kellogg: target, frame of reference, point of difference y reason to believe',
    'Análisis de positioning statements de marcas reales',
    'Modelos de arquitectura: branded house, house of brands y marca madre con submarcas',
  ],
  tools: [],
  sessions: [
    {
      id: 's_5', dateLabel: '', time: '', title: 'Brand resonance y positioning statement (formato Kellogg)', status: 'scheduled',
      learn: 'Qué es la resonancia de marca y la estructura del positioning statement de Kellogg: target, frame of reference, point of difference y reason to believe.',
      doInClass: 'Redacción guiada del positioning statement del proyecto propio, con retroalimentación en vivo del facilitador a cada participante.',
      task: 'Redacta el positioning statement de tu marca y completa el nivel 4 de la pirámide.',
    },
    {
      id: 's_6', dateLabel: '', time: '', title: 'Arquitectura de marca', status: 'scheduled',
      learn: 'Modelos de arquitectura de marca: branded house, house of brands y marca madre con submarcas.',
      doInClass: 'Definición de la arquitectura de marca del proyecto propio, especialmente si maneja varias líneas de negocio o servicios.',
      task: 'Define la arquitectura de tu marca y dibuja su esquema.',
    },
  ],
  deliverable: {
    description: 'Positioning statement formal, nivel 4 de la pirámide CBBE y esquema de arquitectura de marca.',
    checklist: [
      'Nivel 4 (resonance): acciones para generar lealtad, apego, comunidad y compromiso activo.',
      'Positioning statement con sus 4 componentes: target, frame of reference, point of difference y reason to believe.',
      'Justificación del point of difference frente a la competencia del Módulo 01.',
      'Esquema de arquitectura de marca con el modelo elegido y sus líneas o servicios.',
      'Pirámide CBBE completa en sus 4 niveles.',
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
if (current.length < 3) {
  console.error('courseContent/2 no tiene Módulo 3. Corre primero scripts/updateModule1Branding.mjs.');
  process.exit(1);
}

const modules = current.map((m, i) => {
  if (i !== 2) return m;
  return {
    ...m,
    ...MODULE_3,
    materials: realMaterials(m),
    lessons: realLessons(m),
    deliverable: { ...(m.deliverable || {}), ...MODULE_3.deliverable, open: m.deliverable?.open ?? true },
  };
});

await docRef.set({ modules, updatedAt: new Date().toISOString(), updatedBy: snap.data().updatedBy || 'content-update' });
await db.collection('courseSummaries').doc('2').set(summaryOf(modules));

console.log('✔ Branding & Marca: Módulo 3 actualizado (Brand Resonance, Posicionamiento y Arquitectura).');
process.exit(0);
