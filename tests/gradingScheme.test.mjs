// Tests de src/lib/gradingScheme.js (esquema de calificación por curso) y de
// gradebook.usableGrade. Todo se importa del código real, salvo la regla de
// validación de db.setCourseScore (db.js importa firebase): se copia abajo.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GRADING_SCHEMES, getGradingScheme, getGradingModel, buildStudentRows, effectiveModuleWeights } from '../src/lib/gradingScheme.js';
import { usableGrade, buildGradebookRows } from '../src/lib/gradebook.js';
import { computeGradeSummary } from '../src/lib/gradebook.js';
import { evaluateApproval } from '../src/lib/approval.js';
import { resolveWeights } from '../src/lib/weights.js';

const dm = (id, extra = {}) => ({ id, title: `T-${id}`, deliverable: { description: `d-${id}`, ...extra } });
const mods = (n) => Array.from({ length: n }, (_, i) => dm(`m${i + 1}`));
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const rev = (moduleId, grade, status = 'reviewed') => ({ moduleId, grade, status });
const weightsOf = (model) => model.components.map((c) => c.weight);

describe('GRADING_SCHEMES: datos', () => {
  test('existen los esquemas de los cursos 1 a 4 y sólo esos', () => {
    assert.deepEqual(Object.keys(GRADING_SCHEMES), ['1', '2', '3', '4']);
  });
  for (const [id, scheme] of Object.entries(GRADING_SCHEMES)) {
    test(`curso ${id}: los bloques suman 100`, () => {
      assert.equal(scheme.blocks.reduce((s, b) => s + b.weight, 0), 100);
    });
    test(`curso ${id}: los pesos internos de módulos suman 100 y son 4`, () => {
      const mb = scheme.blocks.find((b) => b.moduleWeights);
      assert.ok(mb, 'tiene bloque de módulos');
      assert.equal(mb.moduleWeights.length, 4);
      assert.equal(mb.moduleWeights.reduce((s, w) => s + w, 0), 100);
    });
    test(`curso ${id}: claves de bloque únicas, el bloque de módulos es "modules" y va primero`, () => {
      const keys = scheme.blocks.map((b) => b.key);
      assert.equal(new Set(keys).size, keys.length);
      assert.equal(keys[0], 'modules');
      assert.equal(scheme.blocks.filter((b) => b.moduleWeights).length, 1);
    });
    test(`curso ${id}: textos (subtitle, footer, label) definidos y todos los pesos > 0`, () => {
      assert.ok(scheme.subtitle.trim() && scheme.footer.trim());
      for (const b of scheme.blocks) { assert.ok(b.label.trim()); assert.ok(b.weight > 0); }
    });
    test(`curso ${id}: el modelo con 4 entregables suma exactamente 100`, () => {
      assert.equal(getGradingModel(id, mods(4)).total, 100);
    });
  }
  test('pesos por bloque de cada curso (spec)', () => {
    // Redes: un solo bloque de módulos del 100% (pesos del sílabo), sin componente manual.
    assert.deepEqual(GRADING_SCHEMES[1].blocks.map((b) => [b.key, b.weight]), [['modules', 100]]);
    assert.deepEqual(GRADING_SCHEMES[1].blocks[0].moduleWeights, [20, 25, 25, 30]);
    assert.deepEqual(GRADING_SCHEMES[2].blocks[0].moduleWeights, [25, 25, 25, 25]);
    assert.deepEqual(GRADING_SCHEMES[2].blocks.map((b) => [b.key, b.weight]), [['modules', 70], ['sustentacion', 30]]);
    assert.deepEqual(GRADING_SCHEMES[3].blocks.map((b) => [b.key, b.weight]), [['modules', 20], ['participacion', 20], ['caso1', 20], ['proyecto', 40]]);
    assert.deepEqual(GRADING_SCHEMES[4].blocks.map((b) => [b.key, b.weight]), [['modules', 40], ['participacion', 30], ['sustentacion', 30]]);
  });
});

describe('getGradingScheme', () => {
  test('id numérico o texto devuelve el mismo esquema', () => {
    for (const id of [1, 2, 3, 4]) {
      assert.equal(getGradingScheme(id), GRADING_SCHEMES[id]);
      assert.equal(getGradingScheme(String(id)), GRADING_SCHEMES[id]);
    }
  });
  test('sin esquema -> null (5, 0, -1, "abc", "", null, undefined)', () => {
    for (const id of [5, 0, -1, 'abc', '', null, undefined, NaN, '99']) assert.equal(getGradingScheme(id), null, String(id));
  });
  test('formatos numéricos equivalentes ("02", " 2 ", "2.0") resuelven al curso 2', () => {
    for (const id of ['02', ' 2 ', '2.0']) assert.equal(getGradingScheme(id), GRADING_SCHEMES[2], id);
  });
  test('claves heredadas de Object.prototype ("constructor", "toString", "__proto__") no son esquemas', { todo: 'BAJO gradingScheme.js:52 - GRADING_SCHEMES[courseId] alcanza el prototipo: getGradingScheme("constructor") devuelve la función Object y getGradingModel lanza TypeError (scheme.blocks.map). Usar Object.hasOwn' }, () => {
    for (const id of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) assert.equal(getGradingScheme(id), null, id);
  });
});

