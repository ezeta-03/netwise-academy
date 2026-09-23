// Rúbricas estándar de los cursos que ya tienen una definida por coordinación
// (Redes Sociales & IA y Branding). La página de Rúbrica de evaluación las
// carga sola la primera vez -- el docente no tiene que escribir criterios ni
// descripciones -- y las puede ajustar después. Los pesos de cada componente en
// la nota final NO van acá: los define el esquema de notas (lib/gradingScheme.js).
const level = (points, desc) => ({ points, desc });
const criterion = (id, title, d, l, e, i) => ({
  id, title,
  levels: { destacado: level('5', d), logrado: level('4', l), enProceso: level('3', e), inicial: level('0-2', i) },
});

export const RUBRIC_TEMPLATES = {
  // Redes Sociales & IA
  1: {
    criteria: [
      criterion('crit_1', 'Diagnóstico y uso de datos',
        'Sustenta cada decisión con datos reales del proyecto (métricas, benchmarking, escucha social) y saca conclusiones accionables.',
        'Usa datos reales en la mayoría de decisiones, con conclusiones claras.',
        'Usa datos escasos o genéricos; las conclusiones se conectan poco con el proyecto.',
        'No presenta datos ni un diagnóstico que sustente el trabajo.'),
      criterion('crit_2', 'Coherencia estratégica',
        'El entregable se alinea con el buyer persona, los pilares y los objetivos del plan en todos los canales.',
        'Se alinea con la estrategia, con alguna inconsistencia menor.',
        'La relación con la estrategia es parcial o poco clara.',
        'No se relaciona con la estrategia del proyecto.'),
      criterion('crit_3', 'Aplicación de técnicas y herramientas',
        'Aplica con criterio propio las técnicas y herramientas del módulo (IA, WhatsApp Business, analítica) y justifica su uso.',
        'Aplica correctamente la mayoría de técnicas y herramientas del módulo.',
        'Aplica algunas técnicas, con errores o sin justificarlas.',
        'No aplica las técnicas ni las herramientas del módulo.'),
      criterion('crit_4', 'Calidad y evidencias del entregable',
        'Completo, profesional y con evidencias (capturas, enlaces, antes/después); listo para implementarse.',
        'Completo y con evidencias, con detalles por mejorar.',
        'Incompleto o con pocas evidencias.',
        'No cumple con lo solicitado.'),
    ],
  },
  // Branding & Marca
  2: {
    criteria: [
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
    ],
  },
};

// null si el curso no tiene una rúbrica estándar definida.
export const getRubricTemplate = (courseId) => {
  if (Object.hasOwn(RUBRIC_TEMPLATES, courseId)) return RUBRIC_TEMPLATES[courseId];
  return Object.hasOwn(RUBRIC_TEMPLATES, Number(courseId)) ? RUBRIC_TEMPLATES[Number(courseId)] : null;
};
