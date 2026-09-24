import React, { useState } from 'react';
import { captureMasterclassLead } from '../../lib/db';
import { MASTERCLASSES, MASTERCLASS_TIME } from '../../data/masterclasses';
import TermsModal from '../TermsModal';

// Origen del lead para el Sheet: 'landing' o 'landing:<utm_source>' si vino de
// una campaña (p. ej. ?utm_source=facebook).
const leadSource = () => {
  try {
    const utm = new URLSearchParams(window.location.search).get('utm_source');
    return (utm ? `landing:${utm}` : 'landing').slice(0, 100);
  } catch {
    return 'landing';
  }
};

// Formulario "Elige tu masterclass" -- el mismo en el hero de /masterclass y
// en el modal de "Reservar mi cupo". Términos obligatorios (se marcan solos al
// pulsar "Entendido" en el modal legal); promociones opcionales y sin
// premarcar, igual que el formulario del Inicio.
const MasterclassForm = ({ onClose }) => {
  const [picked, setPicked] = useState([]);
  const [values, setValues] = useState({ firstName: '', lastName: '', email: '', whatsapp: '' });
  const [invalid, setInvalid] = useState({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [legalTab, setLegalTab] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const setField = (k) => (e) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setInvalid((i) => ({ ...i, [k]: false }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const bad = {
      firstName: !values.firstName.trim(),
      lastName: !values.lastName.trim(),
      email: !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email.trim()),
      whatsapp: values.whatsapp.replace(/\D/g, '').length < 6,
    };
    setInvalid(bad);
    if (!picked.length) { setError('Elige al menos una masterclass.'); return; }
    if (Object.values(bad).some(Boolean)) { setError('Completa tus datos correctamente.'); return; }
    if (!acceptedTerms) { setError('Debes aceptar los Términos y la Política de privacidad.'); return; }
    setError('');
    setSending(true);
    try {
      const ordered = MASTERCLASSES.map((m) => m.id).filter((id) => picked.includes(id));
      await captureMasterclassLead({ ...values, masterclasses: ordered, marketingConsent, source: leadSource() });
      // Evento para Google Tag Manager (conversiones de campañas).
      window.dataLayer?.push({ event: 'masterclass_signup', masterclasses: ordered.join(',') });
      setSent(true);
    } catch {
      setError('No pudimos enviar tus datos. Inténtalo de nuevo.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="mcl-form-card">
        <div className="mcl-form-ok" role="status">
          <div className="mcl-ok-ic">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h3>¡Tu cupo está reservado!</h3>
          <p>Te enviaremos el acceso a Google Meet antes de la clase.</p>
          {onClose && <button type="button" className="mcl-submit" style={{ marginTop: 20 }} onClick={onClose}>Listo</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="mcl-form-card">
      {onClose && (
        <button type="button" className="mcl-modal-close" onClick={onClose} aria-label="Cerrar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      )}
      <div>
        <h2>Elige tu masterclass</h2>
        <p className="mcl-lead">Cuéntanos qué quieres aprender.</p>
      </div>
      <form noValidate onSubmit={handleSubmit}>
        <fieldset className="mcl-choices">
          <legend className="mcl-field-title">¿A cuáles quieres asistir? *</legend>
          {MASTERCLASSES.map((m) => (
            <label key={m.id} className={`mcl-choice${picked.includes(m.id) ? ' is-checked' : ''}`}>
              <input type="checkbox" checked={picked.includes(m.id)} onChange={() => toggle(m.id)} />
              <span><b>{m.title}</b><small>{m.weekday} {Number(m.day)} de octubre · {MASTERCLASS_TIME.replace('p.m.', 'p. m.')}</small></span>
            </label>
          ))}
        </fieldset>
        <div className="mcl-fields">
          <div className="mcl-row">
            <label className="mcl-fld">Nombre<input className={invalid.firstName ? 'invalid' : ''} value={values.firstName} onChange={setField('firstName')} placeholder="Tu nombre" autoComplete="given-name" maxLength={80} /></label>
            <label className="mcl-fld">Apellido<input className={invalid.lastName ? 'invalid' : ''} value={values.lastName} onChange={setField('lastName')} placeholder="Tu apellido" autoComplete="family-name" maxLength={80} /></label>
          </div>
          <label className="mcl-fld">Correo electrónico<input type="email" className={invalid.email ? 'invalid' : ''} value={values.email} onChange={setField('email')} placeholder="tucorreo@ejemplo.com" autoComplete="email" maxLength={160} /></label>
          <label className="mcl-fld">Whatsapp<input type="tel" inputMode="tel" className={invalid.whatsapp ? 'invalid' : ''} value={values.whatsapp} onChange={setField('whatsapp')} placeholder="Tu número de contacto" autoComplete="tel" maxLength={30} /></label>
          <div className="mcl-consents">
            <label className="mcl-check">
              <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
              <span>
                He leído y acepto los <button type="button" className="terms-link" onClick={(e) => { e.preventDefault(); setLegalTab('terms'); }}>Términos y condiciones</button> y
                la <button type="button" className="terms-link" onClick={(e) => { e.preventDefault(); setLegalTab('privacy'); }}>Política de privacidad</button>. *
              </span>
            </label>
            <label className="mcl-check">
              <input type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} />
              <span>Quiero recibir novedades, próximos cursos y promociones (opcional).</span>
            </label>
          </div>
          {error && <p className="mcl-form-error" aria-live="polite">{error}</p>}
          <button type="submit" className="mcl-submit" disabled={sending}>{sending ? 'Enviando…' : 'Enviar información'}</button>
        </div>
      </form>
      {legalTab && <TermsModal initialTab={legalTab} onClose={() => setLegalTab(null)} onAccept={() => setAcceptedTerms(true)} />}
    </div>
  );
};

export default MasterclassForm;
