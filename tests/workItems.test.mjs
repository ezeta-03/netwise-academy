// Tests de src/lib/workItems.js (lo que entrega el alumno: módulos y prácticas)
// y de las prácticas "Pasa a registro" en buildStudentRows.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkItems, submissionFor, itemState, hasDelivered, submissionFiles, submissionLinks, submissionComment, daysLeft, dueLabel, practicesForGroup } from '../src/lib/workItems.js';
import { getGradingModel, buildStudentRows } from '../src/lib/gradingScheme.js';

const course = { id: 2, title: 'Branding y Gestión de Marca' };
const modules = [
  { id: 'm1', title: 'Diagnóstico', deliverable: { description: 'Ficha de diagnóstico', dueDate: '2026-11-01' } },
  { id: 'm2', title: 'Performance', deliverable: { description: 'Niveles 2 y 3', dueDate: '2026-11-11' } },
  { id: 'm3', title: 'Sin entregable' },
];
const practices = [{ id: 'p1', title: 'Positioning', classTitle: 'Sesión 5', moduleId: 'm2', dueAt: '2026-10-30T23:59:00-05:00', groupId: 'g1' }];

describe('buildWorkItems', () => {
  const items = buildWorkItems({ course, modules, practices });
  test('una fila por entrega de módulo y por práctica, por fecha', () => {
    assert.deepEqual(items.map((i) => [i.kind, i.key]), [['practice', 'p-p1'], ['module', 'm1'], ['module', 'm2']]);
  });
  test('la práctica toma su módulo, su fecha de Perú y su clave de entrega', () => {
    const p = items[0];
    assert.deepEqual([p.moduleId, p.moduleIndex, p.dueDate, p.submissionModuleId, p.title], ['m2', 1, '2026-10-30', 'p-p1', 'Sesión 5 · Positioning']);
  });
  test('la entrega del módulo se titula con su número', () => {
    assert.equal(items[1].title, 'Módulo 1 · Ficha de diagnóstico');
  });
});

describe('estado de una entrega', () => {
  const item = { submissionModuleId: 'p-p1' };
  test('sin entrega: pending', () => assert.equal(itemState(submissionFor(item, [])), 'pending'));
  test('enviada y calificada', () => {
    assert.equal(itemState(submissionFor(item, [{ moduleId: 'p-p1', status: 'submitted' }])), 'submitted');
    assert.equal(itemState(submissionFor(item, [{ moduleId: 'p-p1', status: 'reviewed', grade: 15 }])), 'reviewed');
  });
  test('calificar a quien no entregó no cuenta como entrega', () => {
    assert.equal(hasDelivered({ status: 'reviewed', grade: 0 }), false);
    assert.equal(hasDelivered({ status: 'reviewed', grade: 15, submittedAt: '2026-10-20' }), true);
  });
});

describe('archivos, links y comentario', () => {
  test('entrega nueva: varios archivos y links', () => {
    const sub = { files: [{ url: 'https://a/1.pdf', name: '1.pdf' }, { url: 'https://a/2.pdf', name: '2.pdf' }], links: ['https://figma.com/x'], comment: 'Revisa la parte 2', note: 'https://figma.com/x' };
    assert.equal(submissionFiles(sub).length, 2);
    assert.deepEqual(submissionLinks(sub), ['https://figma.com/x']);
    assert.equal(submissionComment(sub), 'Revisa la parte 2');
  });
  test('entrega antigua: un archivo y el link o texto en note', () => {
    assert.deepEqual(submissionFiles({ fileUrl: 'https://a/f.pdf', fileName: 'f.pdf' }), [{ url: 'https://a/f.pdf', name: 'f.pdf' }]);
    assert.deepEqual(submissionLinks({ note: 'https://drive.google.com/x' }), ['https://drive.google.com/x']);
    assert.equal(submissionComment({ note: 'Mi trabajo escrito' }), 'Mi trabajo escrito');
    assert.equal(submissionComment({ note: 'https://drive.google.com/x' }), '');
  });
});

describe('fechas', () => {
  const now = new Date('2026-10-28T12:00:00-05:00').getTime();
  test('días hasta la fecha límite (hora de Perú)', () => {
    assert.equal(daysLeft('2026-10-28', now), 0);
    assert.equal(daysLeft('2026-10-30', now), 2);
    assert.equal(daysLeft('2026-10-27', now), -1);
  });
  test('textos', () => {
    assert.deepEqual([dueLabel(0), dueLabel(1), dueLabel(4), dueLabel(-1), dueLabel(-3)], ['Vence hoy', 'Vence mañana', 'Vence en 4 días', 'Venció ayer', 'Venció hace 3 días']);
  });
  test('prácticas del aula del alumno', () => {
    assert.equal(practicesForGroup(practices, 'g1').length, 1);
    assert.equal(practicesForGroup(practices, 'g2').length, 0);
  });
});

describe('prácticas "Pasa a registro" (buildStudentRows)', () => {
  const mods = [1, 2, 3, 4].map((n) => ({ id: `m${n}`, title: `M${n}`, deliverable: { description: `E${n}` } }));
  const model = getGradingModel(2, mods);
  const subs = [
    { moduleId: 'm1', status: 'reviewed', grade: 18 },
    { moduleId: 'p-a', practiceId: 'a', parentModuleId: 'm1', status: 'reviewed', grade: 12 },
    { moduleId: 'p-b', practiceId: 'b', parentModuleId: 'm2', status: 'reviewed', grade: 16 },
  ];
  test('apagado: la práctica no suma', () => {
    assert.deepEqual(buildStudentRows(model, subs, {}, new Set()).slice(0, 2).map((r) => r.grade), [18, null]);
  });
  test('encendido: se promedia dentro de su módulo', () => {
    assert.deepEqual(buildStudentRows(model, subs, {}, new Set(['a', 'b'])).slice(0, 2).map((r) => r.grade), [15, 16]);
  });
});
