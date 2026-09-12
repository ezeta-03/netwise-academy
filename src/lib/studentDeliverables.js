import { fetchCourseContent, fetchSubmissions } from './db';

// Junta, para un alumno, el entregable de cada módulo (de los cursos donde
// está inscrito) con el estado real de su propia entrega -- usado tanto por
// el contador de "Mis entregas" del sidebar como por la página completa, así
// ambos ven siempre el mismo número.
export const fetchMyDeliverables = async (uid, enrolledCourses) => {
  const perCourse = await Promise.all(enrolledCourses.map(async (course) => {
    const content = await fetchCourseContent(course.id);
    const modules = (content.modules || []).filter((m) => m.deliverable?.description);
    return Promise.all(modules.map(async (m) => {
      const subs = await fetchSubmissions(course.id, m.id);
      const mine = subs.find((s) => s.uid === uid);
      const status = mine?.status === 'reviewed' ? 'reviewed' : mine?.status === 'submitted' ? 'submitted' : 'pending';
      return {
        courseId: course.id, courseTitle: course.title, moduleId: m.id, moduleTitle: m.title,
        deliverableTitle: m.deliverable.description, dueDate: m.deliverable.dueDate || null,
        status, note: mine?.note || '',
      };
    }));
  }));
  return perCourse.flat();
};
