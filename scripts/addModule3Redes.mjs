// Agrega el Módulo 3 del curso 1 (Redes Sociales & IA): "Social Selling y
// Conversión Directa". A diferencia de los módulos 1 y 2 (que ya existían
// con materiales/grabaciones reales de un docente), este módulo es nuevo
// -- se crea desde cero, sin materiales ni grabaciones todavía.
//
// Uso: node scripts/addModule3Redes.mjs
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

const MODULE_3 = {
  id: uid('m'),
  title: 'Social Selling y Conversión Directa',
  weeksLabel: 'Semanas 5-6',
  objective: 'Convertir tu audiencia en clientes con un embudo directo en WhatsApp Business y mensajería, apoyado en tu comunidad y en un catálogo digital.',
  practiceIntro: 'Comunidad y social commerce. Diseñarás el embudo que lleva a tu audiencia del contenido a la conversación y a la venta, configurarás WhatsApp Business con catálogo y respuestas automáticas y escribirás los scripts que cierran ventas.',
  practiceBullets: [
    'Modelos de conversión y atracción en redes sociales',
    'Diseño e implementación de embudos de venta directos vía WhatsApp Business y mensajería/inbox',
    'Integración de tiendas sociales y catálogo digital',
    'Estrategias de community management, construcción de comunidad y engagement',
  ],
  tools: ['WhatsApp Business', 'Meta Business Suite', 'ChatGPT / Claude'],
  sessions: [
    {
      id: 's_9', dateLabel: 'lun, 07 set', time: '19:00-21:00', title: 'Modelos de conversión en redes', done: true,
      learn: 'Embudo de atracción, consideración y conversión. Social selling y puntos de entrada a la conversación: CTA a mensaje directo, enlaces a WhatsApp y anuncios a mensajes.',
      doInClass: 'Diseña el embudo de una marca de caso e identifica en qué etapa se pierden los clientes.',
      task: 'Diagrama el embudo de tu proyecto con sus puntos de entrada a la conversación.',
    },
    {
      id: 's_10', dateLabel: 'mié, 09 set', time: '19:00-21:00', title: 'WhatsApp Business e inbox', done: true,
      learn: 'Perfil de empresa, mensajes de bienvenida y ausencia, respuestas rápidas y etiquetas. Bandeja unificada de Instagram, Facebook y WhatsApp en Meta Business Suite.',
      doInClass: 'Configura en vivo WhatsApp Business con un número de prueba.',
      task: 'Configura tu perfil de empresa, mensajes automáticos, respuestas rápidas y etiquetas.',
    },
    {
      id: 's_11', dateLabel: 'lun, 14 set', time: '19:00-21:00', title: 'Catálogo y tienda social', done: true,
      learn: 'Catálogo de WhatsApp Business y tiendas de Instagram y Facebook (según disponibilidad en tu país). Fotos, precios y descripciones que venden.',
      doInClass: 'Carga productos al catálogo y enlázalos desde publicaciones e historias.',
      task: 'Publica tu catálogo con al menos 5 productos o servicios.',
    },
    {
      id: 's_12', dateLabel: 'mié, 16 set', time: '19:00-21:00', title: 'Comunidad y scripts de cierre', done: true,
      learn: 'Community management: tono, tiempos de respuesta y gestión de comentarios. Manejo de objeciones, scripts de cierre y seguimiento postventa.',
      doInClass: 'Simula en parejas una venta por chat usando scripts generados con IA.',
      task: 'Redacta tus scripts de cierre, prueba el embudo completo y entrega las evidencias.',
    },
  ],
  materials: [],
  lessons: [],
  deliverable: {
    open: true,
    description: 'Funnel de conversión directa configurado en WhatsApp Business, con catálogo activo y scripts de cierre de ventas.',
    checklist: [
      'Diagrama del embudo: contenido de atracción → mensaje → conversación → venta → postventa.',
      'Perfil de empresa de WhatsApp Business completo (descripción, horario, ubicación o web).',
      'Catálogo activo con al menos 5 productos o servicios (foto, precio y descripción).',
      'Mensaje de bienvenida, mensaje de ausencia, respuestas rápidas y etiquetas por etapa del embudo.',
      'Scripts de venta: saludo, diagnóstico, presentación de la oferta, manejo de 3 objeciones y cierre.',
      'Protocolo de community management: tono y tiempos de respuesta en comentarios y mensajes.',
      'Evidencias: capturas de la configuración y de una conversación de prueba.',
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

const existing = snap.data().modules;
if (existing.some((m) => m.title === MODULE_3.title)) {
  console.log('El módulo 3 ya existe, no se duplica.');
  process.exit(0);
}

const modules = [...existing, MODULE_3];

await docRef.set({ modules, updatedAt: new Date().toISOString(), updatedBy: snap.data().updatedBy || 'content-update' });
await db.collection('courseSummaries').doc('1').set(summaryOf(modules));

console.log('✔ Módulo 3 "Social Selling y Conversión Directa" agregado a "Redes Sociales & IA".');
process.exit(0);
