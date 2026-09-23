// Convierte los módulos con entregable de un curso + las entregas ya
// calificadas en las filas del registro de notas, y calcula el promedio
// parcial (ponderado, renormalizado sobre lo que ya está calificado) que
// usan tanto "Registro de notas" del docente como "Mis notas" del alumno.
// Los pesos vienen de lib/weights.js (misma fuente que el Cronograma).
import { resolveWeights } from './weights.js';

const MAX_GRADE = 20;

// Solo cuenta la nota de una entrega REVISADA: si el alumno vuelve a
// entregar (status 'submitted') la nota anterior se conserva en el
// documento pero ya no vale hasta que el docente la califique de nuevo.
// Además se acota a 0-20 por si un dato viejo trae una nota fuera de rango.
const usableGrade = (sub) => {
  if (sub?.status !== 'reviewed') return null;
  const n = Number(sub.grade);
  if (sub.grade === null || sub.grade === undefined || sub.grade === '' || !Number.isFinite(n)) return null;
  return Math.min(MAX_GRADE, Math.max(0, n));
};

export const buildGradebookRows = (modules, submissionsByModuleId) => {
  return resolveWeights(modules).rows.map(({ module: m, weight }) => {
    const sub = submissionsByModuleId?.[m.id] || null;
    return {
      moduleId: m.id,
      title: m.deliverable?.description || m.title,
      weight,
      grade: usableGrade(sub),
      status: sub?.status || 'pending',
    };
  });
};

export const computeGradeSummary = (rows) => {
  const graded = rows.filter((r) => r.grade !== null && r.grade !== undefined);
  const weightSum = graded.reduce((s, r) => s + (r.weight || 0), 0);
  const rawAverage = weightSum > 0
    ? graded.reduce((s, r) => s + r.grade * (r.weight || 0), 0) / weightSum
    : (graded.length ? graded.reduce((s, r) => s + r.grade, 0) / graded.length : null);
  const promedioParcial = rawAverage !== null ? Math.round(rawAverage * 100) / 100 : null;
  return {
    promedioParcial,
    rendimientoPct: rawAverage !== null ? Math.round((rawAverage / MAX_GRADE) * 100) : null,
    // Sin redondear: 15.9/20 es 79.5%, que NO llega al 80%.
    rendimientoRaw: rawAverage !== null ? (rawAverage / MAX_GRADE) * 100 : null,
    allGraded: rows.length > 0 && graded.length === rows.length,
    gradedCount: graded.length,
    totalCount: rows.length,
  };
};
