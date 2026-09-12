import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { METHOD_STEPS, FEATURES, METHOD_FAQ } from '../lib/methodologyData';
import Footer from '../components/Footer';

const Metodologia = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(METHOD_STEPS[0].id);
  const [openFaq, setOpenFaq] = useState(0);
  const active = METHOD_STEPS.find((s) => s.id === activeStep);

  return (
    <div className="view active">
      <div className="home-light-block">
        <section className="home-section">
          <div className="meth-hero">
            <h1 className="meth-hero-title">Aprender haciendo,<br /><em>no solo mirando.</em></h1>
            <p className="meth-hero-desc">En Netwise no memorizas teoría: cada curso está diseñado para que salgas con un proyecto real, feedback de un docente y una estrategia que ya puedes aplicar.</p>
          </div>

          <div className="meth-feature-row">
            {FEATURES.map((f) => (
              <div key={f.title} className="meth-feature-item">
                <f.icon size={18} />
                <span>{f.title}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="home-section" style={{ paddingTop: 0 }}>
          <div className="home-section-head">
            <h2 className="home-section-title">Aprende. Aplica. <em>Crece.</em></h2>
            <p className="home-section-sub">Tres pasos que se conectan durante el taller.<br />Explora cómo cada uno te ayuda a avanzar.</p>
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
                  <div className="home-method-step-title">{step.title} <ArrowUpRight size={16} /></div>
                </button>
              ))}
            </div>
            <div>
              <div className="home-method-media" style={{ marginBottom: 24 }}>
                {METHOD_STEPS.map((step) => (
                  <img key={step.id} src={step.image} alt={step.title} className={activeStep === step.id ? 'is-active' : ''} />
                ))}
              </div>
              <div className="meth-result-title">
                <span>{active.resultTitle[0]}</span>
                <span>{active.resultTitle[1]}</span>
              </div>
              <p className="meth-result-desc">{active.resultDesc}</p>
            </div>
          </div>
        </section>

        <section className="home-section" style={{ paddingTop: 0 }}>
          <div className="home-section-head">
            <h2 className="home-section-title">Tu punto de partida<br /><em>también cuenta.</em></h2>
          </div>
          <div className="meth-faq">
            {METHOD_FAQ.map((item, i) => (
              <div key={item.q} className={`meth-faq-item ${openFaq === i ? 'open' : ''}`}>
                <button className="meth-faq-question" onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>
                  {item.q} <ChevronDown size={18} />
                </button>
                {openFaq === i && <p className="meth-faq-answer">{item.a}</p>}
              </div>
            ))}
          </div>

          <div className="meth-cta">
            <div className="meth-cta-blob" />
            <div className="meth-cta-content">
              <h2 className="meth-cta-title">¿Listo para tu<br /><em>primer curso?</em></h2>
              <button className="btn btn-primary btn-lg" onClick={() => navigate('/catalog')}>Encuentra tu taller <ArrowUpRight size={18} /></button>
            </div>
          </div>
        </section>
      </div>

      <div className="home-dark-block">
        <Footer />
      </div>
    </div>
  );
};

export default Metodologia;
