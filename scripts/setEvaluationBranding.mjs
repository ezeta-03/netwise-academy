// Carga la evaluación del curso 2 (Branding & Marca): la rúbrica (4 criterios
// x 4 niveles), la política de aprobación/acreditaciones del Cronograma y el
// peso de cada entregable en la nota final (20% / 20% / 25% / 35%).
//
// - Rúbrica + política -> courseRubrics/2 (solo docente/admin la leen).
// - Pesos -> courseContent/2, módulo por módulo (deliverable.weight).
//
// Requiere haber corrido antes scripts/updateModule1Branding.mjs (deja los
// 4 módulos creados).
//
// Uso: node scripts/setEvaluationBranding.mjs
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

const WEIGHTS = [20, 20, 25, 35];

const level = (points, desc) => ({ points, desc });
const criterion = (id, title, d, l, e, i) => ({
  id, title,
  levels: { destacado: level('5', d), logrado: level('4', l), enProceso: level('3', e), inicial: level('0-2', i) },
});

const CRITERIA = [
  criterion('crit_1', 'Dominio del marco CBBE',
    'Aplica con precisión el nivel de la pirámide CBBE y los conceptos de Keller que corresponden al entregable.',
    'Aplica el marco correctamente, con imprecisiones menores.',
    'Usa el marco de forma superficial o con confusiones entre niveles.',
    'No aplica el marco CBBE.'),
  criterion('crit_2', 'Evidencia de clientes y mercado',
    'Sustenta cada afirmación con evidencia real de clientes y competidores.',
    'Incluye evidencia real en la mayoría de afirmaciones.',
    'La evidencia es escasa o anecdótica.',
    'No presenta evidencia; solo supuestos.'),
  criterion('crit_3', 'Coherencia de la estrategia de marca',
    'Integra el avance con los anteriores y con el posicionamiento; incorpora la retroalimentación recibida y justifica los ajustes.',
    'Es coherente con los avances previos, con ajustes parciales.',
    'Presenta contradicciones con los avances previos o ignora la retroalimentación.',
    'No guarda relación con la estrategia de la marca.'),
  criterion('crit_4', 'Comunicación ejecutiva',
    'Clara, sintética y profesional; lista para presentarse a un comité de dirección.',
    'Clara y ordenada, con detalles de forma por mejorar.',
    'Desordenada o recargada; cuesta seguir la idea central.',
    'No comunica la propuesta de marca.'),
];

const POLICY = {
  syllabusBadge: 'Según sílabo BGM',
  weightsNote: 'El sílabo BGM no define el peso de cada entregable. Estos pesos son provisionales y deben confirmarse con coordinación académica.',
  approval: {
    intro: 'Para aprobar de manera regular y obtener el certificado, el estudiante debe cumplir simultáneamente con:',
    requirements: [
      'Rendimiento ponderado mínimo de 80% en la suma de los entregables prácticos del programa.',
      'Calificación final mínima de 15 (quince) en la escala vigesimal.',
    ],
    fallbackTitle: 'Si el estudiante no aprueba de forma regular',
    options: [
      {
        title: 'Opción A · Con certificación',
        text: 'Rendir una evaluación sustitutoria de proyecto integral. Para aprobar y expedir el certificado se requiere una nota vigesimal mínima de 16 (dieciséis).',
      },
      {
        title: 'Opción B · Constancia',
        text: 'Sin optar al certificado no es obligatorio rendir la evaluación sustitutoria. Para acceder a la constancia de participación se requiere un mínimo de 75% de asistencia a las sesiones regulares.',
      },
    ],
  },
  accreditations: [
    {
      document: 'Certificado acreditativo de capacidades',
      requirement: '80% ponderado en entregables y nota vigesimal ≥ 15 (vía regular), o nota vigesimal ≥ 16 en la evaluación sustitutoria.',
      scope: 'Acredita oficialmente las competencias y habilidades prácticas desarrolladas durante el curso, incluyendo la nota aprobatoria obtenida.',
    },
    {
      document: 'Constancia de participación',
      requirement: 'Mínimo 75% de asistencia a las clases regulares (no requiere nota aprobatoria).',
      scope: 'Acredita la asistencia y el cursado del programa por parte de Netwise Academy, sin expresar nota aprobatoria ni acreditación de capacidades.',
    },
  ],
};

const contentRef = db.collection('courseContent').doc('2');
const contentSnap = await contentRef.get();
if (!contentSnap.exists || (contentSnap.data().modules || []).length < WEIGHTS.length) {
  console.error('courseContent/2 no tiene los 4 módulos. Corre primero scripts/updateModule1Branding.mjs.');
  process.exit(1);
}

const modules = contentSnap.data().modules.map((m, i) => (
  i < WEIGHTS.length ? { ...m, deliverable: { ...(m.deliverable || {}), weight: WEIGHTS[i] } } : m
));
await contentRef.set({ ...contentSnap.data(), modules, updatedAt: new Date().toISOString() });

// merge: true para no pisar el estado de validación si ya lo cambiaron.
await db.collection('courseRubrics').doc('2').set({
  criteria: CRITERIA,
  policy: POLICY,
  status: 'pending',
  updatedAt: new Date().toISOString(),
  updatedBy: 'content-update',
}, { merge: true });

console.log('✔ Branding & Marca: rúbrica (4 criterios), política de aprobación y pesos 20/20/25/35 cargados.');
process.exit(0);
