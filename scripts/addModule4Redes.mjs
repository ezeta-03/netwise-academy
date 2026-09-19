// Agrega el Módulo 4 (último) del curso 1 (Redes Sociales & IA): "Social
// Media Analytics & Optimización Continua". Es el trabajo final del curso,
// todavía no dictado -- por eso sus sesiones van con status 'next' (la
// próxima) y 'scheduled' (las siguientes), no 'done'.
//
// Uso: node scripts/addModule4Redes.mjs
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

const MODULE_4 = {
  id: uid('m'),
  title: 'Social Media Analytics & Optimización Continua',
  weeksLabel: 'Semanas 7-8',
  objective: 'Medir el impacto de tu estrategia con KPIs y un dashboard, y definir un plan de optimización A/B basado en datos.',
  practiceIntro: 'Medición de impacto y performance. Definirás los KPIs que importan a tu negocio, construirás un dashboard de seguimiento, diseñarás pruebas A/B y presentarás un reporte ejecutivo con el impacto financiero de tu estrategia. Es el trabajo final del curso.',
  practiceBullets: [
    'Definición y métrica de KPIs clave: engagement, CTR, conversión y ROAS social',
    'Creación e integración de tableros de control y dashboards de seguimiento',
    'Diseño y ejecución de pruebas A/B en publicaciones y anuncios',
    'Elaboración de reportes ejecutivos de impacto financiero en el negocio',
  ],
  tools: ['Meta Business Suite', 'Administrador de anuncios de Meta', 'TikTok Analytics', 'Looker Studio o Google Sheets'],
  sessions: [
    {
      id: 's_13', dateLabel: 'lun, 21 set', time: '19:00-21:00', title: 'KPIs que importan al negocio', status: 'next',
      learn: 'Métricas de vanidad frente a métricas de negocio. Árbol de KPIs y fórmulas: engagement = interacciones / alcance × 100; CTR = clics / impresiones × 100; conversión = conversiones / clics × 100; ROAS = ingresos / inversión.',
      doInClass: 'Extrae datos de Meta Business Suite y TikTok Analytics y calcula los KPIs de una marca de caso.',
      task: 'Define tu árbol de KPIs y calcula tu línea base de las últimas 4 semanas.',
    },
    {
      id: 's_14', dateLabel: 'mié, 23 set', time: '19:00-21:00', title: 'Dashboard de seguimiento', status: 'scheduled',
      learn: 'Estructura de un dashboard: objetivo, KPIs principales, tendencias y alertas. Fuentes de datos y actualización con Looker Studio o Google Sheets.',
      doInClass: 'Construye en vivo un dashboard a partir de la plantilla de KPIs.',
      task: 'Monta tu dashboard con los datos de tu proyecto.',
    },
    {
      id: 's_15', dateLabel: 'lun, 28 set', time: '19:00-21:00', title: 'Pruebas A/B en publicaciones y anuncios', status: 'scheduled',
      learn: 'Hipótesis, una sola variable por prueba, tamaño de muestra y duración. Pruebas A/B en el Administrador de anuncios de Meta y lectura de resultados.',
      doInClass: 'Diseña dos pruebas A/B y configura una en el Administrador de anuncios de Meta.',
      task: 'Completa tu plan A/B con hipótesis, variantes y métrica de éxito.',
    },
    {
      id: 's_16', dateLabel: 'mié, 30 set', time: '19:00-21:00', title: 'Reporte ejecutivo y presentación final', status: 'scheduled',
      learn: 'Del data a la decisión: impacto financiero, retorno de la inversión y storytelling con datos para presentar resultados.',
      doInClass: 'Presentaciones finales del proyecto integrador con retroalimentación del docente.',
      task: 'Presenta tu proyecto y entrega tu dashboard con el plan A/B y el reporte ejecutivo.',
    },
  ],
  materials: [],
  lessons: [],
  deliverable: {
    open: true,
    description: 'Dashboard de métricas en tiempo real, acompañado de un plan de optimización A/B para la marca.',
    checklist: [
      'Árbol de KPIs: objetivo de negocio → KPI → métrica → fuente de datos.',
      'Fórmulas aplicadas: engagement, CTR, tasa de conversión y ROAS.',
      'Línea base con los datos de las últimas 4 semanas de tu proyecto.',
      'Dashboard conectado a tus datos (Looker Studio o Google Sheets) con enlace de acceso.',
      'Plan A/B con al menos 2 pruebas: hipótesis, variantes, métrica de éxito, duración y presupuesto.',
      'Reporte ejecutivo de una página: resultados, impacto en el negocio y próximos pasos.',
      'Presentación final del proyecto integrador (Módulos 01 a 04) en 10 minutos.',
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
if (existing.some((m) => m.title === MODULE_4.title)) {
  console.log('El módulo 4 ya existe, no se duplica.');
  process.exit(0);
}

const modules = [...existing, MODULE_4];

await docRef.set({ modules, updatedAt: new Date().toISOString(), updatedBy: snap.data().updatedBy || 'content-update' });
await db.collection('courseSummaries').doc('1').set(summaryOf(modules));

console.log('✔ Módulo 4 "Social Media Analytics & Optimización Continua" agregado a "Redes Sociales & IA".');
process.exit(0);
