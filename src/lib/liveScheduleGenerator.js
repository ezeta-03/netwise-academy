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

// A partir de la fecha de la primera clase, genera una entrada por cada día
// de la semana (scheduleDays) durante `weeksLabel` semanas (ej. "8 semanas"),
// respetando el horario (scheduleTime, "19:00-21:00"). Si los datos no son
// válidos devuelve [] en vez de fechas "NaN".
export const buildRecurringSessions = ({ scheduleDays, scheduleTime, weeksLabel }, firstDate) => {
  const weeks = parseInt(weeksLabel, 10) || 8;
  const time = parseScheduleTime(scheduleTime);
  const baseMs = parseDate(firstDate);
  const days = [...new Set((scheduleDays || []).map(normalizeDay).filter(Boolean))];
  if (!time || baseMs === null || days.length === 0) return [];

  const { startHour, startMinute, durationMin } = time;
  const { first, offsets } = firstClassOffsets(baseMs, days);
  const anchorMs = baseMs + first * DAY_MS;
  offsets.sort((a, b) => a.offset - b.offset);

  const entries = [];
  for (let week = 0; week < weeks; week++) {
    for (const { day, offset } of offsets) {
      const startsAt = `${fmtDate(anchorMs + (offset + week * 7) * DAY_MS)}T${pad2(startHour)}:${pad2(startMinute)}${PERU_OFFSET}`;
      entries.push({ startsAt, durationMin, title: `Semana ${week + 1} · ${day}` });
    }
  }
  return entries;
};

// "Martes y Jueves · 19:00-21:00" (formato que guarda el aula) -> días
// (["Martes","Jueves"]) para poder calcular fechas a partir del horario.
// También entiende rangos: "Lunes a Viernes".
export const parseScheduleLabel = (label) => {
  const daysPart = String(label || '').split('·')[0].trim();
  const range = daysPart.match(/^(\S+)\s+a\s+(\S+)$/i);
  if (range) {
    const from = normalizeDay(range[1]);
    const to = normalizeDay(range[2]);
    if (from && to) {
      const out = [];
      for (let i = DAY_INDEX[from]; ; i = (i + 1) % 7) {
        out.push(Object.keys(DAY_INDEX).find((d) => DAY_INDEX[d] === i));
        if (i === DAY_INDEX[to]) break;
      }
      return out;
    }
  }
  return daysPart.split(/\s+y\s+|,|\/|&/i).map(normalizeDay).filter(Boolean);
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
