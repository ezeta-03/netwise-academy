// Genera al menos un mes (2 módulos = 4 semanas) de contenido real para los
// 4 talleres: objetivo, práctica + cuestionario de autoevaluación, materiales
// y entregable por módulo. Los videoUrl nuevos quedan como "Pendiente de
// grabar" -- placeholder explícito para que el equipo docente suba el link
// real después (ver conversación: no hay grabaciones reales disponibles).
//
// El curso 1 ya tenía 2 módulos reales cargados por un docente (con videos y
// un recurso reales) -- este script los PRESERVA tal cual (mismos ids,
// lecciones, videoUrl, resources) y solo agrega los campos que le faltaban
// (weeksLabel, objective, practiceIntro, practiceBullets, materials,
// deliverable) más una lección de refuerzo por módulo.
//
// Uso: node scripts/seedCourseContent.mjs
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

const uid = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const PENDING_VIDEO = 'Pendiente de grabar';
const PENDING_URL = 'Pendiente de subir';

const material = (title, category, url = PENDING_URL) => ({ id: uid('mat'), title, category, url });
const lesson = (title, duration, videoUrl = PENDING_VIDEO) => ({ id: uid('l'), title, videoUrl, duration, resources: [] });

// --- Curso 1: Redes Sociales & IA (enriquecer, preservando lo real) -------
const course1Extra = {
  m_1788190829966_ktr3v: {
    weeksLabel: 'Semanas 1-2',
    objective: 'Entender cómo la Inteligencia Artificial cambia la forma de crear y gestionar contenido en redes sociales, y usar sus herramientas sin perder la voz de tu marca.',
    practiceIntro: 'Cada semana llevas lo aprendido a tu propio proyecto: auditas tus canales y empiezas a generar contenido con apoyo de IA.',
    practiceBullets: [
      'Audita tus 2 redes sociales principales: identifica qué formato de contenido genera más interacción.',
      'Genera 5 ideas de contenido para tu marca usando un prompt de IA (ChatGPT, Gemini o similar).',
      'Cuestionario de autoevaluación (Módulo 1):',
      '1) ¿Qué elementos de la identidad de marca NO deberías delegar completamente a la IA? → Respuesta: el tono de voz y los valores centrales de la marca.',
      '2) Menciona dos usos prácticos de la IA en la planificación de contenido. → Respuesta: generación de ideas/copys y análisis de tendencias o de la competencia.',
      '3) ¿Verdadero o falso? Un buen prompt siempre debe incluir el público objetivo y el tono deseado. → Respuesta: Verdadero.',
    ],
    materials: [
      material('Guía: prompts para generar contenido de redes', 'Material de apoyo'),
      material('Plantilla de auditoría de canales', 'Plantillas'),
    ],
    deliverable: { description: 'Entrega una auditoría de tus canales (Excel/Doc) con 5 piezas de contenido generadas con apoyo de IA.', open: true },
    extraLesson: lesson('Herramientas de IA para crear contenido (Canva IA, ChatGPT, CapCut)', '90 min'),
  },
  m_1788194480695_c6e6p: {
    weeksLabel: 'Semanas 3-4',
    objective: 'Diseñar una estrategia de contenido y un embudo de conversión en redes, usando IA para escalar la producción sin perder consistencia.',
    practiceIntro: 'Aplica lo aprendido sobre LLMs a la escritura de tus propios copys y arma tu calendario de contenido.',
    practiceBullets: [
      'Construye un calendario de contenido de 2 semanas (mínimo 8 piezas) para tu marca.',
      'Diseña un flujo simple de atención en WhatsApp Business con al menos 3 respuestas automatizadas.',
      'Cuestionario de autoevaluación (Módulo 2):',
      '1) ¿Qué es un LLM y para qué sirve en la creación de contenido? → Respuesta: un modelo de lenguaje grande que genera texto a partir de instrucciones (prompts), útil para redactar copys, ideas y guiones.',
      '2) Nombra un indicador (KPI) para medir si tu contenido está funcionando. → Respuesta: por ejemplo, tasa de interacción (engagement), alcance o tasa de conversión del embudo.',
      '3) ¿Verdadero o falso? Automatizar respuestas en WhatsApp Business elimina la necesidad de atención humana. → Respuesta: Falso, la automatización complementa pero no reemplaza la atención humana en casos complejos.',
    ],
    materials: [
      material('Plantilla de calendario de contenido (30 días)', 'Plantillas'),
      material('Checklist de automatización en WhatsApp Business', 'Material de apoyo'),
    ],
    deliverable: { description: 'Presenta tu calendario de contenido de 30 días y el flujo de WhatsApp Business activado.', open: true },
    extraLesson: lesson('De la estrategia al calendario: planifica tu mes de contenido', '90 min'),
  },
};

