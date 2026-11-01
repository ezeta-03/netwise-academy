import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupIdsOf, meetLinkFor, isMeetLink } from '../src/lib/classLinks.js';

const MEET = 'https://meet.google.com/nzv-wikv-grn';

describe('enlace de Meet de cada clase', () => {
  test('la clase usa la sala de su aula', () => {
    assert.equal(meetLinkFor({ id: 's1', groupId: 'g1' }, { g1: MEET }), MEET);
  });
  test('sin aula, sin enlace o con enlace no https: null (queda el botón Ver sala)', () => {
    assert.equal(meetLinkFor({ id: 's1' }, { g1: MEET }), null);
    assert.equal(meetLinkFor({ id: 's1', groupId: 'g2' }, { g1: MEET }), null);
    assert.equal(meetLinkFor({ id: 's1', groupId: 'g1' }, { g1: 'javascript:alert(1)' }), null);
    assert.equal(meetLinkFor({ id: 's1', groupId: 'g1' }, { g1: null }), null);
    assert.equal(isMeetLink('http://meet.google.com/x'), false);
  });
  test('cada aula se pide una sola vez', () => {
    assert.deepEqual(groupIdsOf([{ groupId: 'g1' }, { groupId: 'g1' }, { groupId: 'g2' }, {}]), ['g1', 'g2']);
    assert.deepEqual(groupIdsOf(undefined), []);
  });
});

describe('pantallas con el botón directo a Meet', () => {
  // Inicio, Agenda y Clases en vivo usan la tarjeta de clase (C1) y su botón.
  for (const file of ['src/pages/student/StudentInicio.jsx', 'src/pages/teacher/TeacherInicio.jsx']) {
    test(file, () => {
      const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      assert.match(src, /useClassLinks\(sessions\)/);
      assert.match(src, /<ClassCard/);
      assert.match(src, /meetLink=\{meetLinkFor\(/);
    });
  }
  test('la Agenda pasa el Meet de cada clase a su fila', () => {
    const src = readFileSync(new URL('../src/components/ClassAgenda.jsx', import.meta.url), 'utf8');
    assert.match(src, /<MeetButton session=\{s\} meetLink=\{meetLinkFor\(s, classLinks\)\}/);
  });
  test('el botón abre Meet en otra pestaña', () => {
    const src = readFileSync(new URL('../src/components/ClassCard.jsx', import.meta.url), 'utf8');
    assert.match(src, /href=\{meetLink\} target="_blank" rel="noreferrer"/);
    assert.match(src, /Entrar a Meet/);
    assert.match(src, /Iniciar clase en Meet/);
  });
  for (const file of ['src/pages/admin/AdminGrupos.jsx']) {
    test(file, () => {
      const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      assert.match(src, /useClassLinks\(sessions\)/);
      assert.match(src, /Entrar a Meet/);
      assert.match(src, /target="_blank" rel="noreferrer"/);
    });
  }
});
