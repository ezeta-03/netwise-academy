import React, { useRef, useState } from 'react';
import { X, Check } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { useUI } from '../context/UIContext';
import { saveCourseSyllabus } from '../lib/db';
import { extractPdfText } from '../lib/pdfText';

// Sílabo del curso (A8): el mismo PDF alimenta "Descargar programa del curso"
// de la web y el Asistente IA de todas las aulas del curso.
const SyllabusModal = ({ course, onClose, onSaved }) => {
  const { addToast } = useUI();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const current = course.syllabus;

  const pick = (f) => {
    if (!f) return;
    if (f.type !== 'application/pdf') { addToast('El sílabo debe ser un PDF.', 'error'); return; }
    if (f.size > 10 * 1024 * 1024) { addToast('El PDF pesa más de 10 MB.', 'error'); return; }
    setFile(f);
  };

  const save = async () => {
    setSaving(true);
    try {
      // El texto se saca aquí mismo para que el asistente pueda leerlo.
      const { text, pages } = await extractPdfText(file).catch(() => ({ text: '', pages: null }));
      if (!text.trim()) addToast('Guardamos el PDF, pero no pudimos leer su texto (¿es un escaneo?). El asistente no podrá usarlo.', 'warning');
      await saveCourseSyllabus({ courseId: course.id, courseTitle: course.title, file, text, pages });
      addToast(`Sílabo de "${course.title}" guardado. La web y el asistente ya usan el nuevo.`, 'success');
      onSaved?.();
      onClose();
    } catch {
      addToast('No se pudo guardar el sílabo. Intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const used = !!current || !!file;
  return (
    <ModalPortal>
      <div className="admin-modal-overlay" onClick={() => !saving && onClose()}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head">
            <div><div className="admin-modal-title">Sílabo del curso</div><div className="admin-modal-sub">{course.title}</div></div>
            <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
          </div>
          <p className="admin-cell-sub" style={{ marginTop: 0 }}>La página del curso y el Asistente IA usan este PDF.</p>
          <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          {file || current ? (
            <div className="submit-work-file" style={{ background: '#F8F7FB' }}>
              <span className="submit-work-ext">PDF</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="submit-work-file-name">{file ? file.name : current.name}</div>
                <div className="admin-cell-sub">{file ? 'Listo para guardar' : `Subido el ${new Date(current.uploadedAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}${current.chars === 0 ? ' · sin texto legible' : ''}`}</div>
              </div>
              {!file && <a className="admin-btn-ghost" href={current.url} target="_blank" rel="noreferrer">Ver</a>}
              <button className="admin-btn-ghost" onClick={() => inputRef.current?.click()}>{file ? 'Cambiar' : 'Reemplazar'}</button>
            </div>
          ) : (
            <div className={`submit-work-drop ${dragOver ? 'dragover' : ''}`} role="button" tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files?.[0]); }}>
              <span>Arrastra el PDF aquí o</span>
              <strong>Elegir archivo</strong>
              <span>Solo PDF, hasta 10 MB.</span>
            </div>
          )}
          <div className="submit-work-label" style={{ marginTop: 16 }}>Dónde se usa</div>
          <div className={`cert-check ${used ? 'is-ok' : ''}`}><Check size={14} /> <span><strong>Página del curso</strong><br /><span className="admin-cell-sub">Botón «Descargar programa del curso».</span></span></div>
          <div className={`cert-check ${used ? 'is-ok' : ''}`}><Check size={14} /> <span><strong>Asistente IA</strong><br /><span className="admin-cell-sub">En todas las aulas de este curso.</span></span></div>
          {!current && !file && <div className="dash-notice warn" style={{ marginTop: 10 }}>Sin sílabo, el asistente no puede responder sobre el curso. La web usa el programa que ya trae incluido.</div>}
          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={onClose} disabled={saving}>{file ? 'Cancelar' : 'Cerrar'}</button>
            {file && <button className="admin-btn-edit" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar sílabo'}</button>}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default SyllabusModal;
