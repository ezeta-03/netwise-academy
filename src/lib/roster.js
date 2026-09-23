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
