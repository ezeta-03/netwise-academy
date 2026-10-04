// Qué se puede mostrar de una entrega dentro de la página (visor del docente,
// ver components/SubmissionViewer.jsx).
import { isSafeLink } from './placeholders.js';

const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const PDF_EXT = /\.pdf$/i;

// Nombre del archivo: el guardado en la entrega o, si falta, el de la URL.
const fileNameOf = (submission) => {
  if (submission?.fileName) return submission.fileName;
  try { return decodeURIComponent(new URL(submission.fileUrl).pathname.split('/').pop() || ''); } catch { return ''; }
};

// Un link de Google Drive/Docs se puede incrustar con su vista previa
// (requiere que el alumno lo haya compartido). Devuelve null si no aplica.
export const drivePreviewUrl = (link) => {
  const url = String(link || '').trim();
  const file = url.match(/^https:\/\/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (file) return `https://drive.google.com/file/d/${file[1]}/preview`;
  const doc = url.match(/^https:\/\/docs\.google\.com\/(document|presentation|spreadsheets)\/d\/([\w-]+)/);
  if (doc) return `https://docs.google.com/${doc[1]}/d/${doc[2]}/preview`;
  return null;
};

// Qué se puede mostrar de una entrega: { kind, src, name }.
// kind: 'pdf' | 'image' | 'embed' (vista previa de Drive) | 'file' (formato sin
// vista previa) | 'link' | 'text' | 'empty'.
export const describeSubmission = (submission) => {
  const note = String(submission?.note || '').trim();
  if (submission?.fileUrl && isSafeLink(submission.fileUrl)) {
    const name = fileNameOf(submission);
    const kind = PDF_EXT.test(name) ? 'pdf' : IMAGE_EXT.test(name) ? 'image' : 'file';
    return { kind, src: submission.fileUrl, name: name || 'Archivo adjunto' };
  }
  if (isSafeLink(note)) {
    const preview = drivePreviewUrl(note);
    return preview ? { kind: 'embed', src: preview, link: note, name: 'Documento compartido por enlace' } : { kind: 'link', link: note, name: 'Entrega por enlace' };
  }
  if (note) return { kind: 'text', text: note, name: 'Entrega escrita' };
  return { kind: 'empty', name: '' };
};
