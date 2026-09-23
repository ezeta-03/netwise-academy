import { fetchCourseContent, fetchSubmissions, fetchGroups, fetchMyEnrollments } from './db';
import { deliverableDueDate } from './deliveryDates.js';

// Junta, para un alumno, el entregable de cada módulo (de los cursos donde
// está inscrito) con el estado real de su propia entrega -- usado tanto por
// el contador de "Mis entregas" del sidebar como por la página completa, así
// ambos ven siempre el mismo número.
export const fetchMyDeliverables = async (uid, enrolledCourses) => {
  // El aula (horario y fecha de inicio) da la fecha límite calculada cuando el
  // docente no fijó una a mano -- así el alumno ve la misma fecha que el docente.
  const [groups, enrollments] = await Promise.all([fetchGroups(), fetchMyEnrollments(uid)]);
  const perCourse = await Promise.all(enrolledCourses.map(async (course) => {
    const content = await fetchCourseContent(course.id);
    const allModules = content.modules || [];
    const modules = allModules.filter((m) => m.deliverable?.description);
    const group = groups.find((g) => g.id === enrollments[course.id]?.groupId) || groups.find((g) => g.courseId?.toString() === course.id.toString()) || null;
    return Promise.all(modules.map(async (m) => {
      const subs = await fetchSubmissions(course.id, m.id, uid);
      const mine = subs.find((s) => s.uid === uid);
      const status = mine?.status === 'reviewed' ? 'reviewed' : mine?.status === 'submitted' ? 'submitted' : 'pending';
      return {
        courseId: course.id, courseTitle: course.title, moduleId: m.id, moduleTitle: m.title,
        deliverableTitle: m.deliverable.description, dueDate: deliverableDueDate(m, allModules.indexOf(m), group),
        status, note: mine?.note || '',
      };
    }));
  }));
  return perCourse.flat();
};
