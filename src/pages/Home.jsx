import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Clock, Flame, Trophy, Play } from 'lucide-react';
import { COURSES, CATEGORIES } from '../lib/data';

const Home = () => {
  const navigate = useNavigate();

  const continuingCourses = COURSES.filter(c => c.enrolled && c.progress < 100).slice(0, 4);
  const recommendedCourses = COURSES.filter(c => !c.enrolled).slice(0, 6);
  const trendingCourses = [...COURSES].sort((a, b) => b.students - a.students).slice(0, 4);

  const getPriceBadge = (price, enrolled) => {
    if (price === 0) return { text: 'Gratis', className: 'course-price free' };
    if (enrolled) return { text: '✓ Inscrito', className: 'course-price' };
    return { text: `$${price}`, className: 'course-price' };
  };

  const renderCourseCard = (c) => {
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
  };

  return (
    <div className="view active">
      <div className="home-hero anim-fade-up d1">
        <div className="home-hero-inner">
          <div>
            <div className="badge badge-accent" style={{ marginBottom: '16px' }}>✨ Nueva ruta: Full-Stack 2025</div>
            <h1>Hola, <span>Ana</span>.<br/>¿Seguimos aprendiendo?</h1>
            <p>Tienes 3 cursos en progreso y una racha de 12 días. ¡Sigue así para completar tu certificación!</p>
            <div className="hero-cta">
              <button className="btn btn-primary btn-lg" onClick={() => navigate('/catalog')}>Explorar cursos</button>
              <button className="btn btn-ghost btn-lg" onClick={() => navigate('/my-learning')}>Ver mi progreso</button>
            </div>
          </div>
          <div className="hero-continue-card" onClick={() => navigate('/player/1/1')}>
            <div className="hcc-label">▶ Continuar donde dejaste</div>
            <div className="hcc-title">React Avanzado: Hooks & Patrones</div>
            <div className="hcc-sub">Módulo 3 · Lección 8 de 24</div>
            <div className="hcc-progress"><div className="hcc-fill" style={{ width: '65%' }}></div></div>
            <div className="hcc-pct">65% completado</div>
          </div>
        </div>
      </div>

      <div className="stats-row anim-fade-up d2">
        <div className="stat-card">
          <div className="s-icon"><BookOpen size={28} /></div>
          <div className="s-num">4</div>
          <div className="s-label">Cursos Inscritos</div>
          <div className="s-sub">2 en progreso</div>
        </div>
        <div className="stat-card">
          <div className="s-icon"><Clock size={28} /></div>
          <div className="s-num">38h</div>
          <div className="s-label">Tiempo aprendido</div>
          <div className="s-sub">+2.5h esta semana</div>
        </div>
        <div className="stat-card">
          <div className="s-icon"><Flame size={28} /></div>
          <div className="s-num">12</div>
          <div className="s-label">Días de racha</div>
          <div className="s-sub">Récord: 28 días</div>
        </div>
        <div className="stat-card">
          <div className="s-icon"><Trophy size={28} /></div>
          <div className="s-num">3</div>
          <div className="s-label">Certificados</div>
          <div className="s-sub">1 en curso</div>
        </div>
      </div>

      <div className="home-section" style={{ paddingTop: '40px' }}>
        <div className="section-header anim-fade-up d2">
          <div className="section-title-text">Continuar aprendiendo <span>({continuingCourses.length})</span></div>
          <button className="view-all" onClick={() => navigate('/my-learning')}>Ver todos →</button>
        </div>
        <div className="courses-grid">
          {continuingCourses.map(renderCourseCard)}
        </div>
      </div>

      <div className="home-section">
        <div className="section-header anim-fade-up d3">
          <div className="section-title-text">Explorar por categoría</div>
        </div>
        <div className="cat-chips">
          {CATEGORIES.map(c => (
            <div key={c.id} className="cat-chip" onClick={() => navigate(`/catalog?cat=${c.id}`)}>
              {c.label} <span style={{ color: 'var(--text3)', fontSize: '.75rem' }}>{c.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="home-section">
        <div className="section-header anim-fade-up d3">
          <div className="section-title-text">Recomendados para ti <span>(basado en tu historial)</span></div>
          <button className="view-all" onClick={() => navigate('/catalog')}>Ver catálogo →</button>
        </div>
        <div className="reco-grid">
          {recommendedCourses.map(c => (
            <div key={c.id} className="reco-card" onClick={() => navigate(`/course/${c.id}`)}>
              <div className="reco-thumb" style={{ background: `linear-gradient(135deg, ${c.color})` }}>{c.emoji}</div>
              <div className="reco-body">
                <div className="reco-title">{c.title}</div>
                <div className="reco-meta">
                  <span>⭐ {c.rating}</span>
                  <span>{c.duration}</span>
                  <span dangerouslySetInnerHTML={{ __html: c.price === 0 ? '<span style="color:var(--green)">Gratis</span>' : `$${c.price}` }}></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="home-section">
        <div className="section-header anim-fade-up d4">
          <div className="section-title-text">🔥 Trending esta semana</div>
        </div>
        <div className="courses-grid">
          {trendingCourses.map(renderCourseCard)}
        </div>
      </div>

      <div style={{ height: '48px' }}></div>
    </div>
  );
};

export default Home;
