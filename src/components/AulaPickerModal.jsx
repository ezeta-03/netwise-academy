import React from 'react';
import { X, ArrowRight } from 'lucide-react';
import ModalPortal from './ModalPortal';

// "Selecciona un aula": al entrar a un curso con varias aulas, el docente
// elige con cuál va a trabajar (asistencia, notas y entregas son por aula).
// `aulas`: [{ id, name, scheduleTime, students }].
const AulaPickerModal = ({ course, aulas, onPick, onClose }) => (
  <ModalPortal>
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-head">
          <div>
            <div className="admin-modal-title">Selecciona un aula</div>
            <div className="admin-modal-sub">{course.title} · {aulas.length} aulas</div>
          </div>
          <button className="admin-modal-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="aula-picker-list">
          {aulas.map((a, i) => (
            <button key={a.id} type="button" className="aula-picker-item" autoFocus={i === 0} onClick={() => onPick(a.id)}>
              <span>
                <strong>{a.name}</strong>
                <span className="aula-picker-sub">{a.scheduleTime || 'Sin horario definido'}</span>
                <span className="aula-picker-sub">{a.students} estudiante{a.students === 1 ? '' : 's'}</span>
              </span>
              <span className="aula-picker-enter">Entrar <ArrowRight size={14} /></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  </ModalPortal>
);

export default AulaPickerModal;
