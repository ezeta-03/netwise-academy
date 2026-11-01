import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useUI } from '../context/UIContext';
import { updateLiveSession } from '../lib/db';
import { isSafeLink } from '../lib/placeholders';
import ModalPortal from './ModalPortal';

// Enlace de la grabación de una clase (Drive, YouTube, Vimeo...): el docente
// graba en Meet y pega el link aquí; los alumnos lo ven como "Grabación" en
// Clases anteriores de su Clases en vivo.
const RecordingLinkModal = ({ session, onClose, onSaved }) => {
  const { addToast } = useUI();
  const [url, setUrl] = useState(session.recordingUrl || '');
  const [saving, setSaving] = useState(false);

  const save = async (value) => {
    const clean = value.trim();
    if (clean && !isSafeLink(clean)) { addToast('Pega un enlace completo que empiece con https://', 'error'); return; }
    setSaving(true);
    try {
      const patch = { recordingUrl: clean || null, recordingAddedAt: clean ? new Date().toISOString() : null };
      await updateLiveSession(session.id, patch);
      onSaved({ ...session, ...patch });
      addToast(clean ? 'Grabación publicada para los alumnos.' : 'Grabación quitada.', 'success');
      onClose();
    } catch {
      addToast('No se pudo guardar. Intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="admin-modal-overlay">
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head">
            <div><div className="admin-modal-title">Grabación de la clase</div><div className="admin-modal-sub">{session.courseTitle} · {session.title}</div></div>
            <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
          </div>
          <p className="admin-cell-sub" style={{ marginBottom: 14 }}>
            Graba la clase en Google Meet. Cuando la grabación llegue a tu Drive, compártela con "cualquier persona con el enlace" (o súbela a YouTube como "No listado") y pega el enlace aquí. Tus alumnos la verán en Clases en vivo.
          </p>
          <div className="admin-field">
            <label>Enlace de la grabación</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtu.be/... o https://drive.google.com/..." autoFocus />
          </div>
          <div className="admin-modal-actions">
            {session.recordingUrl && <button className="admin-btn-ghost" onClick={() => save('')} disabled={saving}>Quitar</button>}
            <button className="admin-btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="admin-btn-edit" onClick={() => save(url)} disabled={saving}>{saving ? 'Guardando...' : 'Publicar grabación'}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default RecordingLinkModal;
