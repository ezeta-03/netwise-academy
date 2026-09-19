// Reemplaza el Módulo 2 del curso 1 (Redes Sociales & IA) por la estructura
// real "Estrategia de Contenidos & Narrative Driven Marketing": objetivo,
// contenidos y práctica, sesiones del módulo y el checklist del entregable.
// Preserva materiales y grabaciones (lessons) reales que ya tenía el módulo.
//
// Uso: node scripts/updateModule2Redes.mjs
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

const MODULE_2_ID = 'm_1788194480695_c6e6p';

const MODULE_2_UPDATE = {
  title: 'Estrategia de Contenidos & Narrative Driven Marketing',
  weeksLabel: 'Semanas 3-4',
  objective: 'Diseñar una estrategia de contenidos basada en tu audiencia y en la narrativa de tu marca, y producir con IA las piezas de tu primer mes.',
  practiceIntro: 'Creación de contenido estratégico e IA. Pasarás de los insights de tu auditoría a un buyer persona y a pilares de contenido, construirás la narrativa de tu marca y producirás con inteligencia artificial un calendario de 30 días y 6 piezas listas para publicar.',
  practiceBullets: [
    'Definición de pilares temáticos y construcción del buyer persona',
    'Técnicas de storytelling y copywriting aplicadas a marcas',
    'Diseño de calendarios editoriales asistidos por inteligencia artificial',
    'Producción y escalamiento de activos visuales y en video de alta conversión',
  ],
  tools: ['Meta Business Suite', 'TikTok Creative Center', 'ChatGPT / Claude', 'Canva o CapCut'],
  sessions: [
    {
      id: 's_5', dateLabel: 'lun, 24 ago', time: '19:00-21:00', title: 'Buyer persona y pilares de contenido', done: true,
      learn: 'Del insight al buyer persona: perfil, problemas, motivaciones y objeciones. Pilares de contenido (educar, inspirar, conectar y vender) y su proporción en el calendario.',
      doInClass: 'Construye con IA un buyer persona a partir de los insights del Módulo 01 y contrástalo con datos reales de tu audiencia.',
      task: 'Define tu buyer persona y 3 o 4 pilares de contenido con su porcentaje.',
    },
    {
      id: 's_6', dateLabel: 'mié, 26 ago', time: '19:00-21:00', title: 'Storytelling y copywriting de marca', done: true,
      learn: 'Estructura narrativa: el cliente como protagonista, el conflicto y la transformación. Mensaje central, fórmulas AIDA y PAS y ganchos para los primeros 3 segundos.',
      doInClass: 'Reescribe publicaciones reales con AIDA y PAS y compara ganchos en grupo.',
      task: 'Redacta el mensaje central de tu marca y 10 ganchos para tus piezas.',
    },
    {
      id: 's_7', dateLabel: 'lun, 31 ago', time: '19:00-21:00', title: 'Calendario editorial asistido por IA', done: true,
      learn: 'Frecuencia sostenible, mix de formatos por red, prompts estructurados para idear contenido y programación en Meta Business Suite.',
      doInClass: 'Genera con ChatGPT o Claude el borrador del calendario de 30 días con prompts estructurados y ajústalo con criterio propio.',
      task: 'Completa tu calendario de 30 días en la plantilla.',
    },
    {
      id: 's_8', dateLabel: 'mié, 02 set', time: '19:00-21:00', title: 'Producción de piezas con IA', done: true,
      learn: 'Guion de video corto (gancho, desarrollo y CTA), carruseles, producción por lotes y reutilización de un contenido en varios formatos.',
      doInClass: 'Produce en vivo un guion de video y un carrusel con IA y recibe retroalimentación de tus compañeros.',
      task: 'Produce tus 6 piezas y entrega el plan de contenidos completo.',
    },
  ],
  deliverable: {
    description: 'Plan de contenidos a 30 días, guiones y copywriting para 6 videos/posts generados con IA.',
    checklist: [
      'Buyer persona documentado (perfil, problemas, motivaciones, objeciones y redes que usa), basado en los insights del Módulo 01.',
      '3 o 4 pilares de contenido, cada uno con su objetivo y su porcentaje en el calendario.',
      'Mensaje central de la marca y su estructura narrativa.',
      'Calendario editorial de 30 días: fecha, red, formato, pilar, idea, objetivo y CTA.',
      '6 piezas producidas con IA: guion o copy final, visual o video y los prompts utilizados.',
      'Nota de revisión: qué ajustaste de las respuestas de la IA y por qué.',
    ],
  },
};

const summaryOf = (modules) => ({ modules: modules.map((m) => ({ id: m.id, title: m.title, weeksLabel: m.weeksLabel || '' })) });

const docRef = db.collection('courseContent').doc('1');
const snap = await docRef.get();
if (!snap.exists) {
  console.error('No existe courseContent/1.');
  process.exit(1);
}

const modules = snap.data().modules.map((m) => {
  if (m.id !== MODULE_2_ID) return m;
  return {
    ...m,
    ...MODULE_2_UPDATE,
    deliverable: { ...m.deliverable, ...MODULE_2_UPDATE.deliverable },
  };
});

await docRef.set({ modules, updatedAt: new Date().toISOString(), updatedBy: snap.data().updatedBy || 'content-update' });
await db.collection('courseSummaries').doc('1').set(summaryOf(modules));

console.log('✔ Módulo 2 de "Redes Sociales & IA" actualizado con la estructura de Estrategia de Contenidos & Narrative Driven Marketing.');
process.exit(0);
