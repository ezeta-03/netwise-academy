// Tests de src/lib/attendance.js (attendanceStats), src/lib/roster.js (courseRoster)
// y approval.MIN_PERFORMANCE_GRADE. Todo se importa del código real.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { attendanceStats } from '../src/lib/attendance.js';
import { courseRoster } from '../src/lib/roster.js';
import { getOrderedSessions } from '../src/lib/courseSessions.js';
import { APPROVAL, MIN_PERFORMANCE_GRADE, evaluateApproval } from '../src/lib/approval.js';
import { buildGradebookRows, computeGradeSummary } from '../src/lib/gradebook.js';

const S = (id, done = false) => ({ id, done });
const R = (sessionId, present) => ({ sessionId, present });

describe('attendanceStats', () => {
  test('sin sesiones o sin registros: nada dictado -> raw/pct null y todo en 0', () => {
    for (const [sessions, records] of [[[], []], [undefined, undefined], [null, null], [[S('a'), S('b')], []], [[S('a')], undefined]]) {
      assert.deepEqual(attendanceStats(sessions, records), { taken: 0, present: 0, absent: 0, unregistered: 0, raw: null, pct: null });
    }
  });
  test('una sesión Realizada sin registro cuenta como falta y como "sin registrar"', () => {
    assert.deepEqual(attendanceStats([S('a', true)], []), { taken: 1, present: 0, absent: 1, unregistered: 1, raw: 0, pct: 0 });
  });
  test('un registro en una sesión no Realizada la vuelve dictada', () => {
    assert.deepEqual(attendanceStats([S('a'), S('b')], [R('a', true)]), { taken: 1, present: 1, absent: 0, unregistered: 0, raw: 100, pct: 100 });
  });
  test('una sesión no Realizada y sin registro NO cuenta', () => {
    const st = attendanceStats([S('a', true), S('b', false)], [R('a', true)]);
    assert.equal(st.taken, 1);
  });
  test('presente / ausente registrado explícitamente', () => {
    const st = attendanceStats([S('a', true), S('b', true), S('c', true)], [R('a', true), R('b', false)]);
    assert.deepEqual(st, { taken: 3, present: 1, absent: 2, unregistered: 1, raw: (1 / 3) * 100, pct: 33 });
  });
  test('exactamente 75%: raw 75 y pct 75', () => {
    const st = attendanceStats([S('a', true), S('b', true), S('c', true), S('d', true)], [R('a', true), R('b', true), R('c', true), R('d', false)]);
    assert.equal(st.raw, 75);
    assert.equal(st.pct, 75);
    assert.equal(st.absent, 1);
  });
  test('justo bajo el 75%: 38/51 -> raw 74.51 y pct redondeado 75', () => {
    const sessions = Array.from({ length: 51 }, (_, i) => S(`s${i}`, true));
    const records = sessions.map((s, i) => R(s.id, i < 38));
    const st = attendanceStats(sessions, records);
    assert.ok(st.raw < 75 && st.raw > 74.5);
    assert.equal(st.pct, 75);
  });
  test('3 de 4 con una sin registrar: 2 presentes de 4 -> 50% (la sin registrar es falta)', () => {
    const st = attendanceStats([S('a', true), S('b', true), S('c', true), S('d', true)], [R('a', true), R('b', true)]);
    assert.equal(st.pct, 50);
    assert.equal(st.unregistered, 2);
    assert.equal(st.absent, 2);
  });
  test('registros de sesiones inexistentes se ignoran', () => {
    const st = attendanceStats([S('a', true)], [R('a', true), R('borrada', false), R('otra', true)]);
    assert.deepEqual([st.taken, st.present, st.absent, st.pct], [1, 1, 0, 100]);
  });
  test('un elemento null dentro de records lanza TypeError (no se tolera)', () => {
    assert.throws(() => attendanceStats([S('a', true)], [null]), TypeError);
  });
  test('registros duplicados de la misma sesión: gana el último', () => {
    assert.equal(attendanceStats([S('a', true)], [R('a', true), R('a', false)]).present, 0);
    assert.equal(attendanceStats([S('a', true)], [R('a', false), R('a', true)]).present, 1);
  });
  test('present truthy/falsy no booleano: se evalúa por veracidad', () => {
    const st = attendanceStats([S('a', true), S('b', true)], [R('a', 1), R('b', 0)]);
    assert.equal(st.present, 1);
  });
  test('invariantes: taken = present + absent; unregistered <= absent; pct = round(raw)', () => {
    for (let n = 0; n <= 12; n++) {
      for (let mask = 0; mask < (1 << Math.min(n, 6)); mask++) {
        const sessions = Array.from({ length: n }, (_, i) => S(`s${i}`, i % 2 === 0));
        const records = sessions.filter((_, i) => i < 6 && (mask & (1 << i))).map((s, k) => R(s.id, k % 2 === 0));
        const st = attendanceStats(sessions, records);
        assert.equal(st.taken, st.present + st.absent);
        assert.ok(st.unregistered <= st.absent);
        assert.equal(st.pct, st.raw === null ? null : Math.round(st.raw));
      }
    }
  });
  test('recibe las sesiones de getOrderedSessions (campo done): módulo con status "done" y booleano legado', () => {
    const sessions = getOrderedSessions([{ id: 'm', sessions: [{ id: 'a', status: 'done' }, { id: 'b', done: true }, { id: 'c', status: 'scheduled' }] }]);
    const st = attendanceStats(sessions, [R('a', true)]);
    assert.deepEqual([st.taken, st.present, st.absent, st.unregistered], [2, 1, 1, 1]);
  });
  test('sesiones sin id y registros sin sessionId colisionan ("undefined" == "undefined")', { todo: 'BAJO lib/attendance.js:199-200 - Map.has(undefined): un registro huérfano sin sessionId "coincide" con cualquier sesión sin id' }, () => {
    const st = attendanceStats([{ id: undefined, done: false }], [{ sessionId: undefined, present: true }]);
    assert.equal(st.taken, 0);
  });
});

