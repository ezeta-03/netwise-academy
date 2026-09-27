// Tests de src/lib/groupAssignment.js (asignación de alumnos a un aula) y del
// flag de entregables sin nota de src/lib/weights.js.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pickGroup, eligibleGroups, unassignedEnrollments, distributeEnrollments, countByGroup } from '../src/lib/groupAssignment.js';
import { deliverableModules, allDeliverableModules, resolveWeights } from '../src/lib/weights.js';

const TODAY = '2026-09-27';
const g = (id, extra = {}) => ({ id, courseId: 1, status: 'open', capacity: 2, startDate: '2026-10-05', ...extra });
const e = (id, extra = {}) => ({ id, uid: `u-${id}`, courseId: 1, status: 'active', ...extra });

describe('groupAssignment.js', () => {
  test('prefiere el aula próxima de inicio más cercano, no una ya en curso', () => {
    const groups = [g('curso', { startDate: '2026-09-01' }), g('nov', { startDate: '2026-11-02' }), g('oct', { startDate: '2026-10-05' })];
    assert.deepEqual(eligibleGroups(groups, 1, TODAY).map((x) => x.id), ['oct', 'nov', 'curso']);
    assert.equal(pickGroup(groups, [], 1, TODAY).id, 'oct');
  });

  test('ignora aulas cerradas, terminadas y de otro curso', () => {
    const groups = [g('cerrada', { status: 'closed' }), g('fin', { startDate: '2026-06-01', endDate: '2026-08-01' }), g('otro', { courseId: 2 })];
    assert.equal(pickGroup(groups, [], 1, TODAY), null);
  });

  test('salta el aula llena y usa la siguiente', () => {
    const groups = [g('a'), g('b', { startDate: '2026-11-01' })];
    const enrollments = [e('1', { groupId: 'a' }), e('2', { groupId: 'a' })];
    assert.equal(pickGroup(groups, enrollments, 1, TODAY).id, 'b');
  });

  test('con aulas en paralelo reparte hacia la que tiene más cupos', () => {
    const groups = [g('a', { capacity: 3 }), g('b', { capacity: 3 })];
    assert.equal(pickGroup(groups, [e('1', { groupId: 'a' })], 1, TODAY).id, 'b');
  });

  test('las matrículas pendientes no ocupan cupo', () => {
    assert.deepEqual(countByGroup([e('1', { groupId: 'a', status: 'pending' }), e('2', { groupId: 'a' })]), { a: 1 });
  });

  test('sin aula: activas sin groupId o con un aula que ya no existe', () => {
    const groups = [g('a')];
    const list = [e('1'), e('2', { groupId: 'a' }), e('3', { groupId: 'borrada' }), e('4', { status: 'pending' })];
    assert.deepEqual(unassignedEnrollments(list, groups).map((x) => x.id), ['1', '3']);
  });

  test('el reparto automático respeta cupos y alterna entre aulas en paralelo', () => {
    const groups = [g('a'), g('b')];
    const toAssign = [e('1'), e('2'), e('3'), e('4'), e('5')];
    const plan = distributeEnrollments(toAssign, groups, toAssign, TODAY);
    assert.equal(plan.length, 4);
    const perGroup = plan.reduce((acc, p) => ({ ...acc, [p.group.id]: (acc[p.group.id] || 0) + 1 }), {});
    assert.deepEqual(perGroup, { a: 2, b: 2 });
  });
});

describe('entregables sin nota', () => {
  const m = (id, graded) => ({ id, deliverable: { description: 'x', ...(graded === undefined ? {} : { graded }) } });

  test('un entregable con graded=false no cuenta para notas ni pesos, pero sí se lista', () => {
    const modules = [m('a'), m('b', false), m('c', true)];
    assert.deepEqual(deliverableModules(modules).map((x) => x.id), ['a', 'c']);
    assert.deepEqual(allDeliverableModules(modules).map((x) => x.id), ['a', 'b', 'c']);
    assert.deepEqual(resolveWeights(modules).rows.map((r) => r.weight), [50, 50]);
  });
});
