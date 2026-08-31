// Convierte un link normal de YouTube/Vimeo (el que el docente copia y pega
// desde la barra del navegador) al formato embebible que necesita un
// <iframe>. Si no reconoce el patrón, devuelve el link tal cual -- así
// funciona también con URLs que ya vienen listas para embeber (Loom, etc.)
export const toEmbedUrl = (url) => {
  if (!url) return '';
  const trimmed = url.trim();

  const youtube = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;

  const vimeo = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;

  return trimmed;
};
