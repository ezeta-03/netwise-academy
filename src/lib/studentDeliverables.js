import { fetchCourseContent, fetchCourseSubmissions, fetchGroups, fetchMyEnrollments, fetchPractices, fetchProjectProfile } from './db';
import { buildWorkItems, practicesForGroup, submissionFor, itemState } from './workItems.js';

// Todo lo que un alumno tiene que entregar en sus cursos (entregas de cada
// módulo y prácticas de su aula) con el estado real de su entrega. Lo usan el
// contador de "Mis entregas" del menú, la página Mis entregas y "Esta semana"
// del Inicio, así todos cuentan igual (y lo mismo que Mi proyecto).
// `blocked`: aún no define su empresa en Mi proyecto, así que no puede entregar.
export const fetchMyDeliverables = async (uid, enrolledCourses) => {
  if (!enrolledCourses.length) return [];
  // El aula (horario y fecha de inicio) da la fecha límite calculada cuando el
  // docente no fijó una a mano -- así el alumno ve la misma fecha que el docente.
  const ids = enrolledCourses.map((c) => c.id);
  const [groups, enrollments, practices] = await Promise.all([fetchGroups(ids), fetchMyEnrollments(uid), fetchPractices(ids).catch(() => [])]);
  const perCourse = await Promise.all(enrolledCourses.map(async (course) => {
    const [content, subs, profile] = await Promise.all([fetchCourseContent(course.id), fetchCourseSubmissions(course.id, uid), fetchProjectProfile(uid, course.id).catch(() => null)]);
    const groupId = enrollments[course.id]?.groupId || null;
    const group = groups.find((g) => g.id === groupId) || groups.find((g) => g.courseId?.toString() === course.id.toString()) || null;
    const coursePractices = practicesForGroup(practices.filter((p) => p.courseId?.toString() === course.id.toString()), groupId);
    const mine = (subs || []).filter((s) => s.uid === uid);
    return buildWorkItems({ course, modules: content.modules || [], practices: coursePractices, group }).map((item) => {
      const sub = submissionFor(item, mine);
      return {
        ...item, sub, status: itemState(sub), blocked: !profile,
        // Campos de antes, para quien aún los lee.
        deliverableTitle: item.shortTitle, note: sub?.note || '',
      };
    });
  }));
  return perCourse.flat();
};
