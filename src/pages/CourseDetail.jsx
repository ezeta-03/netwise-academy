import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { COURSES, CATEGORIES, CURRICULUM_DATA, REVIEWS } from '../lib/data';
import { useCulqi } from '../hooks/useCulqi';

const CourseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const course = COURSES.find(c => c.id.toString() === id) || COURSES[0];
  const relatedCourses = COURSES.filter(c => c.id !== course.id).slice(0, 3);
  
  const [openModules, setOpenModules] = useState([true, true]); // first two open by default

  const { openCulqiCheckout, isProcessing } = useCulqi(course.price * 3.75, course.title); // PEN conversion dummy

  const toggleModule = (index) => {
    const newModules = [...openModules];
    newModules[index] = !newModules[index];
    setOpenModules(newModules);
  };

  const getCatLabel = (catId) => {
    const cat = CATEGORIES.find(c => c.id === catId);
    return cat ? cat.label.replace(/[^a-zA-Z\s]/g, '').trim() : 'Categoría';
  };

  const enrollCourse = () => {
    if (course.price === 0) {
      alert("Te has inscrito en el curso gratuito.");
      navigate(`/player/${course.id}/1`);
    } else {
      openCulqiCheckout();
      // In real app, navigate inside the Culqi success callback
      setTimeout(() => navigate(`/player/${course.id}/1`), 1600);
    }
  };

  return (
    <div className="view active">
      <div className="course-detail-layout">
        <div className="course-detail-main anim-fade-up d1">
          <div className="cd-breadcrumb">
            <a onClick={() => navigate('/catalog')}>Explorar</a> › 
            <a onClick={() => navigate(`/catalog?cat=${course.cat}`)}>{getCatLabel(course.cat)}</a> › 
            <span>{course.title.split(':')[0]}</span>
          </div>
          
          {course.badge && <div className="badge badge-accent" style={{ marginBottom: '14px' }}>⚡ {course.badge}</div>}
          
          <h1 className="cd-title">{course.title}</h1>
          <p className="cd-description">Lleva tus habilidades al siguiente nivel con este curso estructurado. Aprende las mejores prácticas, arquitecturas modernas y optimización de rendimiento con técnicas utilizadas en aplicaciones reales de producción.</p>
          
          <div className="cd-meta-row">
            <div className="cd-meta-item">⭐ <strong>{course.rating}</strong> <span style={{ color: 'var(--amber)' }}>(2.4k reseñas)</span></div>
            <div className="cd-meta-item">👥 <strong>{course.students.toLocaleString()}</strong> estudiantes</div>
            <div className="cd-meta-item">🕐 <strong>{course.duration}</strong> de video</div>
            <div className="cd-meta-item">📅 Actualizado <strong>Nov 2024</strong></div>
            <span className="badge badge-sky" style={{ textTransform: 'capitalize' }}>⚡ {course.level}</span>
          </div>

          <div className="instructor-card">
            <div className="instructor-avatar">{course.instructor.split(' ').map(n => n[0]).join('')}</div>
            <div>
              <div className="instructor-name">{course.instructor}</div>
              <div className="instructor-role">Senior Frontend Engineer · Ex-Google · 8 años de experiencia</div>
              <div className="instructor-bio">Ingeniero experto en esta tecnología. Ha trabajado en equipos de alto desempeño y construido aplicaciones con millones de usuarios activos. Apasionado por la enseñanza y el código limpio.</div>
            </div>
          </div>

          <div className="curriculum">
            <div className="curriculum-header">
              <h3>Contenido del Curso</h3>
              <div className="curriculum-stats">{CURRICULUM_DATA.length} módulos · 24 lecciones · {course.duration} de video</div>
            </div>
            
            {CURRICULUM_DATA.map((mod, mi) => (
              <div key={mi} className={`module ${openModules[mi] ? 'open' : ''}`}>
                <div className="module-header" onClick={() => toggleModule(mi)}>
                  <span className="module-num">{String(mi + 1).padStart(2, '0')}</span>
                  <span className="module-title">{mod.module}</span>
                  <span className="module-meta">{mod.lessons.length} clases</span>
                  <span className="module-toggle">▼</span>
                </div>
                <div className="lessons-list">
                  {mod.lessons.map((l, li) => {
                    const iconMap = { video: '▶', quiz: '?', doc: '📄' };
                    const typeClass = l.done ? 'done' : l.type;
                    return (
                      <div key={li} className="lesson-item" onClick={() => navigate(`/player/${course.id}/${mi+1}-${li+1}`)}>
                        <div className={`lesson-icon ${typeClass}`}>
                          {l.done ? '✓' : iconMap[l.type] || '▶'}
                        </div>
                        <span className="lesson-title">
                          {l.title}
                          {l.current && <span className="badge badge-accent" style={{ fontSize: '.65rem', padding: '2px 7px', marginLeft: '6px' }}>Actual</span>}
                        </span>
                        <span className="lesson-duration">{l.dur}</span>
                        {l.locked && <span className="lesson-locked">🔒</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '28px' }}>
            <h3 style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, marginBottom: '20px' }}>Reseñas del curso</h3>
            {REVIEWS.map((r, ri) => (
              <div key={ri} style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '20px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent),var(--sky))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.82rem', color: '#fff' }}>
                    {r.name[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '.9rem' }}>{r.name}</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--text3)' }}>{r.date}</div>
                  </div>
                  <div className="stars" style={{ marginLeft: 'auto' }}>{'⭐'.repeat(r.stars)}</div>
                </div>
                <p style={{ fontSize: '.88rem', color: 'var(--text2)', lineHeight: 1.65 }}>{r.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="course-sidebar anim-fade-up d2">
          <div className="preview-card">
            <div className="preview-thumb" onClick={() => navigate(`/player/${course.id}/1`)}>
              <span style={{ fontSize: '5rem', position: 'relative', zIndex: 1 }}>{course.emoji}</span>
              <div className="preview-play">▶</div>
            </div>
            <div className="preview-body">
              <div className="preview-price">
                ${course.price === 0 ? '0.00' : course.price}
                {course.oldPrice > 0 && <span className="old-price">${course.oldPrice}</span>}
              </div>
              {course.oldPrice > 0 && <div className="preview-discount">67% de descuento · Oferta termina en 2 días</div>}
              
              <button className="btn btn-primary btn-full btn-lg" style={{ marginBottom: '10px' }} onClick={enrollCourse}>
                {course.price === 0 ? 'Inscribirse gratis' : 'Comprar ahora'}
              </button>
              <button className="btn btn-ghost btn-full" onClick={() => alert("Guardado en tu lista")}>Guardar para después</button>
              
              <div className="preview-includes">
                <h4>Este curso incluye:</h4>
                <div className="include-item"><span>🎬</span><span>{course.duration} de video bajo demanda</span></div>
                <div className="include-item"><span>📁</span><span>15 proyectos descargables</span></div>
                <div className="include-item"><span>📝</span><span>6 ejercicios prácticos</span></div>
                <div className="include-item"><span>🏆</span><span>Certificado de finalización</span></div>
                <div className="include-item"><span>♾️</span><span>Acceso ilimitado de por vida</span></div>
                <div className="include-item"><span>📱</span><span>Acceso en móvil y desktop</span></div>
              </div>
            </div>
          </div>

          <div>
            <div className="section-header" style={{ marginBottom: '14px' }}>
              <div className="section-title-text" style={{ fontSize: '1rem' }}>Cursos relacionados</div>
            </div>
            <div>
              {relatedCourses.map(r => (
                <div key={r.id} className="reco-card" onClick={() => navigate(`/course/${r.id}`)} style={{ marginBottom: '10px' }}>
                  <div className="reco-thumb" style={{ background: `linear-gradient(135deg, ${r.color})`, width: '64px', height: '48px', borderRadius: '8px' }}>{r.emoji}</div>
                  <div className="reco-body">
                    <div className="reco-title" style={{ fontSize: '.83rem' }}>{r.title}</div>
                    <div className="reco-meta">
                      <span>⭐{r.rating}</span>
                      <span>{r.price === 0 ? 'Gratis' : `$${r.price}`}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseDetail;
