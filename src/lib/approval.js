// Reglas de aprobación del programa (mismas que se muestran en el
// Cronograma de evaluación del docente, ver scripts/setEvaluationBranding.mjs)
// para que docente y alumno evalúen exactamente lo mismo.

export const APPROVAL = {
  minFinalGrade: 15,       // nota vigesimal mínima (vía regular)
  minPerformancePct: 80,   // rendimiento ponderado mínimo sobre 20
  minSubstituteGrade: 16,  // nota mínima en la evaluación sustitutoria
  minAttendancePct: 75,    // asistencia mínima para la constancia
};

// summary: resultado de computeGradeSummary. attendance: { pct, taken } o
// null si aún no hay sesiones registradas. Cada check devuelve
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
