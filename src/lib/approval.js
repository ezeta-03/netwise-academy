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
  return {
    finalGrade: verdict(summary?.promedioParcial, APPROVAL.minFinalGrade),
    performance: verdict(summary?.rendimientoRaw ?? summary?.rendimientoPct, APPROVAL.minPerformancePct),
    attendance: attendanceState,
  };
};
