import React from 'react';
import { X, Smartphone, Copy, CheckCircle2 } from 'lucide-react';
import { useUI } from '../context/UIContext';
import ModalPortal from './ModalPortal';

const YapeInstructionsModal = ({ cfg, amountLabel, onClose }) => {
  const { addToast } = useUI();
  const number = cfg?.number?.trim();
  const accountName = cfg?.accountName?.trim();
  const note = cfg?.note?.trim();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(number);
      addToast('Número copiado.', 'success');
    } catch {
      addToast('No se pudo copiar. Cópialo manualmente.', 'error');
    }
  };

  const steps = [
    'Abre tu app Yape (o Plin) en el celular.',
    number
      ? `Selecciona "Yapear" e ingresa el número ${number}${accountName ? ` (${accountName})` : ''}.`
      : 'Selecciona "Yapear" e ingresa el número que te compartió Netwise Academy.',
    `Escribe el monto exacto: ${amountLabel}.`,
    'En el motivo o mensaje, agrega tu nombre completo para identificar tu pago.',
    'Confirma el pago en la app y guarda la captura del comprobante.',
    'Vuelve aquí y presiona "Confirmar y pagar" para avisarnos y enviar tu comprobante.',
  ];

  return (
    <ModalPortal>
      <div className="admin-modal-overlay" onClick={onClose}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head">
            <div />
            <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
          </div>
          <h2 className="lead-modal-title"><Smartphone size={20} style={{ verticalAlign: '-3px', marginRight: 8 }} />Cómo pagar con <em>Yape</em></h2>
          <p className="lead-modal-desc">Sigue estos pasos para completar tu pago y asegurar tu cupo.</p>

          {number && (
            <div className="yape-highlight">
              <div>
                <span className="yape-highlight-label">Número de Yape/Plin</span>
                <span className="yape-highlight-value">{number}</span>
                {accountName && <span className="yape-highlight-sub">{accountName}</span>}
              </div>
              <button type="button" className="yape-copy-btn" onClick={handleCopy}><Copy size={14} /> Copiar</button>
            </div>
          )}

          <ol className="yape-steps">
            {steps.map((s, i) => (
              <li key={i} className="yape-step">
                <span className="yape-step-num">{i + 1}</span>
                <span className="yape-step-text">{s}</span>
              </li>
            ))}
          </ol>

          {note && <p className="checkout-pay-note"><CheckCircle2 size={13} /> {note}</p>}

          <button type="button" className="lead-submit-btn" onClick={onClose}>Entendido</button>
        </div>
      </div>
    </ModalPortal>
  );
};

export default YapeInstructionsModal;
