// Tests de src/lib/gradebook.js (buildGradebookRows, computeGradeSummary).
// Convención: los tests con { todo: '...' } afirman el comportamiento
// CORRECTO/esperado y hoy fallan por un defecto abierto del código fuente; node
// los reporta como "todo" (no rompen la corrida).
// Nota: buildGradebookRows sólo cuenta notas de entregas con status 'reviewed'.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildGradebookRows, computeGradeSummary } from '../src/lib/gradebook.js';

const mod = (id, weight, extra = {}) => ({
  id, title: `Módulo ${id}`,
  deliverable: { description: `Entregable ${id}`, ...(weight !== undefined ? { weight } : {}), ...extra },
});
const row = (grade, weight) => ({ moduleId: 'x', title: 't', weight, grade, status: 'reviewed' });

describe('buildGradebookRows', () => {
  test('entradas vacías / nulas devuelven []', () => {
    assert.deepEqual(buildGradebookRows([], {}), []);
    assert.deepEqual(buildGradebookRows(undefined, undefined), []);
    assert.deepEqual(buildGradebookRows(null, null), []);
  });

  test('filtra módulos sin entregable o con descripción vacía', () => {
    const rows = buildGradebookRows([
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B', deliverable: { description: '' } },
      mod('c', 50),
    ], {});
    assert.equal(rows.length, 1);
    assert.equal(rows[0].moduleId, 'c');
  });

  test('usa la descripción del entregable como título (no el título del módulo)', () => {
    const [r] = buildGradebookRows([mod('a', 100)], {});
    assert.equal(r.title, 'Entregable a');
  });

  test('sin entrega: status pending y grade null', () => {
    const [r] = buildGradebookRows([mod('a', 100)], {});
    assert.equal(r.status, 'pending');
    assert.equal(r.grade, null);
  });

  test('nota 0 se conserva como 0 (no se confunde con null)', () => {
    const [r] = buildGradebookRows([mod('a', 100)], { a: { status: 'reviewed', grade: 0 } });
    assert.equal(r.grade, 0);
  });

  test('entrega sin campo grade (undefined) o grade null -> null', () => {
    const rows = buildGradebookRows([mod('a', 50), mod('b', 50)], {
      a: { status: 'submitted' }, b: { status: 'reviewed', grade: null },
    });
    assert.deepEqual(rows.map((r) => r.grade), [null, null]);
    assert.deepEqual(rows.map((r) => r.status), ['submitted', 'reviewed']);
  });

  test('pesos explícitos se respetan, incluido 0', () => {
    const rows = buildGradebookRows([mod('a', 20), mod('b', 0), mod('c', 80)], {});
    assert.deepEqual(rows.map((r) => r.weight), [20, 0, 80]);
  });

  test('sin ningún peso: reparto equitativo redondeado a 2 decimales', () => {
    assert.deepEqual(buildGradebookRows([mod('a'), mod('b')], {}).map((r) => r.weight), [50, 50]);
    const three = buildGradebookRows([mod('a'), mod('b'), mod('c')], {}).map((r) => r.weight);
    assert.deepEqual(three, [33.33, 33.33, 33.33]);
    assert.ok(Math.abs(three.reduce((s, w) => s + w, 0) - 100) > 0.001, 'los pesos redondeados no suman 100 (99.99)');
  });

  test('weight null (así lo guarda TeacherCourseContenido con el campo vacío) cae al reparto equitativo', () => {
    const rows = buildGradebookRows([mod('a', null), mod('b', null)], {});
    assert.deepEqual(rows.map((r) => r.weight), [50, 50]);
  });

  test('el reparto equitativo cuenta solo módulos CON entregable', () => {
    const rows = buildGradebookRows([mod('a'), { id: 'z', title: 'sin entregable' }, mod('b')], {});
    assert.deepEqual(rows.map((r) => r.weight), [50, 50]);
  });

  test('weight "" también cae al reparto (igual que null)', () => {
    assert.deepEqual(buildGradebookRows([mod('a', ''), mod('b', '')], {}).map((r) => r.weight), [50, 50]);
  });

  test('pesos mixtos: el que falta recibe el remanente hasta 100 (no 100/N)', () => {
    assert.deepEqual(buildGradebookRows([mod('a', 30), mod('b', 30), mod('c')], {}).map((r) => r.weight), [30, 30, 40]);
    assert.deepEqual(buildGradebookRows([mod('a', 50), mod('b', 50), mod('c')], {}).map((r) => r.weight), [50, 50, 0]);
    const total = buildGradebookRows([mod('a', 20), mod('b'), mod('c')], {}).reduce((s, r) => s + r.weight, 0);
    assert.equal(total, 100);
  });

  test('pesos numéricos como string ("20") se convierten a número', () => {
    const [a, b] = buildGradebookRows([mod('a', '20'), mod('b', '80')], {});
    assert.deepEqual([a.weight, b.weight], [20, 80]);
    assert.equal(typeof a.weight, 'number');
  });

  test('una re-entrega (status submitted) ya no cuenta la nota anterior', () => {
    // upsertSubmission usa merge:true y conserva `grade`, pero sólo valen las notas 'reviewed'.
    const rows = buildGradebookRows([mod('a', 100)], { a: { status: 'submitted', grade: 18 } });
    assert.equal(rows[0].grade, null);
    assert.equal(rows[0].status, 'submitted');
    assert.equal(computeGradeSummary(rows).promedioParcial, null);
  });

  test('sólo status "reviewed" con nota cuenta; otros status se ignoran', () => {
    const grades = ['pending', 'submitted', 'graded', undefined].map((status) =>
      buildGradebookRows([mod('a', 100)], { a: { status, grade: 15 } })[0].grade);
    assert.deepEqual(grades, [null, null, null, null]);
    assert.equal(buildGradebookRows([mod('a', 100)], { a: { status: 'reviewed', grade: 15 } })[0].grade, 15);
  });

  test('revisada sin nota (grade null / "" / no numérica) -> sin calificar', () => {
    for (const grade of [null, undefined, '', 'abc', NaN]) {
      assert.equal(buildGradebookRows([mod('a', 100)], { a: { status: 'reviewed', grade } })[0].grade, null, String(grade));
    }
  });

  test('notas fuera de 0-20 se acotan; "15" (string) se convierte', () => {
    const g = (grade) => buildGradebookRows([mod('a', 100)], { a: { status: 'reviewed', grade } })[0].grade;
    assert.equal(g(25), 20);
    assert.equal(g(-5), 0);
    assert.equal(g(20), 20);
    assert.equal(g(0), 0);
    assert.equal(g('15'), 15);
    assert.equal(g(15.5), 15.5);
  });
});