// --- Cursos 2, 3 y 4: contenido nuevo (2 módulos = 4 semanas c/u) --------
const NEW_CONTENT = {
  2: [ // Branding & Marca
    {
      id: uid('m'), title: 'Propósito y territorio de marca', weeksLabel: 'Semanas 1-2',
      objective: 'Definir el propósito, la personalidad y la propuesta de valor de tu marca como base de toda decisión de identidad.',
      practiceIntro: 'Trabaja sobre tu propio proyecto: cada clase avanzas un bloque de tu plataforma de marca.',
      practiceBullets: [
        'Completa el lienzo de propósito de marca: por qué existe, para quién y qué cambia en su vida.',
        'Define 3 rasgos de personalidad de marca y un adjetivo que NO te representa (para marcar el contraste).',
        'Cuestionario de autoevaluación (Módulo 1):',
        '1) ¿Cuál es la diferencia entre misión y propósito de marca? → Respuesta: la misión describe qué hace la empresa hoy; el propósito explica por qué existe más allá del producto.',
        '2) ¿Qué es la propuesta de valor? → Respuesta: la razón concreta por la que un cliente te elige a ti y no a la competencia.',
        '3) ¿Verdadero o falso? La personalidad de marca debe cambiar según cada red social. → Respuesta: Falso, debe mantenerse coherente aunque el tono se adapte al canal.',
      ],
      materials: [
        material('Lienzo de propósito de marca (Brand Purpose Canvas)', 'Plantillas'),
        material('Guía: cómo definir tu propuesta de valor', 'Material de apoyo'),
      ],
      deliverable: { description: 'Entrega tu lienzo de propósito de marca y una propuesta de valor redactada en una sola frase.', open: true },
      lessons: [
        lesson('Propósito, misión y visión: la base de tu marca', '90 min'),
        lesson('Personalidad de marca y propuesta de valor', '90 min'),
      ],
    },
    {
      id: uid('m'), title: 'Identidad visual y manual de marca', weeksLabel: 'Semanas 3-4',
      objective: 'Traducir la estrategia de marca en una identidad visual y verbal coherente, documentada en un manual de aplicación.',
      practiceIntro: 'Diseña los primeros elementos visuales de tu marca y documenta las reglas de uso.',
      practiceBullets: [
        'Diseña una propuesta de logotipo y una paleta de colores (mínimo 3 colores) para tu marca.',
        'Define 3 reglas de tono de voz (qué sí decir / qué no decir) para tus redes.',
        'Cuestionario de autoevaluación (Módulo 2):',
        '1) ¿Qué debe incluir como mínimo un manual de marca? → Respuesta: logotipo y sus variaciones, paleta de colores, tipografía y tono de voz.',
        '2) ¿Por qué es importante la consistencia visual entre canales? → Respuesta: genera reconocimiento y confianza en la audiencia a lo largo del tiempo.',
        '3) ¿Verdadero o falso? El tono de voz solo aplica a textos largos, no a redes sociales. → Respuesta: Falso, debe mantenerse en cualquier formato, incluidas redes.',
      ],
      materials: [
        material('Plantilla de manual de marca digital', 'Plantillas'),
        material('Guía de paletas de color y tipografía para marcas', 'Material de apoyo'),
      ],
      deliverable: { description: 'Entrega tu manual de marca inicial: logotipo, paleta de colores, tipografía y 3 reglas de tono de voz.', open: true },
      lessons: [
        lesson('Identidad visual: logotipo, color y tipografía', '90 min'),
        lesson('Cómo armar tu manual de marca', '90 min'),
      ],
    },
  ],
  3: [ // Marketing Digital
    {
      id: uid('m'), title: 'Fundamentos de growth y embudo de conversión', weeksLabel: 'Semanas 1-2',
      objective: 'Diseñar un embudo de captación con objetivos e indicadores claros para tu marca o negocio.',
      practiceIntro: 'Aplica cada concepto a tu propio embudo: desde la primera visita hasta la conversión.',
      practiceBullets: [
        'Dibuja tu embudo de conversión actual (o el que planeas) con al menos 3 etapas.',
        'Define 1 KPI por etapa del embudo (ej. CPC, CTR, tasa de conversión).',
        'Cuestionario de autoevaluación (Módulo 1):',
        '1) ¿Qué es un embudo de conversión? → Respuesta: el recorrido que sigue un usuario desde que conoce una marca hasta que realiza la acción deseada (compra, registro, etc.).',
        '2) Nombra 2 métricas típicas de la parte alta del embudo (awareness). → Respuesta: por ejemplo, alcance e impresiones.',
        '3) ¿Verdadero o falso? El CPC (costo por clic) mide cuántas personas compraron. → Respuesta: Falso, el CPC mide cuánto cuesta cada clic, no las conversiones.',
      ],
      materials: [
        material('Plantilla de embudo de conversión y KPIs', 'Plantillas'),
        material('Glosario de métricas de marketing digital', 'Material de apoyo'),
      ],
      deliverable: { description: 'Entrega tu embudo de conversión con las etapas, objetivos e indicadores definidos.', open: true },
      lessons: [
        lesson('Fundamentos de growth marketing y el embudo AARRR', '120 min'),
        lesson('Cómo elegir los KPIs correctos para tu negocio', '120 min'),
      ],
    },
    {
      id: uid('m'), title: 'SEO, Meta Ads y Google Ads', weeksLabel: 'Semanas 3-4',
      objective: 'Plantear acciones de SEO y campañas de búsqueda/pauta conectadas con una página de captación.',
      practiceIntro: 'Monta tu primera campaña (de práctica) en Meta o Google Ads y define palabras clave para SEO.',
      practiceBullets: [
        'Investiga 10 palabras clave relevantes para tu negocio y clasifícalas por intención de búsqueda.',
        'Arma la estructura de una campaña en Meta Ads o Google Ads (objetivo, público, presupuesto diario).',
        'Cuestionario de autoevaluación (Módulo 2):',
        '1) ¿Qué diferencia hay entre SEO y SEM? → Respuesta: el SEO son resultados orgánicos en buscadores; el SEM incluye la pauta paga en buscadores.',
        '2) ¿Qué es la intención de búsqueda de una palabra clave? → Respuesta: el propósito detrás de la búsqueda del usuario (informativa, de comparación o de compra).',
        '3) ¿Verdadero o falso? Un presupuesto diario alto siempre garantiza mejores resultados en una campaña. → Respuesta: Falso, depende de la segmentación, el mensaje y la calidad de la página de destino.',
      ],
      materials: [
        material('Checklist de estructura de campaña (Meta/Google Ads)', 'Material de apoyo'),
        material('Plantilla de investigación de palabras clave', 'Plantillas'),
      ],
      deliverable: { description: 'Entrega tu investigación de palabras clave y la estructura de tu primera campaña de pauta.', open: true },
      lessons: [
        lesson('SEO: bases para posicionar tu página de captación', '120 min'),
        lesson('Meta Ads y Google Ads: arma tu primera campaña', '120 min'),
      ],
    },
  ],
  4: [ // Emprendimiento Digital
    {
      id: uid('m'), title: 'Validación de la idea y modelo de negocio Canvas', weeksLabel: 'Semanas 1-2',
      objective: 'Validar el problema y la propuesta de valor de tu idea de negocio antes de invertir en construirla.',
      practiceIntro: 'Sal a validar tu idea con entrevistas reales y completa tu primer modelo Canvas.',
      practiceBullets: [
        'Realiza 5 entrevistas de validación de problema con potenciales clientes.',
        'Completa tu Business Model Canvas con los 9 bloques.',
        'Cuestionario de autoevaluación (Módulo 1):',
        '1) ¿Por qué es importante validar el problema antes que la solución? → Respuesta: para evitar construir un producto que nadie necesita, ahorrando tiempo y dinero.',
        '2) Nombra 3 de los 9 bloques del Business Model Canvas. → Respuesta: por ejemplo, propuesta de valor, segmentos de clientes y fuentes de ingresos.',
        '3) ¿Verdadero o falso? Si tus amigos y familia dicen que tu idea es buena, ya está validada. → Respuesta: Falso, la validación real requiere hablar con el segmento de clientes objetivo.',
      ],
      materials: [
        material('Business Model Canvas (plantilla editable)', 'Plantillas'),
        material('Guía de entrevistas de validación de problema', 'Material de apoyo'),
      ],
      deliverable: { description: 'Entrega tu Business Model Canvas y un resumen de los hallazgos de tus 5 entrevistas de validación.', open: true },
      lessons: [
        lesson('Cómo validar el problema antes de construir la solución', '120 min'),
        lesson('Modelo de negocio Canvas paso a paso', '120 min'),
      ],
    },
    {
      id: uid('m'), title: 'Producto Mínimo Viable (MVP) y plan de lanzamiento', weeksLabel: 'Semanas 3-4',
      objective: 'Construir una primera versión de tu producto digital (MVP) con herramientas no-code y preparar su plan de lanzamiento.',
      practiceIntro: 'Construye tu MVP con una herramienta no-code y esboza tu plan de lanzamiento a 90 días.',
      practiceBullets: [
        'Arma un MVP navegable (landing, app o prototipo) usando una herramienta no-code (ej. Glide, Bubble, Notion).',
        'Define 3 hitos de tu plan de lanzamiento a 90 días.',
        'Cuestionario de autoevaluación (Módulo 2):',
        '1) ¿Qué es un MVP? → Respuesta: la versión más simple de un producto que permite probarlo con usuarios reales y aprender de su uso.',
        '2) ¿Qué ventaja tienen las herramientas no-code para un MVP? → Respuesta: permiten construir y probar rápido sin necesidad de programar.',
        '3) ¿Verdadero o falso? Un plan de lanzamiento a 90 días debe incluir solo actividades de marketing. → Respuesta: Falso, también debe incluir hitos de producto, operaciones y métricas financieras.',
      ],
      materials: [
        material('Checklist de MVP con herramientas no-code', 'Material de apoyo'),
        material('Plantilla de plan de lanzamiento a 90 días', 'Plantillas'),
      ],
      deliverable: { description: 'Entrega el link de tu MVP navegable y tu plan de lanzamiento a 90 días con proyección financiera básica.', open: true },
      lessons: [
        lesson('Construye tu MVP con herramientas no-code', '120 min'),
        lesson('Plan de lanzamiento a 90 días y pitch financiero', '120 min'),
      ],
    },
  ],
};