describe('courseRoster', () => {
  const E = (uid, courseId, status, studentName) => ({ uid, courseId, status, ...(studentName !== undefined ? { studentName } : {}) });

  test('sólo las matrículas del curso; courseId numérico o string se comparan por texto', () => {
    const r = courseRoster([E('a', 2, 'active', 'Ana'), E('b', '2', 'active', 'Beto'), E('c', 3, 'active', 'Cami')], 2);
    assert.deepEqual(r.map((x) => x.uid), ['a', 'b']);
    assert.deepEqual(courseRoster([E('a', 2, 'active')], '2').map((x) => x.uid), ['a']);
  });
  test('excluye los pendientes; incluye active, completed y sin status', () => {
    const r = courseRoster([E('a', 2, 'pending'), E('b', 2, 'active'), E('c', 2, 'completed'), E('d', 2, undefined)], 2);
    assert.deepEqual(r.map((x) => x.uid), ['b', 'c', 'd']);
  });
  test('deduplica por uid conservando la primera fila válida', () => {
    const r = courseRoster([E('a', 2, 'active', 'Ana 1'), E('a', 2, 'active', 'Ana 2'), E('b', 2, 'active', 'Beto')], 2);
    assert.deepEqual(r.map((x) => [x.uid, x.studentName]), [['a', 'Ana 1'], ['b', 'Beto']]);
  });
  test('una matrícula pendiente no bloquea a la activa del mismo uid (aunque vaya primero)', () => {
    const r = courseRoster([E('a', 2, 'pending', 'Ana p'), E('a', 2, 'active', 'Ana a')], 2);
    assert.deepEqual(r.map((x) => [x.uid, x.studentName, x.status]), [['a', 'Ana a', 'active']]);
  });
  test('un mismo uid en OTRO curso no cuenta como duplicado', () => {
    assert.deepEqual(courseRoster([E('a', 3, 'active'), E('a', 2, 'active')], 2).map((x) => x.uid), ['a']);
  });
  test('studentName cae al uid si falta o está vacío', () => {
    const r = courseRoster([E('a', 2, 'active'), E('b', 2, 'active', ''), E('c', 2, 'active', 'Cami')], 2);
    assert.deepEqual(r.map((x) => x.studentName), ['a', 'b', 'Cami']);
  });
  test('la forma de salida es { uid, studentName, status } sin más campos', () => {
    const r = courseRoster([{ uid: 'a', courseId: 2, status: 'active', studentName: 'Ana', email: 'a@x.com', id: 'e1' }], 2);
    assert.deepEqual(r, [{ uid: 'a', studentName: 'Ana', status: 'active' }]);
  });
  test('sin uid se descartan (no hay a quién calificar)', () => {
    assert.deepEqual(courseRoster([E(undefined, 2, 'active'), E('', 2, 'active'), E(null, 2, 'active')], 2), []);
  });
  test('enrollments null/undefined/[] -> []', () => {
    assert.deepEqual(courseRoster(undefined, 2), []);
    assert.deepEqual(courseRoster(null, 2), []);
    assert.deepEqual(courseRoster([], 2), []);
  });
  test('conserva el orden de las matrículas', () => {
    assert.deepEqual(courseRoster([E('z', 2, 'active'), E('a', 2, 'active'), E('m', 2, 'active')], 2).map((x) => x.uid), ['z', 'a', 'm']);
  });
  test('matrículas sin courseId no aparecen en ningún curso', () => {
    assert.deepEqual(courseRoster([E('a', undefined, 'active')], 2), []);
  });
  test('sin courseId (undefined) no debería devolver las matrículas sin courseId', { todo: 'BAJO lib/roster.js:219 - undefined?.toString() === undefined?.toString() es true: courseRoster(list, undefined) devuelve las matrículas sin courseId' }, () => {
    assert.deepEqual(courseRoster([E('a', undefined, 'active')], undefined), []);
  });
  test('un roster con 3 matrículas del mismo alumno y 1 pendiente da 1 fila (caso "manual del admin + propia")', () => {
    const r = courseRoster([E('a', 2, 'active', 'Ana'), E('a', 2, 'completed', 'Ana'), E('a', 2, 'pending', 'Ana'), E('b', 2, 'pending', 'Beto')], 2);
    assert.deepEqual(r.map((x) => x.uid), ['a']);
  });
});

describe('MIN_PERFORMANCE_GRADE', () => {
  test('es 16 (80% de 20) y sale de APPROVAL.minPerformancePct', () => {
    assert.equal(MIN_PERFORMANCE_GRADE, 16);
    assert.equal(MIN_PERFORMANCE_GRADE, (APPROVAL.minPerformancePct / 100) * 20);
  });
  test('un promedio >= MIN_PERFORMANCE_GRADE cumple el rendimiento; uno menor no (con notas reales)', () => {
    const summaryOf = (g) => computeGradeSummary(buildGradebookRows([{ id: 'a', deliverable: { description: 'x', weight: 100 } }], { a: { status: 'reviewed', grade: g } }));
    assert.equal(evaluateApproval(summaryOf(MIN_PERFORMANCE_GRADE), null).performance, 'ok');
    assert.equal(evaluateApproval(summaryOf(MIN_PERFORMANCE_GRADE - 0.01), null).performance, 'fail');
  });
  test('la nota mínima de rendimiento (80% de 20) coincide con la nota final mínima (16)', () => {
    assert.equal(MIN_PERFORMANCE_GRADE, APPROVAL.minFinalGrade);
  });
});
