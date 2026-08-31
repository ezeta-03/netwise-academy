import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Play } from 'lucide-react';
import { CATEGORIES } from '../lib/data';
import { COURSE_THUMBNAILS } from '../lib/courseThumbnails';
import { useCourseOfferings } from '../context/CourseOfferingsContext';

const Catalog = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { courses: COURSES } = useCourseOfferings();
  const queryParams = new URLSearchParams(location.search);
  const filterCat = queryParams.get('cat') || '';
  
  const chips = [{ id:'', label:'Todos' }, ...CATEGORIES];

  // Active filter states
  const [filters, setFilters] = useState({ free: false, paid: false });

  const toggleFilter = (key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));

  // Computed Functional Filter Logic
  const filteredCourses = useMemo(() => {
    let result = COURSES;

    // Categoría
    if (filterCat) result = result.filter(c => c.cat === filterCat);

    // Precio
    if (filters.free && !filters.paid) result = result.filter(c => c.price === 0);
    if (filters.paid && !filters.free) result = result.filter(c => c.price > 0);

    return result;
  }, [COURSES, filterCat, filters]);

  const courses = filteredCourses;
  const freeCount = COURSES.filter(c => c.price === 0).length;
  const paidCount = COURSES.filter(c => c.price > 0).length;

  const getPriceBadge = (price, enrolled) => {
    if (price == null) return { text: 'Por confirmar', className: 'course-price' };
    if (price === 0) return { text: 'Gratis', className: 'course-price free' };
    if (enrolled) return { text: '✓ Inscrito', className: 'course-price' };
    return { text: `S/ ${price}`, className: 'course-price' };
  };

  const clearFilters = () => {
    setFilters({ free: false, paid: false });
    navigate('/catalog');
  };

  return (
    <div className="view active">
      <div className="catalog-layout">
        <aside className="filters-sidebar anim-fade-up d1">
          <div className="filter-section">
            <div className="filter-section-title">Categorías</div>
            <div id="filter-cats">
              {CATEGORIES.map(c => (
                <div key={c.id} className={`filter-option ${filterCat === c.id ? 'checked' : ''}`} onClick={() => navigate(`/catalog?cat=${c.id}`)}>
                  <div className="filter-checkbox"></div>
                  <span className="filter-label">{c.label}</span>
                  <span className="filter-count">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="filter-section">
            <div className="filter-section-title">Precio</div>
            <div className={`filter-option ${filters.free ? 'checked' : ''}`} onClick={() => toggleFilter('free')}>
              <div className="filter-checkbox"></div>
              <span className="filter-label">Gratuitos</span>
              <span className="filter-count">{freeCount}</span>
            </div>
            <div className={`filter-option ${filters.paid ? 'checked' : ''}`} onClick={() => toggleFilter('paid')}>
              <div className="filter-checkbox"></div>
              <span className="filter-label">De pago</span>
              <span className="filter-count">{paidCount}</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-full btn-sm" onClick={clearFilters}>Limpiar filtros</button>
        </aside>

        <div className="catalog-main">
          <div className="catalog-header anim-fade-up d1">
            <div className="catalog-count">{courses.length} cursos encontrados</div>
            <div className="cat-chips" style={{ marginBottom: 0, flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {chips.map(c => (
                <div key={c.id} className={`cat-chip ${filterCat === c.id ? 'active' : ''}`} onClick={() => navigate(`/catalog?cat=${c.id}`)}>
                  {c.label}
                </div>
              ))}
            </div>
            <select className="sort-select" defaultValue="Más populares">
              <option>Más populares</option>
              <option>Mejor valorados</option>
              <option>Más recientes</option>
              <option>Precio: menor a mayor</option>
            </select>
          </div>
          
          {courses.length === 0 ? (
            <div className="empty-state">
              <div className="es-icon">🚧</div>
              <p>Estamos preparando nuestro catálogo de talleres. ¡Vuelve pronto!</p>
            </div>
          ) : (
          <div className="courses-grid">
            {courses.map(c => {
              const priceInfo = getPriceBadge(c.price, c.enrolled);
              return (
                <div className="course-card" key={c.id} onClick={() => navigate(`/course/${c.id}`)}>
                  <div className="course-thumb">
                    <img src={COURSE_THUMBNAILS[c.id]} alt={c.title} className="course-thumb-img" />
                    <div className="play-overlay"><div className="play-btn-sm"><Play size={20} fill="currentColor" /></div></div>
                    {c.duration && <div className="course-duration">{c.duration}</div>}
                  </div>
                  <div className="course-body">
                    {c.badge && <div className="course-meta"><span className="badge badge-accent">{c.badge}</span></div>}
                    <div className="course-title">{c.title}</div>
                    <div className="course-instructor">por {c.instructor}</div>
                    <div className="course-stats-row">
                      <span className={priceInfo.className}>{priceInfo.text}</span>
                    </div>
                  </div>
                  {c.enrolled && c.progress > 0 && (
                    <div className="course-progress-wrap">
                      <div className="enrolled-badge">✓ Inscrito · {c.progress}%</div>
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${c.progress}%` }}></div></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Catalog;
