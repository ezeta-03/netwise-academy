import React, { useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStudentCourse } from '../../hooks/useStudentCourse';
import { KIND_LABEL, submissionFor, itemState, hasDelivered, submissionFiles, submissionLinks, submissionComment, daysLeft, practiceKey } from '../../lib/workItems';
import SubmitWorkModal from '../../components/SubmitWorkModal';

const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('es-PE', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Lima' }).replace(/\./g, '') : '');
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Lima' }).replace(/\./g, '') : '');
const extOf = (name) => (String(name).split('.').pop() || '').slice(0, 4).toUpperCase();

const Delivered = ({ files, links, comment }) => (
  <>
    {files.map((f) => (
      <div key={f.url} className="submit-work-file">
        <span className="submit-work-ext">{extOf(f.name)}</span>
        <div style={{ flex: 1, minWidth: 0 }}><div className="submit-work-file-name">{f.name}</div></div>
        <a className="admin-btn-ghost" href={f.url} target="_blank" rel="noreferrer">Ver</a>
      </div>
    ))}
    {links.map((l) => (
      <div key={l} className="submit-work-file">
        <span className="submit-work-ext">LINK</span>
        <div style={{ flex: 1, minWidth: 0 }}><div className="submit-work-file-name">{l.replace(/^https?:\/\//, '')}</div></div>
        <a className="admin-btn-ghost" href={l} target="_blank" rel="noreferrer">Abrir</a>
      </div>
    ))}
    {comment && (
      <div className="entrega-comment"><div className="admin-cell-sub">Tu comentario</div>{comment}</div>
    )}
  </>
);

// Ver mi entrega (E8): en una sola página la nota, el comentario del docente
// (qué hiciste bien, qué mejorar y tu siguiente paso), lo que entregó el
// alumno con sus versiones anteriores y las indicaciones. Igual para prácticas
// y entregas del módulo.
const StudentCourseEntrega = () => {
  const { course, group } = useOutletContext();
  const { kind, itemId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { data, reload } = useStudentCourse(course, group, currentUser?.uid);
  const [replacing, setReplacing] = useState(false);
  const [openVersion, setOpenVersion] = useState(null);

  if (!data) return <div className="admin-empty-hint">Cargando tu entrega...</div>;
  const key = kind === 'practica' ? practiceKey(itemId) : itemId;
  const item = data.items?.find((it) => it.key === key);
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('../proyecto'));
  if (!item) {
    return (
      <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B' }}>
        No encontramos esta entrega. <button className="admin-panel-link" onClick={() => navigate('../proyecto')}>Volver a Mi proyecto</button>
      </div>
    );
  }

  const sub = submissionFor(item, data.submissions);
  const state = itemState(sub);
  const graded = state === 'reviewed' && sub.grade !== null && sub.grade !== undefined;
  const parts = sub?.feedbackParts;
  const versions = sub?.versions || [];
  const days = daysLeft(item.dueDate);
  const canReplace = state !== 'reviewed' && (days === null || days >= 0);

  return (
    <div className="anim-fade-up d1">
      <button className="admin-panel-link entrega-back" onClick={goBack}><ArrowLeft size={14} /> Volver</button>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">{item.title}</h1>
          <p className="admin-page-sub">{course.title}{item.moduleIndex >= 0 ? ` · Módulo ${item.moduleIndex + 1}` : ''} · Lo que entregaste, el comentario de tu docente y tu nota.</p>
        </div>
        {canReplace && <button className="admin-btn-edit" onClick={() => setReplacing(true)}>{hasDelivered(sub) ? 'Reemplazar entrega' : 'Entregar'}</button>}
      </div>

      <div className="entrega-grid">
        <div className="admin-panel">
          <div className="entrega-eyebrow">Tu nota</div>
          <div className="entrega-grade">{graded ? sub.grade : '—'}<small>/20</small></div>
          <span className={`work-tag ${item.kind === 'practice' ? 'is-practice' : 'is-module'}`}>{KIND_LABEL[item.kind]}</span>
          <p className="admin-cell-sub" style={{ margin: '10px 0' }}>{state === 'reviewed' ? 'Revisa el comentario de tu docente: te ayuda a preparar lo que sigue.' : 'Por calificar.'}</p>
          {state === 'reviewed' && <div className="entrega-footnote">Calificada el {fmtDate(sub.updatedAt)}</div>}
        </div>
        <div className="admin-panel">
          <div className="entrega-eyebrow">Comentario de tu docente</div>
          {state !== 'reviewed' ? <p className="admin-cell-sub" style={{ margin: 0 }}>Por calificar.</p>
            : parts && (parts.good || parts.improve || parts.next) ? (
              <>
                {parts.good && <><div className="entrega-part">Qué hiciste bien</div><p className="entrega-text">{parts.good}</p></>}
                {parts.improve && <><div className="entrega-part">Qué debes mejorar</div><p className="entrega-text">{parts.improve}</p></>}
                {parts.next && <><div className="entrega-part">Tu siguiente paso</div><p className="entrega-text">{parts.next}</p></>}
              </>
            ) : <p className="entrega-text">{sub.feedback || 'Tu docente no dejó comentario.'}</p>}
        </div>
      </div>

      <div className="entrega-grid entrega-grid-wide">
        <div className="admin-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span className="entrega-eyebrow" style={{ margin: 0 }}>Lo que entregaste</span>
            {hasDelivered(sub) && <span className="admin-status admin-status-violet" style={{ fontSize: '.68rem' }}>Versión {versions.length + 1}{state === 'reviewed' ? ' · la que se calificó' : ''}</span>}
          </div>
          {!hasDelivered(sub) ? <p className="admin-cell-sub">Todavía no entregas nada.</p> : (
            <>
              <p className="admin-cell-sub" style={{ marginTop: 0 }}>Enviada el {fmtDateTime(sub.submittedAt || sub.updatedAt)}</p>
              <Delivered files={submissionFiles(sub)} links={submissionLinks(sub)} comment={submissionComment(sub)} />
            </>
          )}
          {versions.map((v, i) => (
            <div key={i} className="entrega-version">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span className="admin-cell-sub">Versión {versions.length - i} · {fmtDateTime(v.submittedAt)} · reemplazada</span>
                <button className="admin-panel-link" onClick={() => setOpenVersion(openVersion === i ? null : i)}>{openVersion === i ? 'Ocultar' : 'Ver'}</button>
              </div>
              {openVersion === i && <div style={{ marginTop: 8 }}><Delivered files={v.files || []} links={v.links || []} comment={v.comment || ''} /></div>}
            </div>
          ))}
        </div>
        <div className="admin-panel">
          <div className="entrega-eyebrow">Indicaciones</div>
          <p className="entrega-text">{item.instructions || 'Sin indicaciones adicionales.'}</p>
          <div className="entrega-divider" />
          <div className="entrega-part">Fecha límite</div>
          <p className="entrega-text" style={{ fontWeight: 600 }}>{item.dueAt ? fmtDateTime(item.dueAt) : 'Sin fecha límite'}</p>
          {item.kind === 'practice' && <p className="admin-cell-sub" style={{ margin: 0 }}>Creada por tu docente{item.classTitle ? ` en ${item.classTitle}` : ''}</p>}
          {item.kind === 'module' && <p className="admin-cell-sub" style={{ margin: 0 }}>Sale del sílabo del curso</p>}
        </div>
      </div>

      {replacing && <SubmitWorkModal course={course} item={item} existing={sub} onClose={() => setReplacing(false)} onSaved={reload} />}
    </div>
  );
};

export default StudentCourseEntrega;
