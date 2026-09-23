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

// A partir de la fecha de la primera clase, genera una entrada por cada día
// de la semana (scheduleDays) durante `weeksLabel` semanas (ej. "8 semanas"),
// respetando el horario (scheduleTime, "19:00-21:00"). Si los datos no son
// válidos devuelve [] en vez de fechas "NaN".
export const buildRecurringSessions = ({ scheduleDays, scheduleTime, weeksLabel }, firstDate) => {
  const weeks = parseInt(weeksLabel, 10) || 8;
  const time = parseScheduleTime(scheduleTime);
  const base = new Date(`${firstDate}T00:00:00`);
  const days = [...new Set((scheduleDays || []).map(normalizeDay).filter(Boolean))];
  if (!time || Number.isNaN(base.getTime()) || days.length === 0) return [];

  const { startHour, startMinute, durationMin } = time;
  const baseDow = base.getDay();
  const sortedDays = days.sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b]);

  const entries = [];
  for (let week = 0; week < weeks; week++) {
    for (const dayName of sortedDays) {
      const offset = (DAY_INDEX[dayName] - baseDow + 7) % 7;
      const date = new Date(base);
      date.setDate(date.getDate() + offset + week * 7);
      date.setHours(startHour, startMinute, 0, 0);
      const iso = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
      entries.push({ startsAt: iso, durationMin, title: `Semana ${week + 1} · ${dayName}` });
    }
  }
  // Si la fecha de inicio cae a mitad de semana, los días "anteriores" de la
  // primera vuelta quedan después en el calendario: se ordena por fecha.
  return entries.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
};

// "Martes y Jueves · 19:00-21:00" (formato que guarda el aula) -> días
// (["Martes","Jueves"]) para poder calcular fechas a partir del horario.
export const parseScheduleLabel = (label) => {
  const daysPart = String(label || '').split('·')[0];
  return daysPart.split(/\s+y\s+|,|\/|&/i).map(normalizeDay).filter(Boolean);
};

// Fecha (YYYY-MM-DD) de la última clase de la semana `week` (1 = la semana
// de `startDate`) según los días del horario -- es la fecha de entrega
// calculada del entregable de un módulo (ver TeacherCourseCronograma).
export const lastClassDate = (startDate, dayNames, week) => {
  const days = (dayNames || []).map(normalizeDay).filter(Boolean);
  if (!startDate || days.length === 0) return null;
  const base = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  const baseDow = base.getDay();
  const maxOffset = Math.max(...days.map((d) => (DAY_INDEX[d] - baseDow + 7) % 7));
  base.setDate(base.getDate() + (week - 1) * 7 + maxOffset);
  return `${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(base.getDate())}`;
};
