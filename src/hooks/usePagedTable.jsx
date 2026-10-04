import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZES, DEFAULT_PAGE_SIZE, paginate, validPageSize } from '../lib/pagination';

const STORAGE_KEY = 'nw_page_size';
const readSize = () => {
  try { return validPageSize(localStorage.getItem(STORAGE_KEY)); } catch { return DEFAULT_PAGE_SIZE; }
};

// Paginación de una tabla o lista. Devuelve:
//  - `rows`: las filas de la página actual (lo que hay que pintar);
//  - `pager`: la barra "Filas por página · 1–10 de 397 · ‹ ›" (null si todo
//    cabe en la página más chica);
//  - `tableRef`: ponlo en el <table> junto a la clase `table-cards` para que en
//    el teléfono cada fila se vea como tarjeta: copia el título de cada columna
//    a `data-label` de sus celdas, que es lo que muestra el CSS.
// Al cambiar la cantidad de filas (buscar, filtrar) vuelve a la página 1. El
// tamaño elegido se recuerda en este navegador.
export const usePagedTable = (items, { label = 'registros' } = {}) => {
  const list = items || [];
  const [pageSize, setPageSize] = useState(readSize);
  const [state, setState] = useState({ page: 1, count: list.length });
  const tableRef = useRef(null);

  const { rows, total, pageCount, page, from, to } = paginate(list, state.count === list.length ? state.page : 1, pageSize);
  const goTo = (next) => setState({ page: next, count: list.length });

  const changeSize = (value) => {
    const size = validPageSize(value);
    setPageSize(size);
    goTo(1);
    try { localStorage.setItem(STORAGE_KEY, String(size)); } catch { /* sin almacenamiento: solo no se recuerda */ }
  };

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const heads = [...table.querySelectorAll('thead tr:last-child th')].map((th) => th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach((tr) => {
      [...tr.children].forEach((td, i) => {
        if (td.colSpan > 1 || !heads[i]) td.removeAttribute('data-label');
        else td.setAttribute('data-label', heads[i]);
      });
    });
  });

  const pager = total <= PAGE_SIZES[0] ? null : (
    <div className="table-pager">
      <label className="table-pager-size">
        <span>Filas por página</span>
        <select value={pageSize} onChange={(e) => changeSize(e.target.value)} aria-label="Filas por página">
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <span className="table-pager-range" role="status">{from}–{to} de {total} {label}</span>
      <div className="table-pager-nav">
        <button type="button" className="admin-icon-btn" aria-label="Página anterior" disabled={page <= 1} onClick={() => goTo(page - 1)}><ChevronLeft size={16} /></button>
        <span>Página {page} de {pageCount}</span>
        <button type="button" className="admin-icon-btn" aria-label="Página siguiente" disabled={page >= pageCount} onClick={() => goTo(page + 1)}><ChevronRight size={16} /></button>
      </div>
    </div>
  );

  return { rows, pager, tableRef, page, pageCount, total };
};
