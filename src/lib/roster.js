// Alumnos que cuentan para notas y asistencia de un curso: matrículas de ese
// curso que no estén pendientes (todavía sin acceso) y sin duplicados por uid
// (una matrícula manual del admin más una propia creaba dos filas).
export const courseRoster = (enrollments, courseId) => {
  if (courseId === undefined || courseId === null) return [];
  const seen = new Set();
  return (enrollments || [])
    .filter((e) => e.courseId != null && e.courseId.toString() === courseId.toString() && e.status !== 'pending')
    .filter((e) => {
      if (!e.uid || seen.has(e.uid)) return false;
      seen.add(e.uid);
      return true;
    })
    .map((e) => ({ uid: e.uid, studentName: e.studentName || e.uid, status: e.status }));
};

// Opción "Sin aula" del selector de aula del docente.
export const NO_AULA = '__sin_aula__';

// Alumnos del curso (misma regla que courseRoster) que pertenecen al aula
// elegida. `aulaId`: id de un aula, NO_AULA (matriculados sin aula válida) o
// null/undefined cuando el curso todavía no tiene aulas (todos).
export const aulaRoster = (enrollments, courseId, groups, aulaId) => {
  const roster = courseRoster(enrollments, courseId);
  if (aulaId === null || aulaId === undefined) return roster;
  const valid = new Set((groups || []).map((g) => g.id));
  const groupOf = new Map((enrollments || [])
    .filter((e) => e.courseId != null && e.courseId.toString() === courseId.toString() && e.status !== 'pending')
    .map((e) => [e.uid, e.groupId]));
  return roster.filter((r) => (aulaId === NO_AULA ? !valid.has(groupOf.get(r.uid)) : groupOf.get(r.uid) === aulaId));
};
