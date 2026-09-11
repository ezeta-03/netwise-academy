import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ChevronDown, Video, Clock3, MessageSquare, FolderOpen, Target, Sparkles } from 'lucide-react';
import { COURSE_THUMBNAILS } from '../lib/courseThumbnails';
import { useCourseOfferings } from '../context/CourseOfferingsContext';

import heroImg from '../assets/NETWISE ACADEMY WEB/hero_principal.webp';
import aprendeImg from '../assets/NETWISE ACADEMY WEB/aprende.webp';
import aplicaImg from '../assets/NETWISE ACADEMY WEB/aplica.webp';
import creceImg from '../assets/NETWISE ACADEMY WEB/crece.webp';
import logoNetwise from '../assets/NETWISE ACADEMY WEB/logo_netwise.webp';
import zoozmagoLogo from '../assets/NETWISE ACADEMY WEB/zoozmago_logo.webp';
import videoFuturo from '../assets/NETWISE ACADEMY WEB/videos/video_futuro.mp4';

const METHOD_STEPS = [
  {
    id: 'aprende',
    title: 'Aprende',
    image: aprendeImg,
    desc: 'Conoce herramientas actuales en clases en vivo. Pregunta, comparte y aprende junto a personas que también quieren avanzar.',
  },
  {
    id: 'aplica',
    title: 'Aplica',
    image: aplicaImg,
    desc: 'Trabaja sobre tu negocio, tu marca o una idea propia. Cada clase se convierte en un avance que recibe feedback.',
  },
  {
    id: 'crece',
    title: 'Crece',
    image: creceImg,
    desc: 'Termina con un resultado que puedes mostrar y utilizar. Convierte lo aprendido en el siguiente paso de tu carrera o negocio.',
  },
];

const FEATURES = [
  { icon: Video, title: 'Clases en vivo', desc: 'Dos sesiones de 2 horas por semana, con espacio para preguntar y aprender junto al docente.', tag: '4 horas por semana' },
  { icon: MessageSquare, title: 'Feedback docente', desc: 'Revisión de tus entregables y comentarios concretos para mejorar cada avance.', tag: 'Acompañamiento' },
  { icon: FolderOpen, title: 'Recursos de consulta', desc: 'Materiales de apoyo para repasar lo trabajado y practicar entre sesiones.', tag: 'A tu propio ritmo' },
  { icon: Target, title: 'Proyecto aplicado', desc: 'Un entregable por módulo y un proyecto final desarrollado sobre tu marca, negocio o idea.', tag: 'Resultado final' },
];

const Home = () => {
  const navigate = useNavigate();
  const { courses: COURSES } = useCourseOfferings();
  const [activeStep, setActiveStep] = useState(METHOD_STEPS[0].id);

  const scrollToCourses = () => {
    document.getElementById('talleres')?.scrollIntoView({ behavior: 'smooth' });
  };
  const scrollToMethod = () => {
    document.getElementById('metodologia')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="view active">
      {/* HERO */}
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
          <span className="home-hero-tag home-hero-tag-top"><Sparkles size={14} /> Clases en vivo</span>
          <span className="home-hero-tag home-hero-tag-bottom"><Sparkles size={14} /> Talleres 100% prácticos</span>
        </div>
      </section>

      {/* TALLERES + MÉTODO — bloque claro fijo (ver nota en index.css) */}
      <div className="home-light-block">
        <div className="home-section" id="talleres">
          <div className="home-section-head">
            <h2 className="home-section-title">Tu próximo paso<br />empieza <em>aquí.</em></h2>
            <p className="home-section-sub">No necesitas saberlo todo. <br />Solo elegir por dónde empezar.</p>
          </div>
          <div className="home-courses-grid">
            {COURSES.map((c) => (
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
                  <span className="home-feature-tag">{f.tag} <ArrowUpRight size={14} /></span>
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

        {/* FOOTER */}
        <footer className="home-footer">
          <div className="home-footer-inner">
            <div>
              <img src={logoNetwise} alt="Netwise Academy" className="home-footer-logo-img" />
              <p className="home-footer-tagline">Talleres prácticos de IA, marketing y negocios digitales.</p>
            </div>
            <div>
              <div className="home-footer-col-title">Navegación</div>
              <div className="home-footer-links">
                <button type="button" className="home-footer-link-btn" onClick={scrollToCourses}>Cursos</button>
                <button type="button" className="home-footer-link-btn" onClick={scrollToMethod}>Nuestra metodología</button>
              </div>
            </div>
          </div>
          <div className="home-footer-bottom">
            <span>© {new Date().getFullYear()} Netwise Academy</span>
            <span className="home-footer-zoozmago">Una empresa de <img src={zoozmagoLogo} alt="Zoozmago Holding Group" /></span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Home;
