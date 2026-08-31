import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Play, Check, ArrowRight, Globe } from 'lucide-react';
import { CATEGORIES } from '../lib/data';
import { usePreregistration } from '../hooks/usePreregistration';
import { useCourseOfferings } from '../context/CourseOfferingsContext';
import { useAuth } from '../context/AuthContext';

// La currícula real (semana a semana) todavía no está definida -- este
// cronograma se arma en el momento a partir de los 3 "highlights" que cada
// taller ya tiene en data.js, repartidos en los ~3 meses del programa.
// Es ilustrativo (no hay fecha de inicio de cohorte confirmada todavía).
const buildSchedule = (course) => {
  const ranges = ['Semanas 1–4', 'Semanas 5–8', 'Semanas 9–12'];
  return course.highlights.map((highlight, i) => ({
    module: `Módulo ${i + 1}`,
    range: ranges[i] || `Semana ${i * 4 + 1}`,
    title: highlight,
    isFinal: i === course.highlights.length - 1,
  }));
};

const CourseInfoModal = ({ slide, onClose }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { courses: COURSES } = useCourseOfferings();
  const course = COURSES.find((c) => c.id === slide.id);
  const { isPreregistered, saving, preregister } = usePreregistration(course);

  const handlePreregister = () => {
    if (!currentUser) {
      onClose();
      navigate('/login');
      return;
    }
    preregister();
  };

  // Cierra con Escape y bloquea el scroll de fondo mientras el modal está abierto.
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!course) return null;

  const getCatLabel = (catId) => {
    const cat = CATEGORIES.find((c) => c.id === catId);
    return cat ? cat.label.replace(/[^a-zA-Z\s]/g, '').trim() : 'Categoría';
  };

  const schedule = buildSchedule(course);

  const goToFullPage = () => {
    onClose();
    navigate(`/course/${course.id}`);
  };

  return (
    <div className="nf-modal-overlay" onClick={onClose}>
      <div className="nf-modal anim-fade-up" onClick={(e) => e.stopPropagation()}>
        <button className="nf-modal-close" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>

        <div className="nf-modal-media">
          <picture>
            <source media="(min-width: 1280px)" srcSet={slide.desktop} />
            <source media="(min-width: 768px)" srcSet={slide.tablet} />
            <img src={slide.mobile} alt={slide.label} />
          </picture>
          <div className="nf-modal-media-gradient"></div>
          <div className="nf-modal-media-content">
            <h2 className="nf-modal-title">{course.title}</h2>
            <div className="nf-modal-actions">
              <button
                className="btn-nf btn-nf-play"
                onClick={handlePreregister}
                disabled={isPreregistered || saving}
              >
                {isPreregistered ? <><Check size={18} /> Preinscrito</> : <><Play size={18} fill="currentColor" /> {saving ? 'Guardando...' : 'Preinscribirme'}</>}
              </button>
              <button className="nf-modal-icon-btn" onClick={goToFullPage} title="Ver página completa del taller" aria-label="Ver página completa del taller">
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className="nf-modal-body">
          <div className="nf-modal-meta-row">
            <span className="badge badge-accent">{course.badge || 'Taller'}</span>
            <span className="badge badge-sky">{getCatLabel(course.cat)}</span>
            <div className="nf-modal-meta-item"><Globe size={14} /> 100% online · síncrono + asíncrono</div>
          </div>
          <p className="nf-modal-desc">{course.description}</p>
          <div className="nf-modal-info-grid">
            <div><span>Dictado por</span><strong>{course.instructor}</strong></div>
            <div>
              <span>{course.startDate ? 'Inicio' : 'Duración'}</span>
              <strong>{course.startDate ? new Date(course.startDate + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) : '3 meses'}</strong>
            </div>
            <div><span>Precio</span><strong>{course.price == null ? 'Por confirmar' : (course.price === 0 ? 'Gratis' : `S/ ${course.price}`)}</strong></div>
          </div>

          <div className="nf-modal-schedule">
            <h3>Calendarización</h3>
            <p className="nf-modal-schedule-note">Cronograma referencial del programa; la fecha exacta de inicio de cohorte se confirma al preinscribirte.</p>
            {schedule.map((item, i) => (
              <div className="nf-schedule-item" key={i}>
                <div className="nf-schedule-num">{i + 1}</div>
                <div className="nf-schedule-body">
                  <div className="nf-schedule-top">
                    <span className="nf-schedule-module">{item.module} · {item.range}</span>
                  </div>
                  <div className="nf-schedule-title">{item.title}</div>
                  {item.isFinal && <div className="nf-schedule-tag">🏁 Cierra con la entrega del proyecto final</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseInfoModal;
