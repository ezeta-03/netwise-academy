import React from 'react';
import { KIND_LABEL, itemState, daysLeft, dueLabel, hasDelivered } from '../lib/workItems';

const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '') : '');

// Fila de una entrega (práctica o entrega del módulo), igual en Mi proyecto
// (E7) y Mis entregas (E5): fecha, nombre, etiqueta y el botón según el
// estado: "Entregar", "Ver entrega" (enviada) o la nota con "Ver detalle".
const WorkRow = ({ item, sub, blocked = false, showCourse = false, onSubmit, onView }) => {
  const state = itemState(sub);
  const days = daysLeft(item.dueDate);
  const late = state === 'pending' && days !== null && days < 0;
  const soon = state === 'pending' && days !== null && days >= 0 && days <= 7;
  const due = item.dueDate ? new Date(`${item.dueDate}T12:00:00`) : null;
  const graded = state === 'reviewed' && sub?.grade !== null && sub?.grade !== undefined;

  const detail = state === 'reviewed'
    ? `${hasDelivered(sub) ? 'Calificada' : 'Calificada sin entrega'} el ${shortDate(sub.updatedAt)}`
    : state === 'submitted'
      ? `Enviada el ${shortDate(sub.submittedAt || sub.updatedAt)} · por calificar`
      : `${dueLabel(days)}${blocked ? ' · primero crea tu proyecto' : ''}`;

  return (
    <div className="class-row">
      <div className={`class-row-date ${late ? 'is-late' : soon ? 'is-soon' : 'is-plain'}`}>
        <small>{due ? due.toLocaleDateString('es-PE', { weekday: 'short' }).replace('.', '') : '—'}</small>
        <strong>{due ? String(due.getDate()).padStart(2, '0') : '··'}</strong>
      </div>
      <div className="class-row-body">
        {showCourse && <div className="class-row-course">{item.courseTitle}</div>}
        <div className="class-row-title">{item.title}</div>
        <div className="class-row-sub" style={{ gap: 8 }}>
          <span className={`work-tag ${item.kind === 'practice' ? 'is-practice' : 'is-module'}`}>{KIND_LABEL[item.kind]}</span>
          <span className={`work-due ${state === 'pending' ? (late ? 'is-late' : soon ? 'is-soon' : '') : ''}`}>{detail}</span>
        </div>
      </div>
      <div className="class-row-actions" style={{ alignItems: 'center' }}>
        {state === 'pending' && (blocked
          ? <div className="work-locked"><button className="admin-btn-edit" disabled style={{ background: '#EFEEF5', color: '#A3A1B5', cursor: 'not-allowed' }}>Entregar</button><span>Primero crea tu proyecto con la ficha</span></div>
          : <button className="admin-btn-edit" onClick={() => onSubmit(item)}>Entregar</button>)}
        {state === 'submitted' && <button className="admin-btn-ghost" onClick={() => onView(item)}>Ver entrega</button>}
        {state === 'reviewed' && (
          <>
            {graded && <span className="work-grade">{sub.grade} <small>/20</small></span>}
            <button className="admin-btn-ghost" onClick={() => onView(item)}>Ver detalle</button>
          </>
        )}
      </div>
    </div>
  );
};

export default WorkRow;