describe('computeGradeSummary', () => {
  test('sin filas', () => {
    assert.deepEqual(computeGradeSummary([]), {
      promedioParcial: null, rendimientoPct: null, rendimientoRaw: null, allGraded: false, gradedCount: 0, totalCount: 0,
    });
  });

  test('filas sin calificar', () => {
    const s = computeGradeSummary([row(null, 50), row(undefined, 50)]);
    assert.equal(s.promedioParcial, null);
    assert.equal(s.rendimientoPct, null);
    assert.equal(s.allGraded, false);
    assert.equal(s.gradedCount, 0);
    assert.equal(s.totalCount, 2);
  });

  test('nota 0 cuenta como calificada: promedio 0 y rendimiento 0 (no null)', () => {
    const s = computeGradeSummary([row(0, 100)]);
    assert.equal(s.promedioParcial, 0);
    assert.equal(s.rendimientoPct, 0);
    assert.equal(s.allGraded, true);
  });

  test('nota 0 vs null cambian el promedio ponderado', () => {
    const withZero = computeGradeSummary([row(0, 50), row(20, 50)]);
    const withNull = computeGradeSummary([row(null, 50), row(20, 50)]);
    assert.equal(withZero.promedioParcial, 10);
    assert.equal(withNull.promedioParcial, 20);
    assert.equal(withNull.allGraded, false);
  });

  test('calificación parcial: renormaliza sobre lo calificado', () => {
    const s = computeGradeSummary([row(20, 20), row(null, 20), row(null, 25), row(null, 35)]);
    assert.equal(s.promedioParcial, 20);
    assert.equal(s.rendimientoPct, 100);
    assert.equal(s.gradedCount, 1);
    assert.equal(s.totalCount, 4);
  });

  test('todos calificados, pesos 20/20/25/35 (Branding)', () => {
    const s = computeGradeSummary([row(18, 20), row(16, 20), row(14, 25), row(12, 35)]);
    assert.equal(s.promedioParcial, 14.5);
    assert.equal(s.allGraded, true);
    assert.equal(s.rendimientoPct, Math.round((14.5 / 20) * 100));
  });

  test('pesos que no suman 100 se normalizan silenciosamente', () => {
    const a = computeGradeSummary([row(10, 50), row(20, 50)]);
    const b = computeGradeSummary([row(10, 1), row(20, 1)]);
    assert.equal(a.promedioParcial, 15);
    assert.equal(b.promedioParcial, 15);
  });

  test('redondeo a 2 decimales del promedio', () => {
    // pesos 33.33 x3 (reparto equitativo): (10+11+11)/3 = 10.666.. -> 10.67
    assert.equal(computeGradeSummary([row(10, 33.33), row(11, 33.33), row(11, 33.33)]).promedioParcial, 10.67);
  });

  test('todos los pesos calificados son 0 -> cae al promedio simple', () => {
    const s = computeGradeSummary([row(10, 0), row(20, 0)]);
    assert.equal(s.promedioParcial, 15);
  });

  test('peso undefined se trata como 0', () => {
    const s = computeGradeSummary([row(10, undefined), row(20, 100)]);
    assert.equal(s.promedioParcial, 20);
  });

  test('peso 0 en una fila calificada la excluye del promedio ponderado', () => {
    assert.equal(computeGradeSummary([row(0, 0), row(20, 100)]).promedioParcial, 20);
  });

  test('notas fuera de rango llegan acotadas desde buildGradebookRows: 25 -> promedio 20, rendimiento 100', () => {
    const rows = buildGradebookRows([mod('a', 100)], { a: { status: 'reviewed', grade: 25 } });
    const s = computeGradeSummary(rows);
    assert.equal(s.promedioParcial, 20);
    assert.equal(s.rendimientoPct, 100);
    const neg = computeGradeSummary(buildGradebookRows([mod('a', 100)], { a: { status: 'reviewed', grade: -5 } }));
    assert.equal(neg.promedioParcial, 0);
    assert.equal(neg.rendimientoPct, 0);
  });

  test('flujo completo módulos -> filas -> resumen (Branding 20/20/25/35)', () => {
    const mods = [20, 20, 25, 35].map((w, i) => mod(`m${i}`, w));
    const subs = Object.fromEntries([18, 16, 14, 12].map((g, i) => [`m${i}`, { status: 'reviewed', grade: g }]));
    const s = computeGradeSummary(buildGradebookRows(mods, subs));
    assert.equal(s.promedioParcial, 14.5);
    assert.equal(s.allGraded, true);
  });

  describe('rendimientoPct: redondeo', () => {
    test('promedio 15 -> 75, 16 -> 80', () => {
      assert.equal(computeGradeSummary([row(15, 100)]).rendimientoPct, 75);
      assert.equal(computeGradeSummary([row(16, 100)]).rendimientoPct, 80);
    });
    test('promedio 15.9: rendimientoPct (para mostrar) redondea a 80 pero rendimientoRaw es 79.5', () => {
      const s = computeGradeSummary([row(15.9, 100)]);
      assert.equal(s.rendimientoPct, 80);
      assert.ok(Math.abs(s.rendimientoRaw - 79.5) < 1e-9, `raw=${s.rendimientoRaw}`);
      assert.ok(s.rendimientoRaw < 80);
    });
    test('rendimientoRaw sin notas es null y con 16 es 80 exacto', () => {
      assert.equal(computeGradeSummary([row(null, 100)]).rendimientoRaw, null);
      assert.equal(computeGradeSummary([row(16, 100)]).rendimientoRaw, 80);
    });
  });
});
