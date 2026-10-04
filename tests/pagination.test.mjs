// Tests de src/lib/pagination.js: el recorte por página de las tablas.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { paginate, validPageSize, PAGE_SIZES } from '../src/lib/pagination.js';

const items = Array.from({ length: 397 }, (_, i) => i + 1);

describe('paginate', () => {
  test('los tamaños son 10, 20, 50 y 100', () => {
    assert.deepEqual(PAGE_SIZES, [10, 20, 50, 100]);
  });
  test('primera página', () => {
    const p = paginate(items, 1, 10);
    assert.deepEqual(p.rows, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.deepEqual([p.from, p.to, p.total, p.pageCount], [1, 10, 397, 40]);
  });
  test('la última página trae solo lo que queda', () => {
    const p = paginate(items, 4, 100);
    assert.equal(p.rows.length, 97);
    assert.deepEqual([p.from, p.to, p.pageCount], [301, 397, 4]);
  });
  test('una página fuera de rango cae en la última; una menor que 1, en la primera', () => {
    assert.equal(paginate(items, 99, 50).page, 8);
    assert.equal(paginate(items, 0, 50).page, 1);
    assert.equal(paginate(items, 'x', 50).page, 1);
  });
  test('lista vacía: una sola página, 0 de 0', () => {
    const p = paginate([], 3, 20);
    assert.deepEqual([p.rows.length, p.page, p.pageCount, p.from, p.to], [0, 1, 1, 0, 0]);
  });
  test('recorriendo todas las páginas no se pierde ni se repite ninguna fila', () => {
    for (const size of PAGE_SIZES) {
      const seen = [];
      const { pageCount } = paginate(items, 1, size);
      for (let page = 1; page <= pageCount; page += 1) seen.push(...paginate(items, page, size).rows);
      assert.deepEqual(seen, items);
    }
  });
  test('un tamaño que no es de la lista vuelve a 10', () => {
    assert.equal(validPageSize('50'), 50);
    assert.equal(validPageSize(33), 10);
    assert.equal(validPageSize(null), 10);
    assert.equal(paginate(items, 1, 7).rows.length, 10);
  });
});