describe('getGradingModel con esquema', () => {
  test('Redes (1): pesos efectivos 20 / 25 / 25 / 30, un solo bloque del 100% y sin componente manual', () => {
    const m = getGradingModel(1, mods(4));
    assert.deepEqual(weightsOf(m), [20, 25, 25, 30]);
    assert.equal(m.total, 100);
    assert.equal(m.hasScheme, true);
    assert.deepEqual(m.blocks.map((b) => [b.key, b.label, b.weight]), [['modules', 'Entregables del curso', 100]]);
    assert.ok(m.components.every((c) => c.kind === 'module'));
    assert.deepEqual(m.components.map((c) => c.weightInBlock), [20, 25, 25, 30]);
    assert.equal(m.moduleCountMismatch, null);
    assert.equal(m.subtitle, 'Notas por entregable y promedio final.');
    assert.match(m.footer, /20% \+ 25% \+ 25% \+ 30%/);
  });
  test('Branding (2): 17.5 x4 + sustentación 30', () => {
    assert.deepEqual(weightsOf(getGradingModel(2, mods(4))), [17.5, 17.5, 17.5, 17.5, 30]);
  });
  test('Marketing (3): 5 x4 + participación 20 + caso 20 + proyecto 40', () => {
    const m = getGradingModel(3, mods(4));
    assert.deepEqual(weightsOf(m), [5, 5, 5, 5, 20, 20, 40]);
    assert.deepEqual(m.blocks.map((b) => b.key), ['modules', 'participacion', 'caso1', 'proyecto']);
  });
  test('Negocios (4): 10 x4 + participación 30 + sustentación 30', () => {
    assert.deepEqual(weightsOf(getGradingModel(4, mods(4))), [10, 10, 10, 10, 30, 30]);
  });
  test('forma de cada componente: módulo y manual (Branding)', () => {
    const m = getGradingModel(2, mods(4));
    const c = m.components[1];
    assert.deepEqual([c.key, c.kind, c.moduleId, c.index, c.label, c.blockKey, c.blockLabel, c.weightInBlock, c.weight],
      ['m:m2', 'module', 'm2', 1, 'M2', 'modules', 'Tareas prácticas por módulo', 25, 17.5]);
    assert.equal(c.module.id, 'm2');
    const s = m.components[4];
    assert.deepEqual([s.key, s.kind, s.moduleId, s.label, s.blockKey, s.weightInBlock, s.weight], ['sustentacion', 'manual', undefined, 'Sustentación del Brand Deck', 'sustentacion', 100, 30]);
  });
  test('forma de cada componente de Redes: sólo módulos, con peso interno igual al efectivo', () => {
    const m = getGradingModel(1, mods(4));
    const c = m.components[3];
    assert.deepEqual([c.key, c.kind, c.moduleId, c.index, c.label, c.blockKey, c.blockLabel, c.weightInBlock, c.weight],
      ['m:m4', 'module', 'm4', 3, 'M4', 'modules', 'Entregables del curso', 30, 30]);
    assert.equal(m.components.length, 4);
    assert.equal(m.components.some((x) => x.key === 'sustentacion'), false);
  });
  test('los componentes salen en orden: módulos M1..Mn y luego los manuales; blocks[].components coincide', () => {
    const m = getGradingModel(3, mods(4));
    assert.deepEqual(m.components.map((c) => c.label), ['M1', 'M2', 'M3', 'M4', 'Participación y análisis de casos', 'Caso 1 · Sesión 4', 'Proyecto final y sustentación']);
    assert.deepEqual(m.blocks.flatMap((b) => b.components), m.components);
    assert.deepEqual(m.blocks.map((b) => b.weight), [20, 20, 20, 40]);
  });
  test('subtitle y footer vienen del esquema', () => {
    const m = getGradingModel(4, mods(4));
    assert.equal(m.subtitle, GRADING_SCHEMES[4].subtitle);
    assert.equal(m.footer, GRADING_SCHEMES[4].footer);
  });
  test('id de curso como texto da el mismo modelo que como número', () => {
    for (const id of [1, 2, 3, 4]) {
      assert.deepEqual(weightsOf(getGradingModel(String(id), mods(4))), weightsOf(getGradingModel(id, mods(4))));
    }
  });
  test('un id de módulo se usa en la clave "m:<id>" (ids no numéricos incluidos)', () => {
    const m = getGradingModel(2, [dm('mod_abc'), dm('mod_def'), dm('x'), dm('y')]);
    assert.deepEqual(m.components.slice(0, 4).map((c) => c.key), ['m:mod_abc', 'm:mod_def', 'm:x', 'm:y']);
  });

  describe('deliverable.weight se IGNORA cuando hay esquema', () => {
    test('pesos manuales absurdos en los módulos no cambian nada', () => {
      const crazy = [dm('m1', { weight: 90 }), dm('m2', { weight: 5 }), dm('m3', { weight: 3 }), dm('m4', { weight: 2 })];
      assert.deepEqual(weightsOf(getGradingModel(1, crazy)), [20, 25, 25, 30]);
      assert.deepEqual(weightsOf(getGradingModel(1, crazy)), weightsOf(getGradingModel(1, mods(4))));
      assert.deepEqual(weightsOf(getGradingModel(2, crazy)), [17.5, 17.5, 17.5, 17.5, 30]);
      assert.deepEqual(effectiveModuleWeights(2, crazy), { m1: 17.5, m2: 17.5, m3: 17.5, m4: 17.5 });
    });
    test('pesos null / "" / 0 / negativos / no numéricos tampoco importan', () => {
      const odd = [dm('m1', { weight: null }), dm('m2', { weight: '' }), dm('m3', { weight: 0 }), dm('m4', { weight: -50 })];
      assert.equal(getGradingModel(2, odd).total, 100);
      assert.deepEqual(weightsOf(getGradingModel(2, odd)), [17.5, 17.5, 17.5, 17.5, 30]);
    });
    test('SIN esquema (curso 99) los deliverable.weight sí mandan', () => {
      const m = getGradingModel(99, [dm('a', { weight: 30 }), dm('b', { weight: 70 })]);
      assert.deepEqual(weightsOf(m), [30, 70]);
    });
  });

  describe('cantidad de entregables distinta de 4', () => {
    test('Branding, 4 módulos pero sólo 3 con entregable: el bloque del 70% se reparte en partes iguales (no [25,25,25,25])', () => {
      const three = [dm('a'), { id: 'z', title: 'sin entregable' }, dm('b'), dm('c')];
      const m = getGradingModel(2, three);
      const modulesC = m.components.filter((c) => c.kind === 'module');
      assert.deepEqual(modulesC.map((c) => c.moduleId), ['a', 'b', 'c']);
      assert.deepEqual(modulesC.map((c) => c.label), ['M1', 'M2', 'M3']);
      assert.deepEqual(modulesC.map((c) => c.weightInBlock), [33.33, 33.33, 33.33]);
      assert.deepEqual(modulesC.map((c) => c.weight), [23.33, 23.33, 23.33]); // 70 * 33.33 / 100 = 23.331
      assert.equal(m.total, 99.99); // 3 * 23.33 + 30
      assert.ok(Math.abs(m.total - 100) <= 0.05);
      assert.deepEqual(m.moduleCountMismatch, { expected: 4, actual: 3 });
    });
    test('Redes, 4 módulos pero sólo 3 con entregable: el 100% se reparte en partes iguales (no [20,25,25])', () => {
      const three = [dm('a'), { id: 'z', title: 'sin entregable' }, dm('b'), dm('c')];
      const m = getGradingModel(1, three);
      assert.deepEqual(m.components.map((c) => c.moduleId), ['a', 'b', 'c']);
      assert.deepEqual(m.components.map((c) => c.weightInBlock), [33.33, 33.33, 33.33]);
      assert.deepEqual(weightsOf(m), [33.33, 33.33, 33.33]);
      assert.equal(m.total, 99.99);
      assert.ok(Math.abs(m.total - 100) <= 0.05);
      assert.deepEqual(m.moduleCountMismatch, { expected: 4, actual: 3 });
    });
    test('el módulo sin entregable no aparece como componente ni recibe peso', () => {
      const m = getGradingModel(2, [dm('a'), { id: 'z', title: 'x' }, { id: 'y', title: 'y', deliverable: { description: '' } }, dm('b')]);
      assert.deepEqual(m.components.filter((c) => c.kind === 'module').map((c) => c.moduleId), ['a', 'b']);
      assert.deepEqual(effectiveModuleWeights(2, [dm('a'), { id: 'z' }, dm('b')]), { a: 35, b: 35 });
    });
    test('5 módulos: 20% del bloque cada uno; Redes 20 c/u (sin manual), Branding 14 c/u (70/5) y el total sigue en 100', () => {
      const m = getGradingModel(1, mods(5));
      assert.deepEqual(m.components.filter((c) => c.kind === 'module').map((c) => c.weightInBlock), [20, 20, 20, 20, 20]);
      assert.deepEqual(weightsOf(m), [20, 20, 20, 20, 20]);
      assert.equal(m.total, 100);
      const b = getGradingModel(2, mods(5));
      assert.deepEqual(weightsOf(b), [14, 14, 14, 14, 14, 30]);
      assert.equal(b.total, 100);
    });
    test('2 módulos: 50% del bloque', () => {
      assert.deepEqual(weightsOf(getGradingModel(4, mods(2))), [20, 20, 30, 30]);
    });
    test('1 módulo: recibe todo el bloque', () => {
      assert.deepEqual(weightsOf(getGradingModel(2, mods(1))), [70, 30]);
    });
    test('cero módulos / null / undefined: el bloque queda vacío y el total es sólo lo manual (Branding: 30; Redes: 0)', () => {
      for (const list of [[], null, undefined, [{ id: 'z' }]]) {
        const m = getGradingModel(2, list);
        assert.deepEqual(m.blocks[0].components, []);
        assert.equal(m.blocks[0].weight, 70);
        assert.deepEqual(m.components.map((c) => c.key), ['sustentacion']);
        assert.equal(m.total, 30);
        const r = getGradingModel(1, list);
        assert.deepEqual(r.blocks[0].components, []);
        assert.equal(r.blocks[0].weight, 100);
        assert.deepEqual(r.components, []);
        assert.equal(r.total, 0);
        assert.equal(r.moduleCountMismatch, null);
      }
    });
    test('para cualquier cantidad de módulos 1..12 el total queda a <= 0.1 de 100 en los 4 esquemas', () => {
      for (const id of [1, 2, 3, 4]) {
        for (let n = 1; n <= 12; n++) {
          const total = getGradingModel(id, mods(n)).total;
          assert.ok(Math.abs(total - 100) <= 0.1, `curso ${id}, n=${n}: ${total}`);
        }
      }
    });
    test('el total redondeado por división 100/n a veces supera la tolerancia 0.05 del Cronograma', () => {
      // documenta el peor caso hasta 12 módulos
      let worst = 0;
      for (const id of [1, 2, 3, 4]) for (let n = 1; n <= 12; n++) worst = Math.max(worst, Math.abs(getGradingModel(id, mods(n)).total - 100));
      assert.ok(worst <= 0.1);
    });
    test('el reparto entre módulos debería sumar 100 exacto (sin residuo por redondeo)', { todo: 'BAJO gradingScheme.js:81-84 - round2(100/n) y round2 del peso efectivo acumulan error: p. ej. Marketing con 3 módulos suma 100.01, Redes con 3 suma 99.99' }, () => {
      assert.equal(getGradingModel(3, mods(3)).total, 100);
      assert.equal(getGradingModel(1, mods(3)).total, 100);
    });
  });

  test('modules null/undefined sin esquema y con esquema no lanzan', () => {
    assert.doesNotThrow(() => getGradingModel(1, undefined));
    assert.doesNotThrow(() => getGradingModel(99, undefined));
  });
  test('las claves de componentes son únicas en todos los esquemas', () => {
    for (const id of [1, 2, 3, 4]) {
      const keys = getGradingModel(id, mods(4)).components.map((c) => c.key);
      assert.equal(new Set(keys).size, keys.length, `curso ${id}`);
    }
  });
});

