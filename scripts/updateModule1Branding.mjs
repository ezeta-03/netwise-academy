// Reemplaza el Módulo 1 del curso 2 (Branding & Marca) por la estructura real
// "Diagnóstico de Marca y Marco CBBE": objetivo, contenidos y práctica,
// 2 sesiones del módulo (Aprenderás/Harás en clase/Tarea) y el checklist del
// entregable. Además deja los Módulos 2, 3 y 4 con su título y semana reales
// (solo el título por ahora -- su contenido se carga en pasos siguientes).
//
// Los materiales y grabaciones REALES que ya tenga cada módulo se preservan;
// los placeholders del seed ("Pendiente de subir"/"Pendiente de grabar") se
// descartan para que el módulo quede limpio como en el diseño.
//
// Uso: node scripts/updateModule1Branding.mjs
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

const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const PLACEHOLDERS = ['Pendiente de subir', 'Pendiente de grabar'];
const realMaterials = (m) => (m.materials || []).filter((x) => !PLACEHOLDERS.includes(x.url));
const realLessons = (m) => (m.lessons || []).filter((x) => !PLACEHOLDERS.includes(x.videoUrl));

const MODULE_1 = {
  title: 'Diagnóstico de Marca y Marco CBBE',
  weeksLabel: 'Semana 1',
  objective: 'Diagnosticar la situación actual de tu marca y construir la base de su pirámide CBBE: la notoriedad (salience).',
  practiceIntro: 'Brand equity como decisión estratégica de negocio, método de caso y marco CBBE de Kevin Keller. Levantarás el diagnóstico de tu marca (percepción, competencia y brecha) y completarás el primer nivel de su pirámide.',
  practiceBullets: [
    'Brand equity: por qué gestionar la marca es una decisión estratégica de negocio',
    'Método de caso: diagnóstico de una marca conocida',
    'Auditoría rápida de marca: percepción actual, competencia y brecha',
    'Las 4 etapas de la pirámide CBBE de Keller',
    'Nivel 1 de la pirámide: notoriedad (salience)',
  ],
  tools: [],
  sessions: [
    {
      id: 's_1', dateLabel: '', time: '', title: 'Diagnóstico de marca y método de caso', status: 'next',
      learn: 'Qué es el brand equity y por qué gestionar la marca es una decisión estratégica de negocio.',
      doInClass: 'Cada participante levanta el diagnóstico inicial de su marca (percepción actual, competencia y brecha), con revisión cruzada en salas de trabajo.',
      task: 'Levanta el diagnóstico inicial de tu marca: cómo se percibe hoy, contra quién compite y cuál es la brecha.',
    },
    {
      id: 's_2', dateLabel: '', time: '', title: 'Introducción al marco CBBE de Keller', status: 'scheduled',
      learn: 'Las 4 etapas de la pirámide CBBE: salience; performance e imagery; judgments y feelings; resonance.',
      doInClass: 'Construcción guiada de la base de la pirámide (salience) del proyecto propio, directamente en la plantilla compartida.',
      task: 'Construye la base de la pirámide (salience) de tu marca en la plantilla compartida.',
    },
  ],
  deliverable: {
    description: 'Ficha de diagnóstico de marca y nivel 1 de la pirámide CBBE completado.',
    checklist: [
      'Ficha de diagnóstico: percepción actual de la marca, 3 competidores y la brecha entre la marca actual y la deseada.',
      'Evidencias de percepción: comentarios, reseñas o respuestas de clientes.',
      'Nivel 1 (salience): categoría en la que compite la marca, necesidades que cubre y situaciones de uso o compra.',
      'Ajustes realizados a partir de la revisión cruzada con tus compañeros.',
    ],
  },
};

const OTHER_MODULES = [
  { title: 'Performance, Imagery, Judgments y Feelings', weeksLabel: 'Semana 2' },
  { title: 'Brand Resonance, Posicionamiento y Arquitectura', weeksLabel: 'Semana 3' },
  { title: 'Medición de Brand Equity y Brand Deck Ejecutivo', weeksLabel: 'Semana 4' },
];

// Idempotente: si el módulo ya tiene ese título (por ejemplo porque el script
// del Módulo 2/3/4 ya cargó su contenido), se deja tal cual -- volver a correr
// este script NO debe vaciar lo que ya se cargó.
const emptyModule = (base, def) => (base?.title === def.title ? base : buildEmptyModule(base, def));

const buildEmptyModule = (base, { title, weeksLabel }) => ({
  id: base?.id || uid('m'),
  title,
  weeksLabel,
  objective: '',
  practiceIntro: '',
  practiceBullets: [],
  tools: [],
  sessions: [],
  materials: base ? realMaterials(base) : [],
  lessons: base ? realLessons(base) : [],
  deliverable: { description: '', open: true, checklist: [] },
});

const summaryOf = (modules) => ({ modules: modules.map((m) => ({ id: m.id, title: m.title, weeksLabel: m.weeksLabel || '' })) });

const docRef = db.collection('courseContent').doc('2');
const snap = await docRef.get();
if (!snap.exists) {
  console.error('No existe courseContent/2.');
  process.exit(1);
}

const current = snap.data().modules || [];
const first = current[0];

const module1 = {
  ...(first || {}),
  id: first?.id || uid('m'),
  ...MODULE_1,
  materials: first ? realMaterials(first) : [],
  lessons: first ? realLessons(first) : [],
  deliverable: { ...(first?.deliverable || {}), ...MODULE_1.deliverable, open: first?.deliverable?.open ?? true },
};

const modules = [module1, ...OTHER_MODULES.map((def, i) => emptyModule(current[i + 1], def))];

await docRef.set({ modules, updatedAt: new Date().toISOString(), updatedBy: snap.data().updatedBy || 'content-update' });
await db.collection('courseSummaries').doc('2').set(summaryOf(modules));

console.log('✔ Branding & Marca: Módulo 1 actualizado (Diagnóstico de Marca y Marco CBBE) y Módulos 2-4 con su título real.');
process.exit(0);
