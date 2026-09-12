import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, Sparkles, Fingerprint, TrendingUp, Rocket, Clock3, Video, ArrowUpRight, Download, Calendar } from 'lucide-react';
import { COURSE_THUMBNAILS } from '../lib/courseThumbnails';
import { fetchCourseContent } from '../lib/db';
import { usePreregistration } from '../hooks/usePreregistration';
import { useEnrollment } from '../hooks/useEnrollment';
import { useCourseOfferings } from '../context/CourseOfferingsContext';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import DownloadProgramModal from '../components/DownloadProgramModal';

const OUTCOME_ICONS = { sparkles: Sparkles, fingerprint: Fingerprint, 'trending-up': TrendingUp, rocket: Rocket };

// Horario del acompañamiento/asistente IA -- igual para los 4 talleres, no es
// parte del contenido propio de cada curso.
const SUPPORT_HOURS = { friday: '19:00-21:00', saturday: '10:00-12:00' };

const hoursOfRange = (range) => {
  const [from, to] = range.split('-');
  const toMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  return (toMinutes(to) - toMinutes(from)) / 60;
};

const downloadProgram = (course, modules) => {
  const lines = [
    `${course.title} — Programa del curso`,
    '',
    course.description,
    '',
    `Duración: ${course.duration} · Modalidad: Online en vivo · Nivel: ${course.level.replace('Nivel ', '')}`,
    `Horario: ${course.scheduleDays.join(' y ')} · ${course.scheduleTime}`,
    `Proyecto final: ${course.projectFinal}`,
    '',
    'Módulos:',
    ...modules.map((m, i) => `  ${i + 1}. ${m.title}${m.weeksLabel ? ` (${m.weeksLabel})` : ''}`),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Programa - ${course.title}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

const CourseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { courses: COURSES } = useCourseOfferings();
  const { currentUser } = useAuth();
  const { addToast, openLoginModal } = useUI();
  const [modules, setModules] = useState([]);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);

  const course = COURSES.find(c => c.id.toString() === id);
  const relatedCourses = course ? COURSES.filter(c => c.id !== course.id).slice(0, 3) : [];

  const { isPreregistered, saving, preregister } = usePreregistration(course);
  const { isEnrolled } = useEnrollment(course);

  useEffect(() => {
    if (!course) return;
    fetchCourseContent(course.id).then((data) => setModules(data.modules || []));
  }, [course]);

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

  const isStaff = currentUser?.role === 'teacher' || currentUser?.role === 'admin';
  const Icon = OUTCOME_ICONS[course.icon] || Sparkles;
  const levelShort = course.level.replace('Nivel ', '');
  const weeklyHours = hoursOfRange(course.scheduleTime) * course.scheduleDays.length;
  const supportHours = (hoursOfRange(SUPPORT_HOURS.friday) + hoursOfRange(SUPPORT_HOURS.saturday));
  const originalPrice = course.price != null && course.promoPercent ? Math.round(course.price / (1 - course.promoPercent / 100)) : null;

  const goToMyArea = () => {
    if (!currentUser) { navigate('/login'); return; }
    if (currentUser.role === 'admin') navigate('/admin');
    else if (currentUser.role === 'teacher') navigate('/teacher');
    else navigate('/student');
  };

  const scrollToModules = () => document.getElementById('cd-modules')?.scrollIntoView({ behavior: 'smooth' });

  const enrollCourse = () => {
    if (isEnrolled) {
      navigate(`/player/${course.id}/1-1`);
      return;
    }
    if (course.enrollmentsOpen === false) {
      addToast('Las inscripciones de este taller están cerradas por ahora.', 'error');
      return;
    }
    if (course.price == null) {
      if (!currentUser) { openLoginModal(); return; }
      preregister();
      return;
    }
    navigate(`/checkout/${course.id}`);
  };

  const enrollLabel = isEnrolled
    ? <><Check size={16} /> Continuar viendo</>
    : course.enrollmentsOpen === false
      ? 'Inscripciones cerradas'
      : course.price == null
        ? (isPreregistered ? <><Check size={16} /> Ya estás preinscrito</> : (saving ? 'Guardando...' : 'Preinscribirme'))
        : course.price === 0 ? 'Inscribirse gratis' : <>Inscribirme <ArrowUpRight size={16} /></>;

  return (
    <div className="view active">
      <section className="cd-hero">
        <div className="cd-hero-inner">
          <h1 className="cd-hero-title">{course.cardTitle.join(' ')}.<span className="cd-hero-dot" /></h1>
          <p className="cd-hero-desc">{course.description}</p>

          <div className="cd-hero-media-row">
            <div className="cd-video-card">
              <img src={COURSE_THUMBNAILS[course.id]} alt={course.title} />
              <span className="cd-video-caption"><Video size={14} /> Presentación del curso</span>
            </div>

            <div className="cd-outcome-card">
              <Icon size={30} className="cd-outcome-icon" />
              <span className="cd-outcome-eyebrow">Lo que lograrás</span>
              <div className="cd-outcome-headline">{course.outcomeHeadline}</div>
              <div className="cd-outcome-stats">
                <div className="cd-outcome-stat"><Clock3 size={16} /><span className="cd-outcome-stat-label">Duración</span><span className="cd-outcome-stat-value">{course.duration}</span></div>
                <div className="cd-outcome-stat"><Video size={16} /><span className="cd-outcome-stat-label">Modalidad</span><span className="cd-outcome-stat-value">Online en vivo</span></div>
                <div className="cd-outcome-stat"><Check size={16} /><span className="cd-outcome-stat-label">Nivel</span><span className="cd-outcome-stat-value">{levelShort}</span></div>
              </div>
              <button className="cd-outcome-cta" onClick={scrollToModules}>Ver Programa <ArrowUpRight size={16} /></button>
            </div>
          </div>
        </div>
      </section>

      <div className="cd-body">
        <div className="cd-body-inner">
          <div className="cd-body-grid">
            <div className="cd-body-main">
              <div className="cd-desc-text">
                {course.longDescription.map((p, i) => <p key={i}>{p}</p>)}
              </div>

              <h2 className="cd-section-h2">Lo que podrás <em>hacer.</em></h2>
              <ul className="cd-bullets">
                {course.doableList.map((d, i) => <li key={i}>{d}</li>)}
              </ul>

              <h2 className="cd-section-h2" id="cd-modules">Lo que vas a <em>aprender.</em></h2>
              <p className="cd-section-sub">Cuatro módulos, ocho semanas y un entregable práctico en cada etapa. Lleva lo aprendido a tu propio proyecto.</p>

              {modules.length === 0 ? (
                <p className="cd-section-sub">El programa detallado de este módulo se publica muy pronto.</p>
              ) : (
                <div className="cd-modules">
                  {modules.map((m, i) => (
                    <div key={m.id} className="cd-module-row">
                      <div className="cd-module-num">{i + 1}</div>
                      <div>
                        <div className="cd-module-title">{m.title}</div>
                        {m.weeksLabel && <div className="cd-module-weeks">{m.weeksLabel}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {modules.length > 0 && (
                <div className="cd-download-wrap">
                  <button className="cd-download-btn" onClick={() => setDownloadModalOpen(true)}><Download size={16} /> Descargar programa del curso</button>
                  <p className="cd-download-caption">Consulta los contenidos y entregables de cada módulo en el programa completo.</p>
                </div>
              )}

              <h2 className="cd-section-h2">Horario del <em>curso práctico</em></h2>
              <div className="cd-schedule-card">
                <div className="cd-schedule-course">{course.title}</div>
                <div className="cd-schedule-days">
                  {course.scheduleDays.map((day) => (
                    <div key={day} className="cd-schedule-day">
                      <Calendar size={16} />
                      <div>
                        <div className="cd-schedule-day-name">{day}</div>
                        <div className="cd-schedule-day-time">{course.scheduleTime}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cd-schedule-modality"><Video size={15} /> En vivo (Zoom / Meet)</div>
                <div className="cd-schedule-hours"><Clock3 size={16} color="var(--accent)" /> <strong>{weeklyHours} horas</strong> <span>/ semana de clases</span></div>
              </div>

              <div className="cd-support-card">
                <span className="cd-support-badge">Sin costo extra</span>
                <div className="cd-support-title">Soporte práctico y asistente IA incluído</div>
                <p className="cd-support-desc">Tu curso ya incluye este acompañamiento para reforzar lo aprendido y seguir practicando. {supportHours} horas extras a la semana.</p>
                <div className="cd-support-hours">
                  <div className="cd-support-hour"><Calendar size={15} /><div><div className="cd-support-day">Viernes</div><div className="cd-support-time">{SUPPORT_HOURS.friday}</div></div></div>
                  <div className="cd-support-divider" />
                  <div className="cd-support-hour"><Calendar size={15} /><div><div className="cd-support-day">Sábado</div><div className="cd-support-time">{SUPPORT_HOURS.saturday}</div></div></div>
                </div>
              </div>
            </div>

            <div className="cd-sidebar-card">
              {isStaff ? (
                <>
                  <div className="cd-sidebar-title">Vista pública del taller</div>
                  <p style={{ fontSize: '.82rem', color: '#8B8A9B', marginBottom: 18 }}>
                    Así lo ven los visitantes. Como {currentUser.role === 'admin' ? 'administrador' : 'docente'} no te inscribes aquí — gestiona el taller desde tu panel.
                  </p>
                  <button className="cd-enroll-btn" onClick={goToMyArea}>Ir a mi panel</button>
                </>
              ) : (
                <>
                  <div className="cd-sidebar-title">Tu siguiente paso empieza aquí.</div>
                  <div className="cd-detail-row"><span className="cd-detail-label">Modalidad</span><span className="cd-detail-value">Online en vivo</span></div>
                  <div className="cd-detail-row"><span className="cd-detail-label">Duración</span><span className="cd-detail-value">{course.duration}</span></div>
                  <div className="cd-detail-row"><span className="cd-detail-label">Horario</span><span className="cd-detail-value">{course.scheduleDays.join(' y ')} · {course.scheduleTime}</span></div>
                  <div className="cd-detail-row"><span className="cd-detail-label">Carga semanal</span><span className="cd-detail-value">{weeklyHours} horas · {course.scheduleDays.length} sesiones</span></div>
                  <div className="cd-detail-row"><span className="cd-detail-label">Horas extras</span><span className="cd-detail-value">{supportHours} horas · 2 sesiones</span></div>
                  <div className="cd-detail-row"><span className="cd-detail-label">Nivel</span><span className="cd-detail-value">{levelShort}</span></div>
                  <div className="cd-detail-row"><span className="cd-detail-label">Proyecto final</span><span className="cd-detail-value">{course.projectFinal}</span></div>

                  <div className="cd-price-block">
                    {course.price == null ? (
                      <div className="cd-price-value" style={{ fontSize: '1.1rem' }}>Precio por confirmar</div>
                    ) : (
                      <>
                        {originalPrice && (
                          <div className="cd-price-old-row">
                            <span className="cd-price-old">Antes S/ {originalPrice.toFixed(2)}</span>
                            <span className="cd-price-badge">-{course.promoPercent}%</span>
                          </div>
                        )}
                        <div className="cd-price-value">S/<strong>{course.price === 0 ? 'Gratis' : course.price}</strong>{course.price !== 0 && <span style={{ fontSize: '1.1rem' }}>.00</span>}</div>
                      </>
                    )}

                    <button
                      className="cd-enroll-btn"
                      onClick={enrollCourse}
                      disabled={(!isEnrolled && course.enrollmentsOpen === false) || (course.price == null && !isEnrolled && (isPreregistered || saving))}
                    >
                      {enrollLabel}
                    </button>
                    {course.price == null && !isPreregistered && (
                      <p style={{ fontSize: '.76rem', color: '#9795A8', textAlign: 'center', marginTop: -8, marginBottom: 14 }}>
                        Te avisaremos por correo apenas se confirme la fecha y el precio.
                      </p>
                    )}

                    <div className="cd-access-note">
                      ¿Ya formas parte de la academia?
                      <br />
                      <a onClick={goToMyArea}>Acceder al aula <ArrowUpRight size={14} /></a>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <span className="cd-related-eyebrow">Sigue explorando</span>
          <h2 className="cd-related-title">Más herramientas.<br /><em>Nuevas posibilidades.</em></h2>
          <div className="home-courses-grid cols-3">
            {relatedCourses.map((c) => (
              <div className="home-course-card" key={c.id} onClick={() => navigate(`/course/${c.id}`)}>
                <div className="home-course-thumb"><img src={COURSE_THUMBNAILS[c.id]} alt={c.title} /></div>
                <div className="home-course-body">
                  <div className="home-course-meta-row">
                    <span className="home-course-tag">{c.cardTag}</span>
                    <span className="home-course-live"><Video size={13} /> En vivo</span>
                  </div>
                  <div className="home-course-title"><span>{c.cardTitle[0]}</span><span className="accent">{c.cardTitle[1]}</span></div>
                  <p className="home-course-desc">{c.cardDesc}</p>
                  <div className="home-course-info"><Clock3 size={14} /> {c.duration} <span className="home-course-info-dot" /> {c.level.replace('Nivel ', '')}</div>
                  <span className="home-course-link">Ver curso <ArrowUpRight size={16} /></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {downloadModalOpen && (
        <DownloadProgramModal
          course={course}
          onClose={() => setDownloadModalOpen(false)}
          onDownload={() => downloadProgram(course, modules)}
        />
      )}
    </div>
  );
};

export default CourseDetail;