describe('getGradingModel sin esquema (legado)', () => {
  for (const id of [99, '99', undefined, null, 0]) {
    test(`curso ${String(id)}: un bloque "Entregables" con los pesos de resolveWeights`, () => {
      const m = getGradingModel(id, [dm('a', { weight: 30 }), dm('b'), dm('c')]);
      assert.equal(m.hasScheme, false);
      assert.equal(m.footer, '');
      assert.deepEqual(m.blocks.map((b) => [b.key, b.label]), [['modules', 'Entregables']]);
      assert.deepEqual(weightsOf(m), [30, 35, 35]); // los faltantes se reparten el remanente
      assert.equal(m.total, 100);
      assert.deepEqual(m.components.map((c) => c.label), ['M1', 'M2', 'M3']);
      assert.deepEqual(m.components.map((c) => c.weightInBlock), weightsOf(m));
    });
  }
  test('coincide con resolveWeights en varios escenarios', () => {
    for (const list of [[], mods(3), [dm('a', { weight: 20 }), dm('b', { weight: 80 })], [dm('a', { weight: 0 }), dm('b')], [{ id: 'z' }, dm('a'), dm('b')]]) {
      assert.deepEqual(weightsOf(getGradingModel(99, list)), resolveWeights(list).rows.map((r) => r.weight));
      assert.deepEqual(getGradingModel(99, list).components.map((c) => c.moduleId), resolveWeights(list).rows.map((r) => r.module.id));
    }
  });
  test('sin módulos: modelo vacío con total 0', () => {
    const m = getGradingModel(99, []);
    assert.deepEqual([m.components, m.total, m.blocks[0].weight], [[], 0, 0]);
  });
  test('el index del componente es la posición entre ENTREGABLES', () => {
    const m = getGradingModel(99, [{ id: 'z' }, dm('a'), dm('b')]);
    assert.deepEqual(m.components.map((c) => c.index), [0, 1]);
  });
});

