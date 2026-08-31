import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Play } from 'lucide-react';
import { CATEGORIES } from '../lib/data';
import { COURSE_THUMBNAILS } from '../lib/courseThumbnails';
import { useCourseOfferings } from '../context/CourseOfferingsContext';
import { useAuth } from '../context/AuthContext';
import { fetchMyEnrollments } from '../lib/db';

const Catalog = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { courses: COURSES } = useCourseOfferings();
  const { currentUser } = useAuth();
  const [enrollments, setEnrollments] = useState({});
  const queryParams = new URLSearchParams(location.search);
  const filterCat = queryParams.get('cat') || '';

  useEffect(() => {
    if (!currentUser) return;
    fetchMyEnrollments(currentUser.uid).then(setEnrollments);
  }, [currentUser]);

  const chips = [{ id:'', label:'Todos' }, ...CATEGORIES];

  // Active filter states
  const [filters, setFilters] = useState({ free: false, paid: false });
  const [sortBy, setSortBy] = useState('popular');

  const toggleFilter = (key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));

  // Cuántos talleres reales hay por categoría -- antes venía hardcodeado en
  // 0 desde CATEGORIES (data.js) y nunca reflejaba el catálogo real.
  const categoryCounts = useMemo(() => {
    const counts = {};
    COURSES.forEach(c => { counts[c.cat] = (counts[c.cat] || 0) + 1; });
    return counts;
  }, [COURSES]);

  // Computed Functional Filter Logic
  const filteredCourses = useMemo(() => {
    let result = COURSES;

    // Categoría
    if (filterCat) result = result.filter(c => c.cat === filterCat);

    // Precio
    if (filters.free && !filters.paid) result = result.filter(c => c.price === 0);
    if (filters.paid && !filters.free) result = result.filter(c => c.price > 0);

    result = [...result];
    if (sortBy === 'recent') result.sort((a, b) => b.id - a.id);
    if (sortBy === 'price-asc') result.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));

    return result;
  }, [COURSES, filterCat, filters, sortBy]);

  const courses = filteredCourses;
  const freeCount = COURSES.filter(c => c.price === 0).length;
  const paidCount = COURSES.filter(c => c.price > 0).length;

  const getPriceBadge = (price, isEnrolled) => {
    if (isEnrolled) return { text: '✓ Inscrito', className: 'course-price' };
    if (price == null) return { text: 'Por confirmar', className: 'course-price' };
    if (price === 0) return { text: 'Gratis', className: 'course-price free' };
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
                  <span className="filter-count">{categoryCounts[c.id] || 0}</span>
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
            <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="popular">Más populares</option>
              <option value="recent">Más recientes</option>
              <option value="price-asc">Precio: menor a mayor</option>
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
              const enrollment = enrollments[c.id];
              const priceInfo = getPriceBadge(c.price, !!enrollment);
              return (
                <div className="course-card" key={c.id} onClick={() => navigate(enrollment ? `/player/${c.id}/1-1` : `/course/${c.id}`)}>
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
                  {enrollment && enrollment.progress > 0 && (
                    <div className="course-progress-wrap">
                      <div className="enrolled-badge">✓ Inscrito · {enrollment.progress}%</div>
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${enrollment.progress}%` }}></div></div>
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
