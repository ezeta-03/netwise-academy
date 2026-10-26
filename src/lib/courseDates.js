// Fecha de inicio de un curso ('YYYY-MM-DD') como texto: "Lunes 9 de noviembre".
// Se arma en UTC para que la zona horaria del visitante no la corra un día.
export const formatStartDate = (isoDate) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ''));
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const text = date.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).replace(',', '');
  return text.charAt(0).toUpperCase() + text.slice(1);
};