describe('usableGrade', () => {
  test('sólo cuenta entregas "reviewed"; otro status o sin entrega -> null', () => {
    for (const s of [null, undefined, {}, { status: 'submitted', grade: 18 }, { status: 'pending', grade: 18 }, { grade: 18 }]) assert.equal(usableGrade(s), null);
    assert.equal(usableGrade({ status: 'reviewed', grade: 18 }), 18);
  });
  test('acota a 0-20 y convierte strings numéricos', () => {
    assert.equal(usableGrade({ status: 'reviewed', grade: 25 }), 20);
    assert.equal(usableGrade({ status: 'reviewed', grade: -3 }), 0);
    assert.equal(usableGrade({ status: 'reviewed', grade: '15.5' }), 15.5);
    assert.equal(usableGrade({ status: 'reviewed', grade: 0 }), 0);
  });
  test('grade null / undefined / "" / NaN / no numérico / Infinity -> null', () => {
    for (const g of [null, undefined, '', NaN, 'abc', Infinity, -Infinity]) assert.equal(usableGrade({ status: 'reviewed', grade: g }), null, String(g));
  });
  test('un grade de sólo espacios se considera calificado con 0', { todo: 'BAJO gradebook.js:16-18 - Number(" ") === 0: grade " " o [] se leen como nota 0 en vez de sin calificar' }, () => {
    assert.equal(usableGrade({ status: 'reviewed', grade: '   ' }), null);
  });
  test('coincide con buildGradebookRows para el mismo dato', () => {
    for (const g of [0, 10, 25, -1, null, '12']) {
      const sub = { status: 'reviewed', grade: g };
      assert.equal(buildGradebookRows([dm('a')], { a: sub })[0].grade, usableGrade(sub));
    }
  });
});

