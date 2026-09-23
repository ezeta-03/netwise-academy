// Reglas de aprobación del programa (mismas que se muestran en el
// Cronograma de evaluación del docente, ver scripts/setEvaluationBranding.mjs)
// para que docente y alumno evalúen exactamente lo mismo.

export const APPROVAL = {
  minFinalGrade: 16,       // nota vigesimal mínima (vía regular)
  // Rendimiento ponderado mínimo: 80% del puntaje máximo (20), o sea nota
  // ponderada >= 16. Ambos requisitos del sílabo coinciden: 80% de 20 = 16.
  minPerformancePct: 80,
  minSubstituteGrade: 16,  // nota mínima en la evaluación sustitutoria
  minAttendancePct: 75,    // asistencia mínima para la constancia
};

// Nota ponderada equivalente al rendimiento mínimo (80% de 20 = 16).
export const MIN_PERFORMANCE_GRADE = (APPROVAL.minPerformancePct / 100) * 20;

// summary: resultado de computeGradeSummary. attendance: { pct, taken } o
// null si aún no hay sesiones dictadas. Cada check devuelve
// 'ok' | 'fail' | 'pending': mientras falten notas por calificar nada se da
// por aprobado ni por desaprobado -- solo se confirma con todo calificado.
export const evaluateApproval = (summary, attendance) => {
  const settled = !!summary?.allGraded;
  const verdict = (value, min) => {
    if (value === null || value === undefined) return 'pending';
    if (!settled) return 'pending';
    return value >= min ? 'ok' : 'fail';
  };
  const attendanceState = !attendance || attendance.taken === 0
    ? 'pending'
    : (attendance.pct >= APPROVAL.minAttendancePct ? 'ok' : 'fail');
  const finalGrade = verdict(summary?.promedioParcial, APPROVAL.minFinalGrade);
  const performance = verdict(summary?.rendimientoRaw ?? summary?.rendimientoPct, APPROVAL.minPerformancePct);
  // Veredicto global (solo notas, la asistencia es aparte porque da la
  // constancia, no el certificado): 'pending' mientras falten notas;
  // 'regular' si cumple ambos mínimos; 'substitute' si no -- le queda la
  // evaluación sustitutoria (nota mínima APPROVAL.minSubstituteGrade).
  const overall = !settled ? 'pending' : (finalGrade === 'ok' && performance === 'ok' ? 'regular' : 'substitute');
  return { finalGrade, performance, attendance: attendanceState, overall };
};

// Resultado de la evaluación sustitutoria: solo importa si la nota alcanza el mínimo.
export const evaluateSubstitute = (grade) => {
  const n = Number(grade);
  if (grade === null || grade === undefined || grade === '' || !Number.isFinite(n) || n < 0 || n > 20) return 'pending';
  return n >= APPROVAL.minSubstituteGrade ? 'ok' : 'fail';
};
