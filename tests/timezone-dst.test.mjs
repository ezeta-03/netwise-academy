// Robustez de las fechas ante zona horaria / horario de verano. Cada zona corre
// tests/helpers/tz-probe.mjs en un proceso hijo con su propio process.env.TZ.
// El "oráculo" calcula las fechas esperadas con aritmética UTC (independiente de la TZ).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROBE = fileURLToPath(new URL('./helpers/tz-probe.mjs', import.meta.url));
const probe = (tz) => {
  const r = spawnSync(process.execPath, [PROBE, tz], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
};

const pad = (n) => String(n).padStart(2, '0');
const isoUtc = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
// lun(1)/mié(3) desde lunes 2026-01-05, semana w (0-based), por ventanas de 7 días.
const oracleDates = (weeks) => {
  const base = Date.UTC(2026, 0, 5);
  const days = [];
  for (let w = 0; w < weeks; w++) for (const off of [0, 2]) days.push(isoUtc(base + (off + 7 * w) * 86400000));
  return days;
};

const ZONES = [
  'America/Lima',            // sin DST (zona real del producto)
  'America/New_York',        // DST 2026-03-08 / 2026-11-01
  'Europe/London',           // DST 2026-03-29 / 2026-10-25
  'America/Santiago',        // DST 2026-09-06 (la medianoche no existe)
  'Pacific/Auckland',        // hemisferio sur
  'Pacific/Kiritimati',      // UTC+14
  'Pacific/Pago_Pago',       // UTC-11
];

describe('cruce de horario de verano', () => {
  for (const tz of ZONES) {
    test(`${tz}: 104 clases lun/mié 19:00 en las fechas correctas y siempre a las 19:00`, () => {
      const { sessions } = probe(tz);
      assert.deepEqual(sessions.map((s) => s.slice(0, 10)), oracleDates(52));
      assert.ok(sessions.every((s) => s.endsWith('T19:00')), 'alguna clase cambió de hora por el DST');
    });
    test(`${tz}: lastClassDate == miércoles de cada semana (52 semanas)`, () => {
      const { lastClass } = probe(tz);
      assert.deepEqual(lastClass, oracleDates(52).filter((_, i) => i % 2 === 1));
    });
  }
});

describe('casos límite de DST', () => {
  test('CARACTERIZACIÓN: clase a las 02:30 en el día del cambio (New York) se guarda como 03:30', () => {
    const { gapClass } = probe('America/New_York');
    assert.deepEqual(gapClass, ['2026-03-08T03:30']);
  });
  test('la hora programada (02:30) debería conservarse tal cual en el string', { todo: 'BUG menor liveScheduleGenerator.js:35-36 - setHours en día de salto DST reescribe la hora; usar el startHour/startMinute originales para armar el string' }, () => {
    const { gapClass } = probe('America/New_York');
    assert.deepEqual(gapClass, ['2026-03-08T02:30']);
  });
});

describe('startsAt es una cadena "naive" interpretada en la TZ de cada visitante', () => {
  test('en Lima (19:00 locales) la clase está "live"', () => {
    assert.equal(probe('America/Lima').statusAtLima1900, 'live');
  });
  test('CARACTERIZACIÓN: el mismo instante en Madrid ya la marca "ended" (la hora no está anclada a Lima)', () => {
    assert.equal(probe('Europe/Madrid').statusAtLima1900, 'ended');
  });
  test('la clase debería estar "live" para cualquier visitante en el mismo instante real', { todo: 'DISEÑO liveScheduleGenerator.js:36 / liveSessionStatus.js:9 - startsAt sin offset ("Hora de Perú" en AdminGrupos); alumnos/docentes fuera de UTC-5 ven horas y estados distintos. Guardar ISO con offset -05:00' }, () => {
    assert.equal(probe('Europe/Madrid').statusAtLima1900, 'live');
  });
});
