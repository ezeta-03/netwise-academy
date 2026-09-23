// Tests de src/lib/csv.js (buildCsv y downloadCsv con DOM/Blob simulados).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildCsv, downloadCsv } from '../src/lib/csv.js';

describe('buildCsv', () => {
  test('sin filas: solo cabecera', () => {
    assert.equal(buildCsv(['a', 'b'], []), 'a,b');
  });
  test('celdas simples', () => {
    assert.equal(buildCsv(['Estudiante', 'M1'], [['Ana', 18], ['Luis', 0]]), 'Estudiante,M1\nAna,18\nLuis,0');
  });
  test('null/undefined -> vacío; 0 y false se conservan', () => {
    assert.equal(buildCsv(['a', 'b', 'c', 'd'], [[null, undefined, 0, false]]), 'a,b,c,d\n,,0,false');
  });
  test('escapa comas, comillas y saltos de línea', () => {
    assert.equal(buildCsv(['x'], [['Motivo, verificado'], ['dijo "hola"'], ['a\nb']]), 'x\n"Motivo, verificado"\n"dijo ""hola"""\n"a\nb"');
  });
  test('escapa también la cabecera', () => {
    assert.equal(buildCsv(['Nota, sobre 20'], []), '"Nota, sobre 20"');
  });
  test('fila más corta/larga que la cabecera no se valida', () => {
    assert.equal(buildCsv(['a', 'b'], [[1], [1, 2, 3]]), 'a,b\n1\n1,2,3');
  });
  test('tildes y ñ pasan intactas (sin BOM: Excel en Windows las verá mal)', () => {
    const csv = buildCsv(['Miércoles'], [['Muñoz']]);
    assert.equal(csv, 'Miércoles\nMuñoz');
    assert.notEqual(csv.charCodeAt(0), 0xFEFF);
  });
  test('un "\r" dentro de una celda se entrecomilla', () => {
    assert.equal(buildCsv(['x'], [['a\rb'], ['a\r\nb']]), 'x\n"a\rb"\n"a\r\nb"');
  });
  test('celdas de texto que empiezan con = + - @ (fórmulas) llevan apóstrofo inicial', () => {
    assert.equal(buildCsv(['n'], [['=1+1'], ['+51 999'], ['-x'], ['@SUM(A1)']]), "n\n'=1+1\n'+51 999\n'-x\n'@SUM(A1)");
    assert.equal(buildCsv(['n'], [['=HYPERLINK("http://x","y")']]), 'n\n"\'=HYPERLINK(""http://x"",""y"")"');
  });
  test('el apóstrofo también se aplica a la cabecera', () => {
    assert.equal(buildCsv(['=x', 'ok'], []), "'=x,ok");
  });
  test('los números (typeof number), incluidos negativos, NO se prefijan; los strings numéricos con signo sí', () => {
    assert.equal(buildCsv(['n'], [[-5], [0], [15.5], [+3]]), 'n\n-5\n0\n15.5\n3');
    assert.equal(buildCsv(['n'], [['-5']]), "n\n'-5");
  });
  test('valores que sólo contienen el símbolo en medio no se tocan', () => {
    assert.equal(buildCsv(['n'], [['a=b'], ['juan@mail.com'], ['1-2']]), 'n\na=b\njuan@mail.com\n1-2');
  });
  test('una celda que empieza con tab o \r se prefija (y \r fuerza comillas)', () => {
    assert.equal(buildCsv(['n'], [['\tx']]), "n\n'\tx");
    assert.equal(buildCsv(['n'], [['\rx']]), 'n\n"\'\rx"');
  });
  test('arrays y objetos se serializan con String()', () => {
    assert.equal(buildCsv(['x'], [[[1, 2]]]), 'x\n"1,2"');
    assert.equal(buildCsv(['x'], [[{}]]), 'x\n[object Object]');
  });
});

describe('downloadCsv', () => {
  test('el archivo empieza con BOM UTF-8 (EF BB BF), tiene el CSV y nombre/enlace correctos', async () => {
    let blob; let clicked = false; let revoked = null; const anchor = { click() { clicked = true; } };
    const realCreate = URL.createObjectURL; const realRevoke = URL.revokeObjectURL;
    URL.createObjectURL = (b) => { blob = b; return 'blob:fake'; };
    URL.revokeObjectURL = (u) => { revoked = u; };
    globalThis.document = { createElement: () => anchor };
    try {
      downloadCsv('notas.csv', ['Estudiante', 'Nota'], [['Muñoz', 15]]);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      assert.deepEqual([...bytes.slice(0, 3)], [0xEF, 0xBB, 0xBF]);
      assert.equal(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes), '\uFEFFEstudiante,Nota\nMuñoz,15');
      assert.equal(blob.type, 'text/csv;charset=utf-8;');
      assert.equal(anchor.download, 'notas.csv');
      assert.equal(anchor.href, 'blob:fake');
      assert.equal(clicked, true);
      assert.equal(revoked, 'blob:fake');
    } finally {
      URL.createObjectURL = realCreate; URL.revokeObjectURL = realRevoke; delete globalThis.document;
    }
  });
});