describe('buildStudentRows', () => {
  // Branding: 4 módulos (17.5 c/u) + sustentación manual (30).
  const model = getGradingModel(2, mods(4));

  test('una fila por componente, misma forma que buildGradebookRows (key, kind, title, weight, grade, status)', () => {
    const rows = buildStudentRows(model, [rev('m1', 18)], { sustentacion: 17 });
    assert.equal(rows.length, 5);
    assert.deepEqual(rows[0], { key: 'm:m1', moduleId: 'm1', kind: 'module', title: 'M1', weight: 17.5, grade: 18, status: 'reviewed' });
    assert.deepEqual(rows[4], { key: 'sustentacion', kind: 'manual', title: 'Sustentación del Brand Deck', weight: 30, grade: 17, status: 'reviewed' });
    assert.deepEqual(rows[1], { key: 'm:m2', moduleId: 'm2', kind: 'module', title: 'M2', weight: 17.5, grade: null, status: 'pending' });
  });
  test('Redes: 4 filas (todas de módulo, pesos 20/25/25/30); una clave "sustentacion" en scores se ignora', () => {
    const redes = getGradingModel(1, mods(4));
    const rows = buildStudentRows(redes, [rev('m1', 18), rev('m4', 16)], { sustentacion: 20 });
    assert.equal(rows.length, 4);
    assert.deepEqual(rows.map((r) => [r.key, r.kind, r.weight, r.grade]), [['m:m1', 'module', 20, 18], ['m:m2', 'module', 25, null], ['m:m3', 'module', 25, null], ['m:m4', 'module', 30, 16]]);
  });
  test('módulo: sólo entregas revisadas; "submitted" conserva status pero sin nota', () => {
    const rows = buildStudentRows(model, [rev('m1', 18, 'submitted'), rev('m2', 15)], {});
    assert.equal(rows[0].grade, null);
    assert.equal(rows[0].status, 'submitted');
    assert.equal(rows[1].grade, 15);
  });
  test('módulo: nota acotada a 0-20', () => {
    const rows = buildStudentRows(model, [rev('m1', 25), rev('m2', -5)], {});
    assert.deepEqual([rows[0].grade, rows[1].grade], [20, 0]);
  });
  test('módulo: entregas de otros módulos se ignoran; duplicadas -> gana la primera', () => {
    const rows = buildStudentRows(model, [rev('zzz', 20), rev('m1', 10), rev('m1', 20)], {});
    assert.equal(rows[0].grade, 10);
    assert.deepEqual(rows.slice(1, 4).map((r) => r.grade), [null, null, null]);
  });
  test('manual: acota a 0-20', () => {
    assert.equal(buildStudentRows(model, [], { sustentacion: 25 })[4].grade, 20);
    assert.equal(buildStudentRows(model, [], { sustentacion: -3 })[4].grade, 0);
    assert.equal(buildStudentRows(model, [], { sustentacion: 20 })[4].grade, 20);
  });
  test('manual: null / undefined / "" / NaN / "abc" -> sin calificar (pending)', () => {
    for (const v of [null, undefined, '', NaN, 'abc', Infinity]) {
      const r = buildStudentRows(model, [], { sustentacion: v })[4];
      assert.equal(r.grade, null, String(v));
      assert.equal(r.status, 'pending');
    }
  });
  test('manual: 0 es una nota real ("reviewed"), distinta de null', () => {
    const r = buildStudentRows(model, [], { sustentacion: 0 })[4];
    assert.equal(r.grade, 0);
    assert.equal(r.status, 'reviewed');
  });
  test('manual: string numérico "15.5" se acepta; con coma ("15,5") queda sin calificar', () => {
    assert.equal(buildStudentRows(model, [], { sustentacion: '15.5' })[4].grade, 15.5);
    assert.equal(buildStudentRows(model, [], { sustentacion: '15,5' })[4].grade, null);
  });
  test('scores / submissions null o undefined no lanzan', () => {
    for (const [subs, sc] of [[null, null], [undefined, undefined], [[], {}]]) {
      const rows = buildStudentRows(model, subs, sc);
      assert.equal(rows.length, 5);
      assert.ok(rows.every((r) => r.grade === null));
    }
  });
  test('scores de claves que no existen en el esquema se ignoran (sustentacion en un curso sin ella)', () => {
    const marketing = getGradingModel(3, mods(4));
    const rows = buildStudentRows(marketing, [], { sustentacion: 20, participacion: 10 });
    assert.deepEqual(rows.filter((r) => r.grade !== null).map((r) => r.key), ['participacion']);
  });
  test('un score con la clave "modules" o "m:<id>" no reemplaza la nota del módulo', () => {
    const rows = buildStudentRows(model, [], { modules: 20, 'm:m1': 20 });
    assert.equal(rows[0].grade, null);
  });
  test('un score de sólo espacios se lee como 0', { todo: 'BAJO gradingScheme.js:106-108 - Number(" ") === 0 y Number(false) === 0: raw "  " o false cuentan como nota 0; exigir typeof number o string no vacío tras trim' }, () => {
    assert.equal(buildStudentRows(model, [], { sustentacion: '   ' })[4].grade, null);
    assert.equal(buildStudentRows(model, [], { sustentacion: false })[4].grade, null);
  });
});

