// Genera el calendario recurrente de clases en vivo a partir de un horario
// (días + hora) y la fecha de la primera clase -- usado por Admin al crear
// un aula (ver AdminGrupos.jsx), que es quien ahora arma el calendario
// completo para que el docente entre con todo listo. Antes vivía solo en
// TeacherCourseSala.jsx; el docente conserva "Programar clase suelta" para
// una clase extra (recuperación, Q&A) sin necesitar volver a Admin.

const DAY_INDEX = { Domingo: 0, Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6 };

const parseScheduleTime = (scheduleTime) => {
  const [from, to] = scheduleTime.split('-');
  const toMinutesOfDay = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const startMin = toMinutesOfDay(from);
  return { startHour: Math.floor(startMin / 60), startMinute: startMin % 60, durationMin: toMinutesOfDay(to) - startMin };
};

const pad2 = (n) => String(n).padStart(2, '0');

// A partir de la fecha de la primera clase, genera una entrada por cada día
// de la semana (scheduleDays) durante `weeksLabel` semanas (ej. "8 semanas"),
// respetando el horario (scheduleTime, "19:00-21:00").
export const buildRecurringSessions = ({ scheduleDays, scheduleTime, weeksLabel }, firstDate) => {
  const weeks = parseInt(weeksLabel, 10) || 8;
  const { startHour, startMinute, durationMin } = parseScheduleTime(scheduleTime);
  const base = new Date(`${firstDate}T00:00:00`);
  const baseDow = base.getDay();
  const sortedDays = [...scheduleDays].sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b]);

  const entries = [];
  for (let week = 0; week < weeks; week++) {
    for (const dayName of sortedDays) {
      const offset = (DAY_INDEX[dayName] - baseDow + 7) % 7;
      const date = new Date(base);
      date.setDate(date.getDate() + offset + week * 7);
      date.setHours(startHour, startMinute, 0, 0);
      const startsAt = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
      entries.push({ startsAt, durationMin, title: `Semana ${week + 1} · ${dayName}` });
    }
  }
  return entries;
};

// "Martes y Jueves · 19:00-21:00" (formato que guarda el aula) -> días
// (["Martes","Jueves"]) para poder calcular fechas a partir del horario.
export const parseScheduleLabel = (label) => {
  const daysPart = (label || '').split('·')[0];
  return daysPart.split(/\s+y\s+|,/).map((d) => d.trim()).filter((d) => d in DAY_INDEX);
};

// Fecha (YYYY-MM-DD) de la última clase de la semana `week` (1 = la semana
// de `startDate`) según los días del horario -- es la fecha de entrega
// calculada del entregable de un módulo (ver TeacherCourseCronograma).
export const lastClassDate = (startDate, dayNames, week) => {
  if (!startDate || !dayNames?.length) return null;
  const base = new Date(`${startDate}T00:00:00`);
  const baseDow = base.getDay();
  const maxOffset = Math.max(...dayNames.map((d) => (DAY_INDEX[d] - baseDow + 7) % 7));
  base.setDate(base.getDate() + (week - 1) * 7 + maxOffset);
  return `${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(base.getDate())}`;
};
