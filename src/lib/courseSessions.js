// Aplana las sesiones en vivo de todos los módulos de un curso (module.sessions,
// ver TeacherCourseContenido) en una sola lista numerada S01, S02... agrupada
// por módulo -- usado por Asistencia (docente) y Mi asistencia (alumno).

export const getOrderedSessions = (modules) => {
  let n = 0;
  return (modules || []).flatMap((m) =>
    (m.sessions || []).map((s) => {
      n += 1;
      return {
        id: s.id,
        moduleId: m.id,
        moduleTitle: m.title,
        number: n,
        label: `S${String(n).padStart(2, '0')}`,
        dateLabel: s.dateLabel || '',
        title: s.title,
      };
    })
  );
};