const summaryOf = (modules) => ({ modules: modules.map((m) => ({ id: m.id, title: m.title, weeksLabel: m.weeksLabel || '' })) });

// --- Curso 1: merge aditivo sobre lo existente ---------------------------
const doc1 = await db.collection('courseContent').doc('1').get();
const modules1 = doc1.data().modules.map((m) => {
  const extra = course1Extra[m.id];
  if (!extra) return m;
  const { extraLesson, ...fields } = extra;
  return { ...m, ...fields, lessons: [...m.lessons, extraLesson] };
});
await db.collection('courseContent').doc('1').set({ modules: modules1, updatedAt: new Date().toISOString(), updatedBy: doc1.data().updatedBy || 'content-seed' });
await db.collection('courseSummaries').doc('1').set(summaryOf(modules1));
console.log(`✔ Curso 1: ${modules1.length} módulo(s) actualizados (contenido real preservado + campos completados).`);

// --- Cursos 2, 3, 4: contenido nuevo -------------------------------------
for (const courseId of [2, 3, 4]) {
  const modules = NEW_CONTENT[courseId];
  await db.collection('courseContent').doc(courseId.toString()).set({ modules, updatedAt: new Date().toISOString(), updatedBy: 'content-seed' });
  await db.collection('courseSummaries').doc(courseId.toString()).set(summaryOf(modules));
  console.log(`✔ Curso ${courseId}: ${modules.length} módulo(s) nuevos creados.`);
}

console.log('Listo.');
process.exit(0);
