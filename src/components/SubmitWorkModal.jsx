import React, { useRef, useState } from 'react';
import { Send, X, Link2, FileText } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { upsertSubmission, uploadSubmissionFile } from '../lib/db';
import { isSafeLink } from '../lib/placeholders';
import { KIND_LABEL, dueLongLabel, daysLeft, hasDelivered, submissionFiles, submissionLinks, submissionComment } from '../lib/workItems';

// Mismos límites que storage.rules (match /submissions/{uid}/{fileName}).
export const SUBMISSION_MAX_MB = 50;
const ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.zip';
const ALLOWED_TYPES = /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\..+|application\/vnd\.ms-powerpoint|application\/vnd\.ms-excel|image\/(png|jpeg|webp)|application\/(x-)?zip(-compressed)?)$/;

const fmtSize = (bytes) => (bytes ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : '');
const extOf = (name) => (String(name).split('.').pop() || '').slice(0, 4).toUpperCase();


// Entregar (E6): un solo formulario para la entrega del módulo y para las
// prácticas, desde Mi proyecto y Mis entregas. Varios archivos, links aparte y
// un comentario. Al reemplazar, la versión anterior queda en el historial y el
// docente califica la última.
const SubmitWorkModal = ({ course, item, existing = null, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const delivered = hasDelivered(existing);
  // Arranca con lo que ya entregó: así puede quitar o sumar archivos sin volver a subirlos.
  const [files, setFiles] = useState(() => (delivered ? submissionFiles(existing) : []));
  const [links, setLinks] = useState(() => (delivered ? submissionLinks(existing) : []));
  const [linkDraft, setLinkDraft] = useState('');
  const [comment, setComment] = useState(() => (delivered ? submissionComment(existing) : ''));
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const days = daysLeft(item.dueDate);
  const replacingClosed = delivered && days !== null && days < 0;

  const addFiles = (list) => {
    const accepted = [];
    [...(list || [])].forEach((f) => {
      if (!ALLOWED_TYPES.test(f.type)) { addToast(`"${f.name}" no es un tipo aceptado. Súbelo a Drive y pega el link.`, 'error'); return; }
      if (f.size > SUBMISSION_MAX_MB * 1024 * 1024) { addToast(`"${f.name}" pesa más de ${SUBMISSION_MAX_MB} MB. Súbelo a Drive y pega el link.`, 'error'); return; }
      accepted.push({ file: f, name: f.name, size: f.size });
    });
    if (accepted.length) setFiles((prev) => [...prev, ...accepted]);
  };

  const addLink = () => {
    const clean = linkDraft.trim();
    if (!clean) return;
    if (!isSafeLink(clean)) { addToast('Pega un link completo que empiece con https://', 'error'); return; }
    setLinks((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
    setLinkDraft('');
  };

  const canSend = (files.length > 0 || links.length > 0 || isSafeLink(linkDraft.trim())) && !replacingClosed;

  const handleSave = async () => {
    const finalLinks = isSafeLink(linkDraft.trim()) && !links.includes(linkDraft.trim()) ? [...links, linkDraft.trim()] : links;
    setSaving(true);
    try {
      const uploaded = await Promise.all(files.map(async (f) => (f.file
        ? { url: await uploadSubmissionFile(currentUser.uid, course.id, item.submissionModuleId, f.file), name: f.name, size: f.size }
        : { url: f.url, name: f.name, size: f.size || null })));
      const previous = delivered ? [{
        files: submissionFiles(existing), links: submissionLinks(existing), comment: submissionComment(existing),
        submittedAt: existing.submittedAt || existing.updatedAt || null,
      }, ...(existing.versions || [])] : (existing?.versions || []);
      await upsertSubmission({
        courseId: course.id, moduleId: item.submissionModuleId, moduleTitle: item.moduleTitle || item.title,
        uid: currentUser.uid, studentName: currentUser.displayName || currentUser.email,
        deliverableTitle: item.title, status: 'submitted',
        // Campos antiguos (un archivo y `note`) para las pantallas que aún los leen.
        file: uploaded[0] ? { url: uploaded[0].url, name: uploaded[0].name } : null,
        note: finalLinks[0] || comment.trim(),
        extra: {
          kind: item.kind, files: uploaded, links: finalLinks, comment: comment.trim(), versions: previous.slice(0, 10),
          ...(item.kind === 'practice' ? { practiceId: item.practiceId, parentModuleId: item.moduleId || null } : {}),
        },
      });
      addToast('Entrega enviada. Tu docente la verá en "Por revisar".', 'success');
      onSaved?.();
      onClose();
    } catch {
      addToast('No se pudo enviar tu entrega. Revisa tu conexión e intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="admin-modal-overlay" onClick={() => !saving && onClose()}>
        <div className="admin-modal submit-work-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head">
            <span className={`admin-status ${item.kind === 'practice' ? 'admin-status-gray' : 'admin-status-violet'}`}>{KIND_LABEL[item.kind]}</span>
            <button className="admin-modal-close" onClick={onClose} disabled={saving} aria-label="Cerrar"><X size={18} /></button>
          </div>
          <h2 className="submit-work-title">{item.title}</h2>
          <p className="admin-cell-sub" style={{ marginTop: 0 }}>{course.title}{item.dueAt ? ` · ${dueLongLabel(item.dueAt)}` : ''}</p>

          {existing?.status === 'reviewed' && delivered && (
            <div className="checkout-error" role="alert" style={{ marginBottom: 12 }}>
              Esta entrega ya está calificada ({existing.grade ?? '—'}/20). Si la reemplazas, tu docente calificará la nueva versión.
            </div>
          )}
          {replacingClosed && <p className="dash-notice warn" style={{ marginTop: 0 }}>La fecha límite ya pasó: ya no puedes reemplazar esta entrega.</p>}

          {item.instructions && (
            <div className="submit-work-block">
              <div className="submit-work-label">Indicaciones</div>
              <p className="submit-work-text">{item.instructions}</p>
            </div>
          )}

          <div className="submit-work-block">
            <div className="submit-work-label">Archivos</div>
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="submit-work-file">
                <span className="submit-work-ext">{extOf(f.name) || <FileText size={12} />}</span>
                <div style={{ minWidth: 0, flex: 1 }}><div className="submit-work-file-name">{f.name}</div>{f.size ? <div className="admin-cell-sub">{fmtSize(f.size)}</div> : null}</div>
                <button type="button" className="admin-panel-link" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} disabled={saving}>Quitar</button>
              </div>
            ))}
            <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            <div
              className={`submit-work-drop ${dragOver ? 'dragover' : ''}`} role="button" tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            >
              <strong>Arrastra tus archivos aquí o elígelos desde tu equipo</strong>
              <span>PDF, Word, PowerPoint, Excel, imágenes o ZIP · hasta {SUBMISSION_MAX_MB} MB cada uno</span>
            </div>
          </div>

          <div className="submit-work-block">
            <div className="submit-work-label">Links</div>
            {links.map((l) => (
              <div key={l} className="submit-work-file">
                <span className="submit-work-ext"><Link2 size={12} /></span>
                <a className="submit-work-file-name" href={l} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 0 }}>{l}</a>
                <button type="button" className="admin-panel-link" onClick={() => setLinks((prev) => prev.filter((x) => x !== l))} disabled={saving}>Quitar</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="admin-input" style={{ flex: 1 }} value={linkDraft} onChange={(e) => setLinkDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} placeholder="Pega un link de Drive, Figma o Canva" />
              <button type="button" className="admin-btn-ghost" onClick={addLink}>Agregar</button>
            </div>
            <p className="admin-cell-sub" style={{ margin: '6px 0 0' }}>¿No puedes subir tu archivo? Súbelo a Drive y pega el link aquí.</p>
          </div>

          <div className="submit-work-block">
            <div className="submit-work-label">Comentario para tu docente (opcional)</div>
            <textarea className="admin-input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Por ejemplo, qué parte te gustaría que revise." />
          </div>

          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="admin-btn-edit" onClick={handleSave} disabled={saving || !canSend} title={!canSend && !replacingClosed ? 'Adjunta al menos un archivo o un link' : undefined}>
              <Send size={13} /> {saving ? 'Enviando...' : delivered ? 'Reemplazar entrega' : 'Enviar entrega'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default SubmitWorkModal;
