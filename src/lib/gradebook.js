// Convierte los módulos con entregable de un curso + las entregas ya
// calificadas en las filas del registro de notas, y calcula el promedio
// parcial (ponderado, renormalizado sobre lo que ya está calificado) que
// usan tanto "Registro de notas" del docente como "Mis notas" del alumno.

const EQUAL_WEIGHT = (count) => (count > 0 ? Math.round((100 / count) * 100) / 100 : 0);

export const buildGradebookRows = (modules, submissionsByModuleId) => {
  const withDeliverable = (modules || []).filter((m) => m.deliverable?.description);
  const fallbackWeight = EQUAL_WEIGHT(withDeliverable.length);
  return withDeliverable.map((m) => {
    const sub = submissionsByModuleId?.[m.id] || null;
    const grade = sub?.grade ?? null;
    return {
      moduleId: m.id,
      title: m.deliverable?.description || m.title,
      weight: m.deliverable?.weight ?? fallbackWeight,
      grade,
      status: sub?.status || 'pending',
    };
  });
};

export const computeGradeSummary = (rows) => {
  const graded = rows.filter((r) => r.grade !== null && r.grade !== undefined);
  const weightSum = graded.reduce((s, r) => s + (r.weight || 0), 0);
  const promedioParcial = weightSum > 0
    ? Math.round((graded.reduce((s, r) => s + r.grade * (r.weight || 0), 0) / weightSum) * 100) / 100
    : (graded.length ? Math.round((graded.reduce((s, r) => s + r.grade, 0) / graded.length) * 100) / 100 : null);
  return {
    promedioParcial,
    rendimientoPct: promedioParcial !== null ? Math.round((promedioParcial / 20) * 100) : null,
    allGraded: rows.length > 0 && graded.length === rows.length,
    gradedCount: graded.length,
    totalCount: rows.length,
  };
};
