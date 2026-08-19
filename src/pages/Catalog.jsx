import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Play } from 'lucide-react';
import { COURSES, CATEGORIES } from '../lib/data';

const Catalog = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const filterCat = queryParams.get('cat') || '';
  
  const chips = [{ id:'', label:'Todos' }, ...CATEGORIES];

  // Active filter states
  const [activeLevel, setActiveLevel] = useState('todos');
  const [filters, setFilters] = useState({
    free: false, paid: false, short: false, medium: false, long: false
  });

  const toggleFilter = (key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));

  // Computed Functional Filter Logic
  const filteredCourses = useMemo(() => {
    let result = COURSES;
    
    // Categoría
    if (filterCat) result = result.filter(c => c.cat === filterCat);
    
    // Nivel
    if (activeLevel !== 'todos') {
      result = result.filter(c => c.level.toLowerCase() === activeLevel.toLowerCase());
    }
    
    // Precio
    if (filters.free && !filters.paid) result = result.filter(c => c.price === 0);
    if (filters.paid && !filters.free) result = result.filter(c => c.price > 0);
    
    // Duración (short: < 3h, medium: 3-10h, long: > 10h)
    if (filters.short || filters.medium || filters.long) {
      result = result.filter(c => {
        const hoursMatch = c.duration.match(/(\d+)/);
        const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
        
        if (filters.short && hours < 3) return true;
        if (filters.medium && hours >= 3 && hours <= 10) return true;
        if (filters.long && hours > 10) return true;
        return false;
      });
    }

    return result;
  }, [filterCat, activeLevel, filters]);

  const courses = filteredCourses;

  const getPriceBadge = (price, enrolled) => {
    if (price === 0) return { text: 'Gratis', className: 'course-price free' };
    if (enrolled) return { text: '✓ Inscrito', className: 'course-price' };
    return { text: `$${price}`, className: 'course-price' };
  };

  const clearFilters = () => {
    setActiveLevel('todos');
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
                <div key={c.id} className="filter-option checked" onClick={() => navigate(`/catalog?cat=${c.id}`)}>
                  <div className="filter-checkbox" style={filterCat === c.id ? { background: 'var(--accent)', borderColor: 'var(--accent)' } : {}}>
                    {filterCat === c.id && <span style={{ color: '#fff', fontSize: '.7rem', fontWeight: 700, margin: 'auto' }}>✓</span>}
                  </div>
                  <span className="filter-label">{c.label}</span>
                  <span className="filter-count">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="filter-section">
            <div className="filter-section-title">Nivel</div>
            <button className={`level-btn ${activeLevel === 'todos' ? 'active' : ''}`} onClick={() => setActiveLevel('todos')}>Todos los niveles</button>
            <button className={`level-btn ${activeLevel === 'principiante' ? 'active' : ''}`} onClick={() => setActiveLevel('principiante')}>🌱 Principiante</button>
            <button className={`level-btn ${activeLevel === 'intermedio' ? 'active' : ''}`} onClick={() => setActiveLevel('intermedio')}>🚀 Intermedio</button>
            <button className={`level-btn ${activeLevel === 'avanzado' ? 'active' : ''}`} onClick={() => setActiveLevel('avanzado')}>⚡ Avanzado</button>
          </div>
          <div className="filter-section">
            <div className="filter-section-title">Precio</div>
            <div className={`filter-option ${filters.free ? 'checked' : ''}`} onClick={() => toggleFilter('free')}>
              <div className="filter-checkbox"></div>
              <span className="filter-label">Gratuitos</span>
              <span className="filter-count">12</span>
            </div>
            <div className={`filter-option ${filters.paid ? 'checked' : ''}`} onClick={() => toggleFilter('paid')}>
              <div className="filter-checkbox"></div>
              <span className="filter-label">De pago</span>
              <span className="filter-count">48</span>
            </div>
          </div>
          <div className="filter-section">
            <div className="filter-section-title">Duración</div>
            <div className={`filter-option ${filters.short ? 'checked' : ''}`} onClick={() => toggleFilter('short')}>
              <div className="filter-checkbox"></div>
              <span className="filter-label">Menos de 3h</span>
            </div>
            <div className={`filter-option ${filters.medium ? 'checked' : ''}`} onClick={() => toggleFilter('medium')}>
              <div className="filter-checkbox"></div>
              <span className="filter-label">3 – 10 horas</span>
            </div>
            <div className={`filter-option ${filters.long ? 'checked' : ''}`} onClick={() => toggleFilter('long')}>
              <div className="filter-checkbox"></div>
              <span className="filter-label">Más de 10 horas</span>
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
          
          <div className="courses-grid">
            {courses.map(c => {
              const priceInfo = getPriceBadge(c.price, c.enrolled);
              return (
                <div className="course-card" key={c.id} onClick={() => navigate(`/course/${c.id}`)}>
                  <div className="course-thumb" style={{ background: `linear-gradient(135deg, ${c.color})` }}>
                    <div className="course-thumb-bg">{c.emoji}</div>
                    <div className="play-overlay"><div className="play-btn-sm"><Play size={20} fill="currentColor" /></div></div>
                    <div className="course-duration">{c.duration}</div>
                  </div>
                  <div className="course-body">
                    <div className="course-meta">
                      {c.badge && <span className="badge badge-accent">{c.badge}</span>}
                      <span className="badge badge-sky" style={{ fontSize: '.65rem' }}>{c.level}</span>
                    </div>
                    <div className="course-title">{c.title}</div>
                    <div className="course-instructor">por {c.instructor}</div>
                    <div className="course-stats-row">
                      <div className="course-rating">⭐ {c.rating} <span>({(c.students/1000).toFixed(1)}k)</span></div>
                      <div className={priceInfo.className}>{priceInfo.text}</div>
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
        </div>
      </div>
    </div>
  );
};

export default Catalog;
