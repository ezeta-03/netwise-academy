import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, ArrowRight, Clock3 } from 'lucide-react';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { COURSE_THUMBNAILS } from '../../lib/courseThumbnails';

const TeacherCursos = () => {
  const navigate = useNavigate();
  const { courses } = useCourseOfferings();

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Mis cursos</h1>
          <p className="admin-page-sub">Retoma tus clases y proyectos.</p>
        </div>
      </div>

      <div className="home-courses-grid">
        {courses.map((c) => (
          <div className="home-course-card" key={c.id} onClick={() => navigate(`/teacher/curso/${c.id}`)}>
            <div className="home-course-thumb"><img src={COURSE_THUMBNAILS[c.id]} alt={c.title} /></div>
            <div className="home-course-body">
              <div className="home-course-meta-row">
                <span className="home-course-tag">{c.cardTag}</span>
                <span className="home-course-live"><Video size={13} /> En vivo</span>
              </div>
              <div className="home-course-title"><span>{c.cardTitle[0]}</span><span className="accent">{c.cardTitle[1]}</span></div>
              <p className="home-course-desc">{c.cardDesc}</p>
              <div className="home-course-info"><Clock3 size={14} /> {c.duration} <span className="home-course-info-dot" /> {c.level}</div>
              <span className="home-course-link">Gestionar curso <ArrowRight size={16} /></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeacherCursos;
