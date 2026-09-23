import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RUBRIC_TEMPLATES, getRubricTemplate } from '../src/lib/rubricTemplates.js';
import { GRADING_SCHEMES, getGradingModel } from '../src/lib/gradingScheme.js';

describe('rubricTemplates', () => {
  for (const [courseId, tpl] of Object.entries(RUBRIC_TEMPLATES)) {
    test(`curso ${courseId}: 4 criterios completos, máximo 20 puntos, sin pesos propios (viven en gradingScheme)`, () => {
      assert.equal(tpl.criteria.length, 4);
      const ids = new Set(tpl.criteria.map((c) => c.id));
      assert.equal(ids.size, 4, 'ids únicos');
      for (const c of tpl.criteria) {
        assert.ok(c.title.trim());
        for (const key of ['destacado', 'logrado', 'enProceso', 'inicial']) {
          assert.ok(c.levels[key].desc.trim(), `${c.title} / ${key} sin descripción`);
        }
        assert.deepEqual(['5', '4', '3', '0-2'], [c.levels.destacado.points, c.levels.logrado.points, c.levels.enProceso.points, c.levels.inicial.points]);
      }
      const total = tpl.criteria.reduce((s, c) => s + parseInt(c.levels.destacado.points, 10), 0);
      assert.equal(total, 20);
      assert.equal('weights' in tpl, false, 'los pesos ya no viven en la plantilla de rúbrica');
    });
  }

  test('getRubricTemplate acepta el id como número o texto y devuelve null si no hay plantilla', () => {
    assert.equal(getRubricTemplate(1), RUBRIC_TEMPLATES[1]);
    assert.equal(getRubricTemplate('2'), RUBRIC_TEMPLATES[2]);
    assert.equal(getRubricTemplate(3), null);
    assert.equal(getRubricTemplate(undefined), null);
  });

  test('cada plantilla de rúbrica corresponde a un curso con esquema de calificación que suma 100', () => {
    for (const id of Object.keys(RUBRIC_TEMPLATES)) {
      assert.ok(GRADING_SCHEMES[id], `curso ${id} sin esquema`);
      const mods = Array.from({ length: 4 }, (_, i) => ({ id: `m${i}`, deliverable: { description: 'x' } }));
      assert.equal(getGradingModel(id, mods).total, 100);
    }
  });

  test('las claves heredadas de Object.prototype no son plantillas', () => {
    assert.equal(getRubricTemplate('constructor'), null);
    assert.equal(getRubricTemplate('toString'), null);
  });
});
