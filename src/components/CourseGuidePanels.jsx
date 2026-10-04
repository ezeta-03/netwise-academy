import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// El editor del curso vive en /teacher/curso/:id y, para el admin, en
// /admin/curso/:id: los enlaces internos se quedan en el panel desde el que se abrió.
const useCourseBase = () => (useLocation().pathname.startsWith('/admin/') ? '/admin' : '/teacher');
import { Plus, Trash2, CheckCircle2, Lock, Calendar, Check, BookOpen } from 'lucide-react';

// Panel "Módulos" del riel lateral -- compartido entre Contenido (donde
// clickear un módulo lo selecciona en la misma página) y otras páginas de
// la Guía docente como Rúbrica (donde clickear un módulo te manda a su
// contenido). `onModuleClick` decide el comportamiento; si no se pasa,
// navega a Contenido con ese módulo seleccionado.
export const ModulesRailPanel = ({ courseId, modules, activeModuleId, onModuleClick, onAddModule, onDeleteModule }) => {
  const navigate = useNavigate();
  const base = useCourseBase();
  const handleClick = onModuleClick || ((moduleId) => navigate(`${base}/curso/${courseId}/contenido?modulo=${moduleId}`));

  return (
    <div className="admin-panel" style={{ marginBottom: 20 }}>
      <div className="admin-panel-head"><span className="admin-panel-title">Módulos</span></div>
      <div className="dash-modules-rail">
        {modules.map((m, i) => (
          <div
            key={m.id}
            className={`dash-module-item ${m.id === activeModuleId ? 'active' : ''} ${m.deliverable?.open === false ? 'done' : ''}`}
            onClick={() => handleClick(m.id)}
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
      {onAddModule && (
        <button className="admin-btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={onAddModule}>
          <Plus size={14} /> Agregar módulo
        </button>
      )}
      {onDeleteModule && modules.length > 1 && (
        <button className="admin-btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 8, color: 'var(--rose)' }} onClick={onDeleteModule}>
          <Trash2 size={14} /> Eliminar módulo actual
        </button>
      )}
    </div>
  );
};

// Panel "Guía docente" -- visible solo en la vista de docente, el estudiante
// no tiene acceso a cronograma de evaluación ni rúbrica. `active` resalta el
// ítem de la página en la que estás (Rúbrica: TeacherCourseRubrica,
// Cronograma: TeacherCourseCronograma).
export const GuidePanel = ({ courseId, active }) => {
  const navigate = useNavigate();
  const base = useCourseBase();
  return (
    <div className="dash-guide-panel">
      <div className="dash-guide-head">
        <span className="dash-guide-title">Guía docente</span>
        <span className="dash-guide-badge"><Lock size={11} /> Solo docente</span>
      </div>
      <div
        className={`dash-guide-row ${active === 'cronograma' ? 'active' : ''}`}
        style={{ cursor: 'pointer' }}
        onClick={() => navigate(`${base}/curso/${courseId}/cronograma`)}
      >
        <div className="dash-guide-row-icon"><Calendar size={15} /></div>
        <div>
          <div className="dash-guide-row-title">Cronograma de evaluación</div>
          <div className="dash-guide-row-sub">Fechas, pesos y aprobación</div>
        </div>
      </div>
      <div
        className={`dash-guide-row ${active === 'indicaciones' ? 'active' : ''}`}
        style={{ cursor: 'pointer' }}
        onClick={() => navigate(`${base}/curso/${courseId}/indicaciones`)}
      >
        <div className="dash-guide-row-icon"><BookOpen size={15} /></div>
        <div>
          <div className="dash-guide-row-title">Indicaciones de clase</div>
          <div className="dash-guide-row-sub">Guion de cada sesión</div>
        </div>
      </div>
      <div
        className={`dash-guide-row ${active === 'rubrica' ? 'active' : ''}`}
        style={{ cursor: 'pointer' }}
        onClick={() => navigate(`${base}/curso/${courseId}/rubrica`)}
      >
        <div className="dash-guide-row-icon"><Check size={15} /></div>
        <div>
          <div className="dash-guide-row-title">Rúbrica de evaluación</div>
          <div className="dash-guide-row-sub">Criterios y niveles de logro</div>
        </div>
      </div>
    </div>
  );
};