describe('promedio ponderado con computeGradeSummary(buildStudentRows(...))', () => {
  const redes = getGradingModel(1, mods(4)); // 20/25/25/30, sin componente manual
  const brand = getGradingModel(2, mods(4)); // 17.5 x4 + sustentación 30
  const summary = (model, subs, scores) => computeGradeSummary(buildStudentRows(model, subs, scores));

  test('Redes: M1..M4 = 18, 19, 17, 16 -> (20*18+25*19+25*17+30*16)/100 = 17.4, todo calificado sin componente manual', () => {
    const s = summary(redes, [rev('m1', 18), rev('m2', 19), rev('m3', 17), rev('m4', 16)], {});
    assert.equal(s.promedioParcial, 17.4); // 360 + 475 + 425 + 480 = 1740
    assert.equal(s.allGraded, true);
    assert.equal(s.gradedCount, 4);
    assert.equal(s.totalCount, 4);
    assert.equal(s.rendimientoPct, 87);
    assert.ok(close(s.rendimientoRaw, 87));
  });
  test('Redes: allGraded es true sólo con las 4 notas de módulo; una nota "sustentacion" en scores no cambia nada', () => {
    const subs = [rev('m1', 18), rev('m2', 19), rev('m3', 17), rev('m4', 16)];
    assert.deepEqual(summary(redes, subs, { sustentacion: 0 }), summary(redes, subs, {}));
    assert.deepEqual(summary(redes, subs, null), summary(redes, subs, {}));
    const three = summary(redes, subs.slice(0, 3), {});
    assert.deepEqual([three.allGraded, three.gradedCount, three.totalCount], [false, 3, 4]);
  });
  test('Redes: promedio parcial renormalizado con 2 de 4 calificados (M1 18 y M2 19 -> (360+475)/45 = 18.56)', () => {
    const s = summary(redes, [rev('m1', 18), rev('m2', 19)], {});
    assert.equal(s.promedioParcial, 18.56); // 835 / 45 = 18.5556
    assert.deepEqual([s.allGraded, s.gradedCount, s.totalCount], [false, 2, 4]);
    assert.equal(evaluateApproval(s, null).overall, 'pending');
    // los dos últimos: (25*17 + 30*16) / 55 = 905 / 55 = 16.4545
    assert.equal(summary(redes, [rev('m3', 17), rev('m4', 16)], {}).promedioParcial, 16.45);
  });
  test('Redes: M1 = 0 cuenta con su peso; M1 sin calificar no', () => {
    const withZero = summary(redes, [rev('m1', 0), rev('m2', 20)], {});
    assert.equal(withZero.promedioParcial, 11.11); // (20*0 + 25*20) / 45 = 11.1111
    assert.equal(withZero.gradedCount, 2);
    assert.equal(summary(redes, [rev('m2', 20)], {}).promedioParcial, 20);
  });
  test('Redes: M4 (30%) pesa más que cada uno de los otros: M1..M3 = 20 y M4 = 10 -> 17', () => {
    const s = summary(redes, [rev('m1', 20), rev('m2', 20), rev('m3', 20), rev('m4', 10)], {});
    assert.equal(s.promedioParcial, 17); // (400 + 500 + 500 + 300) / 100
    assert.equal(evaluateApproval(s, null).overall, 'regular');
  });
  test('Redes: reentrega quita la nota vieja hasta que el docente califica de nuevo', () => {
    // M2 reentregado (status "submitted") conserva grade 20 en el documento pero ya no cuenta
    const stale = summary(redes, [rev('m1', 18), rev('m2', 20, 'submitted')], {});
    assert.equal(stale.promedioParcial, 18);
    assert.deepEqual([stale.gradedCount, stale.allGraded], [1, false]);
    const regraded = summary(redes, [rev('m1', 18), rev('m2', 12)], {});
    assert.equal(regraded.promedioParcial, 14.67); // (20*18 + 25*12) / 45 = 660 / 45 = 14.6667
    // con los 4 calificados y una reentrega de M4: vuelve a 'pending' y el promedio se renormaliza sobre 70
    const four = [rev('m1', 18), rev('m2', 19), rev('m3', 17), rev('m4', 16, 'submitted')];
    const s = summary(redes, four, {});
    assert.equal(s.promedioParcial, 18); // (360 + 475 + 425) / 70 = 1260 / 70
    assert.equal(s.allGraded, false);
    assert.equal(evaluateApproval(s, null).overall, 'pending');
  });
  test('Branding: M1..M4 = 18, 19, 17, 16 + sustentación 17 -> (17.5*70 + 30*17)/100 = 17.35', () => {
    const s = summary(brand, [rev('m1', 18), rev('m2', 19), rev('m3', 17), rev('m4', 16)], { sustentacion: 17 });
    assert.equal(s.promedioParcial, 17.35); // 1225 + 510 = 1735
    assert.equal(s.allGraded, true);
    assert.equal(s.gradedCount, 5);
    assert.equal(s.totalCount, 5);
    assert.equal(s.rendimientoPct, 87); // 86.75 redondeado
    assert.ok(close(s.rendimientoRaw, 86.75));
  });
  test('Branding sin la sustentación: se renormaliza sobre el 70% calificado y allGraded es false', () => {
    const s = summary(brand, [rev('m1', 18), rev('m2', 19), rev('m3', 17), rev('m4', 16)], {});
    assert.equal(s.promedioParcial, 17.5); // 1225 / 70
    assert.equal(s.allGraded, false);
    assert.equal(s.gradedCount, 4);
  });
  test('estudiante con SÓLO notas manuales: el promedio sale de ellas y allGraded es false', () => {
    const s = summary(brand, [], { sustentacion: 17 });
    assert.equal(s.promedioParcial, 17);
    assert.equal(s.gradedCount, 1);
    assert.equal(s.allGraded, false);
    const mk = getGradingModel(3, mods(4));
    const m = summary(mk, [], { participacion: 10, caso1: 12, proyecto: 15 });
    assert.equal(m.promedioParcial, 13); // (20*10 + 20*12 + 40*15) / 80
    assert.equal(m.gradedCount, 3);
    assert.equal(m.totalCount, 7);
    assert.equal(m.allGraded, false);
  });
  test('estudiante con SÓLO módulos (sin manuales) tampoco es allGraded (Branding)', () => {
    const s = summary(brand, [rev('m1', 20), rev('m2', 20), rev('m3', 20), rev('m4', 20)], null);
    assert.equal(s.promedioParcial, 20);
    assert.equal(s.allGraded, false);
  });
  test('sin ninguna nota: promedio null', () => {
    const s = summary(redes, [], {});
    assert.deepEqual([s.promedioParcial, s.rendimientoPct, s.rendimientoRaw, s.gradedCount, s.allGraded], [null, null, null, 0, false]);
  });
  test('nota 0 vs null (Branding): M1 = 0 cuenta con su peso; M1 sin calificar no', () => {
    const withZero = summary(brand, [rev('m1', 0)], { sustentacion: 17 });
    assert.equal(withZero.promedioParcial, 10.74); // 30*17 / (17.5 + 30) = 510 / 47.5 = 10.7368
    assert.equal(withZero.gradedCount, 2);
    const withNull = summary(brand, [], { sustentacion: 17 });
    assert.equal(withNull.promedioParcial, 17);
  });
  test('todo 0 con todo calificado: promedio 0, rendimiento 0 (no null), allGraded true (Redes y Branding)', () => {
    const s = summary(redes, [0, 1, 2, 3].map((i) => rev(`m${i + 1}`, 0)), {});
    assert.deepEqual([s.promedioParcial, s.rendimientoPct, s.allGraded], [0, 0, true]);
    const b = summary(brand, [0, 1, 2, 3].map((i) => rev(`m${i + 1}`, 0)), { sustentacion: 0 });
    assert.deepEqual([b.promedioParcial, b.rendimientoPct, b.allGraded], [0, 0, true]);
  });
  test('todo 20: promedio 20, rendimiento 100 (Redes y Branding)', () => {
    const s = summary(redes, [0, 1, 2, 3].map((i) => rev(`m${i + 1}`, 20)), {});
    assert.deepEqual([s.promedioParcial, s.rendimientoPct], [20, 100]);
    const b = summary(brand, [0, 1, 2, 3].map((i) => rev(`m${i + 1}`, 20)), { sustentacion: 20 });
    assert.deepEqual([b.promedioParcial, b.rendimientoPct], [20, 100]);
  });
  test('notas fuera de rango en el almacén se acotan: sustentación 25 -> 20 y módulo -5 -> 0 (Branding)', () => {
    const s = summary(brand, [rev('m1', -5)], { sustentacion: 25 });
    assert.equal(s.promedioParcial, 12.63); // (17.5*0 + 30*20) / 47.5 = 12.6316
    const only = summary(brand, [], { sustentacion: 25 });
    assert.equal(only.promedioParcial, 20);
    assert.equal(only.rendimientoPct, 100);
    // Redes: -5 -> 0 y 25 -> 20 en módulos
    assert.equal(summary(redes, [rev('m1', -5), rev('m2', 25)], {}).promedioParcial, 11.11); // (20*0 + 25*20) / 45
  });
  test('redondeo a 2 decimales con pesos efectivos de 17.5', () => {
    const s = summary(getGradingModel(2, mods(4)), [rev('m1', 11), rev('m2', 12), rev('m3', 13), rev('m4', 14)], { sustentacion: 15 });
    // (17.5*(11+12+13+14) + 30*15) / 100 = (875 + 450) / 100 = 13.25
    assert.equal(s.promedioParcial, 13.25);
  });
  test('para todo esquema y toda nota g (0..20 paso 0.5), si todo vale g el promedio es g (sin error de coma flotante)', () => {
    for (const id of [1, 2, 3, 4]) {
      const model = getGradingModel(id, mods(4));
      for (let g = 0; g <= 20; g += 0.5) {
        const subs = ['m1', 'm2', 'm3', 'm4'].map((m) => rev(m, g));
        const scores = Object.fromEntries(model.components.filter((c) => c.kind === 'manual').map((c) => [c.key, g]));
        const s = summary(model, subs, scores);
        assert.equal(s.promedioParcial, g, `curso ${id} g=${g}`);
        assert.equal(s.allGraded, true);
      }
    }
  });
  test('todo 16 aprueba el rendimiento (80%) en todos los esquemas; 15.9 no', () => {
    for (const id of [1, 2, 3, 4]) {
      const model = getGradingModel(id, mods(4));
      const scores = (g) => Object.fromEntries(model.components.filter((c) => c.kind === 'manual').map((c) => [c.key, g]));
      const subs = (g) => ['m1', 'm2', 'm3', 'm4'].map((m) => rev(m, g));
      assert.equal(evaluateApproval(summary(model, subs(16), scores(16)), null).overall, 'regular', `curso ${id}`);
      assert.equal(evaluateApproval(summary(model, subs(15.9), scores(15.9)), null).overall, 'substitute', `curso ${id} 15.9`);
    }
  });
  test('veredicto global pendiente hasta tener también las notas manuales (Branding)', () => {
    const s = summary(brand, [0, 1, 2, 3].map((i) => rev(`m${i + 1}`, 20)), {});
    assert.equal(evaluateApproval(s, null).overall, 'pending');
    const regular = summary(brand, [0, 1, 2, 3].map((i) => rev(`m${i + 1}`, 20)), { sustentacion: 10 });
    assert.equal(regular.promedioParcial, 17); // (70*20 + 30*10) / 100
    assert.equal(evaluateApproval(regular, null).overall, 'regular');
    const low = summary(brand, [0, 1, 2, 3].map((i) => rev(`m${i + 1}`, 10)), { sustentacion: 10 });
    assert.equal(low.promedioParcial, 10);
    assert.equal(evaluateApproval(low, null).overall, 'substitute');
  });
  test('Redes: el veredicto global sale en cuanto hay las 4 notas de módulo (sin componente manual)', () => {
    const regular = summary(redes, [0, 1, 2, 3].map((i) => rev(`m${i + 1}`, 20)), {});
    assert.equal(evaluateApproval(regular, null).overall, 'regular');
    const low = summary(redes, [0, 1, 2, 3].map((i) => rev(`m${i + 1}`, 10)), {});
    assert.equal(evaluateApproval(low, null).overall, 'substitute');
    const partial = summary(redes, [0, 1, 2].map((i) => rev(`m${i + 1}`, 20)), {});
    assert.equal(evaluateApproval(partial, null).overall, 'pending');
  });
  test('Marketing: los pesos manuales (participación 20, caso 20, proyecto 40) pesan más que los módulos (20 en total)', () => {
    const mk = getGradingModel(3, mods(4));
    const s = summary(mk, [0, 1, 2, 3].map((i) => rev(`m${i + 1}`, 20)), { participacion: 0, caso1: 0, proyecto: 0 });
    assert.equal(s.promedioParcial, 4); // 20*20 / 100
  });
  test('con 3 de 4 entregables el promedio usa el reparto igualitario del bloque (Branding)', () => {
    const three = getGradingModel(2, [dm('a'), dm('b'), dm('c')]);
    const s = summary(three, [rev('a', 10), rev('b', 14), rev('c', 18)], { sustentacion: 20 });
    // pesos 23.33 x3 + 30 -> (23.33*(10+14+18) + 30*20) / 99.99
    assert.equal(s.promedioParcial, Math.round(((23.33 * 42 + 600) / 99.99) * 100) / 100);
  });
  test('con 3 entregables Redes reparte el 100% en partes iguales: 33.33 c/u y promedio = media simple', () => {
    const three = getGradingModel(1, [dm('a'), dm('b'), dm('c')]);
    const s = summary(three, [rev('a', 10), rev('b', 14), rev('c', 18)], {});
    assert.equal(s.promedioParcial, 14); // 33.33*42 / 99.99
    assert.deepEqual([s.allGraded, s.gradedCount, s.totalCount], [true, 3, 3]);
  });
});

