// Clases generales: una clase para varios cursos a la vez (masterclass, día de
// inducción). Se guarda una copia por curso en `liveSessions` (así cada alumno
// la lee con la consulta de su curso, como cualquier otra clase), todas con el
// mismo `generalId`, la lista de cursos (`generalCourseIds`) y su propio
// enlace de Meet (`meetLink`), que no es el del aula.
//
// No cuentan como sesión del curso: no entran en la asistencia ni en la
// numeración S01, S02... (ver buildClassList).
import { isMeetLink } from './classLinks.js';

export const isGeneralClass = (s) => !!s?.general;

// Cuántos cursos tiene la clase general.
export const generalCourseCount = (s) => (Array.isArray(s?.generalCourseIds) ? s.generalCourseIds.length : 1);

// Etiqueta de la clase: el docente ve para cuántos cursos es; el alumno, solo
// que es general.
export const generalClassLabel = (s, role = 'student') => {
  if (!isGeneralClass(s)) return '';
  if (role !== 'teacher') return 'Clase general';
  const n = generalCourseCount(s);
  return `Clase general · ${n} curso${n === 1 ? '' : 's'}`;
};

// ¿La clase general incluye este curso?
export const generalIncludesCourse = (s, courseId) => (s?.generalCourseIds || [s?.courseId])
  .some((c) => c != null && courseId != null && c.toString() === courseId.toString());

// Una sola fila por clase general (quien está en varios de sus cursos la
// recibe varias veces). Las demás clases quedan igual.
export const dedupeGeneralClasses = (sessions) => {
  const seen = new Set();
  return (sessions || []).filter((s) => {
    if (!isGeneralClass(s) || !s.generalId) return true;
    if (seen.has(s.generalId)) return false;
    seen.add(s.generalId);
    return true;
  });
};

// Enlace de Meet con el que se entra a una clase: la general usa el suyo; las
// demás, el de la sala de clase del aula.
export const classMeetLink = (session, aulaLink) => {
  if (isGeneralClass(session)) return isMeetLink(session.meetLink) ? session.meetLink : null;
  return isMeetLink(aulaLink) ? aulaLink : null;
};
