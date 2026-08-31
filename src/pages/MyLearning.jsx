import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Clock } from 'lucide-react';
import { COURSE_THUMBNAILS } from '../lib/courseThumbnails';
import { useAuth } from '../context/AuthContext';
import { useCourseOfferings } from '../context/CourseOfferingsContext';
import { fetchMyPreregistrations } from '../lib/db';

const MyLearning = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { courses: COURSES } = useCourseOfferings();
  const [activeTab, setActiveTab] = useState('enrolled');
  const [preregisteredIds, setPreregisteredIds] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    fetchMyPreregistrations(currentUser.uid).then(setPreregisteredIds);
  }, [currentUser]);

  const preregisteredCourses = COURSES.filter(c => preregisteredIds.includes(c.id));

  // Filter courses based on tab
  const getCoursesForTab = () => {
    switch (activeTab) {
      case 'enrolled': return COURSES.filter(c => c.enrolled && c.progress < 100);
      case 'completed': return COURSES.filter(c => c.enrolled && c.progress === 100);
      case 'preregistered': return preregisteredCourses;
      case 'certs': return [];
      default: return [];
    }
  };

  const currentCourses = getCoursesForTab();

  const enrolledCount = COURSES.filter(c => c.enrolled && c.progress < 100).length;
  const completedCount = COURSES.filter(c => c.enrolled && c.progress === 100).length;

  return (
    <div className="view active">
      <div className="my-learning-header anim-fade-up d1">
        <h1>Mi Aprendizaje</h1>
        <p>Aquí están todos tus cursos y tu progreso</p>
      </div>

      <div className="my-learning-tabs">
        <button className={`ml-tab ${activeTab === 'enrolled' ? 'active' : ''}`} onClick={() => setActiveTab('enrolled')}>En progreso ({enrolledCount})</button>
        <button className={`ml-tab ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>Completados ({completedCount})</button>
        <button className={`ml-tab ${activeTab === 'preregistered' ? 'active' : ''}`} onClick={() => setActiveTab('preregistered')}>Preinscripciones ({preregisteredCourses.length})</button>
        <button className={`ml-tab ${activeTab === 'certs' ? 'active' : ''}`} onClick={() => setActiveTab('certs')}>Certificados (0)</button>
      </div>

      <div className="enrolled-grid">
        {currentCourses.length === 0 ? (
          <div className="empty-state">
            {activeTab === 'preregistered'
              ? 'Todavía no te preinscribiste a ningún taller. Hazlo desde "Más información" en Inicio o desde la página de cada taller.'
              : 'No hay cursos en esta sección.'}
          </div>
        ) : (
          currentCourses.map(c => (
            <div key={c.id} className="enrolled-card" onClick={() => navigate(`/course/${c.id}`)}>
              <div className="ec-thumb">
                <img src={COURSE_THUMBNAILS[c.id]} alt={c.title} className="ec-thumb-img" />
                <div className="play-overlay"><div className="play-btn-sm"><Play size={20} fill="currentColor" /></div></div>
              </div>
              <div className="ec-body">
                <div className="ec-title">{c.title}</div>
                <div className="ec-instructor">por {c.instructor}</div>
                {(activeTab === 'enrolled' || activeTab === 'completed') && (
                  <>
                    <div className="ec-progress">
                      <span>Progreso del curso</span>
                      <span className="ec-pct">{c.progress}%</span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${c.progress}%` }}></div></div>
                  </>
                )}
                {activeTab === 'preregistered' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.85rem', color: 'var(--accent2)', marginTop: '8px' }}>
                    <Clock size={14} /> Te avisaremos cuando se abra la cohorte
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MyLearning;
