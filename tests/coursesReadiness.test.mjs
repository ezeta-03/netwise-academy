import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GRADING_SCHEMES, getGradingModel, buildStudentRows } from '../src/lib/gradingScheme.js';
import { getApprovalPolicy } from '../src/lib/approvalPolicy.js';
import { getRubricTemplate } from '../src/lib/rubricTemplates.js';
import { computeGradeSummary } from '../src/lib/gradebook.js';
import { evaluateApproval } from '../src/lib/approval.js';

// Marketing (3) y Negocios (4) todavía no se lanzan: su información real (rúbrica,
// requisitos, acreditaciones, pesos definitivos) llega después. Estos tests fijan lo
// que YA funciona para ellos y lo que falta, para que sumar esa información sea
// completar datos y no tocar lógica.
const mods = (n) => Array.from({ length: n }, (_, i) => ({ id: `m${i + 1}`, title: `T${i + 1}`, deliverable: { description: 'x' } }));
const rev = (moduleId, grade) => ({ moduleId, status: 'reviewed', grade });

describe('cursos por lanzar: Marketing (3) y Negocios (4)', () => {
  for (const id of [3, 4]) {
    test(`curso ${id}: esquema de notas completo (suma 100, bloque de módulos + componentes manuales)`, () => {
      const model = getGradingModel(id, mods(4));
      assert.equal(model.hasScheme, true);
      assert.equal(model.total, 100);
      assert.ok(model.components.some((c) => c.kind === 'manual'));
      assert.equal(model.moduleCountMismatch, null);
    });

    test(`curso ${id}: el flujo completo de notas llega a un veredicto`, () => {
      const model = getGradingModel(id, mods(4));
      const manual = Object.fromEntries(model.components.filter((c) => c.kind === 'manual').map((c) => [c.key, 18]));
      const subs = mods(4).map((m) => rev(m.id, 18));
      const partial = computeGradeSummary(buildStudentRows(model, subs, {}));
      assert.equal(partial.allGraded, false); // faltan los componentes manuales
      const full = computeGradeSummary(buildStudentRows(model, subs, manual));
      assert.equal(full.promedioParcial, 18);
      assert.equal(evaluateApproval(full, null).overall, 'regular');
    });

    test(`curso ${id}: aún sin rúbrica estándar ni política de aprobación (a la espera de coordinación)`, () => {
      assert.equal(getRubricTemplate(id), null);
      assert.equal(getApprovalPolicy(id), null);
    });
  }

  test('el Cronograma avisa que falta la información cuando no hay política', () => {
    const src = readFileSync(new URL('../src/pages/teacher/TeacherCourseCronograma.jsx', import.meta.url), 'utf8');
    assert.match(src, /todavía no tiene cargados los requisitos de aprobación/);
  });

  test('todo curso con esquema tiene su PDF de programa', () => {
    const src = readFileSync(new URL('../src/lib/programDownloads.js', import.meta.url), 'utf8');
    const ids = [...src.match(/PROGRAM_PDFS = \{([^}]*)\}/)[1].matchAll(/(\d+):/g)].map((m) => Number(m[1]));
    for (const id of Object.keys(GRADING_SCHEMES)) assert.ok(ids.includes(Number(id)), `curso ${id} sin PDF`);
  });
});
