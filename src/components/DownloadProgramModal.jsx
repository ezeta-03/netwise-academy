import React, { useState } from 'react';
import { X, Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { requestProgramByEmail } from '../lib/db';
import { toPeruMobile, isEmailFormat } from '../lib/phone';
import ModalPortal from './ModalPortal';
import TermsModal from './TermsModal';

// El programa (PDF) llega al correo del visitante -- ya no se descarga al
// enviar el formulario: así el contacto que deja tiene que ser real. La
// función sendProgramEmail vuelve a validar correo y celular.
const DownloadProgramModal = ({ course, onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [legalTab, setLegalTab] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const bad = {
      name: name.trim().length < 3 ? 'Escribe tu nombre completo.' : '',
      email: !isEmailFormat(email) ? 'Escribe un correo válido, por ejemplo nombre@gmail.com.' : '',
      phone: !toPeruMobile(phone) ? 'Escribe tu celular de 9 dígitos (empieza con 9).' : '',
    };
    setErrors(bad);
    setError('');
    if (Object.values(bad).some(Boolean)) return;
    setSaving(true);
    try {
      await requestProgramByEmail({ courseId: course.id, courseTitle: course.title, name, email, phone: toPeruMobile(phone), marketingConsent: consent });
      setSentTo(email.trim().toLowerCase());
    } catch (err) {
      setError(err?.code === 'functions/invalid-argument' || err?.code === 'functions/resource-exhausted'
        ? err.message
        : 'No pudimos enviar el programa. Intenta de nuevo en unos minutos.');
    } finally {
      setSaving(false);
    }
  };

  const setField = (setter, key) => (e) => { setter(e.target.value); setErrors((x) => ({ ...x, [key]: '' })); };

  return (
    <ModalPortal>
      <div className="admin-modal-overlay">
        <div className="admin-modal admin-modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head">
            <div />
            <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
          </div>
          {sentTo ? (
            <div style={{ textAlign: 'center', padding: '8px 4px 12px' }}>
              <CheckCircle2 size={44} color="#16A34A" style={{ marginBottom: 12 }} />
              <h2 className="lead-modal-title">Revisa tu <em>correo.</em></h2>
              <p className="lead-modal-desc">Te enviamos el programa de {course.title} a <strong>{sentTo}</strong>. Si no lo ves en unos minutos, revisa la carpeta de spam o promociones.</p>
              <button type="button" className="lead-submit-btn" onClick={onClose}>Entendido</button>
            </div>
          ) : (
            <>
              <h2 className="lead-modal-title">Conoce todo lo que<br /><em>vas a aprender.</em></h2>
              <p className="lead-modal-desc">Te enviamos el programa de {course.title} a tu correo, con sus módulos, contenidos y entregables.</p>

              <form onSubmit={handleSubmit} noValidate>
                <div className="admin-field">
                  <label>Nombre completo</label>
                  <input value={name} onChange={setField(setName, 'name')} placeholder="Tu nombre y apellidos" autoComplete="name" maxLength={120} aria-invalid={!!errors.name} />
                  {errors.name && <div className="checkout-error" role="alert" style={{ marginTop: 6, marginBottom: 0 }}>{errors.name}</div>}
                </div>
                <div className="admin-field">
                  <label>Correo electrónico</label>
                  <input type="email" value={email} onChange={setField(setEmail, 'email')} placeholder="nombre@correo.com" autoComplete="email" maxLength={160} aria-invalid={!!errors.email} />
                  {errors.email && <div className="checkout-error" role="alert" style={{ marginTop: 6, marginBottom: 0 }}>{errors.email}</div>}
                </div>
                <div className="admin-field">
                  <label>Celular</label>
                  <input type="tel" inputMode="numeric" value={phone} onChange={setField(setPhone, 'phone')} placeholder="9XX XXX XXX" autoComplete="tel" maxLength={16} aria-invalid={!!errors.phone} />
                  {errors.phone && <div className="checkout-error" role="alert" style={{ marginTop: 6, marginBottom: 0 }}>{errors.phone}</div>}
                </div>
                <label className="lead-consent-row">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  Quiero recibir por correo o teléfono novedades, próximos cursos y promociones de Netwise Academy. Puedo retirar mi autorización cuando quiera.
                </label>
                {error && <div className="checkout-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
                <button type="submit" className="lead-submit-btn" disabled={saving}>
                  {saving ? <Loader2 size={16} className="spin" /> : <Mail size={16} />} {saving ? 'Enviando...' : 'Enviarme el programa'}
                </button>
                <p className="home-lead-legal" style={{ color: '#8B8A9B' }}>
                  Tus datos se tratan según nuestra <button type="button" className="terms-link" onClick={() => setLegalTab('privacy')}>Política de privacidad</button> y
                  los <button type="button" className="terms-link" onClick={() => setLegalTab('terms')}>Términos y condiciones</button>.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
      {legalTab && <TermsModal initialTab={legalTab} onClose={() => setLegalTab(null)} />}
    </ModalPortal>
  );
};

export default DownloadProgramModal;
