// Tests de lo que hace independiente a cada aula: su lista de alumnos
// (roster.aulaRoster), sus sesiones dictadas (courseSessions.withAulaSessions)
// y las clases que ve cada alumno (groupAssignment.sessionsForStudent).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { aulaRoster, NO_AULA } from '../src/lib/roster.js';
import { getOrderedSessions, withAulaSessions } from '../src/lib/courseSessions.js';
import { attendanceStats } from '../src/lib/attendance.js';
import { sessionsForStudent } from '../src/lib/groupAssignment.js';

const E = (uid, groupId, extra = {}) => ({ uid, courseId: 1, studentName: uid, status: 'active', groupId, ...extra });
const GROUPS = [{ id: 'A', courseId: 1 }, { id: 'B', courseId: 1 }];
const ENROLLMENTS = [E('ana', 'A'), E('beto', 'A'), E('cami', 'B'), E('dani', null), E('eli', 'aula-borrada'), E('fer', 'A', { status: 'pending' }), E('gus', 'A', { courseId: 2 })];
const uids = (list) => list.map((r) => r.uid);

describe('aulaRoster', () => {
  test('cada aula tiene solo sus alumnos', () => {
    assert.deepEqual(uids(aulaRoster(ENROLLMENTS, 1, GROUPS, 'A')), ['ana', 'beto']);
    assert.deepEqual(uids(aulaRoster(ENROLLMENTS, 1, GROUPS, 'B')), ['cami']);
  });
  test('"Sin aula": sin groupId o con un aula que ya no existe', () => {
    assert.deepEqual(uids(aulaRoster(ENROLLMENTS, 1, GROUPS, NO_AULA)), ['dani', 'eli']);
  });
  test('sin aula elegida (curso sin aulas): todos los del curso', () => {
    assert.deepEqual(uids(aulaRoster(ENROLLMENTS, 1, [], null)), ['ana', 'beto', 'cami', 'dani', 'eli']);
  });
  test('matrículas pendientes y de otro curso nunca entran', () => {
    for (const aula of ['A', 'B', NO_AULA, null]) {
      const list = uids(aulaRoster(ENROLLMENTS, 1, GROUPS, aula));
      assert.equal(list.includes('fer'), false);
      assert.equal(list.includes('gus'), false);
    }
  });
  test('las aulas no se solapan y juntas cubren el curso', () => {
    const all = [...uids(aulaRoster(ENROLLMENTS, 1, GROUPS, 'A')), ...uids(aulaRoster(ENROLLMENTS, 1, GROUPS, 'B')), ...uids(aulaRoster(ENROLLMENTS, 1, GROUPS, NO_AULA))];
    assert.deepEqual([...all].sort(), uids(aulaRoster(ENROLLMENTS, 1, GROUPS, null)).sort());
    assert.equal(new Set(all).size, all.length);
  });
});

describe('withAulaSessions', () => {
  const modules = [{ id: 'm1', title: 'M1', sessions: [{ id: 's1', status: 'done' }, { id: 's2' }] }, { id: 'm2', title: 'M2', sessions: [{ id: 's3' }] }];
  const doneOf = (mods) => getOrderedSessions(mods).filter((s) => s.done).map((s) => s.id);

  test('sin avance propio, solo cuentan las Realizadas del contenido', () => {
    assert.deepEqual(doneOf(withAulaSessions(modules, [])), ['s1']);
    assert.deepEqual(doneOf(withAulaSessions(modules, undefined)), ['s1']);
  });
  test('cada aula suma sus propias sesiones dictadas', () => {
    assert.deepEqual(doneOf(withAulaSessions(modules, ['s2'])), ['s1', 's2']);
    assert.deepEqual(doneOf(withAulaSessions(modules, ['s3'])), ['s1', 's3']);
  });
  test('no modifica los módulos originales', () => {
    withAulaSessions(modules, ['s2', 's3']);
    assert.deepEqual(doneOf(modules), ['s1']);
  });
  test('una sesión dictada en el aula A no le cuenta falta a un alumno del aula B', () => {
    const noRecords = [];
    const inA = attendanceStats(getOrderedSessions(withAulaSessions(modules, ['s2'])), noRecords);
    const inB = attendanceStats(getOrderedSessions(withAulaSessions(modules, [])), noRecords);
    assert.equal(inA.taken, 2);
    assert.equal(inB.taken, 1);
  });
  test('tomar lista a un alumno deja la sesión dictada para toda el aula: el resto queda con falta', () => {
    const sessions = getOrderedSessions(withAulaSessions(modules, ['s3']));
    const sinRegistro = attendanceStats(sessions, []);
    assert.equal(sinRegistro.unregistered, 2);
    assert.equal(sinRegistro.pct, 0);
  });
});

describe('sessionsForStudent', () => {
  const sessions = [{ id: 1, courseId: 1, groupId: 'A' }, { id: 2, courseId: 1, groupId: 'B' }, { id: 3, courseId: 1 }, { id: 4, courseId: 2, groupId: 'C' }];
  const ids = (list) => list.map((s) => s.id);

  test('ve las clases de su aula y las sueltas del curso', () => {
    assert.deepEqual(ids(sessionsForStudent(sessions, { 1: { groupId: 'A' } })), [1, 3]);
    assert.deepEqual(ids(sessionsForStudent(sessions, { 1: { groupId: 'B' } })), [2, 3]);
  });
  test('sin aula asignada no ve el calendario de ninguna aula', () => {
    assert.deepEqual(ids(sessionsForStudent(sessions, { 1: { groupId: null } })), [3]);
  });
  test('con dos cursos, cada uno con su aula', () => {
    assert.deepEqual(ids(sessionsForStudent(sessions, { 1: { groupId: 'A' }, 2: { groupId: 'C' } })), [1, 3, 4]);
  });
  test('entradas vacías', () => {
    assert.deepEqual(sessionsForStudent(null, {}), []);
    assert.deepEqual(ids(sessionsForStudent(sessions, undefined)), [3]);
  });
});
