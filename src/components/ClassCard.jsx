import React from 'react';
import { Video, Clock, Play } from 'lucide-react';
import { getClassCardState, relativeClassLabel, sessionEndsAt, LIVE_JOIN_WINDOW_MIN } from '../lib/liveSessionStatus';
import { isSafeLink } from '../lib/placeholders';
import { useNow } from '../hooks/useNow';
import { generalClassLabel } from '../lib/generalClasses';

const fmtTime = (d) => d.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' });

// "Hoy, mié 28 oct · 7:00 – 9:00 p. m." (o sin "Hoy," si es otro día).
const classScheduleLine = (session, now = Date.now()) => {
  const start = new Date(session.startsAt);
  const end = sessionEndsAt(session);
  const day = start.toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', '');
  const isToday = new Date(now).toDateString() === start.toDateString();
  return `${isToday ? 'Hoy, ' : ''}${day} · ${fmtTime(start)} – ${fmtTime(end)}`;
};

// Botón para entrar a la clase, con las mismas reglas en todas las pantallas
// (C1): gris hasta 10 min antes, activo mientras la clase está en vivo y abre
// el Meet del aula directo en otra pestaña -- sin sala de espera.
export const MeetButton = ({ session, meetLink, role = 'student', size = 'md', now: nowProp }) => {
  const tick = useNow();
  const now = nowProp ?? tick;
  const state = getClassCardState(session, now);
  const label = role === 'teacher' ? 'Iniciar clase en Meet' : 'Entrar a Meet';
  const cls = `class-meet-btn ${size === 'sm' ? 'class-meet-btn-sm' : ''}`;
  if (state === 'cancelled' || state === 'ended') return null;
  if (state === 'scheduled') {
    return <button type="button" className={`${cls} is-disabled`} disabled title={`Se activa ${LIVE_JOIN_WINDOW_MIN} min antes de la clase`}><Video size={14} /> {label}</button>;
  }
  if (!meetLink) {
    return <button type="button" className={`${cls} is-disabled`} disabled title="Esta aula todavía no tiene enlace de Meet. Escríbenos por Soporte."><Video size={14} /> {label}</button>;
  }
  return (
    <a className={cls} href={meetLink} target="_blank" rel="noreferrer" title={session.general ? 'Abre el enlace de Meet de esta clase general' : role === 'teacher' ? 'Abre la sala de Meet del aula' : 'Abre la sala de Google Meet de tu aula. Entra con tu correo @netwiseacademy.pe'}>
      <Video size={14} /> {label}
    </a>
  );
};

// Botón de grabación de una clase terminada: lleva al link que subió el
// docente; si aún no lo sube, queda gris con "Grabación pendiente".
export const RecordingButton = ({ session, variant = 'ghost' }) => (
  isSafeLink(session.recordingUrl)
    ? <a className={variant === 'primary' ? 'class-meet-btn' : 'admin-btn-ghost'} href={session.recordingUrl} target="_blank" rel="noreferrer"><Play size={13} /> {variant === 'primary' ? 'Ver grabación' : 'Grabación'}</a>
    : <button type="button" className={variant === 'primary' ? 'class-meet-btn is-disabled' : 'admin-btn-ghost class-btn-muted'} disabled><Play size={13} /> Grabación pendiente</button>
);

const TAG_CLASS = { scheduled: 'is-scheduled', soon: 'is-soon', live: 'is-live', ended: 'is-ended', cancelled: 'is-cancelled' };

