// Tests de src/lib/courseSessions.js (getOrderedSessions)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOrderedSessions } from '../src/lib/courseSessions.js';

describe('getOrderedSessions', () => {
  test('vacío / null / undefined -> []', () => {
    assert.deepEqual(getOrderedSessions([]), []);
    assert.deepEqual(getOrderedSessions(null), []);
    assert.deepEqual(getOrderedSessions(undefined), []);
  });
  test('módulos sin sessions o con sessions vacío / null se saltan', () => {
    assert.deepEqual(getOrderedSessions([{ id: 'a' }, { id: 'b', sessions: [] }, { id: 'c', sessions: null }]), []);
  });
  test('numeración continua entre módulos y etiqueta S01', () => {
    const r = getOrderedSessions([
      { id: 'm1', title: 'M1', sessions: [{ id: 's1', title: 'A', dateLabel: '10 mar' }, { id: 's2', title: 'B' }] },
      { id: 'm2', title: 'M2', sessions: [{ id: 's3', title: 'C' }] },
    ]);
    assert.deepEqual(r.map((s) => [s.number, s.label, s.moduleId, s.id]), [[1, 'S01', 'm1', 's1'], [2, 'S02', 'm1', 's2'], [3, 'S03', 'm2', 's3']]);
    assert.equal(r[0].moduleTitle, 'M1');
    assert.equal(r[0].dateLabel, '10 mar');
    assert.equal(r[1].dateLabel, '');
  });
  test('etiquetas de 3 dígitos no se truncan (S100)', () => {
    const sessions = Array.from({ length: 100 }, (_, i) => ({ id: `s${i}` }));
    const r = getOrderedSessions([{ id: 'm', sessions }]);
    assert.equal(r[8].label, 'S09');
    assert.equal(r[99].label, 'S100');
  });
  test('respeta el orden del arreglo (no reordena por fecha)', () => {
    const r = getOrderedSessions([{ id: 'm', sessions: [{ id: 'b', dateLabel: '20 mar' }, { id: 'a', dateLabel: '10 mar' }] }]);
    assert.deepEqual(r.map((s) => s.id), ['b', 'a']);
  });
  test('CARACTERIZACIÓN: ids de sesión duplicados NO se deduplican (dos filas con el mismo id)', () => {
    const r = getOrderedSessions([
      { id: 'm1', sessions: [{ id: 'dup' }] },
      { id: 'm2', sessions: [{ id: 'dup' }] },
    ]);
    assert.equal(r.length, 2);
    assert.equal(r[0].id, r[1].id);
  });
  test('CARACTERIZACIÓN: sesión sin id -> id undefined (colisiona con asistencias sin sessionId)', () => {
    const [s] = getOrderedSessions([{ id: 'm', sessions: [{ title: 'x' }] }]);
    assert.equal(s.id, undefined);
    const attendance = [{ uid: 'u', sessionId: undefined, present: true }];
    assert.ok(attendance.some((a) => a.sessionId === s.id), 'una fila de asistencia huérfana "coincide" con la sesión sin id');
  });
});
