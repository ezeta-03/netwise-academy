import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import ModalPortal from '../components/ModalPortal';
import MasterclassForm from '../components/masterclass/MasterclassForm';
import { MASTERCLASSES, MASTERCLASS_TIME, MASTERCLASS_PLATFORM, MASTERCLASS_DATES_LABEL } from '../data/masterclasses';
import logo from '../assets/masterclass/logo.svg';
import arrow from '../assets/masterclass/arrow.svg';
import arrowDark from '../assets/masterclass/arrow-dark.svg';
import check from '../assets/masterclass/check.svg';
import iconClock from '../assets/masterclass/icon-clock.svg';
import iconVideo from '../assets/masterclass/icon-video.svg';
import iFolder from '../assets/masterclass/i-folder.svg';
import iMsg from '../assets/masterclass/i-msg.svg';
import iVideo from '../assets/masterclass/i-video.svg';
import './masterclass.css';

const SLIDE_MS = 7000;

// Fila blanca con fecha, hora y plataforma (hero y tarjetas de cada masterclass).
const InfoRow = ({ m, withWeekday }) => (
  <div className="mcl-info">
    <div className="mcl-info-date">
      <small>INICIO</small>
      <strong>{withWeekday && <span className="mcl-wd">{m.weekday.toUpperCase()} </span>}{m.dateLong.toUpperCase()}</strong>
    </div>
    <div className="mcl-info-item"><img src={iconClock} alt="" /><small>Hora</small><b>{MASTERCLASS_TIME}</b></div>
    <div className="mcl-info-item"><img src={iconVideo} alt="" className="is-video" /><small>Plataforma</small><b>{MASTERCLASS_PLATFORM}</b></div>
  </div>
);

// El primer slide es el <h1> de la página; el resto, <h2>.
const Title = ({ m, as = 'h2' }) => React.createElement(as, { className: 'mcl-d-title' }, `${m.titleTop} `, <span>{m.titleAccent}</span>);

// Aparición al entrar en pantalla (clase .in), como en el diseño.
const useReveal = () => {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const els = root.querySelectorAll('.mcl-rv, .mcl-stagger');
    root.querySelectorAll('.mcl-stagger').forEach((el) => [...el.children].forEach((c, i) => c.style.setProperty('--i', i)));
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return undefined; }
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
};

