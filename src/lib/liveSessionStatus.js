// El campo `status` que se guarda en Firestore solo vale 'upcoming' (al
// programarla) o 'cancelled' (al cancelarla) -- nunca pasa solo a 'live' o
// 'ended' por sí mismo, porque nada corre en el servidor para actualizarlo
// con el reloj. Este helper calcula el estado real en el momento de
// renderizar, comparando la hora actual contra `startsAt`/`durationMin`.
export const getLiveSessionStatus = (session) => {
  if (session.status === 'cancelled') return 'cancelled';

  const start = new Date(session.startsAt).getTime();
  if (Number.isNaN(start)) return session.status || 'upcoming';

  const end = start + (Number(session.durationMin) || 60) * 60000;
  const now = Date.now();

  if (now < start) return 'upcoming';
  if (now <= end) return 'live';
  return 'ended';
};
