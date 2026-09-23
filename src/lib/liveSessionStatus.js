// El campo `status` que se guarda en Firestore solo vale 'upcoming' (al
// programarla) o 'cancelled' (al cancelarla) -- nunca pasa solo a 'live' o
// 'ended' por sí mismo, porque nada corre en el servidor para actualizarlo
// con el reloj. Este helper calcula el estado real en el momento de
// renderizar, comparando la hora actual contra `startsAt`/`durationMin`.
// Una duración vacía, 0 o negativa (datos viejos de un horario que cruzaba la
// medianoche) se trata como 60 min en vez de dejar la clase "finalizada".
const durationOf = (session) => (Number(session.durationMin) > 0 ? Number(session.durationMin) : 60);

export const getLiveSessionStatus = (session) => {
  if (session.status === 'cancelled') return 'cancelled';
  if (!session.startsAt) return session.status || 'upcoming';

  const start = new Date(session.startsAt).getTime();
  if (Number.isNaN(start)) return session.status || 'upcoming';

  const end = start + durationOf(session) * 60000;
  const now = Date.now();

  if (now < start) return 'upcoming';
  if (now <= end) return 'live';
  return 'ended';
};

// Ventana para poder abrir la sala: no se deja entrar apenas se programa la
// clase (podría ser días antes), solo desde N minutos antes de la hora
// definida y hasta que termine.
export const LIVE_JOIN_WINDOW_MIN = 10;

export const canJoinLiveSession = (session) => {
  if (session.status === 'cancelled' || !session.startsAt) return false;
  const start = new Date(session.startsAt).getTime();
  if (Number.isNaN(start)) return false;
  const end = start + durationOf(session) * 60000;
  const now = Date.now();
  return now >= start - LIVE_JOIN_WINDOW_MIN * 60000 && now <= end;
};
