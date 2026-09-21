import React, { useState } from 'react';
import { ArrowLeft, X, Loader2 } from 'lucide-react';
import { captureProgramLead } from '../lib/db';
import { useUI } from '../context/UIContext';

// Pestaña "Descubre" del hero + el formulario de interés general que
// despliega -- antes la pestaña solo hacía scroll a #metodologia (función
// ya cubierta por el botón "Cómo es el método"), así que quedaba
// duplicada; ahora abre/cierra este panel en vez de scrollear.
const HeroLeadPanel = ({ courses }) => {
  const { addToast } = useUI();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [saving, setSaving] = useState(false);

  const visibleCourses = courses.filter((c) => c.visible !== false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const topicCourse = visibleCourses.find((c) => c.id.toString() === topic);
      await captureProgramLead({
        name: `${name} ${lastName}`.trim(),
        email,
        phone,
        courseId: topicCourse?.id ?? null,
        courseTitle: topicCourse?.title ?? null,
        marketingConsent: true,
        source: 'hero',
      });
      addToast('¡Gracias! Te contactaremos muy pronto.', 'success');
      setName(''); setLastName(''); setEmail(''); setPhone(''); setTopic('');
      setOpen(false);
    } catch {
      addToast('No se pudo enviar. Intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`home-hero-discover ${open ? 'is-hidden' : ''}`}
        onClick={() => setOpen(true)}
        aria-expanded={open}
      >
        <ArrowLeft size={13} />
        <span>Descubre</span>
        <ArrowLeft size={13} />
      </button>

      <div className={`home-lead-panel ${open ? 'open' : ''}`} aria-hidden={!open}>
        <button type="button" className="home-lead-panel-close" onClick={() => setOpen(false)} aria-label="Cerrar formulario">
          <X size={16} />
        </button>
        <span className="home-lead-panel-eyebrow">✦ Formulario/Forms</span>
        <h3 className="home-lead-panel-title">Da el siguiente paso</h3>
        <p className="home-lead-panel-sub">Cuéntanos qué quieres aprender.</p>

        <form onSubmit={handleSubmit}>
          <div className="home-lead-row">
            <div className="home-lead-field">
              <label>Nombre</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" required />
            </div>
            <div className="home-lead-field">
              <label>Apellido</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Tu apellido" required />
            </div>
          </div>
          <div className="home-lead-field">
            <label>Correo electrónico</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" required />
          </div>
          <div className="home-lead-field">
            <label>Teléfono</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Tu número de contacto" />
          </div>
          <div className="home-lead-field">
            <label>¿Qué te gustaría aprender?</label>
            <select value={topic} onChange={(e) => setTopic(e.target.value)} required>
              <option value="" disabled>Selecciona un taller</option>
              {visibleCourses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="lead-submit-btn" disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : 'Enviar información'}
          </button>
        </form>
      </div>
    </>
  );
};

export default HeroLeadPanel;
