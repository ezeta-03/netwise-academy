// Tests de src/lib/teacherHome.js (Inicio del docente, D1).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildToReview, trailingAbsences, buildAttentionList } from '../src/lib/teacherHome.js';

const sessions = [1, 2, 3, 4].map((n) => ({ id: `s${n}`, done: true }));

describe('trailingAbsences', () => {
  test('cuenta solo las faltas del final', () => {
    const att = [{ sessionId: 's1', present: false }, { sessionId: 's2', present: true }, { sessionId: 's3', present: false }, { sessionId: 's4', present: false }];
    assert.equal(trailingAbsences(sessions, att), 2);
  });
  test('sin registro en una sesión dictada cuenta como falta', () => {
    assert.equal(trailingAbsences(sessions, [{ sessionId: 's1', present: true }]), 3);
  });
  test('"No aplica" no corta la racha ni suma', () => {
    const att = [{ sessionId: 's2', present: true }, { sessionId: 's3', present: false }, { sessionId: 's4', excused: true }];
    assert.equal(trailingAbsences(sessions, att), 1);
  });
});

describe('buildAttentionList', () => {
  const base = { uid: 'u1', studentName: 'Ana', sessions, submissions: [], overdueModules: [] };
  test('alumno al día no aparece', () => {
    const att = sessions.map((s) => ({ sessionId: s.id, present: true }));
    assert.equal(buildAttentionList([{ ...base, attendance: att }]).length, 0);
  });
  test('faltas seguidas y entrega vencida', () => {
    const att = [{ sessionId: 's1', present: true }, { sessionId: 's2', present: true }, { sessionId: 's3', present: false }, { sessionId: 's4', present: false }];
    const [row] = buildAttentionList([{ ...base, attendance: att, overdueModules: [{ id: 'm1', label: 'Módulo 1' }] }]);
    assert.deepEqual(row.reasons.map((r) => r.label), ['2 faltas seguidas', 'Sin entrega del Módulo 1']);
  });
  test('entregó el módulo vencido: sale de la lista', () => {
    const att = sessions.map((s) => ({ sessionId: s.id, present: true }));
    assert.equal(buildAttentionList([{ ...base, attendance: att, submissions: [{ moduleId: 'm1' }], overdueModules: [{ id: 'm1', label: 'Módulo 1' }] }]).length, 0);
  });
  test('asistencia bajo 75% sin racha', () => {
    const att = [{ sessionId: 's1', present: false }, { sessionId: 's2', present: false }, { sessionId: 's3', present: true }, { sessionId: 's4', present: true }];
    const [row] = buildAttentionList([{ ...base, attendance: att }]);
    assert.equal(row.reasons[0].label, 'Asistencia bajo 75%');
  });
});

describe('buildToReview', () => {
  test('agrupa por módulo, marca tardías y ordena por la más antigua', () => {
    const courses = [{ id: 2, title: 'Branding' }];
    const modules = { 2: [{ id: 'm1' }, { id: 'm2' }] };
    const subs = { 2: [
      { moduleId: 'm2', status: 'submitted', submittedAt: '2026-10-20T10:00' },
      { moduleId: 'm1', status: 'submitted', submittedAt: '2026-10-25T10:00' },
      { moduleId: 'm1', status: 'submitted', submittedAt: '2026-10-27T10:00' },
      { moduleId: 'm1', status: 'reviewed', submittedAt: '2026-10-01T10:00' },
    ] };
    const rows = buildToReview({ courses, submissionsByCourse: subs, modulesByCourse: modules, dueDateOf: (c, m) => (m.id === 'm1' ? '2026-10-26' : null) });
    assert.deepEqual(rows.map((r) => [r.title, r.count, r.late]), [['Entrega Módulo 2', 1, 0], ['Entrega Módulo 1', 2, 1]]);
  });
});
