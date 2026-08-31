import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { COURSE_THUMBNAILS } from '../lib/courseThumbnails';
import { useCourseOfferings } from '../context/CourseOfferingsContext';
import CourseInfoModal from '../components/CourseInfoModal';

// Fotos panorámicas del hero (ver src/assets/hero). Se sirven en .webp
// (comprimidas desde los .png originales, ~95% menos peso, misma calidad
// visual) para que el Inicio cargue rápido.
import desktop1 from '../assets/hero/desktop-1.webp';
import desktop2 from '../assets/hero/desktop-2.webp';
import desktop3 from '../assets/hero/desktop-3.webp';
import desktop4 from '../assets/hero/desktop-4.webp';
import tablet1 from '../assets/hero/tablet-1.webp';
import tablet2 from '../assets/hero/tablet-2.webp';
import tablet3 from '../assets/hero/tablet-3.webp';
import tablet4 from '../assets/hero/tablet-4.webp';
import movil1 from '../assets/hero/movil-1.webp';
import movil2 from '../assets/hero/movil-2.webp';
import movil3 from '../assets/hero/movil-3.webp';
import movil4 from '../assets/hero/movil-4.webp';

const HERO_SLIDES = [
  {
    id: 1, label: 'Redes Sociales & IA',
    description: 'Del contenido manual a la creación asistida por Inteligencia Artificial para multiplicar la productividad de marca.',
    desktop: desktop1, tablet: tablet1, mobile: movil1,
  },
  {
    id: 2, label: 'Branding & Marca',
    description: 'Construcción de identidad de marca sólida: desde el propósito hasta el manual de aplicación para canales digitales.',
    desktop: desktop2, tablet: tablet2, mobile: movil2,
  },
  {
    id: 3, label: 'Marketing Digital',
    description: 'Estrategia y ejecución integral: Meta/Google Ads, SEO, automatizaciones y analítica para generar resultados.',
    desktop: desktop3, tablet: tablet3, mobile: movil3,
  },
  {
    id: 4, label: 'Emprendimiento Digital',
    description: 'De la idea al negocio validado: modelo Canvas, Producto Mínimo Viable (MVP) y plan de lanzamiento a 90 días.',
    desktop: desktop4, tablet: tablet4, mobile: movil4,
  },
];

const Home = () => {
  const navigate = useNavigate();
  const { courses: COURSES } = useCourseOfferings();
  const [activeSlide, setActiveSlide] = useState(0);
  const [infoSlide, setInfoSlide] = useState(null);
  const rowRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setActiveSlide((s) => (s + 1) % HERO_SLIDES.length), 5500);
    return () => clearInterval(id);
  }, []);

  // Sólo hay 4 talleres -- se muestran los 4, una sola vez, nada más. La
  // fila simplemente scrollea (con flechas en desktop, gesto táctil en
  // móvil) hasta donde llegue el contenido real, sin loop ni duplicados.
  const scrollRow = (direction) => {
    const el = rowRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const slide = HERO_SLIDES[activeSlide];

  const getPriceLabel = (price) => {
    if (price == null) return 'Precio por confirmar';
    if (price === 0) return 'Gratis';
    return `S/ ${price}`;
  };

  return (
    <div className="view active">
      <div className="nf-hero anim-fade-up d1">
        <div className="nf-hero-media" key={activeSlide}>
          <picture>
            <source media="(min-width: 1280px)" srcSet={slide.desktop} />
            <source media="(min-width: 768px)" srcSet={slide.tablet} />
            <img src={slide.mobile} alt={slide.label} loading={activeSlide === 0 ? 'eager' : 'lazy'} />
          </picture>
          <div className="nf-hero-gradient"></div>
        </div>

        <div className="nf-hero-content">
          <div className="nf-hero-kicker">Taller {activeSlide + 1} de {HERO_SLIDES.length}</div>
          <h1 className="nf-hero-title">{slide.label}</h1>
          <div className="nf-hero-tags">
            <span>Taller práctico</span><span>3 meses</span><span>100% Online</span>
            <span>{getPriceLabel(COURSES.find((c) => c.id === slide.id)?.price)}</span>
          </div>
          <p className="nf-hero-desc">{slide.description}</p>
          <div className="nf-hero-actions">
            <button className="btn-nf btn-nf-play" onClick={() => navigate(`/course/${slide.id}`)}>
              <Play size={18} fill="currentColor" /> Ver taller
            </button>
            <button className="btn-nf btn-nf-info" onClick={() => setInfoSlide(slide)}>
              <Info size={18} /> Más información
            </button>
          </div>
        </div>

        <div className="nf-hero-dots">
          {HERO_SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`nf-dot ${i === activeSlide ? 'active' : ''}`}
              aria-label={`Ver ${s.label}`}
              onClick={() => setActiveSlide(i)}
            />
          ))}
        </div>
      </div>

      <div className="nf-row">
        <div className="nf-row-header">
          <h2 className="nf-row-title">Nuestros talleres</h2>
        </div>
        <div className="nf-row-wrap">
          <button className="nf-row-arrow nf-row-arrow-left" aria-label="Ver talleres anteriores" onClick={() => scrollRow(-1)}>
            <ChevronLeft size={22} />
          </button>
          <div className="nf-row-scroll" ref={rowRef}>
            {COURSES.map((c) => (
              <div className="nf-card" key={c.id} onClick={() => navigate(`/course/${c.id}`)}>
                <div className="nf-card-thumb">
                  <img src={COURSE_THUMBNAILS[c.id]} alt={c.title} className="nf-card-img" />
                  {c.badge && <span className="badge badge-accent nf-card-badge">{c.badge}</span>}
                </div>
                <div className="nf-card-body">
                  <div className="nf-card-title">{c.title}</div>
                  <div className="nf-card-meta">por {c.instructor} · {getPriceLabel(c.price)}</div>
                </div>
              </div>
            ))}
          </div>
          <button className="nf-row-arrow nf-row-arrow-right" aria-label="Ver más talleres" onClick={() => scrollRow(1)}>
            <ChevronRight size={22} />
          </button>
        </div>
      </div>

      <div style={{ height: '48px' }}></div>

      {infoSlide && <CourseInfoModal slide={infoSlide} onClose={() => setInfoSlide(null)} />}
    </div>
  );
};

export default Home;
