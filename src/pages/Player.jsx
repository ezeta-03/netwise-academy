import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchCourseContent, fetchMyEnrollments, markLessonComplete } from '../lib/db';
import { toEmbedUrl } from '../lib/embedUrl';
import { useCourseOfferings } from '../context/CourseOfferingsContext';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';

const Player = () => {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const { courses: COURSES } = useCourseOfferings();
  const { currentUser } = useAuth();
  const { addToast } = useUI();

  const [activeTab, setActiveTab] = useState('overview');
  const [isPlaying, setIsPlaying] = useState(false);
  const [modules, setModules] = useState(null); // null = cargando
  const [progress, setProgress] = useState(0);
  const [completedLessonIds, setCompletedLessonIds] = useState([]);
  const [marking, setMarking] = useState(false);

  const course = COURSES.find(c => c.id.toString() === courseId);

  useEffect(() => {
    if (!courseId) return;
    fetchCourseContent(courseId).then((data) => setModules(data.modules || []));
  }, [courseId]);

  useEffect(() => {
    if (!currentUser || !courseId) return;
    fetchMyEnrollments(currentUser.uid).then((map) => {
      const record = map[courseId];
      setProgress(record?.progress ?? 0);
      setCompletedLessonIds(record?.completedLessonIds ?? []);
    });
  }, [currentUser, courseId]);

  if (!course) {
    return (
      <div className="view active">
        <div className="empty-state" style={{ padding: '96px 24px' }}>
          <div className="es-icon">📭</div>
          <p>Este curso no existe o todavía no está disponible.</p>
          <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => navigate('/catalog')}>Ver catálogo</button>
        </div>
      </div>
    );
  }

  if (modules === null) {
    return (
      <div className="view active">
        <div className="empty-state" style={{ padding: '96px 24px' }}><p>Cargando lecciones...</p></div>
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="view active">
        <div className="empty-state" style={{ padding: '96px 24px' }}>
          <div className="es-icon">🎬</div>
          <p>Este curso todavía no tiene lecciones publicadas. Vuelve pronto.</p>
          <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => navigate(`/course/${course.id}`)}>Volver al curso</button>
        </div>
      </div>
    );
  }

  // Deriva el módulo/lección desde la URL (formato "1-1" = módulo 1, lección
  // 1). Si el índice pedido no existe (curso recortado, link viejo, etc.) cae
  // al primero disponible en vez de romper.
  const [modIdxRaw, lessIdxRaw] = (lessonId || '1-1').split('-').map(n => parseInt(n) - 1);
  const modIdx = modules[modIdxRaw] ? modIdxRaw : 0;
  const module = modules[modIdx];
  const lessIdx = module.lessons[lessIdxRaw] ? lessIdxRaw : 0;
  const lesson = module.lessons[lessIdx];

  if (!lesson) {
    return (
      <div className="view active">
        <div className="empty-state" style={{ padding: '96px 24px' }}>
          <div className="es-icon">🎬</div>
          <p>Este módulo todavía no tiene lecciones.</p>
          <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => navigate(`/course/${course.id}`)}>Volver al curso</button>
        </div>
      </div>
    );
  }

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const isLessonDone = completedLessonIds.includes(lesson.id);

  const handleMarkComplete = async () => {
    if (!currentUser || isLessonDone || marking) return;
    setMarking(true);
    try {
      const updated = await markLessonComplete(currentUser.uid, course.id, lesson.id, totalLessons);
      if (updated) {
        setProgress(updated.progress);
        setCompletedLessonIds(updated.completedLessonIds);
      }
      addToast('Lección marcada como completada.', 'success');
    } finally {
      setMarking(false);
    }
  };

  const goNext = () => {
    let nextLess = lessIdx + 1;
    let nextMod = modIdx;
    if (nextLess >= module.lessons.length) {
      nextMod += 1;
      nextLess = 0;
    }
    if (nextMod < modules.length) {
      navigate(`/player/${course.id}/${nextMod + 1}-${nextLess + 1}`);
      setIsPlaying(false);
    }
  };

  const goPrev = () => {
    let prevLess = lessIdx - 1;
    let prevMod = modIdx;
    if (prevLess < 0) {
      prevMod -= 1;
      if (prevMod >= 0) prevLess = modules[prevMod].lessons.length - 1;
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
                <iframe src={toEmbedUrl(lesson.videoUrl)} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="Video"></iframe>
              )}
            </div>
          </div>

          <div className="player-info">
            <div className="player-breadcrumb" onClick={() => navigate(`/course/${course.id}`)}>
              ← {course.title}
            </div>

            <div className="player-lesson-title">{lesson.title}</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              {lesson.duration && <span className="badge badge-sky">📺 Video · {lesson.duration}</span>}
              <span className="badge badge-accent">{module.title}</span>
            </div>

            <div className="player-nav">
              <button className="btn btn-ghost btn-sm" onClick={goPrev}>← Anterior</button>
              <button className="btn btn-primary btn-sm" onClick={handleMarkComplete} disabled={isLessonDone || marking}>
                {isLessonDone ? '✓ Completada' : marking ? 'Guardando...' : '✓ Marcar completada'}
              </button>
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
                <p style={{ color: 'var(--text2)', lineHeight: 1.8, fontSize: '.92rem' }}>{course.description}</p>
              </div>
            )}

            {activeTab === 'resources' && (
              <div className="player-content-tab active">
                {lesson.resources?.length > 0 ? lesson.resources.map((r, ri) => (
                  <a key={ri} className="resource-item" href={r.url} target="_blank" rel="noopener noreferrer">
                    <span className="resource-icon">🔗</span><span className="resource-name">{r.title}</span>
                  </a>
                )) : (
                  <p style={{ color: 'var(--text3)', fontSize: '.9rem', padding: '12px 0' }}>Esta lección no tiene materiales adjuntos.</p>
                )}
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
              <span style={{ color: 'var(--accent2)', fontWeight: 600 }}>{progress}%</span>
            </div>
            <div className="progress-bar" style={{ height: '6px' }}>
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
          </div>

          <div className="sidebar-lessons">
            {modules.map((mod, mIndex) => (
              <div key={mod.id} className="sidebar-module">
                <div className="sidebar-module-header">{mod.title}</div>
                {mod.lessons.map((l, lIndex) => {
                  const isCurrent = mIndex === modIdx && lIndex === lessIdx;
                  const isDone = completedLessonIds.includes(l.id);
                  const cls = isCurrent ? 'sl-current active' : isDone ? 'sl-done' : '';
                  return (
                    <div
                      key={l.id}
                      className={`sidebar-lesson ${isCurrent ? 'active' : ''}`}
                      onClick={() => navigate(`/player/${course.id}/${mIndex + 1}-${lIndex + 1}`)}
                    >
                      <div className={`sl-icon ${cls}`}>{isCurrent ? '▶' : isDone ? '✓' : '○'}</div>
                      <span className="sl-title">{l.title}</span>
                      <span className="sl-dur">{l.duration}</span>
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
