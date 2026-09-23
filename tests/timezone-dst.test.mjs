// Independencia de zona horaria / horario de verano. Cada zona corre
// tests/helpers/tz-probe.mjs en un proceso hijo con su propio process.env.TZ.
// El "oráculo" calcula las fechas esperadas con aritmética UTC (independiente de la TZ).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROBE = fileURLToPath(new URL('./helpers/tz-probe.mjs', import.meta.url));
const cache = new Map();
const probe = (tz) => {
  if (!cache.has(tz)) {
    const r = spawnSync(process.execPath, [PROBE, tz], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    cache.set(tz, JSON.parse(r.stdout));
  }
  return cache.get(tz);
};

const pad = (n) => String(n).padStart(2, '0');
const isoUtc = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
// lun(1)/mié(3) desde lunes 2026-01-05, semana w (0-based), ventanas de 7 días.
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
  'Europe/Madrid',
  'America/Santiago',        // DST 2026-09-06 (la medianoche no existe)
  'Pacific/Auckland',        // hemisferio sur
  'Pacific/Kiritimati',      // UTC+14
  'Pacific/Pago_Pago',       // UTC-11
];

describe('las fechas generadas no dependen de la zona ni del horario de verano', () => {
  for (const tz of ZONES) {
    test(`${tz}: 104 clases lun/mié en las fechas correctas, siempre T19:00-05:00`, () => {
      const { sessions } = probe(tz);
      assert.deepEqual(sessions.map((s) => s.slice(0, 10)), oracleDates(52));
      assert.ok(sessions.every((s) => s.endsWith('T19:00-05:00')), 'alguna clase cambió de hora u offset');
    });
    test(`${tz}: lastClassDate == miércoles de cada semana (52 semanas)`, () => {
      assert.deepEqual(probe(tz).lastClass, oracleDates(52).filter((_, i) => i % 2 === 1));
    });
    test(`${tz}: resultado idéntico byte a byte al de Lima`, () => {
      const a = probe(tz); const b = probe('America/Lima');
      assert.deepEqual(a.sessions, b.sessions);
      assert.deepEqual(a.lastClass, b.lastClass);
      assert.deepEqual(a.gapClass, b.gapClass);
    });
  }
});

describe('casos límite de DST', () => {
  for (const tz of ZONES) {
    test(`${tz}: clase a las 02:30 el 2026-03-08 (hora inexistente en Nueva York) conserva 02:30`, () => {
      assert.deepEqual(probe(tz).gapClass, ['2026-03-08T02:30-05:00']);
    });
  }
});

describe('startsAt con offset es un instante fijo para cualquier visitante', () => {
  for (const tz of ZONES) {
    test(`${tz}: a las 19:00 de Lima la clase está "live"`, () => {
      assert.equal(probe(tz).statusOffset, 'live');
    });
  }
  test('datos legados SIN offset siguen dependiendo de la zona del visitante (Lima "live", Madrid "ended")', () => {
    assert.equal(probe('America/Lima').statusNaive, 'live');
    assert.equal(probe('Europe/Madrid').statusNaive, 'ended');
  });
  test('getLiveSessionStatus debería tratar los startsAt legados sin offset como hora de Perú', { todo: 'BAJO liveSessionStatus.js:14 - las clases ya guardadas sin "-05:00" se ven distinto según la zona; aplicar toPeruIso al leer o migrar los datos' }, () => {
    assert.equal(probe('Europe/Madrid').statusNaive, 'live');
  });
});
