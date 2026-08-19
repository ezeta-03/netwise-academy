import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { COURSES } from '../lib/data';

const MyLearning = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('enrolled');

  // Filter courses based on tab
  const getCoursesForTab = () => {
    switch (activeTab) {
      case 'enrolled': return COURSES.filter(c => c.enrolled && c.progress < 100);
      case 'completed': return COURSES.filter(c => c.enrolled && c.progress === 100);
      case 'wishlist': return COURSES.filter(c => !c.enrolled).slice(0, 7); // dummy wishlist
      case 'certs': return [];
      default: return [];
    }
  };

  const currentCourses = getCoursesForTab();

  return (
    <div className="view active">
      <div className="my-learning-header anim-fade-up d1">
        <h1>Mi Aprendizaje</h1>
        <p>Aquí están todos tus cursos y tu progreso</p>
      </div>
      
      <div className="my-learning-tabs">
        <button className={`ml-tab ${activeTab === 'enrolled' ? 'active' : ''}`} onClick={() => setActiveTab('enrolled')}>En progreso (4)</button>
        <button className={`ml-tab ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>Completados (3)</button>
        <button className={`ml-tab ${activeTab === 'wishlist' ? 'active' : ''}`} onClick={() => setActiveTab('wishlist')}>Lista de deseos (7)</button>
        <button className={`ml-tab ${activeTab === 'certs' ? 'active' : ''}`} onClick={() => setActiveTab('certs')}>Certificados (3)</button>
      </div>
      
      <div className="enrolled-grid">
        {currentCourses.length === 0 ? (
          <div className="empty-state">No hay cursos en esta sección.</div>
        ) : (
          currentCourses.map(c => (
            <div key={c.id} className="enrolled-card" onClick={() => navigate(`/course/${c.id}`)}>
              <div className="ec-thumb" style={{ background: `linear-gradient(135deg, ${c.color})` }}>
                {c.emoji}
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
                {activeTab === 'wishlist' && (
                  <div style={{ fontSize: '.85rem', color: 'var(--text2)', marginTop: '8px' }}>
                    Agregado recientemente
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
