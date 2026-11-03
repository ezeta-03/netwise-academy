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

// Estado de la tarjeta de clase (C1), igual en todas las pantallas y para
// todos los roles. Cambia solo con el reloj:
//   scheduled -> más de 10 min para empezar: botón gris "Se activa 10 min antes"
//   soon      -> desde 10 min antes: el botón se activa
//   live      -> desde la hora de inicio hasta la de fin
//   ended     -> terminada: pasa a Clases anteriores (grabación)
//   cancelled -> la canceló el docente: sin botón
export const getClassCardState = (session, now = Date.now()) => {
  if (session.status === 'cancelled') return 'cancelled';
  const start = new Date(session.startsAt).getTime();
  if (!session.startsAt || Number.isNaN(start)) return 'scheduled';
  const end = start + durationOf(session) * 60000;
  if (now > end) return 'ended';
  if (now >= start) return 'live';
  if (now >= start - LIVE_JOIN_WINDOW_MIN * 60000) return 'soon';
  return 'scheduled';
};

// ¿Cuenta como clase por venir (para "Tu próxima clase")? Una sin fecha
// válida no: no hay día ni hora que mostrar, y nunca terminaría.
export const isPendingClass = (session, now = Date.now()) => {
  if (Number.isNaN(new Date(session.startsAt).getTime())) return false;
  const st = getClassCardState(session, now);
  return st !== 'ended' && st !== 'cancelled';
};

export const sessionEndsAt = (session) => new Date(new Date(session.startsAt).getTime() + durationOf(session) * 60000);

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// Días de calendario entre hoy y la clase (0 = hoy, 1 = mañana...).
export const daysUntil = (session, now = Date.now()) =>
  Math.round((startOfDay(new Date(session.startsAt)) - startOfDay(new Date(now))) / 86400000);

// Texto corto de cuánto falta o cuánto pasó: "Empieza en 8 min",
// "En 3 días", "Hace 2 h"... Lo usan la etiqueta de la tarjeta y las filas.
export const relativeClassLabel = (session, now = Date.now()) => {
  const state = getClassCardState(session, now);
  const start = new Date(session.startsAt).getTime();
  if (state === 'cancelled') return 'Cancelada';
  if (state === 'live') return 'En vivo ahora';
  if (state === 'ended') {
    const mins = Math.max(1, Math.round((now - sessionEndsAt(session).getTime()) / 60000));
    if (mins < 60) return `Terminada · hace ${mins} min`;
    if (mins < 60 * 24) return `Terminada · hace ${Math.round(mins / 60)} h`;
    const days = -daysUntil(session, now);
    return `Terminada · hace ${days} día${days === 1 ? '' : 's'}`;
  }
  const mins = Math.ceil((start - now) / 60000);
  const days = daysUntil(session, now);
  if (days === 0) return mins <= 60 ? `Hoy · empieza en ${mins} min` : `Hoy · ${new Date(start).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' })}`;
  if (days === 1) return 'Mañana';
  return `En ${days} días`;
};
