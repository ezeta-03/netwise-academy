import { getLiveSessionStatus } from './liveSessionStatus';
import { ticketStatus, ticketTitle } from './support.js';
import { activeBanner, isExternalLink } from './campusBanner.js';

// Antes el sidebar mostraba 3 notificaciones hardcodeadas que nunca
// cambiaban. Esto las reemplaza por notificaciones derivadas del estado
// real del alumno: cohortes que se abrieron para talleres en los que se
// preinscribió, y clases en vivo próximas/activas/canceladas de los
// talleres en los que está inscrito o preinscrito. No se guardan en
// Firestore -- se recalculan cada vez a partir de datos que ya existen
// (igual que el estado de una clase en vivo).
// Solo se avisa de las clases de la próxima semana: con el calendario completo
// de un aula (16+ clases) la campana se llenaba de avisos de meses adelante.
const UPCOMING_WINDOW_MS = 7 * 24 * 3600 * 1000;

// Una matrícula recién activada se avisa durante dos semanas.
const ACCESS_NOTICE_MS = 14 * 24 * 3600 * 1000;

// `enrollments`: matrículas activas del alumno ({ [courseId]: matrícula }).
// `submissions`: sus entregas (para avisar cuando el docente las califica).
export const buildStudentNotifications = ({ courses, preregisteredIds, enrolledCourseIds, liveSessions, enrollments = {}, submissions = [], practices = [], support = [], groupInvites = [], banners = [], now = Date.now() }) => {
  const notifications = [];

  Object.values(enrollments).forEach((e) => {
    const since = new Date(e.enrolledAt || 0).getTime();
    if (!since || now - since > ACCESS_NOTICE_MS) return;
    notifications.push({
      id: `access_${e.courseId}_${e.enrolledAt}`,
      title: `🎉 Ya tienes acceso a "${e.courseTitle || 'tu curso'}"`,
      detail: e.groupName ? `Tu aula: ${e.groupName}` : 'Tu pago fue validado.',
      to: `/student/curso/${e.courseId}`,
    });
  });

  submissions.filter((s) => s.status === 'reviewed').forEach((s) => {
    const graded = s.grade !== null && s.grade !== undefined && s.grade !== '';
    notifications.push({
      // Con la fecha en el id, una recalificación vuelve a avisar.
      id: `graded_${s.id}_${s.updatedAt}`,
      title: `✅ Tu docente ${graded ? 'calificó' : 'revisó'} "${s.deliverableTitle || s.moduleTitle || 'tu entrega'}"`,
      detail: graded ? `Nota: ${s.grade}/20${s.feedback ? ' · con comentarios' : ''}` : 'Revisa sus comentarios.',
      to: s.practiceId ? `/student/curso/${s.courseId}/entrega/practica/${s.practiceId}` : `/student/curso/${s.courseId}/entrega/modulo/${s.moduleId}`,
    });
  });
  // Soporte respondió: con la fecha de la respuesta en el id, cada respuesta vuelve a avisar.
  support.filter((t) => ticketStatus(t) === 'answered').forEach((t) => {
    notifications.push({
      id: `support_${t.id}_${t.lastMessageAt}`,
      title: '💬 Soporte respondió tu solicitud',
      detail: ticketTitle(t),
      to: `/student/soporte/${t.id}`,
    });
  });

  // Banner del campus (A7): el activo también llega a la campana, con su
  // miniatura y el mismo link (el aviso nace el día que se activa).
  const banner = activeBanner(banners, now);
  if (banner) {
    notifications.push({
      id: `banner_${banner.id}`,
      title: `📣 ${banner.title}`,
      detail: 'Novedad de Netwise Academy',
      image: banner.mobileImage || banner.desktopImage,
      ...(isExternalLink(banner.link) ? { href: banner.link } : { to: banner.link }),
    });
  }

  // Invitaciones a un grupo de trabajo (E12).
  groupInvites.forEach((g) => {
    notifications.push({
      id: `group_invite_${g.id}`,
      title: `👥 ${g.leaderName || 'Un compañero'} te invitó a "${g.name}"`,
      detail: 'Grupo de trabajo · acéptala o recházala en Grupos de trabajo.',
      to: `/student/curso/${g.courseId}/grupos`,
    });
  });

  // Una práctica nueva del docente se avisa durante una semana.
  practices.forEach((p) => {
    const since = new Date(p.createdAt || 0).getTime();
    if (!since || now - since > UPCOMING_WINDOW_MS) return;
    notifications.push({
      id: `practice_${p.id}`,
      title: `📝 Nueva práctica: "${p.title}"`,
      detail: p.dueAt ? `Vence el ${new Date(p.dueAt).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Entrégala desde Mi proyecto.',
      to: `/student/curso/${p.courseId}/proyecto`,
    });
  });
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
      if (new Date(s.startsAt).getTime() - now > UPCOMING_WINDOW_MS) return;
      // El docente cambió fecha, hora o tema: aviso aparte (con la fecha del
      // cambio en el id, cada cambio vuelve a avisar).
      if (s.rescheduledAt) {
        notifications.push({
          id: `live_changed_${s.id}_${s.rescheduledAt}`,
          title: `🗓️ Cambió la clase "${s.title}"`,
          detail: `${s.courseTitle} · Ahora: ${new Date(s.startsAt).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
          to: `/student/curso/${s.courseId}/sala`,
        });
        return;
      }
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

// Notificaciones para el Admin: un aviso por cada pedido manual (Yape/
// Transferencia) que sigue 'pending' -- nadie confirmó todavía que el
// dinero llegó, así que necesita que alguien lo revise en Ventas y lo
// apruebe (ver approveOrder en lib/db.js) para recién matricular al
// alumno. Igual que las del alumno, se recalculan a partir de `orders` en
// vez de guardarse aparte.
export const buildAdminNotifications = ({ orders, support = [] }) => [
  ...orders
    .filter((o) => o.status === 'pending')
    .map((o) => ({
      id: `order_pending_${o.id}`,
      title: `🧾 Pago por validar: ${o.studentName}`,
      detail: `${o.courseTitle} · S/ ${Number(o.amount).toFixed(2)} · ${o.code}`,
      to: '/admin/ventas',
    })),
  // Pedidos de soporte esperando respuesta (los nuevos y los que el alumno volvió a abrir).
  ...support
    .filter((t) => t.type !== 'tutoria' && ticketStatus(t) === 'new')
    .map((t) => ({
      id: `support_new_${t.id}_${t.lastMessageAt || t.createdAt}`,
      title: `🛟 Soporte: ${t.requesterName}`,
      detail: ticketTitle(t),
      to: '/admin/soporte',
    })),
];

// Notificaciones para el Docente: entregas que esperan su revisión, una por
// curso. `pendingByCourse`: [{ course, pending }]. El número va en el id para
// que una entrega nueva vuelva a marcarse como no leída.
export const buildTeacherNotifications = ({ pendingByCourse }) => (
  pendingByCourse
    .filter((b) => b.pending > 0)
    .map((b) => ({
      id: `to_review_${b.course.id}_${b.pending}`,
      title: `📥 ${b.pending} entrega${b.pending === 1 ? '' : 's'} por revisar`,
      detail: b.course.title,
      to: `/teacher/curso/${b.course.id}/entregas`,
    }))
);
