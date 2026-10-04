import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Video, ArrowRight, Pencil } from 'lucide-react';
import { fetchCourseContent } from '../../lib/db';
import { getOrderedSessions } from '../../lib/courseSessions';
import { GuidePanel } from '../../components/CourseGuidePanels';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';

// "Indicaciones de clase" de la Guía docente: el guion de cada sesión del
// curso en una sola página, en el orden en que se dicta -- qué aprenden, qué
// se hace en clase y qué tarea queda para el proyecto. Es una vista de
// lectura: el texto se edita en Contenido, en la sesión de cada módulo.
const TeacherCourseIndicaciones = () => {
  const { course, group } = useOutletContext();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const base = useLocation().pathname.startsWith('/admin/') ? '/admin' : '/teacher';
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCourseContent(course.id)
      .then((data) => { if (!cancelled) { setModules(data.modules || []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [course.id]);

  if (loading) return <div className="admin-empty-hint">Cargando indicaciones...</div>;

  const numberOf = new Map(getOrderedSessions(modules).map((s) => [s.id, s.label]));
  const withSessions = modules.filter((m) => m.sessions?.length);
  const canEdit = can(currentUser, 'editContent');

  return (
    <div className="anim-fade-up d1">
      <div className="admin-two-col" style={{ gridTemplateColumns: '1fr 300px', alignItems: 'flex-start' }}>
        <div>
          <span className="dash-eyebrow">GUÍA DOCENTE · {group?.name ? `Aula ${group.name}` : course.title}</span>
          <div className="admin-page-head">
            <div>
              <h1 className="admin-page-title">Indicaciones de clase</h1>
              <p className="admin-page-sub">El guion de cada sesión, en el orden en que se dicta.</p>
            </div>
          </div>

          {withSessions.length === 0 ? (
            <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B' }}>
              Todavía no hay sesiones definidas. Agrégalas en "Contenido", dentro de cada módulo.
            </div>
          ) : withSessions.map((m, mi) => (
            <div key={m.id} className="admin-panel" style={{ marginBottom: 16 }}>
              <div className="admin-panel-head">
                <div>
                  <span className="admin-cell-sub" style={{ color: 'var(--accent)', fontWeight: 700 }}>MÓDULO {String(modules.indexOf(m) + 1).padStart(2, '0')}{m.weeksLabel ? ` · ${m.weeksLabel}` : ''}</span>
                  <div className="admin-panel-title" style={{ display: 'block', marginTop: 2 }}>{m.title}</div>
                </div>
                {canEdit && (
                  <button className="admin-btn-ghost" onClick={() => navigate(`${base}/curso/${course.id}/contenido?modulo=${m.id}`)} aria-label={`Editar sesiones de ${m.title}`}>
                    <Pencil size={13} /> Editar en Contenido
                  </button>
                )}
              </div>
              {m.tools?.length > 0 && <p className="admin-cell-sub" style={{ marginBottom: 12 }}>Herramientas: {m.tools.join(' · ')}</p>}
              {m.sessions.map((s) => (
                <div key={s.id} className="guion-session">
                  <div className="guion-session-head">
                    <span className="guion-session-num">{numberOf.get(s.id) || `S${mi + 1}`}</span>
                    <div>
                      <div className="dash-list-row-title">{s.title || 'Sesión sin título'}</div>
                      {(s.dateLabel || s.time) && <div className="admin-cell-sub">{[s.dateLabel, s.time].filter(Boolean).join(' · ')}</div>}
                    </div>
                  </div>
                  {!s.learn && !s.doInClass && !s.task ? (
                    <p className="admin-cell-sub" style={{ margin: 0 }}>Esta sesión todavía no tiene guion.</p>
                  ) : (
                    <dl className="guion-list">
                      {s.learn && <><dt><BookOpen size={14} /> Aprenderán</dt><dd>{s.learn}</dd></>}
                      {s.doInClass && <><dt><Video size={14} /> En clase</dt><dd>{s.doInClass}</dd></>}
                      {s.task && <><dt><ArrowRight size={14} /> Tarea para el proyecto</dt><dd>{s.task}</dd></>}
                    </dl>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div>
          <GuidePanel courseId={course.id} active="indicaciones" />
        </div>
      </div>
    </div>
  );
};

export default TeacherCourseIndicaciones;
