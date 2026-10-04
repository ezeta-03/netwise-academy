// Tests de src/lib/permissions.js: funciones del panel docente por cuenta.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { can, resolvePermissions, allPermissions, TEACHER_PERMISSIONS } from '../src/lib/permissions.js';

describe('can', () => {
  test('un docente sin permisos guardados puede todo (cuentas anteriores)', () => {
    for (const { key } of TEACHER_PERMISSIONS) {
      assert.equal(can({ role: 'teacher' }, key), true);
      assert.equal(can({ role: 'teacher', permissions: null }, key), true);
      assert.equal(can({ role: 'teacher', permissions: {} }, key), true);
    }
  });
  test('solo se bloquea lo que el admin quitó explícitamente', () => {
    const user = { role: 'teacher', permissions: { grade: false, announce: true } };
    assert.equal(can(user, 'grade'), false);
    assert.equal(can(user, 'announce'), true);
    assert.equal(can(user, 'editContent'), true);
  });
  test('el admin siempre puede, aunque tenga permisos en false', () => {
    assert.equal(can({ role: 'admin', permissions: { grade: false } }, 'grade'), true);
  });
  test('sin usuario no se puede nada', () => {
    assert.equal(can(null, 'grade'), false);
    assert.equal(can(undefined, 'grade'), false);
  });
});

describe('resolvePermissions', () => {
  test('completa con true lo que falta y respeta lo guardado', () => {
    assert.deepEqual(resolvePermissions({ grade: false }), { ...allPermissions(), grade: false });
    assert.deepEqual(resolvePermissions(undefined), allPermissions());
  });
  test('hay exactamente las seis funciones del diseño', () => {
    assert.deepEqual(TEACHER_PERMISSIONS.map((p) => p.key), ['editContent', 'scheduleClasses', 'uploadMaterials', 'grade', 'announce', 'support']);
  });
});
