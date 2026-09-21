import React from 'react';
import { X, Smartphone, CheckCircle2 } from 'lucide-react';
import ModalPortal from './ModalPortal';
import qrZaazmago from '../assets/NETWISE ACADEMY WEB/qr_zaazmago_recortado.jpeg';

const YapeInstructionsModal = ({ cfg, amountLabel, onClose }) => {
  const accountName = cfg?.accountName?.trim() || 'GRUPO ZAAZMAGO E.I.R.L.';
  const note = cfg?.note?.trim();

  const steps = [
    'Abre tu app Yape (o Plin) en el celular.',
    'Selecciona "Yapear/Plinear con QR" y escanea el código de abajo.',
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

          <div className="yape-qr-highlight">
            <img src={qrZaazmago} alt={`Código QR de Yape Empresas -- ${accountName}`} className="yape-qr-img" />
            <span className="yape-highlight-sub">{accountName}</span>
          </div>

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
