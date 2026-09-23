import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// programDownloads.js importa los PDF (los resuelve Vite), así que no se puede
// cargar en Node: se valida su fuente y los archivos reales.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(root, 'src/lib/programDownloads.js'), 'utf8');
const dir = resolve(root, 'src/assets/NETWISE ACADEMY WEB/descargables');

describe('programDownloads', () => {
  const imports = [...src.matchAll(/^import (\w+) from '\.\.\/assets\/NETWISE ACADEMY WEB\/descargables\/([^']+)';/gm)];

  test('importa un PDF real y válido por cada curso', () => {
    assert.equal(imports.length, 4);
    for (const [, , file] of imports) {
      const p = resolve(dir, file);
      assert.ok(existsSync(p), `falta ${file}`);
      assert.equal(readFileSync(p).subarray(0, 5).toString(), '%PDF-', `${file} no es un PDF`);
    }
  });

  test('cada curso 1-4 apunta a su propio PDF, sin repetidos', () => {
    const map = src.match(/PROGRAM_PDFS = \{([^}]*)\}/)[1];
    const pairs = [...map.matchAll(/(\d+):\s*(\w+)/g)].map((m) => [Number(m[1]), m[2]]);
    assert.deepEqual(pairs.map((p) => p[0]), [1, 2, 3, 4]);
    assert.equal(new Set(pairs.map((p) => p[1])).size, 4);
    const byVar = Object.fromEntries(imports.map(([, v, f]) => [v, f]));
    assert.match(byVar[pairs[0][1]], /REDES/);
    assert.match(byVar[pairs[1][1]], /BRANDING/);
    assert.match(byVar[pairs[2][1]], /MARKETING/);
    assert.match(byVar[pairs[3][1]], /NEGOCIOS/);
  });

  test('usa Object.hasOwn para que un id inesperado no devuelva miembros del prototipo', () => {
    assert.match(src, /Object\.hasOwn\(PROGRAM_PDFS, courseId\)/);
  });

  test('el nombre de archivo se sanea', () => {
    const fn = new Function(`${src.match(/export const programFileName = .*/)[0].replace('export ', '')}; return programFileName;`)();
    assert.equal(fn({ title: 'Redes: Sociales/IA?' }), 'Programa - Redes SocialesIA.pdf');
    assert.equal(fn(null), 'Programa - Netwise Academy.pdf');
  });
});
