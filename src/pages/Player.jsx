import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { COURSES, CURRICULUM_DATA } from '../lib/data';

const Player = () => {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [isPlaying, setIsPlaying] = useState(false);

  // Derive lesson details from URL
  const [modIdx, lessIdx] = (lessonId || '1-1').split('-').map(n => parseInt(n) - 1);
  const course = COURSES.find(c => c.id.toString() === courseId) || COURSES[0];
  const module = CURRICULUM_DATA[modIdx] || CURRICULUM_DATA[0];
  const lesson = module.lessons[lessIdx] || module.lessons[0];

  const goNext = () => {
    let nextLess = lessIdx + 1;
    let nextMod = modIdx;
    if (nextLess >= module.lessons.length) {
      nextMod += 1;
      nextLess = 0;
    }
    if (nextMod < CURRICULUM_DATA.length) {
      navigate(`/player/${course.id}/${nextMod + 1}-${nextLess + 1}`);
      setIsPlaying(false);
    }
  };

  const goPrev = () => {
    let prevLess = lessIdx - 1;
    let prevMod = modIdx;
    if (prevLess < 0) {
      prevMod -= 1;
      if (prevMod >= 0) prevLess = CURRICULUM_DATA[prevMod].lessons.length - 1;
    }
    if (prevMod >= 0) {
      navigate(`/player/${course.id}/${prevMod + 1}-${prevLess + 1}`);
      setIsPlaying(false);
    }
  };

  return (
    <div className="view active" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="player-layout">
        <div className="player-main">
          <div className="video-container">
            <div className="video-wrapper">
              {!isPlaying ? (
                <div className="video-placeholder" onClick={() => setIsPlaying(true)}>
                  <div className="vp-icon">▶</div>
                  <p>Haz clic para reproducir la lección</p>
                </div>
              ) : (
                <iframe src={course.video} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="Video"></iframe>
              )}
            </div>
          </div>
          
          <div className="player-info">
            <div className="player-breadcrumb" onClick={() => navigate(`/course/${course.id}`)}>
              ← {course.title}
            </div>
            
            <div className="player-lesson-title">{lesson.title}</div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span className="badge badge-sky">📺 Video · {lesson.dur}</span>
              <span className="badge badge-accent">{module.module.split(':')[0]}</span>
            </div>
            
            <div className="player-nav">
              <button className="btn btn-ghost btn-sm" onClick={goPrev}>← Anterior</button>
              <button className="btn btn-primary btn-sm" onClick={() => alert("Marked Done!")}>✓ Marcar completada</button>
              <button className="btn btn-ghost btn-sm" onClick={goNext}>Siguiente →</button>
            </div>
            
            <div className="player-tabs">
              <button className={`player-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Descripción</button>
              <button className={`player-tab ${activeTab === 'resources' ? 'active' : ''}`} onClick={() => setActiveTab('resources')}>Recursos</button>
              <button className={`player-tab ${activeTab === 'notes' ? 'active' : ''}`} onClick={() => setActiveTab('notes')}>Mis notas</button>
              <button className={`player-tab ${activeTab === 'qa' ? 'active' : ''}`} onClick={() => setActiveTab('qa')}>Q&A</button>
            </div>
            
            {activeTab === 'overview' && (
              <div className="player-content-tab active">
                <p style={{ color: 'var(--text2)', lineHeight: 1.8, fontSize: '.92rem' }}>En esta lección profundizamos en los conceptos clave. Aprenderás cuándo y cómo usar las herramientas adecuadas para evitar problemas y escribir código más eficiente en producción.</p>
                <div style={{ marginTop: '20px', padding: '16px', background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '.82rem', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)', marginBottom: '12px' }}>Lo que aprenderás</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '.87rem', color: 'var(--text2)' }}>
                    <div>✓ Diferencias clave</div>
                    <div>✓ Casos de uso reales con ejemplos</div>
                    <div>✓ Solución de problemas comunes</div>
                    <div>✓ Profiling avanzado</div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'resources' && (
              <div className="player-content-tab active">
                <div className="resource-item"><span className="resource-icon">📄</span><span className="resource-name">Slides de la lección</span><span className="resource-size">PDF · 2.4MB</span></div>
                <div className="resource-item"><span className="resource-icon">💻</span><span className="resource-name">Código fuente del ejercicio</span><span className="resource-size">ZIP · 845KB</span></div>
                <div className="resource-item"><span className="resource-icon">🔗</span><span className="resource-name">Documentación oficial</span><span className="resource-size">Enlace externo</span></div>
              </div>
            )}
            
            {activeTab === 'notes' && (
              <div className="player-content-tab active">
                <textarea className="notes-input" placeholder="Escribe tus notas sobre esta lección...&#10;&#10;Tip: Las notas se guardan automáticamente."></textarea>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => alert("Nota guardada")}>Guardar nota</button>
                </div>
              </div>
            )}
            
            {activeTab === 'qa' && (
              <div className="player-content-tab active">
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '12px' }}>💬</div>
                  <p style={{ marginBottom: '16px' }}>¿Tienes dudas sobre esta lección?</p>
                  <button className="btn btn-primary btn-sm" onClick={() => alert("Próximamente")}>Hacer una pregunta</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="player-sidebar">
          <div className="sidebar-header">
            <h3>{course.title}</h3>
            <div className="sidebar-progress-text">
              <span>Progreso del curso</span>
              <span style={{ color: 'var(--accent2)', fontWeight: 600 }}>{course.progress}%</span>
            </div>
            <div className="progress-bar" style={{ height: '6px' }}>
              <div className="progress-fill" style={{ width: `${course.progress}%` }}></div>
            </div>
          </div>
          
          <div className="sidebar-lessons">
            {CURRICULUM_DATA.map((mod, mIndex) => (
              <div key={mIndex} className="sidebar-module">
                <div className="sidebar-module-header">{mod.module}</div>
                {mod.lessons.map((l, lIndex) => {
                  const isCurrent = mIndex === modIdx && lIndex === lessIdx;
                  const cls = isCurrent ? 'sl-current active' : l.done ? 'sl-done' : 'sl-locked';
                  let icon = isCurrent ? '▶' : l.done ? '✓' : '○';
                  if (!isCurrent) icon = l.locked ? '🔒' : icon;
                  return (
                    <div 
                      key={lIndex} 
                      className={`sidebar-lesson ${isCurrent ? 'active' : ''}`}
                      onClick={() => !l.locked && navigate(`/player/${course.id}/${mIndex+1}-${lIndex+1}`)}
                    >
                      <div className={`sl-icon ${cls}`}>{icon}</div>
                      <span className="sl-title">{l.title}</span>
                      <span className="sl-dur">{l.dur}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Player;