describe('effectiveModuleWeights', () => {
  test('moduleId -> peso efectivo, sólo módulos (sin componentes manuales)', () => {
    assert.deepEqual(effectiveModuleWeights(1, mods(4)), { m1: 20, m2: 25, m3: 25, m4: 30 });
    assert.deepEqual(effectiveModuleWeights(2, mods(4)), { m1: 17.5, m2: 17.5, m3: 17.5, m4: 17.5 });
    assert.deepEqual(effectiveModuleWeights('3', mods(4)), { m1: 5, m2: 5, m3: 5, m4: 5 });
  });
  test('sin esquema usa resolveWeights', () => {
    assert.deepEqual(effectiveModuleWeights(99, [dm('a', { weight: 40 }), dm('b', { weight: 60 })]), { a: 40, b: 60 });
  });
  test('sin módulos -> {}', () => {
    assert.deepEqual(effectiveModuleWeights(1, []), {});
    assert.deepEqual(effectiveModuleWeights(1, null), {});
  });
  test('coincide con los pesos de los componentes de módulo', () => {
    for (const id of [1, 2, 3, 4, 99]) {
      const model = getGradingModel(id, mods(4));
      const eff = effectiveModuleWeights(id, mods(4));
      for (const c of model.components.filter((x) => x.kind === 'module')) assert.equal(eff[c.moduleId], c.weight);
    }
  });
});

