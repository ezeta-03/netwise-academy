import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { describeSubmission } from '../lib/submissionPreview';

// Visor de la entrega para el docente: muestra el PDF o la imagen dentro de la
// página; lo que el navegador no puede mostrar queda con un aviso y su botón.
const SubmissionViewer = ({ submission }) => {
  const info = describeSubmission(submission);

  if (info.kind === 'pdf' || info.kind === 'embed') {
    return (
      <div className="review-viewer">
        {/* PDF: ajustado al ancho y sin el panel de miniaturas del visor del navegador. */}
        <iframe src={info.kind === 'pdf' ? `${info.src}#navpanes=0&view=FitH` : info.src} title={`Entrega: ${info.name}`} loading="lazy" allow="fullscreen" />
      </div>
    );
  }
  if (info.kind === 'image') {
    return <div className="review-viewer review-viewer-image"><img src={info.src} alt={`Entrega: ${info.name}`} /></div>;
  }
  if (info.kind === 'text') {
    return <div className="review-viewer review-viewer-text"><p>{info.text}</p></div>;
  }

  const message = info.kind === 'file'
    ? { title: 'Este formato no se puede mostrar aquí', sub: 'Descárgalo para revisarlo (Word, PowerPoint, Excel o ZIP).' }
    : info.kind === 'link'
      ? { title: 'La entrega es un enlace externo', sub: 'Ábrelo en una pestaña nueva para revisarlo.' }
      : { title: 'Sin entrega', sub: 'Este alumno todavía no presenta su entrega.' };
  return (
    <div className="review-viewer review-viewer-empty">
      <FileText size={30} />
      <strong>{message.title}</strong>
      <span>{message.sub}</span>
      {info.kind === 'link' && <a className="admin-btn-ghost" href={info.link} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Abrir enlace</a>}
    </div>
  );
};

export default SubmissionViewer;
