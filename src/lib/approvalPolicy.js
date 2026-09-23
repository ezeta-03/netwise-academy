// Requisitos de aprobación y acreditaciones que el Cronograma de evaluación
// muestra al docente. El texto se arma con las mismas constantes que usa el
// cálculo (lib/approval.js), así lo que se lee y lo que se evalúa no se separan.
import { APPROVAL } from './approval.js';

const SYLLABUS_BADGE = {
  1: 'Según sílabo EDRRSS', // Estrategias de Redes Sociales
  2: 'Según sílabo BGM',    // Branding & Gestión de Marca
};

const buildPolicy = (badge) => ({
  syllabusBadge: badge,
  approval: {
    intro: 'Para aprobar de manera regular y obtener el certificado, el estudiante debe cumplir simultáneamente con:',
    requirements: [
      `Rendimiento ponderado mínimo de ${APPROVAL.minPerformancePct}% en la suma de los entregables prácticos del programa.`,
      `Calificación final mínima de ${APPROVAL.minFinalGrade} (dieciséis) en la escala vigesimal.`,
    ],
    fallbackTitle: 'Si el estudiante no aprueba de forma regular',
    options: [
      {
        title: 'Opción A · Con certificación',
        text: `Rendir una evaluación sustitutoria de proyecto integral. Para aprobar y expedir el certificado se requiere una nota vigesimal mínima de ${APPROVAL.minSubstituteGrade} (dieciséis).`,
      },
      {
        title: 'Opción B · Constancia',
        text: `Sin optar al certificado no es obligatorio rendir la evaluación sustitutoria. Para acceder a la constancia de participación se requiere un mínimo de ${APPROVAL.minAttendancePct}% de asistencia a las sesiones regulares.`,
      },
    ],
  },
  accreditations: [
    {
      document: 'Certificado acreditativo de capacidades',
      requirement: `${APPROVAL.minPerformancePct}% ponderado en entregables y nota vigesimal ≥ ${APPROVAL.minFinalGrade} (vía regular), o nota vigesimal ≥ ${APPROVAL.minSubstituteGrade} en la evaluación sustitutoria.`,
      scope: 'Acredita oficialmente las competencias y habilidades prácticas desarrolladas durante el curso, incluyendo la nota aprobatoria obtenida.',
    },
    {
      document: 'Constancia de participación',
      requirement: `Mínimo ${APPROVAL.minAttendancePct}% de asistencia a las clases regulares (no requiere nota aprobatoria).`,
      scope: 'Acredita la asistencia y el cursado del programa por parte de Netwise Academy, sin expresar nota aprobatoria ni acreditación de capacidades.',
    },
  ],
});

// null si el curso no tiene una política estándar definida.
export const getApprovalPolicy = (courseId) => {
  const badge = Object.hasOwn(SYLLABUS_BADGE, courseId) ? SYLLABUS_BADGE[courseId]
    : (Object.hasOwn(SYLLABUS_BADGE, Number(courseId)) ? SYLLABUS_BADGE[Number(courseId)] : undefined);
  return badge ? buildPolicy(badge) : null;
};

// La política del código manda sobre requisitos y acreditaciones (una sola
// fuente, igual que el cálculo); del documento guardado solo se conserva lo
// demás (p. ej. la nota de pesos provisionales).
export const resolveApprovalPolicy = (courseId, stored) => {
  const standard = getApprovalPolicy(courseId);
  return standard ? { ...(stored || {}), ...standard } : (stored || null);
};
