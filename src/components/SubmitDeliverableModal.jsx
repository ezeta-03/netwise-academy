import React, { useRef, useState } from 'react';
import { Send, X, Paperclip, ExternalLink, Download } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { upsertSubmission, uploadSubmissionFile } from '../lib/db';
import { isSafeLink } from '../lib/placeholders';

// Mismos límites que storage.rules (match /submissions/{uid}/{fileName}).
export const SUBMISSION_MAX_MB = 10;
const ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.zip';
const ALLOWED_TYPES = /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\..+|application\/vnd\.ms-powerpoint|application\/vnd\.ms-excel|image\/(png|jpeg|webp)|application\/(x-)?zip(-compressed)?)$/;

// Entrega de un módulo: archivo (Storage) y/o link o descripción. Lo usan
// Alumno > Evaluación (entregables) y Alumno > Proyecto (avances).
const SubmitDeliverableModal = ({ course, module, onClose, onSaved, title, noteLabel, submitLabel, successMsg }) => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const pickFile = (e) => {
    const f = e.target.files?.[0] || null;
    e.target.value = '';
    if (!f) return;
    if (f.size > SUBMISSION_MAX_MB * 1024 * 1024) { addToast(`El archivo supera los ${SUBMISSION_MAX_MB} MB. Súbelo a Drive y pega el link.`, 'error'); return; }
    if (!ALLOWED_TYPES.test(f.type)) { addToast('Formato no permitido. Usa PDF, Word, PowerPoint, Excel, imagen o ZIP.', 'error'); return; }
    setFile(f);
  };

  const handleSave = async () => {
    if (!note.trim() && !file) { addToast('Adjunta un archivo, pega el link de tu entrega o describe tu trabajo.', 'error'); return; }
    setSaving(true);
    try {
      const uploaded = file
        ? { url: await uploadSubmissionFile(currentUser.uid, course.id, module.id, file), name: file.name }
        : null;
      await upsertSubmission({
        courseId: course.id, moduleId: module.id, moduleTitle: module.title,
        uid: currentUser.uid, studentName: currentUser.displayName || currentUser.email,
        deliverableTitle: module.deliverable?.description || module.title, status: 'submitted', note: note.trim(),
        file: uploaded,
      });
      addToast(successMsg, 'success');
      onSaved();
      onClose();
    } catch {
      addToast('No se pudo enviar tu entrega. Revisa tu conexión e intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="admin-modal-overlay" onClick={saving ? undefined : onClose}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head"><div className="admin-modal-title">{title}</div><button className="admin-modal-close" onClick={onClose} disabled={saving}><X size={18} /></button></div>
          <p className="admin-cell-sub" style={{ marginBottom: 12 }}>{module.deliverable?.description || module.title}</p>
          <div className="admin-field">
            <label>Archivo (opcional, hasta {SUBMISSION_MAX_MB} MB)</label>
            <input ref={inputRef} type="file" accept={ACCEPT} onChange={pickFile} hidden />
            {file ? (
              <div className="submission-file-chip">
                <Paperclip size={14} /><span>{file.name}</span>
                <button type="button" className="admin-modal-close" onClick={() => setFile(null)} disabled={saving} aria-label="Quitar archivo"><X size={14} /></button>
              </div>
            ) : (
              <button type="button" className="admin-btn-ghost" onClick={() => inputRef.current?.click()} style={{ alignSelf: 'flex-start' }}>
                <Paperclip size={13} /> Adjuntar archivo
              </button>
            )}
            <span className="admin-cell-sub">PDF, Word, PowerPoint, Excel, imagen o ZIP. Si pesa más, súbelo a Drive y pega el link abajo.</span>
          </div>
          <div className="admin-field"><label>{noteLabel}</label><textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="https://... o una breve descripción" /></div>
          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="admin-btn-edit" onClick={handleSave} disabled={saving}><Send size={13} /> {saving ? (file ? 'Subiendo archivo...' : 'Enviando...') : submitLabel}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

// Cómo se ve una entrega ya presentada (alumno y docente): archivo adjunto,
// link (si la nota es un link) o la descripción escrita.
export const SubmissionContent = ({ submission, primary = false, emptyText }) => {
  const note = submission?.note || '';
  const noteIsLink = isSafeLink(note);
  const btn = primary ? 'admin-btn-edit' : 'admin-btn-ghost';
  const hasFile = submission?.fileUrl && isSafeLink(submission.fileUrl);
  if (!hasFile && !note) return <p className="admin-cell-sub" style={{ marginBottom: 10 }}>{emptyText}</p>;
  return (
    <div className="submission-content">
      {hasFile && (
        <a className={btn} href={submission.fileUrl} target="_blank" rel="noreferrer" title={submission.fileName || ''}>
          <Download size={13} /> {submission.fileName ? `Descargar ${submission.fileName}` : 'Descargar archivo'}
        </a>
      )}
      {noteIsLink && <a className={hasFile ? 'admin-btn-ghost' : btn} href={note.trim()} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Abrir link de la entrega</a>}
      {note && !noteIsLink && <p className="admin-cell-sub" style={{ margin: 0 }}>{note}</p>}
    </div>
  );
};

export default SubmitDeliverableModal;
