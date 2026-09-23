import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { Check, CheckCircle2, FileText, Sparkles, Target, Video } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchCourseContent, fetchProjectAdvances, fetchProjectProfile } from '../../lib/db';
import ModuleSessionCard from '../../components/ModuleSessionCard';
import { isPendingUrl } from '../../lib/placeholders';

const StudentCourseContenido = () => {
  const { course } = useOutletContext();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modules, setModules] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [advances, setAdvances] = useState({});
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    Promise.all([fetchCourseContent(course.id), fetchProjectAdvances(currentUser.uid, course.id), fetchProjectProfile(currentUser.uid, course.id)]).then(([content, adv, profile]) => {
      const mods = content.modules || [];
      setModules(mods);
      setAdvances(adv);
      setHasProfile(!!profile);
      const fromQuery = searchParams.get('modulo');
      setSelectedId(fromQuery && mods.some((m) => m.id === fromQuery) ? fromQuery : mods[0]?.id || null);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id, currentUser]);

  const selected = modules.find((m) => m.id === selectedId);
  const selectedIndex = modules.findIndex((m) => m.id === selectedId);
  const sessionOffset = modules.slice(0, selectedIndex).reduce((sum, m) => sum + (m.sessions?.length || 0), 0);

  if (loading) return <div className="admin-empty-hint">Cargando contenido...</div>;

  if (modules.length === 0) {
    return (
      <div className="anim-fade-up d1">
        <div className="admin-page-head"><div><h1 className="admin-page-title">Contenido</h1><p className="admin-page-sub">{course.title}</p></div></div>
        <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B' }}>Este curso todavía no tiene módulos publicados.</div>
      </div>
    );
  }

  const doneCount = (advances[selected.id] || []).length;
  const totalBullets = selected.practiceBullets?.length || 0;
  const moduleClosed = selected.deliverable?.open === false;

  return (
    <div className="anim-fade-up d1">
      <div className="admin-two-col" style={{ gridTemplateColumns: '1fr 300px', alignItems: 'flex-start' }}>
        <div>
          <span className="dash-eyebrow">{selected.weeksLabel ? `${selected.title.toUpperCase()} · ${selected.weeksLabel}` : selected.title.toUpperCase()}</span>
          <h1 className="admin-page-title">{selected.title}</h1>
          <p className="admin-page-sub" style={{ marginBottom: 20 }}>{course.title}</p>

          {selected.objective && (
            <div className="dash-callout">
              <div className="dash-callout-label">Objetivo</div>
              <div className="dash-callout-text">{selected.objective}</div>
            </div>
          )}

          {(selected.practiceIntro || selected.practiceBullets?.length > 0) && (
            <div style={{ marginBottom: 22 }}>
              <h3 style={{ fontSize: '1rem', color: '#14141F', marginBottom: 6 }}>Contenidos y práctica</h3>
              {selected.practiceIntro && <p style={{ fontSize: '.88rem', color: '#4A4860' }}>{selected.practiceIntro}</p>}
              {selected.practiceBullets?.length > 0 && (
                <ul className="dash-bullets">{selected.practiceBullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
              )}
            </div>
          )}

          {selected.sessions?.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <h3 style={{ fontSize: '1rem', color: '#14141F', marginBottom: 6 }}>Sesiones del módulo</h3>
              {selected.tools?.length > 0 && <div className="dash-session-tools">{selected.tools.join(' · ')}</div>}
              {selected.sessions.map((s, i) => <ModuleSessionCard key={s.id} session={s} number={sessionOffset + i + 1} />)}
            </div>
          )}

          <div className="admin-panel" style={{ marginBottom: 20 }}>
            <div className="admin-panel-head"><span className="admin-panel-title">Materiales de este módulo</span></div>
            {(selected.materials || []).length === 0 ? (
              <p className="admin-panel-caption" style={{ marginTop: 0 }}>Este módulo todavía no tiene materiales.</p>
            ) : selected.materials.map((mat) => (
              <div key={mat.id} className="dash-list-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="dash-list-row-icon"><FileText size={17} /></div>
                  <div>
                    <div className="dash-list-row-title">{mat.title}</div>
                    <div className="dash-list-row-sub">{mat.category} · {selected.title}</div>
                  </div>
                </div>
                {isPendingUrl(mat.url) ? <span className="admin-status admin-status-gray">Pendiente de subir</span> : <a className="admin-btn-ghost" href={mat.url} target="_blank" rel="noreferrer">Descargar</a>}
              </div>
            ))}
          </div>

          <div className="admin-panel" style={{ marginBottom: 20 }}>
            <div className="admin-panel-head"><span className="admin-panel-title">Sesiones grabadas</span></div>
            <p className="admin-panel-caption" style={{ marginTop: 0 }}>
              {selected.lessons.length === 0 ? 'Todavía no hay grabaciones para este módulo.' : 'Vuelve a ver las clases pasadas de este módulo a tu ritmo.'}
            </p>
            {selected.lessons.map((les, li) => (
              <div key={les.id} className="dash-list-row">
                <div>
                  <div className="dash-list-row-eyebrow">Sesión {String(li + 1).padStart(2, '0')}</div>
                  <div className="dash-list-row-title">{les.title}</div>
                  <div className="dash-list-row-sub">{les.date ? `${les.date} · ` : ''}{les.duration || 'Sin duración'}</div>
                </div>
                {isPendingUrl(les.videoUrl) ? <span className="admin-status admin-status-gray">Pendiente de grabar</span> : <button className="admin-btn-ghost" onClick={() => navigate(`/player/${course.id}/${selectedIndex + 1}-${li + 1}`)}><Video size={13} /> Ver grabación</button>}
              </div>
            ))}
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head">
              <span className="admin-panel-title">Entregable</span>
              {moduleClosed && <span className="admin-status admin-status-green">Módulo completado</span>}
            </div>
            <p style={{ fontSize: '.88rem', color: '#4A4860', marginBottom: 10 }}>{selected.deliverable?.description || 'Este módulo todavía no tiene un entregable definido.'}</p>
            {selected.deliverable?.checklist?.length > 0 && (
              <>
                <p style={{ fontSize: '.82rem', fontWeight: 700, color: '#14141F', marginBottom: 0 }}>Tu entregable debe incluir</p>
                <ul className="dash-checklist">
                  {selected.deliverable.checklist.map((c, i) => <li key={i}><Check size={15} />{c}</li>)}
                </ul>
              </>
            )}
            {totalBullets > 0 && (
              <p className="admin-cell-sub" style={{ marginBottom: 16 }}>Avances de tu proyecto en este módulo · {doneCount} de {totalBullets}</p>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="admin-btn-edit" onClick={() => navigate(`/student/curso/${course.id}/proyecto`)}>
                <Target size={14} /> {hasProfile ? 'Abrir mi proyecto' : 'Crear mi proyecto'}
              </button>
              {selected.lessons.length > 0 && (
                <button className="admin-btn-ghost" onClick={() => navigate(`/player/${course.id}/${selectedIndex + 1}-1`)}><Video size={14} /> Ver la clase</button>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="admin-panel" style={{ marginBottom: 20 }}>
            <div className="admin-panel-head"><span className="admin-panel-title">Módulos</span></div>
            <div className="dash-modules-rail">
              {modules.map((m, i) => (
                <div
                  key={m.id}
                  className={`dash-module-item ${m.id === selectedId ? 'active' : ''} ${m.deliverable?.open === false ? 'done' : ''}`}
                  onClick={() => { setSelectedId(m.id); setSearchParams({}); }}
                >
                  <div className="dash-module-num">{String(i + 1).padStart(2, '0')}</div>
                  <div className="dash-module-item-body">
                    <div className="dash-module-title">{m.title}</div>
                    <div className="dash-module-sub">{m.deliverable?.open === false ? 'Completado' : (m.weeksLabel || '')}</div>
                  </div>
                  {m.deliverable?.open === false && <div className="dash-module-check"><CheckCircle2 size={13} /></div>}
                </div>
              ))}
            </div>
          </div>

          <div className="admin-panel" style={{ background: 'var(--accent-bg)' }}>
            <div className="admin-panel-head"><span className="admin-panel-title"><Sparkles size={15} style={{ verticalAlign: -2, marginRight: 4 }} color="var(--accent)" /> Asistente IA</span></div>
            <p className="admin-cell-sub" style={{ marginBottom: 14 }}>Resuelve dudas sobre este curso.</p>
            <button className="admin-btn-edit" onClick={() => navigate(`/student/curso/${course.id}/ia`)}>Abrir asistente</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentCourseContenido;
