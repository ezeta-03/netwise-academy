// Asignación de alumnos matriculados a un aula (grupo) de su curso. Fuente
// única para la asignación automática al matricular (adminCreateEnrollment /
// approveOrder) y para "Aulas y horarios > Asignar alumnos".
//
// Criterio: entre las aulas no cerradas del curso que todavía no terminaron y
// tienen cupo, primero las que aún no empiezan (el alumno no se pierde clases),
// la de inicio más cercano; con varias aulas en paralelo (misma fecha) va a la
// que tiene más cupos libres, para repartir parejo.

const sameCourse = (a, b) => a != null && b != null && a.toString() === b.toString();
const isActive = (e) => (e?.status || 'active') === 'active';

// YYYY-MM-DD de hoy en hora de Perú (las fechas de aula se guardan así).
export const todayIsoLima = (now = Date.now()) => new Date(now - 5 * 3600 * 1000).toISOString().slice(0, 10);

// Alumnos activos por aula: { [groupId]: n }.
export const countByGroup = (enrollments) => {
  const counts = {};
  (enrollments || []).filter((e) => e.groupId && isActive(e)).forEach((e) => { counts[e.groupId] = (counts[e.groupId] || 0) + 1; });
  return counts;
};

// Cupos libres (Infinity si el aula no tiene tope definido).
export const freeSeats = (group, counts) => {
  const cap = Number(group?.capacity) || 0;
  return cap > 0 ? Math.max(0, cap - (counts[group.id] || 0)) : Infinity;
};

// Aulas del curso que pueden recibir alumnos, en orden de preferencia (sin
// mirar cupos: eso lo resuelve pickGroup con los conteos del momento).
export const eligibleGroups = (groups, courseId, today = todayIsoLima()) => (groups || [])
  .filter((g) => sameCourse(g.courseId, courseId) && g.status !== 'closed' && !(g.endDate && g.endDate < today))
  .sort((a, b) => {
    const upA = !a.startDate || a.startDate >= today;
    const upB = !b.startDate || b.startDate >= today;
    if (upA !== upB) return upA ? -1 : 1;
    // Próximas: la que empieza antes. Ya en curso: la que empezó más tarde.
    const sa = a.startDate || '9999-12-31';
    const sb = b.startDate || '9999-12-31';
    if (sa !== sb) return upA ? sa.localeCompare(sb) : sb.localeCompare(sa);
    return 0;
  });

// Aula sugerida para un alumno nuevo del curso, o null si no hay ninguna con cupo.
export const pickGroup = (groups, enrollments, courseId, today = todayIsoLima()) => {
  const counts = countByGroup(enrollments);
  const list = eligibleGroups(groups, courseId, today).filter((g) => freeSeats(g, counts) > 0);
  if (list.length === 0) return null;
  const first = list[0];
  // Aulas en paralelo: misma fecha de inicio que la preferida -> la más libre.
  const parallel = list.filter((g) => (g.startDate || '') === (first.startDate || ''));
  return parallel.reduce((best, g) => (freeSeats(g, counts) > freeSeats(best, counts) ? g : best), parallel[0]);
};

// Matrículas activas de un curso sin aula válida (sin groupId, o con un aula
// que ya no existe o es de otro curso).
export const unassignedEnrollments = (enrollments, groups, courseId = null) => {
  const valid = new Map((groups || []).map((g) => [g.id, g]));
  return (enrollments || []).filter((e) => {
    if (!isActive(e)) return false;
    if (courseId != null && !sameCourse(e.courseId, courseId)) return false;
    const g = e.groupId ? valid.get(e.groupId) : null;
    return !g || !sameCourse(g.courseId, e.courseId);
  });
};

// Reparto automático: una lista de { enrollment, group } para las matrículas
// dadas, llenando aulas con el mismo criterio de pickGroup y actualizando los
// conteos a cada paso. Las que no entran en ningún aula quedan fuera.
// Clave de una matrícula (en modo mock no tienen `id`).
export const enrollmentKey = (e) => e.id ?? `${e.uid}_${e.courseId}`;

export const distributeEnrollments = (toAssign, groups, enrollments, today = todayIsoLima()) => {
  const pending = new Set(toAssign.map(enrollmentKey));
  // Conteo de partida sin las matrículas que se van a mover.
  let current = (enrollments || []).filter((e) => !pending.has(enrollmentKey(e)));
  const result = [];
  for (const e of toAssign) {
    const g = pickGroup(groups, current, e.courseId, today);
    if (!g) continue;
    result.push({ enrollment: e, group: g });
    current = [...current, { ...e, groupId: g.id, status: 'active' }];
  }
  return result;
};
