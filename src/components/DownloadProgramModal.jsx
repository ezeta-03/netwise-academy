import React, { useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { captureProgramLead } from '../lib/db';
import ModalPortal from './ModalPortal';
import TermsModal from './TermsModal';

const DownloadProgramModal = ({ course, onClose, onDownload }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [legalTab, setLegalTab] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await captureProgramLead({ courseId: course.id, courseTitle: course.title, name, email, phone, marketingConsent: consent });
      onDownload();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="admin-modal-overlay" onClick={onClose}>
        <div className="admin-modal admin-modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head">
            <div />
            <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
          </div>
          <h2 className="lead-modal-title">Conoce todo lo que<br /><em>vas a aprender.</em></h2>
          <p className="lead-modal-desc">Descarga el programa de {course.title} y explora sus módulos, contenidos y entregables.</p>

          <form onSubmit={handleSubmit}>
            <div className="admin-field">
              <label>Nombre completo</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre y apellidos" required />
            </div>
            <div className="admin-field">
              <label>Correo electrónico</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" required />
            </div>
            <div className="admin-field">
              <label>Teléfono (opcional)</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+51" />
            </div>
            <label className="lead-consent-row">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              Quiero recibir por correo o teléfono novedades, próximos cursos y promociones de Netwise Academy. Puedo retirar mi autorización cuando quiera.
            </label>
            <button type="submit" className="lead-submit-btn" disabled={saving}>
              {saving ? <Loader2 size={16} className="spin" /> : <Download size={16} />} {saving ? 'Guardando...' : 'Descargar programa completo'}
            </button>
            <p className="home-lead-legal" style={{ color: '#8B8A9B' }}>
              Tus datos se tratan según nuestra <button type="button" className="terms-link" onClick={() => setLegalTab('privacy')}>Política de privacidad</button> y
              los <button type="button" className="terms-link" onClick={() => setLegalTab('terms')}>Términos y condiciones</button>.
            </p>
          </form>
        </div>
      </div>
      {legalTab && <TermsModal initialTab={legalTab} onClose={() => setLegalTab(null)} />}
    </ModalPortal>
  );
};

export default DownloadProgramModal;
