import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ChevronDown, Video, Clock3, Sparkles } from 'lucide-react';
import { COURSE_THUMBNAILS } from '../lib/courseThumbnails';
import { useCourseOfferings } from '../context/CourseOfferingsContext';
import { METHOD_STEPS, FEATURES } from '../lib/methodologyData';
import Footer from '../components/Footer';
import HeroLeadPanel from '../components/HeroLeadPanel';
import MasterclassPopup from '../components/masterclass/MasterclassPopup';

import heroImg from '../assets/NETWISE ACADEMY WEB/hero_principal.webp';
import videoFuturo from '../assets/NETWISE ACADEMY WEB/videos/video_futuro.mp4';

const Home = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { courses: COURSES } = useCourseOfferings();
  const [activeStep, setActiveStep] = useState(METHOD_STEPS[0].id);

  const scrollToCourses = () => {
    document.getElementById('talleres')?.scrollIntoView({ behavior: 'smooth' });
  };
  const scrollToMethod = () => {
    document.getElementById('metodologia')?.scrollIntoView({ behavior: 'smooth' });
  };

  // El link "Cursos" del navbar navega aquí pidiendo scroll a #talleres (ver
  // Navbar.jsx) cuando el visitante no estaba ya en el Inicio. No limpiamos
  // location.state después de usarlo -- hacerlo con otro navigate() disparaba
  // un segundo render que competía con este mismo efecto (visible sobre todo
  // en desarrollo, por el doble-invoke de StrictMode) y a veces cancelaba el
  // scroll; en el peor caso de dejarlo, un "atrás" del navegador que vuelva
  // a esta misma entrada del historial como mucho vuelve a hacer scroll.
  useEffect(() => {
    if (location.state?.scrollTo) {
      document.getElementById(location.state.scrollTo)?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.state]);

  return (
    <div className="view active">
      {/* HERO */}
      <div className="home-hero-wrap">
        <section className="home-hero anim-fade-up d1">
          <div className="home-hero-left">
            <h1 className="home-hero-title">
              <span>Aprende.</span>
              <span>Aplica.</span>
              <em>Crece.</em>
            </h1>
            <p className="home-hero-desc">
              Talleres de IA, marketing y negocios para convertir lo que sabes en lo que ya eres capaz de hacer.
            </p>
            <div className="home-hero-actions">
              <button className="btn btn-primary btn-lg" onClick={scrollToCourses}>
                Encuentra tu taller <ArrowRight size={18} />
              </button>
              <button className="btn btn-ghost btn-lg" onClick={scrollToMethod}>
                Cómo es el método <ChevronDown size={18} />
              </button>
            </div>
          </div>
          <div className="home-hero-right">
            <div className="home-hero-media">
              <img src={heroImg} alt="Estudiante de Netwise Academy" />
            </div>
            <span className="home-hero-tag home-hero-tag-top"><Sparkles size={14} /> Clases online en vivo</span>
            <span className="home-hero-tag home-hero-tag-bottom"><Sparkles size={14} /> Talleres 100% prácticos</span>
          </div>
        </section>
        <HeroLeadPanel courses={COURSES} />
      </div>

      <div className="home-hero-banner">
        <span>Metodologías propias, basada en casos y en tus proyectos 100% reales</span>
        <ArrowRight size={16} />
      </div>

      {/* TALLERES + MÉTODO — bloque claro fijo (ver nota en index.css) */}
      <div className="home-light-block">
        <div className="home-section" id="talleres">
          <div className="home-section-head">
            <h2 className="home-section-title">Tu próximo paso<br />empieza <em>aquí.</em></h2>
            <p className="home-section-sub">No necesitas saberlo todo. <br />Solo elegir por dónde empezar.</p>
          </div>
          <div className="home-courses-grid">
            {COURSES.filter((c) => c.visible !== false).map((c) => (
              <div className="home-course-card" key={c.id} onClick={() => navigate(`/course/${c.id}`)}>
                <div className="home-course-thumb">
                  <img src={COURSE_THUMBNAILS[c.id]} alt={c.title} />
                </div>
                <div className="home-course-body">
                  <div className="home-course-meta-row">
                    <span className="home-course-tag">{c.cardTag}</span>
                    <span className="home-course-live"><Video size={13} /> En vivo</span>
                  </div>
                  <div className="home-course-title">
                    <span>{c.cardTitle[0]}</span>
                    <span className="accent">{c.cardTitle[1]}</span>
                  </div>
                  <p className="home-course-desc">{c.cardDesc}</p>
                  <div className="home-course-info">
                    <Clock3 size={14} /> {c.duration} <span className="home-course-info-dot" /> {c.level}
                  </div>
                  <span className="home-course-link">Ver curso <ArrowUpRight size={16} /></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="home-section" id="metodologia">
          <div className="home-section-head">
            <h2 className="home-section-title">El mejor momento para<br />comenzar es <em>ahora.</em></h2>
            <p className="home-section-sub">Una metodología que conecta lo que aprendes<br />con lo que de verdad quieres lograr.</p>
          </div>
          <div className="home-method">
            <div className="home-method-steps">
              {METHOD_STEPS.map((step, i) => (
                <button
                  key={step.id}
                  type="button"
                  className={`home-method-step ${activeStep === step.id ? 'active' : ''}`}
                  onClick={() => setActiveStep(step.id)}
                >
                  <span className="home-method-step-num">0{i + 1}</span>
                  <div>
                    <div className="home-method-step-title">{step.title} <ArrowUpRight size={16} /></div>
                    <p className="home-method-step-desc">{step.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="home-method-media">
              {METHOD_STEPS.map((step) => (
                <img
                  key={step.id}
                  src={step.image}
                  alt={step.title}
                  className={activeStep === step.id ? 'is-active' : ''}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CÓMO APRENDES + CTA + FOOTER — un solo bloque oscuro (#141223) */}
      <div className="home-dark-block">
        <section>
          <div className="home-section">
            <div className="home-section-head home-section-head-center">
              <h2 className="home-section-title">Una forma de aprender<br />que te ayuda a <em>avanzar.</em></h2>
            </div>
            <div className="home-features-grid">
              {FEATURES.map((f) => (
                <div key={f.title}>
                  <f.icon className="home-feature-icon" size={26} />
                  <div className="home-feature-title">{f.title}</div>
                  <p className="home-feature-desc">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="home-section home-cta-section">
          <div className="home-cta">
            <video className="home-cta-video" autoPlay loop muted playsInline>
              <source src={videoFuturo} type="video/mp4" />
            </video>
            <div className="home-cta-overlay"></div>
            <div className="home-cta-content">
              <h2 className="home-cta-title">Empieza a formar tu<br />futuro <em>ahora.</em></h2>
              <button className="btn btn-primary btn-lg" onClick={scrollToCourses}>
                Encuentra tu taller <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </section>

        <Footer onCoursesClick={scrollToCourses} onMethodologyClick={scrollToMethod} />
        <MasterclassPopup />
      </div>
    </div>
  );
};

export default Home;