// Regla de validación de db.js setCourseScore (líneas 1298-1300), copiada porque db.js importa firebase.
const validateScore = (value) => {
  const score = value === null || value === undefined || value === '' ? null : Number(value);
  if (score !== null && (!Number.isFinite(score) || score < 0 || score > 20)) throw new Error('La nota debe estar entre 0 y 20.');
  return score;
};

describe('setCourseScore: regla de validación (copia de db.js)', () => {
  test('null / undefined / "" borran (null)', () => {
    for (const v of [null, undefined, '']) assert.equal(validateScore(v), null);
  });
  test('0 y 20 válidos; strings numéricos se convierten', () => {
    assert.equal(validateScore(0), 0);
    assert.equal(validateScore(20), 20);
    assert.equal(validateScore('15.5'), 15.5);
    assert.equal(validateScore('0'), 0);
  });
  test('fuera de rango, NaN, Infinity y no numérico lanzan', () => {
    for (const v of [20.01, -0.01, 21, -1, NaN, Infinity, 'abc', '15,5', '1e3']) assert.throws(() => validateScore(v), /entre 0 y 20/, String(v));
  });
  test('un valor de sólo espacios se guardaría como 0', { todo: 'BAJO db.js:1299 - Number("  ") === 0: setCourseScore({ value: "  " }) guarda un 0 en lugar de borrar/rechazar' }, () => {
    assert.throws(() => validateScore('   '));
  });
  test('la regla acepta exactamente lo que buildStudentRows lee sin acotar (0-20)', () => {
    for (const v of [0, 7.25, 20]) assert.equal(buildStudentRows(getGradingModel(2, mods(4)), [], { sustentacion: validateScore(v) })[4].grade, v);
  });
});
