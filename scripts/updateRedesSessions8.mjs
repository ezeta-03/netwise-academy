// Curso 1 (Estrategias de Redes Sociales) en 4 semanas: cada módulo pasa de
// 4 a 2 sesiones, según el programa actualizado (8 sesiones de 2 horas, una
// semana por módulo). Cada sesión nueva fusiona dos antiguas y CONSERVA el id
// de la primera (la asistencia se registra por id de sesión); la segunda se
// retira. Toma títulos y laboratorios del PDF, las fechas del aula oficial
// (Martes y Jueves 20:00-22:00 desde el 10/11) y deja todas "Programada" (las
// marcas de "Realizada" eran del contenido de ejemplo). No toca objetivo,
// entregable, materiales ni grabaciones de los módulos.
//
// Uso: node scripts/updateRedesSessions8.mjs            (simulación, no escribe)
//      node scripts/updateRedesSessions8.mjs --apply    (escribe en Firestore)
// Requiere serviceAccountKey.json en la raíz (Admin SDK, no toca las reglas).
import { readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
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
const APPLY = process.argv.includes('--apply');
const TIME = '20:00-22:00';

// [id que se conserva, id que se retira, sesión nueva]
const SESSIONS = [
  [['s_1', 's_3', {
    title: 'Mapeo del ecosistema y análisis de competencia',
    dateLabel: 'mar, 10 nov',
    learn: 'Canales propios, ganados y pagados y el rol de cada red en el recorrido del cliente: atraer, convencer y convertir. Competencia directa e indirecta, matriz de benchmarking y escucha social (social listening): comentarios, reseñas, búsquedas y hashtags como fuente de insights.',
    doInClass: 'Laboratorio: mapa de canales y matriz de benchmarking del proyecto, con perfiles reales y la Biblioteca de anuncios de Meta; usa IA para agrupar comentarios en insights.',
    task: 'Mapea los canales de tu proyecto, registra 5 competidores en la matriz y extrae al menos 5 insights de tu audiencia con su fuente.',
  }]],
  [['s_2', 's_4', {
    title: 'Algoritmos y optimización de perfiles',
    dateLabel: 'jue, 12 nov',
    learn: 'Señales de distribución en TikTok, Instagram y LinkedIn: retención, guardados, compartidos, conversación y relevancia. Perfiles con enfoque en SEO social y conversión: nombre y bio con palabras clave, imagen, enlaces, destacados, publicaciones fijadas y CTA.',
    doInClass: 'Laboratorio: optimización de los perfiles del proyecto con la checklist de la ficha de auditoría y revisión entre pares (cierre M1).',
    task: 'Define qué redes y formatos prioriza tu proyecto, optimiza tus perfiles con capturas del antes y después y cierra tu informe de auditoría.',
  }]],
  [['s_5', 's_6', {
    title: 'Pilares de contenido, buyer persona y narrativa',
    dateLabel: 'mar, 17 nov',
    learn: 'Del insight al buyer persona: perfil, problemas, motivaciones y objeciones. Pilares de contenido (educar, inspirar, conectar y vender). Estructura narrativa, mensaje central, fórmulas AIDA y PAS y ganchos para los primeros 3 segundos.',
    doInClass: 'Laboratorio: buyer persona construido con IA a partir de los insights del Módulo 01, pilares temáticos y primeros guiones con IA.',
    task: 'Define tu buyer persona, 3 o 4 pilares de contenido con su porcentaje, el mensaje central de tu marca y 10 ganchos para tus piezas.',
  }]],
  [['s_7', 's_8', {
    title: 'Calendario editorial y producción con IA',
    dateLabel: 'jue, 19 nov',
    learn: 'Frecuencia sostenible, mix de formatos por red, prompts estructurados para idear contenido y programación en Meta Business Suite. Guion de video corto (gancho, desarrollo y CTA), carruseles, producción por lotes y reutilización de contenidos.',
    doInClass: 'Laboratorio: calendario de 30 días generado con ChatGPT o Claude y producción de las 6 piezas (videos/posts) con IA (cierre M2).',
    task: 'Completa tu calendario de 30 días en la plantilla, produce tus 6 piezas y entrega el plan de contenidos completo.',
  }]],
  [['s_9', 's_12', {
    title: 'Modelos de conversión y comunidad',
    dateLabel: 'mar, 24 nov',
    learn: 'Embudo de atracción, consideración y conversión. Social selling y puntos de entrada a la conversación: CTA a mensaje directo, enlaces a WhatsApp y anuncios a mensajes. Community management: tono, tiempos de respuesta, gestión de comentarios y engagement.',
    doInClass: 'Laboratorio: diseño del modelo de atracción-conversión y del plan de comunidad del proyecto.',
    task: 'Diagrama el embudo de tu proyecto con sus puntos de entrada a la conversación y define tu plan de comunidad.',
  }]],
  [['s_10', 's_11', {
    title: 'Embudos directos y social commerce',
    dateLabel: 'jue, 26 nov',
    learn: 'WhatsApp Business: perfil de empresa, mensajes de bienvenida y ausencia, respuestas rápidas, etiquetas y bandeja unificada en Meta Business Suite. Catálogo y tiendas sociales. Manejo de objeciones, scripts de cierre y seguimiento postventa.',
    doInClass: 'Laboratorio: configuración de WhatsApp Business, catálogo y scripts de cierre; simulación de una venta por chat en parejas (cierre M3).',
    task: 'Configura tu WhatsApp Business, publica tu catálogo con al menos 5 productos o servicios, redacta tus scripts de cierre y prueba el embudo completo.',
  }]],
  [['s_13', 's_14', {
    title: 'KPIs y tableros de control',
    dateLabel: 'mar, 1 dic',
    learn: 'Métricas de vanidad frente a métricas de negocio. Árbol de KPIs y fórmulas: engagement, CTR, conversión, CAC y ROAS social. Estructura de un dashboard (objetivo, KPIs, tendencias y alertas) con Looker Studio o Google Sheets.',
    doInClass: 'Laboratorio: construcción del dashboard de métricas del proyecto con datos de Meta Business Suite y TikTok Analytics.',
    task: 'Define tu árbol de KPIs, calcula tu línea base de las últimas 4 semanas y monta tu dashboard con los datos de tu proyecto.',
  }]],
  [['s_15', 's_16', {
    title: 'Pruebas A/B, reportes y sustentación final',
    dateLabel: 'jue, 3 dic',
    learn: 'Pruebas A/B: hipótesis, una sola variable, tamaño de muestra, duración y lectura de resultados en el Administrador de anuncios de Meta. Reporte ejecutivo: impacto financiero, retorno de la inversión y storytelling con datos.',
    doInClass: 'Laboratorio: plan de optimización A/B, reporte ejecutivo y sustentación del plan integral con retroalimentación del docente (cierre M4).',
    task: 'Presenta tu proyecto y entrega tu dashboard con el plan A/B y el reporte ejecutivo.',
  }]],
].map(([x]) => x);

const contentRef = db.collection('courseContent').doc('1');
const snap = await contentRef.get();
const current = snap.data()?.modules || [];
const currentIds = current.map((m) => (m.sessions || []).map((s) => s.id));
const expected = [['s_1', 's_2', 's_3', 's_4'], ['s_5', 's_6', 's_7', 's_8'], ['s_9', 's_10', 's_11', 's_12'], ['s_13', 's_14', 's_15', 's_16']];
if (JSON.stringify(currentIds) === JSON.stringify(SESSIONS.reduce((acc, [keep], i) => { (acc[i >> 1] ||= []).push(keep); return acc; }, []))) {
  console.log('courseContent/1 ya tiene las 8 sesiones nuevas. Nada que hacer.');
  process.exit(0);
}
if (JSON.stringify(currentIds) !== JSON.stringify(expected)) {
  console.error(`Las sesiones no son las esperadas (${JSON.stringify(currentIds)}); revisa antes de fusionar.`);
  process.exit(1);
}

const retiredIds = SESSIONS.map(([, retire]) => retire);
const attendance = await db.collection('attendance').where('sessionId', 'in', retiredIds).get();
if (!attendance.empty) {
  console.error(`Hay ${attendance.size} registros de asistencia en sesiones que se retirarían; no se cambia nada.`);
  process.exit(1);
}

const modules = current.map((m, i) => ({
  ...m,
  sessions: SESSIONS.slice(i * 2, i * 2 + 2).map(([keep, , s]) => ({ id: keep, ...s, time: TIME, status: 'scheduled' })),
}));

modules.forEach((m, i) => {
  console.log(`\n${m.title} (${m.weeksLabel}) · materiales ${(m.materials || []).length}, grabaciones ${(m.lessons || []).length}`);
  current[i].sessions.forEach((s) => console.log(`  - ${s.id} ${s.title}`));
  m.sessions.forEach((s) => console.log(`  + ${s.id} ${s.dateLabel} ${s.title}`));
});

if (!APPLY) {
  console.log('\nSimulación: no se escribió nada. Corre con --apply para aplicarlo.');
  process.exit(0);
}

const backup = join(tmpdir(), `courseContent-1-backup-${Date.now()}.json`);
writeFileSync(backup, JSON.stringify(snap.data(), null, 1));
await contentRef.set({ ...snap.data(), modules, updatedAt: new Date().toISOString() });
console.log(`\n✔ Redes Sociales: 8 sesiones (2 por módulo). Respaldo del contenido anterior en ${backup}`);
process.exit(0);
