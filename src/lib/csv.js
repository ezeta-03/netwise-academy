// Arma un CSV escapando cada celda -- sin esto, cualquier texto libre que el
// admin escribe (ej. "Motivo" de una matrícula, "Motivo, verificado por
// WhatsApp") corre las columnas del archivo exportado porque la coma se
// interpreta como separador.
//
// Las celdas que empiezan con = + - @ se prefijan con una comilla: Excel las
// interpretaría como fórmulas (un nombre de alumno como "=HYPERLINK(...)").
// Los números negativos legítimos (tipo number) no se tocan.
const escapeCsvCell = (value) => {
  let str = String(value ?? '');
  if (typeof value !== 'number' && /^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

export const buildCsv = (header, rows) => {
  const lines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return [header.map(escapeCsvCell).join(','), ...lines].join('\n');
};

// El BOM al inicio hace que Excel abra el archivo como UTF-8 (tildes y ñ).
export const downloadCsv = (filename, header, rows) => {
  const csv = buildCsv(header, rows);
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
