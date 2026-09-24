import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useUI } from '../context/UIContext';
import { updateLiveSession } from '../lib/db';
import { isSafeLink } from '../lib/placeholders';
import ModalPortal from './ModalPortal';

// Enlace de la grabación de una clase (YouTube, Drive, Vimeo...): el docente
// graba en su computadora desde la sala, lo sube y pega el link aquí; los
// alumnos del curso lo ven como "Ver grabación" en su Agenda.
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
      <div className="admin-modal-overlay" onClick={onClose}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head">
            <div><div className="admin-modal-title">Grabación de la clase</div><div className="admin-modal-sub">{session.courseTitle} · {session.title}</div></div>
            <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
          </div>
          <p className="admin-cell-sub" style={{ marginBottom: 14 }}>
            Graba desde la sala con el botón ● (Chrome o Edge en computadora). Al detener, el video se descarga: súbelo a YouTube (como "No listado") o a Drive (con acceso para cualquiera con el enlace) y pega el enlace aquí.
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
