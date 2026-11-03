// Control de asistencia de un alumno. Una sesión cuenta como "dictada" si el
// docente la marcó como Realizada en Contenido (session.status === 'done') o
// si ya hay un registro de asistencia de ese alumno en ella. Sobre las sesiones
// dictadas, una sin registro cuenta como FALTA: el docente debe tomar lista de
// todos (un alumno "sin registrar" ya no queda fuera del porcentaje ni del
// riesgo, que era lo que pasaba antes).
//
// `sessions`: lista de getOrderedSessions (con `done`).
// `records`: registros de asistencia de ESE alumno ({ sessionId, present }).
export const attendanceStats = (sessions, records) => {
  const byId = new Map((records || []).map((r) => [r.sessionId, r]));
  // Una sesión sin id no se puede cruzar con ningún registro: se ignora.
  // Una marcada "No aplica" (`excused`: el alumno se matriculó después, o la
  // falta está justificada) no entra en su porcentaje ni cuenta como falta.
  const dictated = (sessions || []).filter((s) => s.id !== undefined && s.id !== null && !byId.get(s.id)?.excused && (s.done || byId.has(s.id)));
  const present = dictated.filter((s) => byId.get(s.id)?.present).length;
  const unregistered = dictated.filter((s) => !byId.has(s.id)).length;
  const raw = dictated.length ? (present / dictated.length) * 100 : null;
  return {
    taken: dictated.length,
    present,
    absent: dictated.length - present,
    unregistered,
    raw,
    pct: raw === null ? null : Math.round(raw),
  };
};

// Tomar lista a un alumno deja la sesión como dictada para toda el aula,
// aunque el docente no la haya marcado como Realizada: quien quede sin registro
// cuenta como falta en vez de quedar fuera del porcentaje.
// `classRecords`: registros de los alumnos de ESA aula (no de otras).
export const withTakenSessions = (sessions, classRecords) => {
  const taken = new Set((classRecords || []).map((r) => r.sessionId));
  return (sessions || []).map((s) => (!s.done && taken.has(s.id) ? { ...s, done: true } : s));
};

// Sesiones marcadas "No aplica" para ese alumno (fuera de su porcentaje).
export const excusedCount = (sessions, records) => {
  const ids = new Set((sessions || []).map((s) => s.id));
  return (records || []).filter((r) => r.excused && ids.has(r.sessionId)).length;
};
