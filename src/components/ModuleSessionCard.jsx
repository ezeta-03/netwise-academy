import React, { useState } from 'react';
import { BookOpen, Check, ChevronDown, ChevronUp, Video, ArrowRight, Pencil, Trash2 } from 'lucide-react';

// Tarjeta de una sesión en vivo dentro de "Sesiones del módulo" -- distinto
// de las "Sesiones grabadas" (lessons con videoUrl): esto es la ficha de
// clase (fecha/hora, qué se aprende, qué se hace en clase y la tarea que
// deja para el proyecto del alumno). Se usa tal cual en la vista de
// estudiante y con botones de editar/eliminar en la de docente.
//
// `status` es un campo autorado (no calculado por fecha): 'done' | 'next' |
// 'scheduled'. Sesiones antiguas solo tenían `done` booleano -- se sigue
// aceptando como fallback.
const STATUS_META = {
  done: { label: 'Realizada', badgeClass: 'admin-status-green', checkClass: 'done' },
  next: { label: 'Próxima sesión', badgeClass: 'admin-status-violet', checkClass: 'next' },
  scheduled: { label: 'Programada', badgeClass: 'admin-status-gray', checkClass: '' },
};

const ModuleSessionCard = ({ session, number, defaultOpen = false, onEdit, onDelete }) => {
  const [open, setOpen] = useState(defaultOpen);
  const status = session.status || (session.done ? 'done' : 'scheduled');
  const meta = STATUS_META[status] || STATUS_META.scheduled;

  return (
    <div className="dash-session-card">
      <div className="dash-session-head" onClick={() => setOpen((o) => !o)}>
        <div className={`dash-session-check ${meta.checkClass}`}>
          {status === 'done' ? <Check size={13} /> : <span>{number}</span>}
        </div>
        <div className="dash-session-main">
          <div className="dash-session-meta">
            {number != null && `Sesión ${String(number).padStart(2, '0')}`}
            {session.dateLabel && ` · ${session.dateLabel}${session.time ? ` · ${session.time}` : ''}`}
          </div>
          <div className="dash-session-title">{session.title}</div>
        </div>
        <div className="dash-session-actions">
          <span className={`admin-status ${meta.badgeClass}`}>{meta.label}</span>
          {onEdit && (
            <button className="admin-icon-btn" onClick={(e) => { e.stopPropagation(); onEdit(session); }}><Pencil size={13} /></button>
          )}
          {onDelete && (
            <button className="admin-icon-btn" onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}><Trash2 size={13} /></button>
          )}
          <button className="dash-session-toggle" onClick={() => setOpen((o) => !o)}>
            {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="dash-session-body">
          {session.learn && (
            <div className="dash-session-block">
              <div className="dash-session-block-icon"><BookOpen size={15} /></div>
              <div>
                <div className="dash-session-block-title">Aprenderás</div>
                <div className="dash-session-block-text">{session.learn}</div>
              </div>
            </div>
          )}
          {session.doInClass && (
            <div className="dash-session-block">
              <div className="dash-session-block-icon"><Video size={15} /></div>
              <div>
                <div className="dash-session-block-title">Harás en clase</div>
                <div className="dash-session-block-text">{session.doInClass}</div>
              </div>
            </div>
          )}
          {session.task && (
            <div className="dash-session-task">
              <div className="dash-session-task-icon"><ArrowRight size={14} /></div>
              <div>
                <div className="dash-session-task-title">Tu tarea para el proyecto</div>
                <div className="dash-session-task-text">{session.task}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModuleSessionCard;
