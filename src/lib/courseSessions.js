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
        // "Realizada" (o el booleano antiguo `done`): ver lib/attendance.js.
        done: (s.status || (s.done ? 'done' : 'scheduled')) === 'done',
      };
    })
  );
};

// Sesiones del curso vistas desde UN aula: además de las que el contenido marca
// como Realizada (vale para todas las aulas), cuentan como dictadas las que esa
// aula ya tuvo (`doneSessionIds`, ver fetchGroupProgress). Devuelve los módulos
// con ese estado aplicado, listos para getOrderedSessions.
export const withAulaSessions = (modules, doneSessionIds) => {
  const done = new Set(doneSessionIds || []);
  if (done.size === 0) return modules || [];
  return (modules || []).map((m) => ({
    ...m,
    sessions: (m.sessions || []).map((s) => (done.has(s.id) ? { ...s, status: 'done' } : s)),
  }));
};
