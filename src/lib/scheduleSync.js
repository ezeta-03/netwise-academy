// Sincroniza el calendario de clases de un aula cuando se EDITA (horario,
// docente, estado, fecha de cierre) en vez de crear otra aula. Compara las
// clases futuras que el sistema generó para el aula con las que deberían
// existir según la configuración nueva, y devuelve solo la diferencia.
//
// Reglas que respeta (ver AdminGrupos):
// - Lo ya realizado / en vivo / cancelado a propósito NO se toca: es historial
//   (asistencia, grabaciones) o una decisión del docente (feriado, etc.).
// - Las clases sueltas que el docente programó a mano no llevan `generated`
//   y nunca se borran.
// - Solo se compara lo FUTURO: cambiar el horario afecta desde la próxima
//   clase; las semanas pasadas conservan el horario con el que se dictaron.
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

export const planScheduleSync = ({
  desired = [], existing = [], groupId, now = Date.now(), endDate = null,
  closed = false, adoptLegacy = false, instructor = '', instructorUid = '',
}) => {
  const mine = existing.filter((s) => belongsToGroup(s, groupId, adoptLegacy));
  const statusOf = (s) => statusAt(s, now);

  const future = mine.filter((s) => statusOf(s) === 'upcoming' && instant(s.startsAt) > now);
  const cancelledFuture = mine.filter((s) => s.status === 'cancelled' && instant(s.startsAt) > now);
  const past = mine.filter((s) => !future.includes(s) && !cancelledFuture.includes(s));

  const limit = endDate ? endOfDayPeru(endDate) : Infinity;
  const wanted = closed
    ? []
    : desired.filter((e) => instant(e.startsAt) > now && instant(e.startsAt) <= limit);

  const wantedKeys = new Set(wanted.map((e) => keyOf(e.startsAt, e.durationMin)));
  const futureByKey = new Map(future.map((s) => [keyOf(s.startsAt, s.durationMin), s]));
  // Una clase que el docente canceló a propósito no se vuelve a crear.
  const cancelledKeys = new Set(cancelledFuture.map((s) => keyOf(s.startsAt, s.durationMin)));

  const toDelete = future.filter((s) => !wantedKeys.has(keyOf(s.startsAt, s.durationMin)));
  const toCreate = wanted.filter((e) => {
    const k = keyOf(e.startsAt, e.durationMin);
    return !futureByKey.has(k) && !cancelledKeys.has(k);
  });
  const toKeep = future.filter((s) => wantedKeys.has(keyOf(s.startsAt, s.durationMin)));
  const toUpdate = toKeep.filter((s) => (instructorUid && s.instructorUid !== instructorUid) || (instructor && s.instructor !== instructor));

  return {
    toCreate, toDelete, toUpdate,
    unchanged: toKeep.length - toUpdate.length,
    pastCount: past.length,
    mineCount: mine.length,
    futureCount: future.length,
    hasStarted: past.some((s) => ['live', 'ended'].includes(statusOf(s))),
    hasChanges: toCreate.length + toDelete.length + toUpdate.length > 0,
  };
};
