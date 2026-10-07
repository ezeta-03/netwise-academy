// Tests de src/lib/institutionalEmail.js: dirección propuesta para el correo institucional.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { suggestLocalPart, isValidLocalPart } from '../src/lib/institutionalEmail.js';

describe('suggestLocalPart', () => {
  test('nombre y apellido', () => {
    assert.equal(suggestLocalPart('Sergio Zenteno'), 'sergio.zenteno');
  });
  test('quita tildes, eñes y mayúsculas', () => {
    assert.equal(suggestLocalPart('José Núñez'), 'jose.nunez');
    assert.equal(suggestLocalPart('  MARÍA   Peña '), 'maria.pena');
  });
  test('nombre + dos apellidos usa el primer apellido', () => {
    assert.equal(suggestLocalPart('Valeria Torres Quispe'), 'valeria.torres');
  });
  test('dos nombres + dos apellidos usa el primer apellido', () => {
    assert.equal(suggestLocalPart('Juan Carlos Pérez Gómez'), 'juan.perez');
  });
  test('ignora partículas del apellido', () => {
    assert.equal(suggestLocalPart('María de la Cruz'), 'maria.cruz');
    assert.equal(suggestLocalPart('Ana del Río Soto'), 'ana.rio');
  });
  test('una sola palabra o vacío', () => {
    assert.equal(suggestLocalPart('Sergio'), 'sergio');
    assert.equal(suggestLocalPart(''), '');
    assert.equal(suggestLocalPart(null), '');
  });
  test('descarta símbolos (p. ej. un correo usado como nombre)', () => {
    assert.equal(suggestLocalPart('ana.soto@gmail.com'), 'ana.soto');
  });
  test('lo propuesto siempre es una dirección válida', () => {
    for (const name of ['Sergio Zenteno', 'José Núñez', 'María de la Cruz', 'O’Brien Lee']) {
      assert.ok(isValidLocalPart(suggestLocalPart(name)), name);
    }
  });
});

describe('isValidLocalPart', () => {
  test('acepta letras, números y separadores intermedios', () => {
    for (const ok of ['sergio.zenteno', 'ana2', 'juan-carlos.perez', 'a_b']) assert.ok(isValidLocalPart(ok), ok);
  });
  test('rechaza mayúsculas, espacios, tildes, arrobas y separadores sueltos', () => {
    for (const bad of ['', null, 'Sergio', 'ana soto', 'josé', 'ana@x', '.ana', 'ana.', 'ana..soto', 'a'.repeat(61)]) {
      assert.ok(!isValidLocalPart(bad), String(bad));
    }
  });
});
