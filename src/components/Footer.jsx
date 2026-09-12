import React from 'react';
import { useNavigate } from 'react-router-dom';
import logoNetwise from '../assets/NETWISE ACADEMY WEB/logo_netwise.webp';
import zoozmagoLogo from '../assets/NETWISE ACADEMY WEB/zoozmago_logo.webp';

const Footer = ({ onCoursesClick, onMethodologyClick }) => {
  const navigate = useNavigate();
  const handleCourses = onCoursesClick || (() => navigate('/catalog'));
  const handleMethodology = onMethodologyClick || (() => navigate('/metodologia'));

  return (
    <footer className="home-footer">
      <div className="home-footer-inner">
        <div>
          <img src={logoNetwise} alt="Netwise Academy" className="home-footer-logo-img" />
          <p className="home-footer-tagline">Talleres prácticos de IA, marketing y negocios digitales.</p>
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
        <span className="home-footer-zoozmago">Una empresa de <img src={zoozmagoLogo} alt="Zoozmago Holding Group" /></span>
      </div>
    </footer>
  );
};

export default Footer;
