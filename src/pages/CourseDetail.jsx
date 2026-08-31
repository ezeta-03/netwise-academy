import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { CATEGORIES } from '../lib/data';
import { COURSE_THUMBNAILS } from '../lib/courseThumbnails';
import { useCulqi } from '../hooks/useCulqi';
import { usePreregistration } from '../hooks/usePreregistration';
import { useEnrollment } from '../hooks/useEnrollment';
import { useCourseOfferings } from '../context/CourseOfferingsContext';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';

const CourseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { courses: COURSES } = useCourseOfferings();
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const [enrolling, setEnrolling] = useState(false);

  const course = COURSES.find(c => c.id.toString() === id);
  const relatedCourses = course ? COURSES.filter(c => c.id !== course.id).slice(0, 3) : [];

  const { openCulqiCheckout } = useCulqi(course?.price ? course.price * 3.75 : 0, course?.title || ''); // PEN conversion dummy
  const { isPreregistered, saving, preregister } = usePreregistration(course);
  const { isEnrolled, enroll } = useEnrollment(course);

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

  const getCatLabel = (catId) => {
    const cat = CATEGORIES.find(c => c.id === catId);
    return cat ? cat.label.replace(/[^a-zA-Z\s]/g, '').trim() : 'Categoría';
  };

  const enrollCourse = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    if (isEnrolled) {
      navigate(`/player/${course.id}/1-1`);
      return;
    }
    if (course.price == null) {
      preregister();
      return;
    }
    setEnrolling(true);
    if (course.price === 0) {
      await enroll();
      setEnrolling(false);
      addToast('Te has inscrito en el taller gratuito.', 'success');
      navigate(`/player/${course.id}/1-1`);
    } else {
      openCulqiCheckout();
      // En una integración real, esto pasaría dentro del callback de éxito de Culqi.
      setTimeout(async () => {
        await enroll();
        setEnrolling(false);
        navigate(`/player/${course.id}/1-1`);
      }, 1600);
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
          <p className="cd-description">{course.description}</p>

          <div className="cd-meta-row">
            <span className="badge badge-sky">{getCatLabel(course.cat)}</span>
            <div className="cd-meta-item">🌐 100% online · síncrono + asíncrono</div>
          </div>

          <div className="instructor-card">
            <div className="instructor-avatar">{course.instructor.split(' ').map(n => n[0]).join('')}</div>
            <div>
              <div className="instructor-name">{course.instructor}</div>
              <div className="instructor-role">Especialistas en growth marketing</div>
              <div className="instructor-bio">Enseñamos las mismas herramientas y procesos que usamos a diario con nuestros clientes reales.</div>
            </div>
          </div>

          <div className="curriculum">
            <div className="curriculum-header">
              <h3>Lo que aprenderás</h3>
            </div>
            <div className="cd-highlights">
              {course.highlights.map((h, hi) => (
                <div key={hi} className="cd-highlight-item">
                  <span className="cd-highlight-icon">✓</span>
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="course-sidebar anim-fade-up d2">
          <div className="preview-card">
            <div className="preview-thumb">
              <img src={COURSE_THUMBNAILS[course.id]} alt={course.title} />
            </div>
            <div className="preview-body">
              {course.price == null ? (
                <div className="preview-price" style={{ fontSize: '1.3rem' }}>Precio por confirmar</div>
              ) : (
                <div className="preview-price">{course.price === 0 ? 'Gratis' : `S/ ${course.price}`}</div>
              )}
              <div className="preview-discount" style={{ color: 'var(--text2)' }}>
                {course.startDate
                  ? `Inicia el ${new Date(course.startDate + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}`
                  : 'Fecha de inicio: próximamente'}
              </div>

              <button
                className={`btn btn-full btn-lg ${isPreregistered && !isEnrolled ? 'btn-ghost' : 'btn-primary'}`}
                style={{ marginBottom: '10px' }}
                onClick={enrollCourse}
                disabled={enrolling || (course.price == null && !isEnrolled && (isPreregistered || saving))}
              >
                {isEnrolled
                  ? <><Check size={18} /> Continuar viendo</>
                  : course.price == null
                    ? (isPreregistered ? <><Check size={18} /> Ya estás preinscrito</> : (saving ? 'Guardando...' : 'Preinscribirme'))
                    : enrolling ? 'Procesando...' : course.price === 0 ? 'Inscribirse gratis' : 'Comprar ahora'}
              </button>
              {course.price == null && !isPreregistered && (
                <p style={{ fontSize: '.78rem', color: 'var(--text3)', textAlign: 'center', marginTop: '-4px', marginBottom: '10px' }}>
                  Te avisaremos por correo apenas se confirme la fecha y el precio.
                </p>
              )}

              <div className="preview-includes">
                <h4>Este taller incluye:</h4>
                <div className="include-item"><span>🧩</span><span>Proyecto propio validado en el mercado</span></div>
                <div className="include-item"><span>🧑‍🏫</span><span>Mentoría personalizada</span></div>
                <div className="include-item"><span>🎥</span><span>Sesiones en vivo + trabajo asíncrono</span></div>
                <div className="include-item"><span>🏆</span><span>Certificado de finalización</span></div>
              </div>
            </div>
          </div>

          <div>
            <div className="section-header" style={{ marginBottom: '14px' }}>
              <div className="section-title-text" style={{ fontSize: '1rem' }}>Otros talleres</div>
            </div>
            <div>
              {relatedCourses.map(r => (
                <div key={r.id} className="reco-card" onClick={() => navigate(`/course/${r.id}`)} style={{ marginBottom: '10px' }}>
                  <div className="reco-thumb" style={{ width: '64px', height: '48px', borderRadius: '8px' }}>
                    <img src={COURSE_THUMBNAILS[r.id]} alt={r.title} />
                  </div>
                  <div className="reco-body">
                    <div className="reco-title" style={{ fontSize: '.83rem' }}>{r.title}</div>
                    <div className="reco-meta">
                      <span>{r.price == null ? 'Precio por confirmar' : r.price === 0 ? 'Gratis' : `S/ ${r.price}`}</span>
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
