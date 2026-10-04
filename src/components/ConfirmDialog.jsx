import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import ModalPortal from './ModalPortal';

// Diálogo de confirmación propio de la app, en vez del confirm()/prompt() del
// navegador. Se abre con `confirmDialog(...)` de UIContext, que devuelve una
// promesa: true/false, o -- con `input` -- el texto escrito (null si cancela).
const ConfirmDialog = ({ options, onResolve }) => {
  const { title = 'Confirmar', message = '', confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false, input = null } = options;
  const [value, setValue] = useState(input?.defaultValue || '');
  const confirmRef = useRef(null);
  const inputRef = useRef(null);
  const cancel = () => onResolve(input ? null : false);
  const confirm = () => onResolve(input ? value.trim() : true);

  useEffect(() => {
    (input ? inputRef : confirmRef).current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onResolve(input ? null : false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ModalPortal>
      <div className="admin-modal-overlay confirm-dialog-overlay" onClick={cancel}>
        <div className="admin-modal confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head">
            <div className="admin-modal-title" id="confirm-dialog-title">{title}</div>
            <button className="admin-modal-close" onClick={cancel} aria-label="Cerrar"><X size={18} /></button>
          </div>
          {message && <p className="confirm-dialog-message">{message}</p>}
          {input && (
            <div className="admin-field" style={{ marginTop: 12 }}>
              {input.label && <label htmlFor="confirm-dialog-input">{input.label}</label>}
              <textarea id="confirm-dialog-input" ref={inputRef} rows={3} value={value} placeholder={input.placeholder || ''} onChange={(e) => setValue(e.target.value)} />
            </div>
          )}
          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={cancel}>{cancelLabel}</button>
            <button ref={confirmRef} className={`admin-btn-edit ${danger ? 'confirm-dialog-danger' : ''}`} onClick={confirm}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ConfirmDialog;
