// Programas descargables (PDF) de cada taller: el visitante los recibe en
// /course/:id después de dejar su contacto (ver DownloadProgramModal).
// id de curso -> PDF real de coordinación.
import redes from '../assets/NETWISE ACADEMY WEB/descargables/ESTRATEGIAS DE REDES SOCIALES_1.pdf';
import branding from '../assets/NETWISE ACADEMY WEB/descargables/BRANDING Y GESTION DE MARCA_1.pdf';
import marketing from '../assets/NETWISE ACADEMY WEB/descargables/MARKETING DIGITAL APLICADO_1.pdf';
import negocios from '../assets/NETWISE ACADEMY WEB/descargables/CREACION NEGOCIOS DIGITALES.pdf';

export const PROGRAM_PDFS = { 1: redes, 2: branding, 3: marketing, 4: negocios };

// Object.hasOwn: un id inesperado ('constructor'...) no debe devolver nada.
export const getProgramPdf = (courseId) => (Object.hasOwn(PROGRAM_PDFS, courseId) ? PROGRAM_PDFS[courseId] : null);

// Nombre con el que se guarda el archivo, sin caracteres que un sistema de
// archivos no acepte.
export const programFileName = (course) => `Programa - ${String(course?.title || 'Netwise Academy').replace(/[\\/:*?"<>|]/g, '')}.pdf`;

// Dispara la descarga del PDF del curso. Devuelve false si el curso no tiene PDF
// (el llamador puede caer a otra alternativa).
export const downloadProgramPdf = (course) => {
  const url = getProgramPdf(course?.id);
  if (!url) return false;
  const a = document.createElement('a');
  a.href = url;
  a.download = programFileName(course);
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
};
