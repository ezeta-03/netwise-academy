// Piezas del Asistente IA sin dependencias (las prueba tests/assistantText).

// Cómo se calcula la nota final de cada curso, igual que la plataforma
// (src/lib/gradingScheme.js: GRADING_SCHEMES). El test comprueba que los pesos
// coincidan; si cambia un esquema, cambia también aquí.
export const GRADE_FORMULAS = {
  1: { blocks: [['Módulos', 70, [20, 25, 25, 30]], ['Sustentación final', 30]] },
  2: { blocks: [['Módulos', 70, [25, 25, 25, 25]], ['Sustentación final (Brand Deck)', 30]] },
  3: { blocks: [['Prácticas por módulo', 20, [25, 25, 25, 25]], ['Participación', 20], ['Caso 1', 20], ['Proyecto final y sustentación', 40]] },
  4: { blocks: [['Proyecto (entregas por módulo)', 40, [25, 25, 25, 25]], ['Participación y experimentos', 30], ['Sustentación', 30]] },
};

const pct = (n) => `${String(Math.round(n * 100) / 100).replace('.', ',')}%`;

// Texto para las instrucciones: la fórmula oficial y las reglas de aprobación.
export const gradeFormulaText = (courseId) => {
  const f = GRADE_FORMULAS[Number(courseId)];
  if (!f) return '';
  const parts = f.blocks.map(([label, weight, inner]) => (inner
    ? `${pct(weight)} ${label.toLowerCase()} (${inner.map((w, i) => `Módulo ${i + 1}: ${pct((weight * w) / 100)}`).join(', ')})`
    : `${pct(weight)} ${label.toLowerCase()}`));
  return [
    `Cómo se calcula la nota final de este curso (fórmula oficial de la plataforma; si el sílabo dice otra cosa, manda esta): ${parts.join(' + ')}.`,
    'Para aprobar y obtener el certificado: nota final de 16 o más (sobre 20) y entregar al menos el 80% de las evaluaciones. Quien no llega a 16 puede dar un examen sustitutorio. Con 75% de asistencia se obtiene la constancia de participación.',
    'Estos porcentajes (80% de entregables, 75% de asistencia) son requisitos para aprobar, no pesos de la nota: no los mezcles con la fórmula.',
  ].join('\n');
};

// "[[fuentes: Sílabo | Material: X]]" al final de la respuesta -> lista aparte.
// Quita también un "Fuentes:" suelto antes de la marca y deja solo las fuentes
// que de verdad estaban disponibles (`available`: { syllabus, materials, dates, company }).
export const splitSources = (reply, available = {}) => {
  const m = reply.match(/\[\[\s*fuentes?\s*:([^\]]*)\]\]\s*$/i);
  if (!m) return { text: reply, sources: [] };
  const text = reply.slice(0, m.index).replace(/\n?\s*(fuentes|basado en)\s*:?\s*$/i, '').trim();
  const materials = (available.materials || []).map((x) => x.toLowerCase());
  const seen = new Set();
  const sources = m[1].split('|').map((x) => x.trim()).filter(Boolean).map((src) => {
    const low = src.toLowerCase();
    if (low.includes('sílabo') || low.includes('silabo')) return available.syllabus ? 'Sílabo' : null;
    if (low.startsWith('material')) {
      const name = src.replace(/^material\s*:?\s*/i, '').trim();
      return name && materials.some((t) => t === name.toLowerCase() || t.includes(name.toLowerCase())) ? `Material: ${name}` : null;
    }
    if (low.includes('fecha')) return available.dates ? 'Fechas de entrega' : null;
    if (low.includes('empresa')) return available.company ? 'Tu empresa' : null;
    return null;
  }).filter((s) => s && !seen.has(s) && seen.add(s)).slice(0, 4);
  return { text, sources };
};
