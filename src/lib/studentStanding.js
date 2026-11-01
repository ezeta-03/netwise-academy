import { fetchCourseContent, fetchCourseSubmissions, fetchCourseAttendance, fetchCourseGrades, fetchGroupProgress, fetchLiveSessions, fetchPractices } from './db';
import { computeGradeSummary } from './gradebook';
import { getGradingModel, buildStudentRows } from './gradingScheme';
import { buildClassList, normalizeAttendance } from './classList';
import { practicesForGroup } from './workItems';
import { attendanceStats } from './attendance';

// Cómo va un alumno en un curso, para la tarjeta de "Mis cursos" del Inicio:
// la nota parcial (solo lo ya calificado, con los pesos del sílabo) y su
// asistencia sobre la lista única de clases. Mismo cálculo que Mis notas y Mi asistencia.
export const fetchCourseStanding = async (courseId, uid, groupId) => {
  const [content, subs, att, grades, doneIds, live, practices] = await Promise.all([
    fetchCourseContent(courseId), fetchCourseSubmissions(courseId, uid), fetchCourseAttendance(courseId, uid),
    fetchCourseGrades(courseId, uid), fetchGroupProgress(groupId).catch(() => []), fetchLiveSessions(courseId).catch(() => []), fetchPractices(courseId).catch(() => []),
  ]);
  const modules = content.modules || [];
  const mine = (list) => (list || []).filter((x) => x.uid === uid);
  const inRecord = new Set(practicesForGroup(practices, groupId).filter((p) => p.countsInRecord).map((p) => p.id));
  const grade = computeGradeSummary(buildStudentRows(getGradingModel(courseId, modules), mine(subs), mine(grades)[0]?.scores, inRecord));
  const classList = buildClassList({ liveSessions: live, modules, groupId, doneIds });
  const st = attendanceStats(classList, normalizeAttendance(mine(att), classList));
  return { promedioParcial: grade.promedioParcial, allGraded: grade.allGraded, attendance: { present: st.present, taken: st.taken, pct: st.pct, total: classList.length } };
};
