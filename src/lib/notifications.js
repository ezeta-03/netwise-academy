import { getLiveSessionStatus } from './liveSessionStatus';

// Antes el sidebar mostraba 3 notificaciones hardcodeadas que nunca
// cambiaban. Esto las reemplaza por notificaciones derivadas del estado
// real del alumno: cohortes que se abrieron para talleres en los que se
// preinscribió, y clases en vivo próximas/activas/canceladas de los
// talleres en los que está inscrito o preinscrito. No se guardan en
// Firestore -- se recalculan cada vez a partir de datos que ya existen
// (igual que el estado de una clase en vivo).
export const buildStudentNotifications = ({ courses, preregisteredIds, enrolledCourseIds, liveSessions }) => {
  const notifications = [];
  const relevantCourseIds = new Set([...preregisteredIds, ...enrolledCourseIds]);

  preregisteredIds.forEach((courseId) => {
    const course = courses.find((c) => c.id === courseId);
    if (!course || course.price == null) return;
    notifications.push({
      id: `cohort_${courseId}`,
      title: `🚀 ¡Se abrió la cohorte de "${course.title}"!`,
      detail: course.price === 0
        ? 'Es gratis. Inscríbete cuando quieras.'
        : `Cuesta S/ ${course.price}${course.startDate ? ` · Inicia el ${new Date(course.startDate + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}` : ''}.`,
    });
  });

  liveSessions.forEach((s) => {
    if (!relevantCourseIds.has(s.courseId)) return;
    const status = getLiveSessionStatus(s);
    if (status === 'live') {
      notifications.push({
        id: `live_now_${s.id}`,
        title: `🔴 "${s.title}" está en vivo ahora`,
        detail: s.courseTitle,
      });
    } else if (status === 'upcoming') {
      notifications.push({
        id: `live_soon_${s.id}`,
        title: `📅 Próxima clase en vivo: "${s.title}"`,
        detail: `${s.courseTitle} · ${new Date(s.startsAt).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
      });
    } else if (status === 'cancelled') {
      notifications.push({
        id: `live_cancel_${s.id}`,
        title: `❌ Se canceló "${s.title}"`,
        detail: s.courseTitle,
      });
    }
  });

  return notifications;
};
