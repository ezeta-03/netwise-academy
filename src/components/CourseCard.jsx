import React from 'react';
import { ArrowUpRight, Clock3, Video } from 'lucide-react';
import { COURSE_THUMBNAILS } from '../lib/courseThumbnails';

// Tarjeta del catálogo "Cursos prácticos". La usan la página /cursos y la
// vista previa del formulario de curso nuevo, así que se ven igual.
const CourseCard = ({ course, onClick }) => {
  const thumb = course.thumb || COURSE_THUMBNAILS[1];
  const title = course.cardTitle || [course.title, ''];
  const promo = Number(course.promoPercent) || 0;
  const original = course.price != null && promo > 0 && promo < 100
    ? Math.round(course.price / (1 - promo / 100))
    : null;
  const [priceInt, priceDec = '00'] = Number(course.price ?? 0).toFixed(2).split('.');
  return (
    <div className="home-course-card catalog-card" onClick={onClick} role={onClick ? 'link' : undefined}>
      <div className="home-course-thumb">
        <img src={thumb} alt={course.title} />
        {course.badge && <span className="catalog-card-badge">{course.badge}</span>}
      </div>
      <div className="home-course-body">
        <div className="home-course-meta-row">
          <span className="home-course-tag">{course.cardTag}</span>
          <span className="home-course-live"><Video size={13} /> En vivo</span>
        </div>
        <div className="home-course-title">
          <span>{title[0]}</span>
          <span className="accent">{title[1]}</span>
        </div>
        <p className="home-course-desc">{course.cardDesc}</p>
        <div className="home-course-info">
          <Clock3 size={14} /> {course.duration} <span className="home-course-info-dot" /> {course.level}
        </div>
        {course.price != null && (
          <div className="catalog-card-price">
            {original && <span className="catalog-card-old">Antes S/ {original}</span>}
            <span className="catalog-card-now">S/ {priceInt}<small>.{priceDec}</small></span>
          </div>
        )}
        <span className="home-course-link">Ver curso <ArrowUpRight size={16} /></span>
      </div>
    </div>
  );
};

export default CourseCard;
