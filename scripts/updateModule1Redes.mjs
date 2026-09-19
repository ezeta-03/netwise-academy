// Reemplaza el Módulo 1 del curso 1 (Redes Sociales & IA) por la estructura
// real "Auditoría del Ecosistema Digital": objetivo, contenidos y práctica,
// sesiones del módulo (fecha/hora + Aprenderás/Harás en clase/Tarea) y el
// checklist del entregable. Preserva tal cual los materiales y las
// grabaciones (lessons) reales que ya tenía el módulo -- no se tocan.
//
// Uso: node scripts/updateModule1Redes.mjs
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

const MODULE_1_ID = 'm_1788190829966_ktr3v';

const MODULE_1_UPDATE = {
  title: 'Auditoría del Ecosistema Digital',
  weeksLabel: 'Semanas 1-2',
  objective: 'Diagnosticar el ecosistema digital de tu proyecto frente a su competencia y dejar tus perfiles optimizados para ser encontrados y convertir.',
  practiceIntro: 'Ecosistema digital y algoritmos. Mapearás los canales de tu proyecto, entenderás qué premia cada algoritmo, analizarás a tu competencia, escucharás a tu audiencia y optimizarás tus perfiles con enfoque en SEO social y conversión.',
  practiceBullets: [
    'Mapeo y arquitectura de canales digitales',
    'Funcionamiento y lógica de algoritmos en TikTok, Instagram y LinkedIn',
    'Optimización de perfiles con enfoque en SEO social y conversión',
    'Análisis de competencia directa e indirecta',
    'Tácticas de escucha social (social listening) para la detección de insights',
  ],
  tools: ['Meta Business Suite', 'TikTok Creative Center', 'Biblioteca de anuncios de Meta', 'ChatGPT / Claude'],
  sessions: [
    {
      id: 's_1', dateLabel: 'lun, 10 ago', time: '19:00-21:00', title: 'Mapa del ecosistema digital', done: true,
      learn: '', doInClass: '', task: '',
    },
    {
      id: 's_2', dateLabel: 'mié, 12 ago', time: '19:00-21:00', title: 'Cómo deciden los algoritmos', done: true,
      learn: 'Señales de distribución en TikTok, Instagram y LinkedIn: retención, guardados, compartidos, conversación y relevancia. Formatos que prioriza cada red.',
      doInClass: 'Explora en TikTok Creative Center las tendencias, sonidos y contenidos destacados del sector de cada estudiante.',
      task: 'Define qué redes y formatos debe priorizar tu proyecto según su audiencia y el algoritmo de cada red.',
    },
    {
      id: 's_3', dateLabel: 'lun, 17 ago', time: '19:00-21:00', title: 'Competencia y escucha social', done: true,
      learn: 'Competencia directa e indirecta, matriz de benchmarking y social listening: comentarios, reseñas, búsquedas y hashtags como fuente de insights.',
      doInClass: 'Completa la matriz de benchmarking con perfiles reales y la Biblioteca de anuncios de Meta; usa IA para agrupar comentarios en insights.',
      task: 'Registra 5 competidores en la matriz y extrae al menos 5 insights de tu audiencia con su fuente.',
    },
    {
      id: 's_4', dateLabel: 'mié, 19 ago', time: '19:00-21:00', title: 'Perfiles optimizados: SEO social y conversión', done: true,
      learn: 'Nombre y bio con palabras clave, imagen, enlaces, destacados, publicaciones fijadas y CTA. Configuración del perfil de empresa en Meta Business Suite.',
      doInClass: 'Optimiza en vivo un perfil con la checklist de la ficha de auditoría y revisión entre pares.',
      task: 'Optimiza tus perfiles, guarda capturas del antes y después y cierra tu informe de auditoría.',
    },
  ],
  deliverable: {
    description: 'Informe práctico de auditoría digital y benchmarking del proyecto y competencia, con perfiles de redes sociales totalmente optimizados.',
    checklist: [
      'Mapa del ecosistema: canales activos, rol de cada canal y recorrido del usuario hasta la conversión.',
      'Ficha de auditoría de cada perfil: bio, imagen, enlaces, destacados, frecuencia, formatos e interacción.',
      'Benchmarking de 3 competidores directos y 2 indirectos en la matriz comparativa.',
      'Al menos 5 insights de escucha social, cada uno con su fuente (comentario, reseña, búsqueda o hashtag).',
      'Capturas del antes y después de los perfiles optimizados (bio con palabras clave, CTA y enlace).',
      'Conclusión con 3 oportunidades priorizadas para tu proyecto.',
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
  if (m.id !== MODULE_1_ID) return m;
  // materials y lessons reales del módulo se preservan tal cual.
  return {
    ...m,
    ...MODULE_1_UPDATE,
    deliverable: { ...m.deliverable, ...MODULE_1_UPDATE.deliverable },
  };
});

await docRef.set({ modules, updatedAt: new Date().toISOString(), updatedBy: snap.data().updatedBy || 'content-update' });
await db.collection('courseSummaries').doc('1').set(summaryOf(modules));

console.log('✔ Módulo 1 de "Redes Sociales & IA" actualizado con la estructura de Auditoría del Ecosistema Digital.');
process.exit(0);
