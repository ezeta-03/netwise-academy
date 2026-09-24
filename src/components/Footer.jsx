import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logoNetwise from '../assets/NETWISE ACADEMY WEB/logo_netwise.webp';
import zoozmagoLogo from '../assets/NETWISE ACADEMY WEB/zoozmago_logo.webp';
import libroReclamaciones from '../assets/NETWISE ACADEMY WEB/libro_reclamaciones.webp';
import TermsModal from './TermsModal';

const Footer = ({ onCoursesClick, onMethodologyClick }) => {
  const navigate = useNavigate();
  const [legalTab, setLegalTab] = useState(null);
  const handleCourses = onCoursesClick || (() => navigate('/catalog'));
  const handleMethodology = onMethodologyClick || (() => navigate('/metodologia'));

  return (
    <footer className="home-footer">
      <div className="home-footer-inner">
        <div>
          <img src={logoNetwise} alt="Netwise Academy" className="home-footer-logo-img" />
          <p className="home-footer-tagline">Talleres prácticos de IA, marketing y negocios digitales.</p>
          {/* Canal del Libro de Reclamaciones según los Términos (cláusula 14.2). */}
          <a className="home-footer-libro" href="mailto:reclamos@netwise.pe?subject=Libro%20de%20Reclamaciones" aria-label="Libro de Reclamaciones virtual (reclamos@netwise.pe)" title="Libro de Reclamaciones">
            <img src={libroReclamaciones} alt="Libro de Reclamaciones" width="59" height="58" />
          </a>
        </div>
        <div>
          <div className="home-footer-col-title">Navegación</div>
          <div className="home-footer-links">
            <button type="button" className="home-footer-link-btn" onClick={handleCourses}>Cursos</button>
            <button type="button" className="home-footer-link-btn" onClick={handleMethodology}>Nuestra metodología</button>
          </div>
        </div>
      </div>
      <div className="home-footer-bottom">
        <span>© {new Date().getFullYear()} Netwise Academy</span>
        <span className="home-footer-legal">
          <button type="button" className="home-footer-link-btn" onClick={() => setLegalTab('terms')}>Términos y condiciones</button>
          <button type="button" className="home-footer-link-btn" onClick={() => setLegalTab('privacy')}>Política de privacidad</button>
        </span>
        <span className="home-footer-zoozmago">Una empresa de <img src={zoozmagoLogo} alt="Zoozmago Holding Group" /></span>
      </div>
      {legalTab && <TermsModal initialTab={legalTab} onClose={() => setLegalTab(null)} />}
    </footer>
  );
};

export default Footer;