// Tarjeta de clase (C1): la misma en el Inicio, la Agenda, Clases en vivo y
// Contenido, para alumno y docente. Cambia sola según la hora.
const ClassCard = ({ session, courseTitle, meetLink, role = 'student', meta, secondary }) => {
  const now = useNow();
  const state = getClassCardState(session, now);
  const tag = state === 'scheduled' ? `Próxima clase · ${relativeClassLabel(session, now).toLowerCase()}` : relativeClassLabel(session, now);
  const footnote = state === 'scheduled'
    ? `Se activa ${LIVE_JOIN_WINDOW_MIN} min antes`
    : state === 'ended'
      ? (isSafeLink(session.recordingUrl) ? 'La grabación queda disponible hasta el fin del curso' : 'El docente sube la grabación después de la clase')
      : state === 'cancelled'
        ? 'El docente canceló esta clase'
        : !meetLink
          ? (session.general ? 'Esta clase aún no tiene enlace de Meet' : 'Esta aula aún no tiene enlace de Meet')
          : role === 'teacher' ? (session.general ? `Abre el enlace de esta clase. Los alumnos de sus cursos ven «Entrar» ${LIVE_JOIN_WINDOW_MIN} min antes.` : `Tus alumnos ven el botón «Entrar» ${LIVE_JOIN_WINDOW_MIN} min antes.`) : 'Entra con tu correo @netwiseacademy.pe';

  return (
    <div className={`class-card ${state === 'live' ? 'is-live' : ''}`}>
      <div className="class-card-info">
        <div className="class-card-tags">
          <span className={`class-card-tag ${TAG_CLASS[state]}`}>{state === 'live' && <span className="class-card-dot" />}{tag}</span>
          {session.general && <span className="class-general-pill is-dark">{generalClassLabel(session, role)}</span>}
        </div>
        {courseTitle && <div className="class-card-course">{courseTitle}</div>}
        <div className="class-card-title">{session.title}</div>
        <div className="class-card-meta"><Clock size={13} /> {classScheduleLine(session, now)}{session.instructor && role !== 'teacher' ? ` · ${session.instructor}` : ''}{meta ? ` · ${meta}` : ''}</div>
      </div>
      {state !== 'cancelled' && (
        <div className="class-card-actions">
          {state === 'ended' ? <RecordingButton session={session} variant="primary" /> : <MeetButton session={session} meetLink={meetLink} role={role} now={now} />}
          <div className="class-card-footnote">{footnote}</div>
          {secondary}
        </div>
      )}
    </div>
  );
};

export default ClassCard;

// Fila de una clase con la fecha en bloque ("MIÉ 28"), usada en las listas de
// la Agenda y de Clases en vivo. `actions` va a la derecha.
export const ClassRow = ({ session, courseTitle, actions, showRelative = true, past = false, role = 'student' }) => {
  const now = useNow();
  const start = new Date(session.startsAt);
  const isToday = new Date(now).toDateString() === start.toDateString();
  const dow = start.toLocaleDateString('es-PE', { weekday: 'short' }).replace('.', '');
  const month = start.toLocaleDateString('es-PE', { month: 'short' }).replace('.', '');
  const state = getClassCardState(session, now);
  const rel = state === 'cancelled' ? 'Cancelada' : isToday ? 'Hoy' : (showRelative && !past ? relativeClassLabel(session, now) : '');
  return (
    <div className="class-row">
      <div className={`class-row-date ${past ? 'is-past' : isToday ? 'is-today' : 'is-plain'}`}>
        <small>{past ? month : dow}</small>
        <strong>{String(start.getDate()).padStart(2, '0')}</strong>
      </div>
      <div className="class-row-body">
        {courseTitle && <div className="class-row-course">{courseTitle}</div>}
        {session.general && <span className="class-general-pill">{generalClassLabel(session, role)}</span>}
        <div className="class-row-title" style={state === 'cancelled' ? { textDecoration: 'line-through', color: '#8B8A9B' } : undefined}>{session.title}</div>
        <div className="class-row-sub"><Clock size={12} /> {fmtTime(start)} – {fmtTime(sessionEndsAt(session))}{rel ? ` · ${rel}` : ''}</div>
      </div>
      {actions && <div className="class-row-actions">{actions}</div>}
    </div>
  );
};