const Masterclass = () => {
  const [current, setCurrent] = useState(0);
  const [cycle, setCycle] = useState(0); // reinicia la barra de progreso del dot
  const [modalOpen, setModalOpen] = useState(false);
  const heroRef = useRef(null);
  const bgsRef = useRef(null);
  const touchX = useRef(null);
  const pageRef = useReveal();

  const go = useCallback((i) => {
    setCurrent((i + MASTERCLASSES.length) % MASTERCLASSES.length);
    setCycle((c) => c + 1);
  }, []);

  useEffect(() => {
    document.title = 'Masterclass gratuitas · Netwise Academy';
    return () => { document.title = 'Netwise Academy · Plataforma de Aprendizaje'; };
  }, []);

  // Avance automático; se detiene con la pestaña oculta.
  useEffect(() => {
    if (document.hidden) return undefined;
    const t = setTimeout(() => go(current + 1), SLIDE_MS);
    const onVis = () => { if (document.hidden) clearTimeout(t); else go(current); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', onVis); };
  }, [current, cycle, go]);

  // Parallax suave del fondo del hero.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (bgsRef.current && heroRef.current && y < heroRef.current.offsetHeight + 200) {
          bgsRef.current.style.transform = `translate3d(0, ${y * 0.18}px, 0)`;
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current === null || e.target.closest('.mcl-form-card')) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 50) go(current + (dx < 0 ? 1 : -1));
    touchX.current = null;
  };

  const openForm = () => setModalOpen(true);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setModalOpen(false); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [modalOpen]);

  return (
    <div className="mcl" ref={pageRef}>
      <div className="mcl-promo"><p><b>Promociones y descuentos</b> disponibles <b>hasta el 30/09</b></p></div>

      <header className="mcl-hero" ref={heroRef} aria-roledescription="carrusel" aria-label="Masterclass destacadas" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="mcl-hero-bgs" ref={bgsRef} aria-hidden="true">
          {MASTERCLASSES.map((m, i) => (
            <div key={m.id} className={`mcl-hero-bg${i === current ? ' is-active' : ''}`} data-slide={i}>
              <img src={m.heroImage} alt="" loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : undefined} />
            </div>
          ))}
        </div>

        <nav className="mcl-nav">
          <Link className="mcl-brand" to="/" aria-label="Netwise Academy"><img src={logo} alt="Netwise Tools Academy" /></Link>
          <button type="button" className="mcl-btn-sm" onClick={openForm}>Reservar mi cupo</button>
        </nav>

        <div className="mcl-hero-inner">
          <div className="mcl-slides">
            {MASTERCLASSES.map((m, i) => (
              <article key={m.id} className={`mcl-slide-card${i === current ? ' is-active' : ''}`} aria-label={`${i + 1} de ${MASTERCLASSES.length}`} aria-hidden={i !== current}>
                <div className="mcl-tag">MASTERCLASS GRATUITO DE <img src={arrow} alt="" /></div>
                <div className="mcl-hcard">
                  <Title m={m} as={i === 0 ? 'h1' : 'h2'} />
                  <p className="mcl-d-sub">{m.subtitle}</p>
                  <InfoRow m={m} />
                </div>
              </article>
            ))}
            <div className="mcl-dots" role="tablist" aria-label="Elegir slide" style={{ '--dur': `${SLIDE_MS}ms` }}>
              {MASTERCLASSES.map((m, i) => (
                <button key={i === current ? `${m.id}-${cycle}` : m.id} type="button" role="tab" aria-selected={i === current} aria-label={m.title}
                  className={`mcl-dot${i === current ? ' is-active' : ''}`} onClick={() => go(i)} />
              ))}
            </div>
          </div>

          <div className="mcl-hero-form">
            <MasterclassForm />
          </div>
        </div>
      </header>

      <div className="mcl-cases">
        <div className="mcl-cases-inner">
          <p className="mcl-cases-lead">Casos 100% reales</p>
          <p className="mcl-cases-sub">con el método de caso, al estilo de <b>Harvard</b> y <b>Kellogg</b></p>
        </div>
      </div>

      <main>
        <section className="mcl-mc" id="masterclass">
          {MASTERCLASSES.map((m, i) => (
            <div key={m.id} className={`mcl-mc-group mcl-rv${i % 2 === 1 ? ' is-reversed' : ''}`}>
              <div className="mcl-tag">MASTERCLASS {String(i + 1).padStart(2, '0')} <img src={arrow} alt="" /></div>
              <div className="mcl-mc-card">
                <div className="mcl-mc-body">
                  <div>
                    <Title m={m} />
                    <p className="mcl-d-sub">{m.subtitle}</p>
                    <InfoRow m={m} withWeekday />
                  </div>
                  <div>
                    <ul className="mcl-learn mcl-stagger">
                      {m.learn.map((t) => <li key={t}><img src={check} alt="" />{t}</li>)}
                    </ul>
                    <p className="mcl-forwho"><b>Para quién:</b> {m.forWho}</p>
                  </div>
                </div>
                <div className="mcl-mc-img">
                  <img className={m.cardImageWide ? 'is-wide' : ''} src={m.cardImage} alt={`Masterclass de ${m.title}`} loading="lazy" />
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="mcl-cta-bar">
          <div className="mcl-wrap">
            <h2>MASTERCLASS GRATUITOS</h2>
            <button type="button" className="mcl-btn-white" onClick={openForm}>Reservar mi cupo gratis <img src={arrowDark} alt="" /></button>
          </div>
        </section>

        <section className="mcl-steps">
          <h2 className="mcl-rv">Reservar tu cupo toma menos de un minuto.</h2>
          <div className="mcl-steps-grid mcl-stagger">
            <div className="mcl-step"><img src={iFolder} alt="" /><h3>Regístrate<br />Gratis</h3><p>Elige la masterclass y completa tus datos en el formulario.</p></div>
            <div className="mcl-step"><img src={iMsg} alt="" /><h3>Recibe la<br />confirmación</h3><p>Recibirás la información de acceso antes de la clase.</p></div>
            <div className="mcl-step"><img src={iVideo} alt="" /><h3>Conéctate<br />en vivo</h3><p>Entra a las 8:00 p.m. desde tu computadora o celular, aprende y haz tus preguntas en directo.</p></div>
          </div>
        </section>

        <section className="mcl-faq-sec" id="preguntas">
          <div className="mcl-faq">
            <div className="mcl-faq-head mcl-rv">
              <h2>Preguntas y<br />Respuestas</h2>
              <p>Todas las sesiones empiezan a las 8:00 p.m.</p>
            </div>
            <div className="mcl-faq-list mcl-stagger">
              <details open><summary>¿Las masterclass son gratuitas?</summary><p>Sí. Las tres sesiones son gratuitas.</p></details>
              <details><summary>¿Puedo elegir más de una?</summary><p>Sí. Puedes escoger una, dos o las tres masterclass.</p></details>
              <details><summary>¿Dónde serán las clases?</summary><p>Por Google Meet, a las 8:00 p. m., hora de Perú.</p></details>
            </div>
          </div>

          <div className="mcl-final mcl-rv">
            <div>
              <h2>Tu próximo paso en digital empieza en octubre.</h2>
              <p>Reserva tu cupo gratis y recibe el acceso a las masterclass que elijas.</p>
            </div>
            <div className="mcl-cta-col">
              <button type="button" className="mcl-btn-white" onClick={openForm}>Reservar mi cupo gratis <img src={arrowDark} alt="" /></button>
              <small>{MASTERCLASS_DATES_LABEL} · 8:00 p.m.</small>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {modalOpen && (
        <ModalPortal>
          <div className="mcl-modal" role="dialog" aria-modal="true" aria-label="Reservar mi cupo" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
            <MasterclassForm onClose={() => setModalOpen(false)} />
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default Masterclass;
