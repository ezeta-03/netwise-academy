import React, { useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, ExternalLink, Check } from 'lucide-react';
import SubmissionViewer from './SubmissionViewer';
import Switch from './Switch';
import { hasDelivered, submissionFiles, submissionLinks, submissionComment } from '../lib/workItems';

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' }) : '');

// Comentario del docente en tres partes (lo ve el alumno igual en Ver mi entrega).
const emptyParts = { good: '', improve: '', next: '' };
const partsOf = (sub) => {
  if (sub?.feedbackParts) return { ...emptyParts, ...sub.feedbackParts };
  return sub?.feedback ? { ...emptyParts, good: sub.feedback } : emptyParts;
};

// Calificar (D5): con todo a la vista lo que entregó el alumno (archivos y
// links, con sus versiones anteriores), la nota, el comentario y, en prácticas,
// el interruptor "Pasa a registro". Se puede calificar aunque no haya entregado.
const GradeReview = ({ student, index, total, sub, subtitle, graded = true, statusLabel, statusCls, onBack, onPrev, onNext, onSave, saving, inRecord, onToggleRecord }) => {
  const files = submissionFiles(sub);
  const links = submissionLinks(sub);
  const options = [...files.map((f) => ({ kind: 'file', ...f })), ...links.map((l) => ({ kind: 'link', url: l, name: l }))];
  const [shown, setShown] = useState(0);
  const [openVersion, setOpenVersion] = useState(null);
  // Una reentrega llega con la nota de la versión anterior: el formulario arranca vacío.
  const reviewed = sub?.status === 'reviewed';
  const [grade, setGrade] = useState(reviewed ? (sub?.grade ?? '') : '');
  const [parts, setParts] = useState(reviewed ? partsOf(sub) : emptyParts);
  const current = options[shown] || null;
  const viewerSub = current?.kind === 'file' ? { fileUrl: current.url, fileName: current.name } : current?.kind === 'link' ? { note: current.url } : (sub && !hasDelivered(sub) ? null : sub);
  const comment = submissionComment(sub);
  const delivered = hasDelivered(sub);

  return (
    <div>
      <div className="review-head">
        <div>
          <div className="review-student">
            <h2>{student.studentName}</h2>
            <span className="admin-status admin-status-gray">{index + 1} de {total}</span>
          </div>
          <p className="admin-page-sub">{subtitle}</p>
        </div>
        <div className="review-head-meta">
          <span className={`admin-status ${statusCls}`}>{statusLabel}</span>
          {delivered && <span className="admin-cell-sub">Entregado: {fmt(sub.submittedAt || sub.updatedAt)}</span>}
        </div>
      </div>
      <div className="review-nav">
        <button className="admin-btn-ghost" onClick={onBack}><ArrowLeft size={13} /> Volver a entregas</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="admin-icon-btn" aria-label="Anterior" disabled={!onPrev} onClick={onPrev}><ChevronLeft size={16} /></button>
          <button className="admin-icon-btn" aria-label="Siguiente" disabled={!onNext} onClick={onNext}><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="review-grid">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span className="admin-panel-title">{delivered ? (options.length > 1 ? `Entregó ${options.length} archivos y links` : 'Archivo entregado') : 'Sin entrega'}</span>
              <div className="admin-cell-sub">{current?.name || (delivered ? 'Entrega escrita' : 'El alumno no entregó. Igual puedes ponerle nota y comentario.')}</div>
            </div>
            {current?.kind === 'file' && <a className="admin-btn-ghost" href={current.url} target="_blank" rel="noreferrer" download={current.name}><Download size={13} /> Descargar</a>}
            {current?.kind === 'link' && <a className="admin-btn-ghost" href={current.url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Abrir enlace</a>}
          </div>
          {options.length > 1 && (
            <div className="review-files">
              {options.map((o, i) => <button key={o.url} className={`review-file-tab ${i === shown ? 'active' : ''}`} onClick={() => setShown(i)} title={o.name}>{o.kind === 'link' ? 'Link' : (o.name.split('.').pop() || '').toUpperCase()} · {o.name.length > 28 ? `${o.name.slice(0, 26)}…` : o.name}</button>)}
            </div>
          )}
          <SubmissionViewer key={`${student.uid}-${shown}-${sub?.updatedAt || ''}`} submission={viewerSub} />
          {comment && <p className="admin-cell-sub" style={{ margin: '12px 0 0' }}>Comentario del alumno: {comment}</p>}
          {(sub?.versions || []).map((v, i) => (
            <div key={i} className="entrega-version">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="admin-cell-sub">Versión {(sub.versions.length - i)} · {fmt(v.submittedAt)} · reemplazada</span>
                <button className="admin-panel-link" onClick={() => setOpenVersion(openVersion === i ? null : i)}>{openVersion === i ? 'Ocultar' : 'Ver'}</button>
              </div>
              {openVersion === i && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {(v.files || []).map((f) => <a key={f.url} className="admin-btn-ghost" href={f.url} target="_blank" rel="noreferrer">{f.name}</a>)}
                  {(v.links || []).map((l) => <a key={l} className="admin-btn-ghost" href={l} target="_blank" rel="noreferrer">Link</a>)}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="admin-panel review-grade-panel">
          {sub?.status === 'submitted' && sub?.grade != null && (
            <p className="admin-panel-caption" style={{ marginTop: 0 }}>Reentrega: la versión anterior tenía {sub.grade}/20. Califica la nueva versión.</p>
          )}
          {graded ? (
            <div className="admin-field">
              <label htmlFor="review-grade-input">Nota</label>
              <div className="review-grade">
                <input id="review-grade-input" type="number" inputMode="decimal" min="0" max="20" step="0.5" placeholder="—" value={grade} onChange={(e) => setGrade(e.target.value)} />
                <span>/ 20</span>
              </div>
            </div>
          ) : <p className="dash-notice" style={{ marginTop: 0 }}>Este entregable no lleva nota: deja tu retroalimentación y márcalo como revisado.</p>}
          <div className="admin-field"><label>Qué hizo bien</label><textarea rows={2} value={parts.good} onChange={(e) => setParts((p) => ({ ...p, good: e.target.value }))} /></div>
          <div className="admin-field"><label>Qué debe mejorar</label><textarea rows={2} value={parts.improve} onChange={(e) => setParts((p) => ({ ...p, improve: e.target.value }))} /></div>
          <div className="admin-field"><label>Su siguiente paso</label><textarea rows={2} value={parts.next} onChange={(e) => setParts((p) => ({ ...p, next: e.target.value }))} /></div>
          {onToggleRecord && (
            <div className="record-toggle">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Pasa a registro</strong>
                <Switch checked={!!inRecord} onChange={onToggleRecord} label="Pasa a registro" />
              </div>
              <span>{inRecord ? 'Encendido: la nota cuenta dentro de su módulo.' : 'Apagado: es una nota referencial. El alumno la ve, pero no suma a su nota final.'}</span>
            </div>
          )}
          <button className="admin-btn-edit" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onSave({ grade, parts })} disabled={saving}>
            <Check size={14} /> {saving ? 'Guardando...' : graded ? 'Guardar calificación' : 'Marcar como revisado'}
          </button>
          {onToggleRecord && <p className="admin-cell-sub" style={{ marginBottom: 0 }}>«Pasa a registro» vale para toda la práctica. También lo cambias desde «Prácticas y avances».</p>}
        </div>
      </div>
    </div>
  );
};

export default GradeReview;
