// Sincroniza el calendario de clases de un aula cuando se EDITA (horario,
// docente, estado, fecha de inicio o de cierre) en vez de crear otra aula.
// Compara las clases que el sistema generó para el aula con las que deberían
// existir según la configuración nueva (fecha de inicio + horario + cierre), y
// devuelve solo la diferencia.
//
// Reglas que respeta (ver AdminGrupos):
// - El aula tiene exactamente las clases que salen de sus fechas y su horario:
//   si se mueve la fecha de inicio o de cierre, las clases se recalculan y no
//   quedan clases de más (antes las ya pasadas se quedaban y se sumaban).
// - No se mueve una clase con asistencia marcada (`lockedIds`), con grabación,
//   en vivo, ni una ya dictada que sigue dentro de las fechas del aula: se
//   queda donde está y ocupa el lugar de la clase calculada más cercana, para
//   no pasarse del total.
// - Una clase cancelada a propósito (feriado) no se vuelve a crear ni se borra.
// - Las clases sueltas que el docente programó a mano no llevan `generated`
//   y nunca se borran.
const instant = (startsAt) => new Date(startsAt).getTime();

// Estado de una clase en el instante `now` (mismo criterio que liveSessionStatus.js,
// pero con el reloj inyectable para poder probar escenarios).
const statusAt = (session, now) => {
  if (session.status === 'cancelled') return 'cancelled';
  const start = instant(session.startsAt);
  if (Number.isNaN(start)) return 'upcoming';
  const end = start + (Number(session.durationMin) > 0 ? Number(session.durationMin) : 60) * 60000;
  return now < start ? 'upcoming' : now <= end ? 'live' : 'ended';
};
const keyOf = (startsAt, durationMin) => `${instant(startsAt)}|${Number(durationMin) || 60}`;

// Fin de un día (YYYY-MM-DD) en hora de Perú, para recortar clases pasada la
// fecha de cierre del aula.
const endOfDayPeru = (isoDate) => instant(`${isoDate}T23:59:59-05:00`);

// ¿Esta clase la generó el sistema para ESTE aula? Las nuevas llevan
// `generated` + `groupId`. Las antiguas (sin groupId) solo se adoptan si el
// curso tiene un único aula -- con varias no hay forma de saber de cuál es.
const belongsToGroup = (session, groupId, adoptLegacy) => {
  if (session.generated) return session.groupId === groupId;
  return adoptLegacy && !session.groupId && /^Semana \d+ · /.test(session.title || '');
};

const startOfDayPeru = (isoDate) => instant(`${isoDate}T00:00:00-05:00`);

export const planScheduleSync = ({
  desired = [], existing = [], groupId, now = Date.now(), endDate = null,
  closed = false, adoptLegacy = false, instructor = '', instructorUid = '', lockedIds = [],
}) => {
  const mine = existing.filter((s) => belongsToGroup(s, groupId, adoptLegacy));
  const statusOf = (s) => statusAt(s, now);
  const locked = new Set(lockedIds);

  const cancelled = mine.filter((s) => s.status === 'cancelled');
  const active = mine.filter((s) => s.status !== 'cancelled');
  const future = active.filter((s) => statusOf(s) === 'upcoming' && instant(s.startsAt) > now);
  const past = mine.filter((s) => !future.includes(s));

  // Clases que debería tener el aula. Un aula cerrada conserva lo ya dictado
  // y pierde lo que falta.
  const limit = endDate ? endOfDayPeru(endDate) : Infinity;
  const wanted = desired
    .filter((e) => instant(e.startsAt) <= limit && (!closed || instant(e.startsAt) <= now))
    .sort((a, b) => instant(a.startsAt) - instant(b.startsAt));
  const rangeStart = wanted.length ? startOfDayPeru(wanted[0].startsAt.slice(0, 10)) : null;
  const rangeEnd = wanted.length ? endOfDayPeru(wanted[wanted.length - 1].startsAt.slice(0, 10)) : null;

  // Lo que no se mueve. Sin calendario calculado (fechas sin clases) tampoco
  // se borra lo ya dictado: no hay con qué compararlo.
  const isLocked = (s) => {
    if (locked.has(s.id) || s.recordingUrl) return true;
    const st = statusOf(s);
    if (st === 'live') return true;
    if (st !== 'ended') return false;
    if (rangeStart === null) return true;
    const t = instant(s.startsAt);
    return t >= rangeStart && t <= rangeEnd;
  };
  const fixed = active.filter(isLocked);
  const movable = active.filter((s) => !isLocked(s));

  // Cada clase calculada se usa una sola vez.
  const remaining = wanted.map((e) => ({ ...e, key: keyOf(e.startsAt, e.durationMin) }));
  const takeExact = (s) => {
    const i = remaining.findIndex((e) => e.key === keyOf(s.startsAt, s.durationMin));
    return i >= 0 ? remaining.splice(i, 1)[0] : null;
  };
  const takeNearest = (s) => {
    if (remaining.length === 0) return null;
    const t = instant(s.startsAt);
    let best = 0;
    remaining.forEach((e, i) => { if (Math.abs(instant(e.startsAt) - t) < Math.abs(instant(remaining[best].startsAt) - t)) best = i; });
    return remaining.splice(best, 1)[0];
  };

  const byTime = (a, b) => instant(a.startsAt) - instant(b.startsAt);
  const matchOf = new Map();
  [...fixed].sort(byTime).forEach((s) => { const e = takeExact(s); if (e) matchOf.set(s.id, e); });
  // Una clase que el docente canceló a propósito no se vuelve a crear.
  cancelled.forEach((s) => takeExact(s));
  [...fixed].sort(byTime).filter((s) => !matchOf.has(s.id)).forEach((s) => takeNearest(s));

  const toKeep = [];
  const toDelete = [];
  [...movable].sort(byTime).forEach((s) => {
    const e = takeExact(s);
    if (e) { matchOf.set(s.id, e); toKeep.push(s); } else toDelete.push(s);
  });
  const toCreate = remaining.map((e) => { const copy = { ...e }; delete copy.key; return copy; });

  // Una clase que se conserva puede cambiar de docente o de número de semana
  // (al mover la fecha de inicio, el lunes que era "Semana 2" pasa a ser
  // "Semana 1"): `patch` lleva solo los campos que cambian. Lo ya dictado
  // conserva el docente y el título con que se dictó.
  const toUpdate = [...fixed, ...toKeep].filter((s) => statusOf(s) === 'upcoming').map((s) => {
    const patch = {};
    if ((instructorUid && s.instructorUid !== instructorUid) || (instructor && s.instructor !== instructor)) {
      Object.assign(patch, { instructor, instructorUid });
    }
    const title = matchOf.get(s.id)?.title;
    if (title && s.title !== title) patch.title = title;
    return { ...s, patch };
  }).filter((s) => Object.keys(s.patch).length > 0);

  return {
    toCreate, toDelete, toUpdate,
    unchanged: fixed.length + toKeep.length - toUpdate.length,
    lockedCount: fixed.length,
    pastCount: past.length,
    mineCount: mine.length,
    futureCount: future.length,
    hasStarted: past.some((s) => ['live', 'ended'].includes(statusOf(s))),
    hasChanges: toCreate.length + toDelete.length + toUpdate.length > 0,
  };
};
