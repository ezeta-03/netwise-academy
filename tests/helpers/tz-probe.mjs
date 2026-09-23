// Se ejecuta en un proceso hijo: fija process.env.TZ (en runtime, antes de usar
// Date; en Windows/Git Bash `TZ=... node` NO se propaga, pero la asignación en
// runtime sí funciona) y vuelca a stdout el resultado de las funciones de fechas.
// Uso: node tests/helpers/tz-probe.mjs <IANA-zone>
process.env.TZ = process.argv[2];

const { buildRecurringSessions, lastClassDate } = await import('../../src/lib/liveScheduleGenerator.js');
const { getLiveSessionStatus } = await import('../../src/lib/liveSessionStatus.js');

const out = { tz: process.env.TZ };

// 52 semanas lun/mié 19:00 desde 2026-01-05: cruza los cambios de horario de verano de casi todo el mundo.
out.sessions = buildRecurringSessions(
  { scheduleDays: ['Lunes', 'Miércoles'], scheduleTime: '19:00-21:00', weeksLabel: '52 semanas' }, '2026-01-05',
).map((s) => s.startsAt);
out.lastClass = Array.from({ length: 52 }, (_, i) => lastClassDate('2026-01-05', ['Lunes', 'Miércoles'], i + 1));

// Clase a las 02:30 el domingo 2026-03-08 (hora inexistente en EE. UU. por el cambio a horario de verano).
out.gapClass = buildRecurringSessions(
  { scheduleDays: ['Domingo'], scheduleTime: '02:30-04:00', weeksLabel: '1' }, '2026-03-08',
).map((s) => s.startsAt);

// Misma cadena naive "2026-03-10T19:00" (120 min) evaluada en el instante 2026-03-11T00:00:00Z (= 19:00 en Lima).
const RealNow = Date.now;
Date.now = () => Date.UTC(2026, 2, 11, 0, 0, 0);
out.statusAtLima1900 = getLiveSessionStatus({ startsAt: '2026-03-10T19:00', durationMin: 120 });
Date.now = RealNow;

console.log(JSON.stringify(out));
