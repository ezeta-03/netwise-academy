// Banner del campus (A7 / C3): una imagen con link arriba del Inicio del
// estudiante, igual para todos y sin botón de cerrar. Hay uno solo activo a la
// vez: un banner programado reemplaza al activo en su fecha de inicio y se
// quita solo en su fecha de fin (o antes, si el admin lo quita).

export const bannerState = (b, now = Date.now()) => {
  if (b.removedAt) return 'removed';
  const start = new Date(b.startsAt).getTime();
  const end = new Date(b.endsAt).getTime();
  if (now < start) return 'scheduled';
  if (now >= end) return 'ended';
  return 'active';
};

// El activo es el que empezó más recientemente entre los vigentes.
export const activeBanner = (banners, now = Date.now()) => (banners || [])
  .filter((b) => bannerState(b, now) === 'active')
  .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt))[0] || null;

export const isExternalLink = (link) => /^https?:\/\//i.test(link || '') && !/^https?:\/\/(www\.)?netwiseacademy\.pe(\/|$)/i.test(link || '');

// Qué falta para poder programar (dos imágenes, título, link y fechas).
export const bannerMissing = ({ desktopImage, mobileImage, title, link, startsAt, endsAt }) => {
  if (!desktopImage) return 'Falta la imagen para escritorio';
  if (!mobileImage) return 'Falta la imagen para celular';
  if (!String(title || '').trim()) return 'Escribe el título para la campana';
  if (!/^(https?:\/\/|\/)/.test(String(link || '').trim())) return 'Pega el link (https://... o una ruta como /student/agenda)';
  if (!startsAt || !endsAt) return 'Elige las fechas de inicio y fin';
  if (new Date(endsAt) <= new Date(startsAt)) return 'La fecha de fin debe ser después del inicio';
  return '';
};
