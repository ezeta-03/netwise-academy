// Genera el calendario recurrente de clases en vivo a partir de un horario
// (días + hora) y la fecha de la primera clase -- usado por Admin al crear
// un aula (ver AdminGrupos.jsx), que es quien ahora arma el calendario
// completo para que el docente entre con todo listo. Antes vivía solo en
// TeacherCourseSala.jsx; el docente conserva "Programar clase suelta" para
// una clase extra (recuperación, Q&A) sin necesitar volver a Admin.

const DAY_INDEX = { Domingo: 0, Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6 };

// "Martes", "martes", "MARTES", "Miercoles", "Sábados" -> "Martes"/"Miércoles"/
// "Sábado": sin esto un horario escrito a mano ("Martes y jueves") perdía
// los días en minúscula y dejaba el calendario / las fechas de entrega vacíos.
const cleanDay = (text) => String(text || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().trim().replace(/s$/, '');

const normalizeDay = (raw) => {
  const key = cleanDay(raw);
  return Object.keys(DAY_INDEX).find((d) => cleanDay(d) === key) || null;
};

// "19:00-21:00" (también con guion largo o "a") -> hora de inicio y duración.
// Devuelve null si el formato no es válido. Un horario que cruza la medianoche
// ("22:00-01:00") dura 3 h, no un valor negativo.
const parseScheduleTime = (scheduleTime) => {
  const m = String(scheduleTime || '').match(/(\d{1,2}):(\d{2})\s*(?:-|–|—|a)\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [sh, sm, eh, em] = m.slice(1).map(Number);
  if (sh > 23 || eh > 23 || sm > 59 || em > 59) return null;
  const startMin = sh * 60 + sm;
  const durationMin = (eh * 60 + em - startMin + 1440) % 1440;
  if (durationMin === 0) return null;
  return { startHour: sh, startMinute: sm, durationMin };
};

const pad2 = (n) => String(n).padStart(2, '0');

// Las clases se programan en hora de Perú (UTC-5, sin horario de verano): se
// guarda el offset en `startsAt` para que docente y alumnos vean el MISMO
// instante estén donde estén, y para que el cálculo no dependa del horario
// de verano de quien crea el aula (todo el cálculo de fechas va en UTC).
export const PERU_OFFSET = '-05:00';

// "2026-08-11T19:00" (hora de Perú, como sale de un input datetime-local) ->
// "2026-08-11T19:00-05:00". Si ya trae offset o "Z", se deja igual.
export const toPeruIso = (localIso) => {
  if (!localIso || /(?:Z|[+-]\d{2}:\d{2})$/.test(localIso)) return localIso;
  // Solo una fecha (sin hora) no es un instante: se completa a medianoche.
  return `${/T/.test(localIso) ? localIso : `${localIso}T00:00`}${PERU_OFFSET}`;
};

const parseDate = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  // Rechaza fechas imposibles (2026-02-31, 2026-13-45): JS las "corrige" solo.
  const check = new Date(ms);
  return check.getUTCFullYear() === y && check.getUTCMonth() === mo - 1 && check.getUTCDate() === d ? ms : null;
};
const DAY_MS = 86400000;
const fmtDate = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};

// La "semana 1" arranca en la primera clase REAL: si el aula empieza un
// miércoles y dicta martes/jueves, la primera clase es el jueves y las
// semanas van de jueves a miércoles (2 clases por semana, sin mezclar).
const firstClassOffsets = (baseMs, days) => {
  const baseDow = new Date(baseMs).getUTCDay();
  const rel = days.map((d) => (DAY_INDEX[d] - baseDow + 7) % 7);
  const first = Math.min(...rel);
  const anchorDow = (baseDow + first) % 7;
  return { first, offsets: days.map((d) => ({ day: d, offset: (DAY_INDEX[d] - anchorDow + 7) % 7 })) };
};

