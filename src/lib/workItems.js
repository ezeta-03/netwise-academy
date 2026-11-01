// Todo lo que un alumno entrega en un curso, con una sola forma para las dos
// clases de entrega: la entrega de cada módulo (sale del sílabo / Contenido) y
// las prácticas de clase que crea el docente. Mi proyecto (E7), Mis entregas
// (E5), el Inicio (E1) y la ventana Entregar (E6) usan esta misma lista, así
// que cuentan igual en todas partes.
import { deliverableDueDate } from './deliveryDates.js';
import { isSafeLink } from './placeholders.js';

export const PRACTICE_PREFIX = 'p-';
export const practiceKey = (practiceId) => `${PRACTICE_PREFIX}${practiceId}`;
export const isPracticeSubmission = (sub) => !!sub?.practiceId || String(sub?.moduleId || '').startsWith(PRACTICE_PREFIX);

export const KIND_LABEL = { module: 'Entrega del módulo', practice: 'Práctica de clase' };

// Fecha de Perú (YYYY-MM-DD) de un instante.
const peruDate = (iso) => {
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : new Date(ms - 5 * 3600000).toISOString().slice(0, 10);
};

// Prácticas que ve un alumno: las de su aula (o sin aula).
export const practicesForGroup = (practices, groupId) => (practices || []).filter((p) => !p.groupId || !groupId || p.groupId === groupId);

// `modules`: los del curso. `practices`: ya filtradas por aula. `group`: su
// aula (horario e inicio, para la fecha límite calculada).
export const buildWorkItems = ({ course, modules, practices = [], group = null }) => {
  const mods = modules || [];
  const moduleItems = mods.filter((m) => m.deliverable?.description).map((m) => {
    const index = mods.indexOf(m);
    const dueDate = deliverableDueDate(m, index, group);
    return {
      key: m.id, kind: 'module', courseId: course.id, courseTitle: course.title,
      submissionModuleId: m.id, moduleId: m.id, moduleIndex: index, moduleTitle: m.title,
      title: `Módulo ${index + 1} · ${m.deliverable.description}`,
      shortTitle: m.deliverable.description,
      instructions: m.deliverable.instructions || m.objective || '',
      dueDate, dueAt: dueDate ? `${dueDate}T23:59:00-05:00` : null,
      graded: m.deliverable.graded !== false, open: m.deliverable.open !== false,
    };
  });
  const practiceItems = (practices || []).map((p) => {
    const index = mods.findIndex((m) => m.id === p.moduleId);
    return {
      key: practiceKey(p.id), kind: 'practice', courseId: course.id, courseTitle: course.title,
      submissionModuleId: practiceKey(p.id), practiceId: p.id, practice: p,
      moduleId: p.moduleId || null, moduleIndex: index, moduleTitle: mods[index]?.title || '',
      title: p.classTitle ? `${p.classTitle} · ${p.title}` : p.title,
      shortTitle: p.title,
      instructions: p.instructions || '',
      dueDate: p.dueAt ? peruDate(p.dueAt) : null, dueAt: p.dueAt || null,
      classTitle: p.classTitle || '', createdByName: p.createdByName || '',
      graded: true, open: true,
    };
  });
  return [...moduleItems, ...practiceItems].sort((a, b) => String(a.dueAt || '9').localeCompare(String(b.dueAt || '9')));
};

// Entrega del alumno para un ítem y su estado: 'pending' (por entregar),
// 'submitted' (enviada, sin nota) o 'reviewed' (calificada).
export const submissionFor = (item, submissions) => (submissions || []).find((s) => s.moduleId === item.submissionModuleId) || null;

export const itemState = (sub) => (sub?.status === 'reviewed' ? 'reviewed' : sub?.status === 'submitted' ? 'submitted' : 'pending');

// Lo que el alumno mandó (no lo que puso el docente al calificar sin entrega).
export const hasDelivered = (sub) => !!sub && (sub.status === 'submitted' || !!sub.submittedAt || submissionFiles(sub).length > 0 || submissionLinks(sub).length > 0 || !!sub.note);

// Días entre hoy y la fecha límite (negativo = vencida).
export const daysLeft = (dueDate, now = Date.now()) => {
  if (!dueDate) return null;
  const today = peruDate(new Date(now).toISOString());
  return Math.round((Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
};

export const dueLabel = (days) => {
  if (days === null || days === undefined) return 'Sin fecha límite';
  if (days < 0) return days === -1 ? 'Venció ayer' : `Venció hace ${-days} días`;
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  return `Vence en ${days} días`;
};

// Archivos, links y comentario de una entrega, también de las antiguas (un
// solo archivo en fileUrl y el link o texto en `note`).
export const submissionFiles = (sub) => {
  if (Array.isArray(sub?.files) && sub.files.length) return sub.files.filter((f) => isSafeLink(f?.url));
  return sub?.fileUrl && isSafeLink(sub.fileUrl) ? [{ url: sub.fileUrl, name: sub.fileName || 'Archivo adjunto' }] : [];
};
export const submissionLinks = (sub) => {
  if (Array.isArray(sub?.links)) return sub.links.filter((l) => isSafeLink(l));
  return isSafeLink(sub?.note) ? [String(sub.note).trim()] : [];
};
export const submissionComment = (sub) => {
  if (sub?.comment !== undefined) return sub.comment || '';
  return sub?.note && !isSafeLink(sub.note) ? sub.note : '';
};

// "Vence el domingo 1 de noviembre, 11:59 p. m." (hora de Perú).
export const dueLongLabel = (dueAt) => {
  if (!dueAt) return '';
  const d = new Date(dueAt);
  return `Vence el ${d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Lima' })}, ${d.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Lima' })}`;
};
