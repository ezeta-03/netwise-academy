// Lista única de clases de un aula: las clases en vivo (`liveSessions`) que
// ven la Agenda, el Inicio y Clases en vivo. Asistencia (docente y alumno),
// prácticas y seguimiento leen esta misma lista, así que si el docente cambia
// una clase, cambia en todas partes.
//
// Antes la asistencia se tomaba sobre las sesiones escritas en cada módulo
// (`module.sessions`). Para no perder esos registros, la clase N de la lista
// queda unida a la sesión N de los módulos (`legacyId`) y de ahí toma su módulo;
// normalizeAttendance pasa los registros viejos a la clase que les toca.
import { getClassCardState } from './liveSessionStatus.js';
import { getOrderedSessions, withAulaSessions } from './courseSessions.js';

const pad = (n) => String(n).padStart(2, '0');

// `liveSessions`: clases del curso (se filtran las del aula y las canceladas).
// `groupId`: aula elegida (null = todas). `doneIds`: avance del aula para el
// caso sin clases programadas, donde se sigue usando la lista de los módulos.
export const buildClassList = ({ liveSessions, modules, groupId = null, doneIds = [], now = Date.now() }) => {
  const legacy = getOrderedSessions(modules);
  const classes = (liveSessions || [])
    .filter((s) => s.status !== 'cancelled' && s.startsAt && (!groupId || !s.groupId || s.groupId === groupId))
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

  if (classes.length === 0) {
    return getOrderedSessions(withAulaSessions(modules, doneIds)).map((s) => ({ ...s, legacyId: null, startsAt: null, durationMin: null, fromModules: true }));
  }

  return classes.map((s, i) => {
    const old = legacy[i] || null;
    const state = getClassCardState({ ...s, status: 'upcoming' }, now);
    return {
      id: s.id,
      legacyId: old?.id ?? null,
      moduleId: old?.moduleId ?? legacy[legacy.length - 1]?.moduleId ?? null,
      moduleTitle: old?.moduleTitle ?? legacy[legacy.length - 1]?.moduleTitle ?? '',
      number: i + 1,
      label: `S${pad(i + 1)}`,
      title: s.title,
      startsAt: s.startsAt,
      durationMin: s.durationMin,
      dateLabel: new Date(s.startsAt).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', ''),
      // Una clase cuenta para la asistencia cuando ya terminó (por la hora).
      done: state === 'ended',
      live: state === 'live',
    };
  });
};

// Registros de asistencia con el id de su clase en la lista única. Un registro
// tomado sobre la sesión vieja de un módulo pasa a su clase (`fromLegacy`
// guarda el id original para reemplazarlo cuando el docente vuelva a marcar).
// Si la clase ya tiene un registro propio, ese manda.
export const normalizeAttendance = (records, classList) => {
  const byLegacy = new Map(classList.filter((c) => c.legacyId && c.legacyId !== c.id).map((c) => [c.legacyId, c.id]));
  const direct = new Set((records || []).filter((r) => !byLegacy.has(r.sessionId)).map((r) => `${r.uid}|${r.sessionId}`));
  return (records || []).flatMap((r) => {
    const target = byLegacy.get(r.sessionId);
    if (!target) return [r];
    if (direct.has(`${r.uid}|${target}`)) return [];
    return [{ ...r, sessionId: target, fromLegacy: r.sessionId }];
  });
};

// Nombre de una clase para listas: "Sesión 04 · Tema", sin repetir "Sesión" si
// el tema ya empieza así ("Sesión 4 · Judgments y Feelings").
export const classLabel = (c) => (/^sesi[oó]n\s*\d+/i.test(c.title || '') ? c.title : `Sesión ${String(c.number).padStart(2, '0')} · ${c.title}`);
