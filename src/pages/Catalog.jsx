import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, MessageSquare, FolderOpen, CheckCircle2 } from 'lucide-react';
import { useCourseOfferings } from '../context/CourseOfferingsContext';
import CourseCard from '../components/CourseCard';
import Footer from '../components/Footer';
import './Catalog.css';

const BENEFITS = [
  { Icon: Video, label: 'Clases en vivo' },
  { Icon: MessageSquare, label: 'Feedback docente' },
  { Icon: FolderOpen, label: 'Recursos de consulta' },
  { Icon: CheckCircle2, label: 'Proyecto aplicado' },
];

// Página "Cursos prácticos" (/cursos). Muestra solo los cursos visibles en la
// web, en el orden que fija el admin en Cursos y precios.
const Catalog = () => {
  const navigate = useNavigate();
  const { courses, loaded } = useCourseOfferings();
  const visible = courses.filter((c) => c.visible !== false && !c.draft);

  return (
    <div className="catalog-page">
      <section className="catalog-hero">
        <h1 className="catalog-title">Cursos <em>prácticos</em></h1>
        <ul className="catalog-benefits">
          {BENEFITS.map((benefit) => (
            <li key={benefit.label}><benefit.Icon size={18} /><span>{benefit.label}</span></li>
          ))}
        </ul>
      </section>

      <section className="catalog-grid-wrap">
        {loaded && visible.length === 0 && (
          <p className="catalog-empty">Pronto publicaremos nuevos cursos.</p>
        )}
        <div className="home-courses-grid catalog-grid">
          {visible.map((c) => (
            <CourseCard key={c.id} course={c} onClick={() => navigate(`/course/${c.id}`)} />
          ))}
        </div>
      </section>

      <section className="catalog-more">
        <p className="catalog-more-title">Hay más por aprender. <em>Y mucho más por hacer.</em></p>
        <p className="catalog-more-sub">Pronto sumaremos nuevos cursos.</p>
      </section>

      <Footer />
    </div>
  );
};

export default Catalog;
