// Tests de functions/assistantText.js (instrucciones y fuentes del Asistente IA).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GRADE_FORMULAS, gradeFormulaText, splitSources } from '../functions/assistantText.js';
import { GRADING_SCHEMES } from '../src/lib/gradingScheme.js';

describe('fórmula de la nota que recibe el asistente', () => {
  for (const id of [1, 2, 3, 4]) {
    test(`curso ${id}: mismos pesos que la plataforma`, () => {
      const platform = GRADING_SCHEMES[id].blocks.map((b) => [b.weight, b.moduleWeights || null]);
      const assistant = GRADE_FORMULAS[id].blocks.map(([, w, inner]) => [w, inner || null]);
      assert.deepEqual(assistant, platform);
    });
  }
  test('Branding: 70% módulos (17,5% cada uno) + 30% sustentación, y separa los requisitos', () => {
    const text = gradeFormulaText(2);
    assert.match(text, /70% módulos \(Módulo 1: 17,5%, Módulo 2: 17,5%, Módulo 3: 17,5%, Módulo 4: 17,5%\) \+ 30% sustentación final/);
    assert.match(text, /no pesos de la nota/);
  });
  test('curso sin fórmula: nada', () => assert.equal(gradeFormulaText(99), ''));
});

describe('splitSources', () => {
  const available = { syllabus: true, materials: ['Pirámide CBBE.pdf'], dates: false, company: false };
  test('quita el "Fuentes:" suelto y deja solo lo disponible', () => {
    const r = splitSources('Respuesta.\n\nFuentes:\n[[fuentes: Sílabo | Material: Sílabo del curso | Fechas de entrega | Tu empresa]]', available);
    assert.equal(r.text, 'Respuesta.');
    assert.deepEqual(r.sources, ['Sílabo']);
  });
  test('un material real se mantiene', () => {
    assert.deepEqual(splitSources('Ok [[fuentes: Material: Pirámide CBBE.pdf]]', available).sources, ['Material: Pirámide CBBE.pdf']);
  });
  test('sin marca, el texto queda igual', () => {
    assert.deepEqual(splitSources('Hola', available), { text: 'Hola', sources: [] });
  });
});
