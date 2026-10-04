// Tests de src/lib/demoData.js: el plan de datos de ejemplo de Configuración.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoPlan, demoPeople, DEMO_COLLECTIONS } from '../src/lib/demoData.js';

const slots = [{ day: 'Lunes', start: '19:00', end: '21:00' }, { day: 'Miércoles', start: '19:00', end: '21:00' }];
const COURSES = [
  { id: 1, title: 'Redes Sociales & IA', price: 300, scheduleSlots: slots, teacherUid: 't1' },
  { id: 2, title: 'Branding & Marca', price: 360, scheduleSlots: slots, teacherUid: null },
  { id: 3, title: 'Marketing Digital', price: 450, scheduleSlots: slots, teacherUid: 't2' },
  { id: 4, title: 'Emprendimiento Digital', price: null, scheduleSlots: slots, teacherUid: null },
];
const modules = [1, 2].map((n) => ({
  id: `m${n}`, title: `Módulo ${n}`, sessions: [1, 2].map((s) => ({ id: `s${n}${s}`, title: `Sesión ${n}.${s}` })),
  deliverable: { description: `Entregable ${n}` },
}));
const NOW = Date.UTC(2026, 9, 5, 15);
const plan = (size, extra = {}) => buildDemoPlan({ courses: COURSES, contentByCourse: { 1: modules }, teacherNames: { t1: 'Lucía', t2: 'Marco' }, size, now: NOW, ...extra });

describe('demoPeople', () => {
  test('los primeros son los del Figma y nadie se repite', () => {
    const people = demoPeople(300);
    assert.equal(people[0].name, 'Lucía Ramírez');
    assert.equal(people[0].email, 'lucia.ramirez@ejemplo.com');
    assert.equal(new Set(people.map((p) => p.uid)).size, 300);
    assert.ok(people.every((p) => p.uid.startsWith('demo-') && p.email.endsWith('@ejemplo.com')));
  });
});

describe('buildDemoPlan', () => {
  test('todo documento va marcado como ejemplo y solo en colecciones que se saben borrar', () => {
    const { docs } = plan(100);
    for (const [name, list] of Object.entries(docs)) {
      assert.ok(DEMO_COLLECTIONS.includes(name), `${name} no está en DEMO_COLLECTIONS`);
      assert.ok(list.every((d) => d.data.demo === true), `${name} tiene documentos sin marca`);
    }
  });
  test('los ids no se repiten dentro de una colección', () => {
    const { docs } = plan(300);
    for (const list of Object.values(docs)) assert.equal(new Set(list.map((d) => d.id)).size, list.length);
  });
  test('un curso sin precio no recibe matrículas', () => {
    const { docs } = plan(100);
    assert.equal(docs.enrollments.some((e) => e.data.courseId === 4), false);
  });
  test('cada matrícula tiene id uid_curso y su pedido pagado por el precio del curso', () => {
    const { docs } = plan(100);
    for (const e of docs.enrollments) {
      assert.equal(e.id, `${e.data.uid}_${e.data.courseId}`);
      const order = docs.orders.find((o) => o.data.status === 'paid' && o.data.uid === e.data.uid && o.data.courseId === e.data.courseId);
      assert.ok(order, `sin pedido: ${e.id}`);
      assert.equal(order.data.amount, COURSES.find((c) => c.id === e.data.courseId).price);
    }
  });
  test('ninguna aula supera su cupo y queda gente sin aula, como en el diseño', () => {
    const { docs, summary } = plan(300);
    for (const g of docs.groups) {
      const n = docs.enrollments.filter((e) => e.data.groupId === g.id).length;
      assert.ok(n <= g.data.capacity, `${g.data.name}: ${n}/${g.data.capacity}`);
      assert.ok(n > 0);
    }
    assert.ok(summary.unassigned > 0);
    assert.equal(summary.unassigned, docs.enrollments.filter((e) => !e.data.groupId).length);
  });
  test('el aula de un alumno es de su mismo curso', () => {
    const { docs } = plan(300);
    const courseOf = new Map(docs.groups.map((g) => [g.id, g.data.courseId]));
    for (const e of docs.enrollments.filter((x) => x.data.groupId)) assert.equal(courseOf.get(e.data.groupId), e.data.courseId);
  });
  test('solo los cursos con docente tienen calendario de clases, a nombre de ese docente', () => {
    const { docs } = plan(100);
    assert.ok(docs.liveSessions.length > 0);
    assert.equal(docs.liveSessions.some((s) => s.data.courseId === 2), false);
    assert.ok(docs.liveSessions.filter((s) => s.data.courseId === 1).every((s) => s.data.instructorUid === 't1' && s.data.generated === true));
  });
  test('asistencia y entregas solo para alumnos con aula, en cursos con contenido', () => {
    const { docs } = plan(100);
    const assigned = new Set(docs.enrollments.filter((e) => e.data.groupId).map((e) => e.id));
    assert.ok(docs.attendance.length > 0 && docs.submissions.length > 0);
    for (const a of docs.attendance) { assert.equal(a.data.courseId, 1); assert.ok(assigned.has(`${a.data.uid}_1`)); }
    for (const s of docs.submissions) { assert.equal(s.data.courseId, 1); assert.ok(assigned.has(`${s.data.uid}_1`)); }
  });
  test('una entrega calificada tiene nota entre 0 y 20; una sin calificar no trae nota', () => {
    const { docs } = plan(300);
    for (const s of docs.submissions) {
      if (s.data.status === 'reviewed') assert.ok(s.data.grade >= 0 && s.data.grade <= 20);
      else assert.equal('grade' in s.data, false);
    }
  });
  test('una tardanza siempre es una asistencia', () => {
    const { docs } = plan(300);
    assert.ok(docs.attendance.filter((a) => a.data.late).every((a) => a.data.present));
  });
  test('deja pedidos pendientes y uno rechazado para revisar en Ventas', () => {
    const { docs } = plan(20);
    assert.equal(docs.orders.filter((o) => o.data.status === 'pending').length, 3);
    assert.equal(docs.orders.filter((o) => o.data.status === 'rejected').length, 1);
  });
  test('es reproducible: mismas entradas, mismo plan', () => {
    assert.deepEqual(plan(100), plan(100));
  });
  test('sin cursos con precio no genera nada', () => {
    const { docs, summary } = buildDemoPlan({ courses: [COURSES[3]], size: 20, now: NOW });
    assert.equal(summary.enrollments, 0);
    assert.ok(Object.values(docs).every((list) => list.length === 0));
  });
  test('el tamaño pequeño se parece al Figma: 20 alumnos, unas 25 matrículas', () => {
    const { summary } = plan(20);
    assert.equal(summary.students, 20);
    assert.ok(summary.enrollments >= 22 && summary.enrollments <= 30, `matrículas: ${summary.enrollments}`);
  });
});
