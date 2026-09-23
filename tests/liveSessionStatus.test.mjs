// Tests de src/lib/liveSessionStatus.js. Se congela Date con mock.timers.
// Las cadenas startsAt son "naive" (sin offset) y se interpretan en la zona
// horaria local del proceso; los tests usan siempre la MISMA zona para armar
// el instante y la cadena, así que son independientes de la TZ de la máquina.
import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getLiveSessionStatus, canJoinLiveSession, LIVE_JOIN_WINDOW_MIN } from '../src/lib/liveSessionStatus.js';

const STARTS = '2026-03-10T19:00';
const startMs = new Date(STARTS).getTime();
const MIN = 60000;
const at = (ms) => mock.timers.enable({ apis: ['Date'], now: ms });
afterEach(() => mock.timers.reset());

describe('getLiveSessionStatus', () => {
  const s = { startsAt: STARTS, durationMin: 120, status: 'upcoming' };

  test('cancelled manda aunque la hora ya pasó', () => {
    at(startMs + 999 * MIN);
    assert.equal(getLiveSessionStatus({ ...s, status: 'cancelled' }), 'cancelled');
  });
  test('antes del inicio -> upcoming', () => {
    at(startMs - 1);
    assert.equal(getLiveSessionStatus(s), 'upcoming');
  });
  test('exactamente en el inicio -> live', () => {
    at(startMs);
    assert.equal(getLiveSessionStatus(s), 'live');
  });
  test('exactamente en el fin (inclusivo) -> live; +1ms -> ended', () => {
    at(startMs + 120 * MIN);
    assert.equal(getLiveSessionStatus(s), 'live');
    mock.timers.reset(); at(startMs + 120 * MIN + 1);
    assert.equal(getLiveSessionStatus(s), 'ended');
  });
  test('durationMin ausente -> 60 min', () => {
    const noDur = { startsAt: STARTS };
    at(startMs + 60 * MIN);
    assert.equal(getLiveSessionStatus(noDur), 'live');
    mock.timers.reset(); at(startMs + 60 * MIN + 1);
    assert.equal(getLiveSessionStatus(noDur), 'ended');
  });
  test('durationMin como string "90"', () => {
    at(startMs + 90 * MIN);
    assert.equal(getLiveSessionStatus({ startsAt: STARTS, durationMin: '90' }), 'live');
  });
  test('durationMin 0 se trata como 60', () => {
    at(startMs + 30 * MIN);
    assert.equal(getLiveSessionStatus({ startsAt: STARTS, durationMin: 0 }), 'live');
  });
  test('durationMin negativo, 0, vacío, NaN o no numérico se trata como 60 min', () => {
    for (const d of [-1260, 0, -1, '', null, undefined, 'abc', NaN]) {
      mock.timers.reset(); at(startMs + 30 * MIN);
      assert.equal(getLiveSessionStatus({ startsAt: STARTS, durationMin: d }), 'live', `durationMin=${d}`);
      mock.timers.reset(); at(startMs + 60 * MIN + 1);
      assert.equal(getLiveSessionStatus({ startsAt: STARTS, durationMin: d }), 'ended', `durationMin=${d} (fin)`);
    }
  });
  test('canJoin también usa 60 min cuando la duración es <= 0', () => {
    at(startMs + 60 * MIN);
    assert.equal(canJoinLiveSession({ startsAt: STARTS, durationMin: -1260 }), true);
    mock.timers.reset(); at(startMs + 60 * MIN + 1);
    assert.equal(canJoinLiveSession({ startsAt: STARTS, durationMin: -1260 }), false);
  });
  test('un startsAt con offset -05:00 se evalúa como un instante fijo', () => {
    const iso = '2026-03-10T19:00-05:00';
    const ms = Date.parse('2026-03-11T00:00:00Z');
    at(ms - 1);
    assert.equal(getLiveSessionStatus({ startsAt: iso, durationMin: 120 }), 'upcoming');
    mock.timers.reset(); at(ms);
    assert.equal(getLiveSessionStatus({ startsAt: iso, durationMin: 120 }), 'live');
  });
  test('startsAt inválido devuelve el status guardado o upcoming', () => {
    at(startMs);
    assert.equal(getLiveSessionStatus({ startsAt: 'basura', status: 'ended' }), 'ended');
    assert.equal(getLiveSessionStatus({ startsAt: 'basura' }), 'upcoming');
    assert.equal(getLiveSessionStatus({}), 'upcoming'); // new Date(undefined) es NaN
  });
  test('startsAt null / vacío -> status guardado o "upcoming" (ya no "ended" por 1970)', () => {
    at(startMs);
    assert.equal(getLiveSessionStatus({ startsAt: null, status: 'upcoming' }), 'upcoming');
    assert.equal(getLiveSessionStatus({ startsAt: '' }), 'upcoming');
    assert.equal(getLiveSessionStatus({ startsAt: null }), 'upcoming');
  });
});

describe('canJoinLiveSession', () => {
  const s = { startsAt: STARTS, durationMin: 120 };

  test('ventana de 10 min antes: borde inclusivo', () => {
    assert.equal(LIVE_JOIN_WINDOW_MIN, 10);
    at(startMs - 10 * MIN - 1);
    assert.equal(canJoinLiveSession(s), false);
    mock.timers.reset(); at(startMs - 10 * MIN);
    assert.equal(canJoinLiveSession(s), true);
  });
  test('hasta el fin inclusive; después no', () => {
    at(startMs + 120 * MIN);
    assert.equal(canJoinLiveSession(s), true);
    mock.timers.reset(); at(startMs + 120 * MIN + 1);
    assert.equal(canJoinLiveSession(s), false);
  });
  test('startsAt inválido/ausente -> false', () => {
    at(startMs);
    assert.equal(canJoinLiveSession({ startsAt: 'x' }), false);
    assert.equal(canJoinLiveSession({}), false);
  });
  test('una clase cancelada no se puede abrir, ni dentro de su ventana', () => {
    at(startMs);
    assert.equal(canJoinLiveSession({ ...s, status: 'cancelled' }), false);
    assert.equal(canJoinLiveSession({ ...s, status: 'upcoming' }), true);
  });
  test('startsAt null / vacío -> false', () => {
    at(startMs);
    assert.equal(canJoinLiveSession({ startsAt: null }), false);
    assert.equal(canJoinLiveSession({ startsAt: '' }), false);
  });
});
