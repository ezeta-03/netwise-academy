// Fechas de entrega y duración calculadas a partir del horario del aula y de
// la semana de cada módulo. Una sola fuente para el Cronograma del docente,
// "Mis entregas" del alumno y la generación del calendario de clases (Admin).
import { groupScheduleDays, lastClassDate } from './liveScheduleGenerator.js';

// "Semanas 5-6" -> 6 (la entrega cae al cierre del módulo); "Semana 3" -> 3;
// "Semanas 5 y 6" -> 6; "Sem. 3" -> 3. Sin una semana reconocible: `fallback`.
export const endWeekOf = (weeksLabel, fallback) => {
  const m = String(weeksLabel || '').match(/sem(?:anas?|\.)?\s*(\d+)(?:\s*(?:[-–]|a|y)\s*(\d+))?/i);
  return m ? Number(m[2] || m[1]) : fallback;
};

// Semanas que dura el curso según sus módulos (la mayor semana de cierre);
// null si ningún módulo declara semanas. Sirve para generar exactamente las
// clases que el contenido del curso necesita en vez de usar una duración fija.
export const courseWeeksFromModules = (modules) => {
  const ends = (modules || []).map((m) => endWeekOf(m.weeksLabel, null)).filter((n) => n !== null);
  return ends.length ? Math.max(...ends) : null;
};

// Fecha límite del entregable de un módulo (YYYY-MM-DD): la que el docente
// fijó a mano (`deliverable.dueDate`) o, si no, la última clase de la semana
// de cierre del módulo según el horario del aula. null si no se puede calcular.
export const deliverableDueDate = (module, moduleIndex, group) => {
  if (module?.deliverable?.dueDate) return module.deliverable.dueDate;
  const days = groupScheduleDays(group);
  return lastClassDate(group?.startDate, days, endWeekOf(module?.weeksLabel, moduleIndex + 1));
};
