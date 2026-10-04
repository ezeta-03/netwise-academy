// Paginación de las tablas (ver hooks/usePagedTable.jsx). Lógica pura, sin React.
export const PAGE_SIZES = [10, 20, 50, 100];
export const DEFAULT_PAGE_SIZE = 10;

export const validPageSize = (value) => (PAGE_SIZES.includes(Number(value)) ? Number(value) : DEFAULT_PAGE_SIZE);

// Recorta `items` a la página pedida. Una página fuera de rango (p. ej. tras
// filtrar y quedar menos filas) cae en la última que existe.
export const paginate = (items, page, pageSize) => {
  const total = items.length;
  const size = validPageSize(pageSize);
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.floor(Number(page)) || 1), pageCount);
  const start = (current - 1) * size;
  const rows = items.slice(start, start + size);
  return { rows, total, pageCount, page: current, pageSize: size, from: total === 0 ? 0 : start + 1, to: start + rows.length };
};
