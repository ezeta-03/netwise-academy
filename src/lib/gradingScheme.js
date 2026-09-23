// Esquema de calificación de cada curso (Registro de notas): la nota final se
// arma con bloques que suman 100%. Un bloque puede ser "módulos" (una nota por
// cada entregable de módulo, con un peso interno dentro del bloque) o un
// componente manual que el docente califica directo (sustentación final,
// participación, un caso, el proyecto final...).
//
// Fuente única para el Registro de notas del docente, "Mis notas" del alumno,
// el Cronograma y la Rúbrica -- todos calculan el mismo peso efectivo de cada
// componente: peso del bloque x peso interno / 100.
import { resolveWeights, deliverableModules } from './weights.js';
import { usableGrade } from './gradebook.js';

const moduleBlock = (label, weight, moduleWeights) => ({ key: 'modules', label, weight, moduleWeights });
const manualBlock = (key, label, weight) => ({ key, label, weight });

export const GRADING_SCHEMES = {
  // Redes Sociales & IA
  1: {
    subtitle: 'Notas por módulo, sustentación y promedio final.',
    footer: 'Esquema propuesto · 70% módulos + 30% sustentación',
    blocks: [moduleBlock('Evaluación de módulos', 70, [20, 25, 25, 30]), manualBlock('sustentacion', 'Sustentación final', 30)],
  },
  // Branding & Marca
  2: {
    subtitle: 'Notas por módulo, sustentación y promedio final.',
    footer: 'Esquema propuesto · 70% módulos + 30% sustentación',
    blocks: [moduleBlock('Tareas prácticas por módulo', 70, [25, 25, 25, 25]), manualBlock('sustentacion', 'Sustentación del Brand Deck', 30)],
  },
  // Marketing Digital
  3: {
    subtitle: 'Notas por módulo, caso, participación y sustentación.',
    footer: 'Pesos del sílabo · distribución interna por módulo propuesta',
    blocks: [
      moduleBlock('Laboratorios y tareas por módulo', 20, [25, 25, 25, 25]),
      manualBlock('participacion', 'Participación y análisis de casos', 20),
      manualBlock('caso1', 'Caso 1 · Sesión 4', 20),
      manualBlock('proyecto', 'Proyecto final y sustentación', 40),
    ],
  },
  // Emprendimiento / Creación de Negocios Digitales
  4: {
    subtitle: 'Notas por módulo, participación, sustentación y promedio final.',
    footer: 'Esquema propuesto · 40% módulos + 30% participación + 30% sustentación',
    blocks: [
      moduleBlock('Tareas prácticas por módulo', 40, [25, 25, 25, 25]),
      manualBlock('participacion', 'Participación, casos y experimentos', 30),
      manualBlock('sustentacion', 'Sustentación del MVP', 30),
    ],
  },
};

// Object.hasOwn: un id como 'constructor' no debe devolver miembros del prototipo.
export const getGradingScheme = (courseId) => {
  if (Object.hasOwn(GRADING_SCHEMES, courseId)) return GRADING_SCHEMES[courseId];
  return Object.hasOwn(GRADING_SCHEMES, Number(courseId)) ? GRADING_SCHEMES[Number(courseId)] : null;
};

const round2 = (n) => Math.round(n * 100) / 100;

// Componentes calificables del curso, en orden, con su peso efectivo sobre la
// nota final. Sin esquema definido (cursos nuevos) cae al reparto por
// entregable de lib/weights.js, como antes.
export const getGradingModel = (courseId, modules) => {
  const scheme = getGradingScheme(courseId);
  const deliverables = deliverableModules(modules);

  if (!scheme) {
    const { rows } = resolveWeights(modules);
    const components = rows.map((r) => ({
      key: `m:${r.module.id}`, kind: 'module', module: r.module, moduleId: r.module.id, index: r.index,
      label: `M${r.index + 1}`, blockKey: 'modules', blockLabel: 'Entregables', weightInBlock: r.weight, weight: r.weight,
    }));
    return {
      hasScheme: false, subtitle: 'Notas por módulo y promedio.', footer: '',
      blocks: [{ key: 'modules', label: 'Entregables', weight: round2(components.reduce((s, c) => s + c.weight, 0)), components }],
      components, total: round2(components.reduce((s, c) => s + c.weight, 0)),
    };
  }

  let moduleCountMismatch = null;
  const blocks = scheme.blocks.map((b) => {
    if (b.moduleWeights) {
      const n = deliverables.length;
      const useDefined = b.moduleWeights.length === n;
      // El esquema prevé un número fijo de entregables: si el curso tiene otro,
      // los pesos internos se reparten en partes iguales y se avisa (Cronograma).
      if (!useDefined && n > 0) moduleCountMismatch = { expected: b.moduleWeights.length, actual: n };
      const components = deliverables.map((m, i) => {
        const inBlock = useDefined ? b.moduleWeights[i] : round2(100 / n);
        return {
          key: `m:${m.id}`, kind: 'module', module: m, moduleId: m.id, index: i, label: `M${i + 1}`,
          blockKey: b.key, blockLabel: b.label, weightInBlock: inBlock, weight: round2((b.weight * inBlock) / 100),
        };
      });
      return { key: b.key, label: b.label, weight: b.weight, components };
    }
    return {
      key: b.key, label: b.label, weight: b.weight,
      components: [{ key: b.key, kind: 'manual', label: b.label, blockKey: b.key, blockLabel: b.label, weightInBlock: 100, weight: b.weight }],
    };
  });
  const components = blocks.flatMap((b) => b.components);
  return { hasScheme: true, moduleCountMismatch, subtitle: scheme.subtitle, footer: scheme.footer, blocks, components, total: round2(components.reduce((s, c) => s + c.weight, 0)) };
};

// Filas de notas de UN estudiante (misma forma que buildGradebookRows, para
// usar computeGradeSummary): módulos desde sus entregas revisadas y
// componentes manuales desde `scores` ({ [key]: nota }).
export const buildStudentRows = (model, studentSubmissions, scores) => model.components.map((c) => {
  if (c.kind === 'module') {
    const sub = (studentSubmissions || []).find((s) => s.moduleId === c.moduleId) || null;
    return { key: c.key, moduleId: c.moduleId, kind: 'module', title: c.label, weight: c.weight, grade: usableGrade(sub), status: sub?.status || 'pending' };
  }
  const raw = scores?.[c.key];
  const n = Number(raw);
  const blank = raw === null || raw === undefined || String(raw).trim() === '';
  const grade = blank || !Number.isFinite(n) ? null : Math.min(20, Math.max(0, n));
  return { key: c.key, kind: 'manual', title: c.label, weight: c.weight, grade, status: grade === null ? 'pending' : 'reviewed' };
});

// Peso efectivo de cada módulo (moduleId -> % de la nota final).
export const effectiveModuleWeights = (courseId, modules) => Object.fromEntries(
  getGradingModel(courseId, modules).components.filter((c) => c.kind === 'module').map((c) => [c.moduleId, c.weight]),
);
