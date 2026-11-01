// Tests de src/lib/classList.js (lista única de clases y migración de asistencia).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildClassList, normalizeAttendance } from '../src/lib/classList.js';

const modules = [
  { id: 'm1', title: 'Módulo 1', sessions: [{ id: 'a' }, { id: 'b' }] },
  { id: 'm2', title: 'Módulo 2', sessions: [{ id: 'c' }] },
];
const live = [
  { id: 'L2', startsAt: '2026-10-21T19:00:00-05:00', durationMin: 120, groupId: 'g1' },
  { id: 'L1', startsAt: '2026-10-19T19:00:00-05:00', durationMin: 120, groupId: 'g1' },
  { id: 'L3', startsAt: '2026-10-23T19:00:00-05:00', durationMin: 120, groupId: 'g1' },
  { id: 'X', startsAt: '2026-10-20T19:00:00-05:00', durationMin: 120, groupId: 'g2' },
  { id: 'C', startsAt: '2026-10-22T19:00:00-05:00', durationMin: 120, groupId: 'g1', status: 'cancelled' },
];
const now = new Date('2026-10-22T12:00:00-05:00').getTime();

describe('buildClassList', () => {
  const list = buildClassList({ liveSessions: live, modules, groupId: 'g1', now });
  test('solo las clases del aula, sin canceladas, en orden', () => {
    assert.deepEqual(list.map((c) => c.id), ['L1', 'L2', 'L3']);
    assert.deepEqual(list.map((c) => c.label), ['S01', 'S02', 'S03']);
  });
  test('cada clase toma el módulo de la sesión N', () => {
    assert.deepEqual(list.map((c) => [c.legacyId, c.moduleId]), [['a', 'm1'], ['b', 'm1'], ['c', 'm2']]);
  });
  test('dictada = ya terminó', () => {
    assert.deepEqual(list.map((c) => c.done), [true, true, false]);
  });
  test('sin clases programadas usa las sesiones de los módulos', () => {
    const fallback = buildClassList({ liveSessions: [], modules, doneIds: ['a'], now });
    assert.deepEqual(fallback.map((c) => [c.id, c.done]), [['a', true], ['b', false], ['c', false]]);
  });
});

describe('normalizeAttendance', () => {
  const list = buildClassList({ liveSessions: live, modules, groupId: 'g1', now });
  test('un registro viejo pasa a su clase', () => {
    const out = normalizeAttendance([{ uid: 'u', sessionId: 'a', present: true }], list);
    assert.deepEqual(out, [{ uid: 'u', sessionId: 'L1', present: true, fromLegacy: 'a' }]);
  });
  test('si la clase ya tiene registro propio, el viejo se descarta', () => {
    const out = normalizeAttendance([{ uid: 'u', sessionId: 'a', present: true }, { uid: 'u', sessionId: 'L1', present: false }], list);
    assert.deepEqual(out, [{ uid: 'u', sessionId: 'L1', present: false }]);
  });
});