// Una franja del horario semanal de un aula: un día con su hora de inicio y
// fin. Un aula puede tener las franjas que se quiera (un día distinto con su
// propia hora, dos franjas el mismo día, etc.) -- ver el editor de horario en
// Admin > Grupos y horarios. { day: 'Martes', start: '19:00', end: '21:00' }
const resolveSlots = ({ slots, scheduleDays, scheduleTime }) => {
  const seen = new Set();
  const out = [];
  const push = (day, time) => {
    if (!day || !time) return;
    const key = `${day}|${time.startHour}:${time.startMinute}|${time.durationMin}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ day, ...time });
  };
  if (Array.isArray(slots) && slots.length) {
    slots.forEach((s) => push(normalizeDay(s?.day), parseScheduleTime(`${s?.start}-${s?.end}`)));
  } else {
    const time = parseScheduleTime(scheduleTime);
    (Array.isArray(scheduleDays) ? scheduleDays : []).forEach((d) => push(normalizeDay(d), time));
  }
  return out;
};

// Valida las franjas que arma el editor: devuelve las válidas (día + hora de
// inicio/fin correctas) ya normalizadas como { day, start, end }.
export const validSlots = (slots) => resolveSlots({ slots }).map((s) => ({
  day: s.day,
  start: `${pad2(s.startHour)}:${pad2(s.startMinute)}`,
  end: (() => { const t = (s.startHour * 60 + s.startMinute + s.durationMin) % 1440; return `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`; })(),
}));

// Texto del horario que se guarda en el aula (`scheduleTime`) y se muestra en
// tablas: "Martes y Jueves · 19:00-21:00" si todas las franjas comparten hora,
// o "Lunes 19:00-21:00 · Miércoles 18:00-20:00" si cada día tiene la suya.
export const buildScheduleLabel = (slots) => {
  const list = validSlots(slots).sort((a, b) => DAY_INDEX[a.day] - DAY_INDEX[b.day] || a.start.localeCompare(b.start));
  if (list.length === 0) return '';
  const ranges = new Set(list.map((s) => `${s.start}-${s.end}`));
  if (ranges.size === 1) {
    const days = [...new Set(list.map((s) => s.day))];
    const joined = days.length > 1 ? `${days.slice(0, -1).join(', ')} y ${days[days.length - 1]}` : days[0];
    return `${joined} · ${[...ranges][0]}`;
  }
  return list.map((s) => `${s.day} ${s.start}-${s.end}`).join(' · ');
};

// A partir de la fecha de la primera clase, genera una entrada por cada franja
// del horario semanal durante `weeksLabel` semanas (ej. "8 semanas").
// Acepta `slots` (franjas con su propia hora) o el formato anterior
// (scheduleDays + un único scheduleTime). Si los datos no son válidos
// devuelve [] en vez de fechas "NaN".
export const buildRecurringSessions = ({ slots, scheduleDays, scheduleTime, weeksLabel }, firstDate) => {
  const weeks = parseInt(weeksLabel, 10) || 8;
  const baseMs = parseDate(firstDate);
  const resolved = resolveSlots({ slots, scheduleDays, scheduleTime });
  if (baseMs === null || resolved.length === 0) return [];

  const { first, offsets } = firstClassOffsets(baseMs, [...new Set(resolved.map((s) => s.day))]);
  const anchorMs = baseMs + first * DAY_MS;
  const offsetOf = Object.fromEntries(offsets.map((o) => [o.day, o.offset]));
  const ordered = [...resolved].sort((a, b) => offsetOf[a.day] - offsetOf[b.day] || (a.startHour * 60 + a.startMinute) - (b.startHour * 60 + b.startMinute));

  const entries = [];
  for (let week = 0; week < weeks; week++) {
    for (const slot of ordered) {
      const startsAt = `${fmtDate(anchorMs + (offsetOf[slot.day] + week * 7) * DAY_MS)}T${pad2(slot.startHour)}:${pad2(slot.startMinute)}${PERU_OFFSET}`;
      entries.push({ startsAt, durationMin: slot.durationMin, title: `Semana ${week + 1} · ${slot.day}` });
    }
  }
  return entries;
};

const DAY_WORDS = /(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)/gi;

// Horario en texto -> días. Entiende "Martes y Jueves · 19:00-21:00", el
// formato por día "Lunes 19:00-21:00 · Miércoles 18:00-20:00" y rangos como
// "Lunes a Viernes". Se usa para aulas antiguas que solo guardaron el texto.
export const parseScheduleLabel = (label) => {
  // NFC: un teclado que escribe "é" como "e" + tilde combinada también vale.
  const text = String(label || '').normalize('NFC');
  const found = [];
  let rest = text;
  const range = text.match(/^\s*(\S+)\s+a\s+(\S+)/i);
  if (range) {
    const from = normalizeDay(range[1]);
    const to = normalizeDay(range[2]);
    if (from && to) {
      for (let i = DAY_INDEX[from]; ; i = (i + 1) % 7) {
        found.push(Object.keys(DAY_INDEX).find((d) => DAY_INDEX[d] === i));
        if (i === DAY_INDEX[to]) break;
      }
      rest = text.slice(range[0].length); // "Lunes a Miércoles y Viernes": suma Viernes
    }
  }
  return [...new Set([...found, ...(rest.match(DAY_WORDS) || []).map(normalizeDay).filter(Boolean)])];
};

// Días de clase de un aula: las franjas estructuradas si existen (`schedule`)
// o, en aulas antiguas (o si las franjas no son válidas), lo que diga el
// texto del horario.
export const groupScheduleDays = (group) => {
  if (Array.isArray(group?.schedule) && group.schedule.length) {
    const days = [...new Set(validSlots(group.schedule).map((s) => s.day))];
    if (days.length) return days;
  }
  return parseScheduleLabel(group?.scheduleTime || group?.scheduleDays);
};

// Fecha (YYYY-MM-DD) de la última clase de la semana `week` (1 = la semana de
// la primera clase real) según los días del horario -- es la fecha de entrega
// calculada del entregable de un módulo (ver TeacherCourseCronograma).
export const lastClassDate = (startDate, dayNames, week) => {
  const days = (dayNames || []).map(normalizeDay).filter(Boolean);
  const baseMs = parseDate(startDate);
  if (baseMs === null || days.length === 0) return null;
  const { first, offsets } = firstClassOffsets(baseMs, days);
  const maxOffset = Math.max(...offsets.map((o) => o.offset));
  return fmtDate(baseMs + (first + maxOffset + (week - 1) * 7) * DAY_MS);
};
