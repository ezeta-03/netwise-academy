import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { fetchSupportRequest, addSupportMessage, resolveMySupportRequest, uploadSupportAttachment } from '../../lib/db';
import { categoryLabel, ticketStatus, ticketTitle, ticketMessages, STUDENT_STATUS } from '../../lib/support';
import { AttachPicker } from './StudentSoporte';

const fmt = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' });
  return today ? `hoy, ${time}` : `${d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')}, ${time}`;
};
const initials = (name) => (name || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

// Un mensaje del hilo (lo usan alumno y admin). `mineFrom`: qué lado es "Tú".
export const SupportMessage = ({ m, mineFrom, onLink }) => {
  const isSupport = m.from === 'support';
  const mine = m.from === mineFrom;
  const name = mine ? 'Tú' : isSupport ? 'Soporte Netwise' : (m.authorName || 'Alumno');
  return (
    <div className="support-msg">
      <div className={`support-avatar ${isSupport ? 'is-support' : ''}`}>{isSupport ? 'SN' : initials(m.authorName)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="support-msg-head"><strong>{name}</strong> <span>{fmt(m.at)}</span></div>
        <div className={`support-bubble ${isSupport ? 'is-support' : ''}`}>
          {m.text && <p>{m.text}</p>}
          {m.attachment?.url && <a className="support-file" href={m.attachment.url} target="_blank" rel="noreferrer">{/\.pdf$/i.test(m.attachment.name) ? 'PDF' : 'IMG'} <strong>{m.attachment.name}</strong></a>}
          {m.link?.to && <button type="button" className="admin-panel-link" style={{ display: 'block', marginTop: 6 }} onClick={() => onLink?.(m.link.to)}>{m.link.label} →</button>}
        </div>
      </div>
    </div>
  );
};

// Ver conversación (E9): el hilo con soporte, una caja para responder y
// "Ya se resolvió". Si el alumno responde una solicitud resuelta, se vuelve a abrir.
const StudentSoporteConversacion = () => {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const [ticket, setTicket] = useState(undefined);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => fetchSupportRequest(requestId).then(setTicket).catch(() => setTicket(null)), [requestId]);
   
  useEffect(() => { load(); }, [load]);

  if (ticket === undefined) return <div className="admin-empty-hint">Cargando conversación...</div>;
  if (!ticket || ticket.requesterUid !== currentUser?.uid) {
    return <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B' }}>No encontramos esta solicitud. <button className="admin-panel-link" onClick={() => navigate('/student/soporte')}>Volver a Soporte</button></div>;
  }

  const status = ticketStatus(ticket);
  const st = STUDENT_STATUS[status];
  const messages = ticketMessages(ticket);
  const lastSupport = [...messages].reverse().find((m) => m.from === 'support');

  const reply = async () => {
    setBusy(true);
    try {
      const attachment = file ? await uploadSupportAttachment(currentUser.uid, file) : null;
      await addSupportMessage(ticket.id, { from: 'requester', authorName: currentUser.displayName || currentUser.email, text: text.trim(), attachment });
      setText(''); setFile(null);
      addToast(status === 'resolved' ? 'Volvimos a abrir tu solicitud.' : 'Respuesta enviada.', 'success');
      load();
    } catch {
      addToast('No se pudo enviar. Intenta de nuevo.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const markResolved = async () => {
    setBusy(true);
    try {
      await resolveMySupportRequest(ticket.id);
      addToast('¡Listo! Marcamos tu solicitud como resuelta.', 'success');
      load();
    } catch {
      addToast('No se pudo actualizar. Intenta de nuevo.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="anim-fade-up d1">
      <button className="admin-panel-link entrega-back" onClick={() => navigate('/student/soporte')}><ArrowLeft size={14} /> Volver a Soporte</button>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">{ticketTitle(ticket)}</h1>
          <p className="admin-page-sub">{[categoryLabel(ticket.category), ticket.courseTitle, `Enviada ${fmt(ticket.createdAt)}`].filter(Boolean).join(' · ')}</p>
        </div>
      </div>

      <div className="admin-two-col" style={{ gridTemplateColumns: 'minmax(0, 1fr) 300px', alignItems: 'flex-start' }}>
        <div className="admin-panel">
          {messages.map((m, i) => <SupportMessage key={i} m={m} mineFrom="requester" onLink={navigate} />)}
          <div className="support-reply-box">
            <label className="submit-work-label">Responder</label>
            <textarea className="admin-input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe tu respuesta..." />
            <AttachPicker file={file} onChange={setFile} label="Adjuntar captura" />
            <div className="admin-modal-actions">
              {status !== 'resolved' && <button className="admin-btn-ghost" onClick={markResolved} disabled={busy}>Ya se resolvió</button>}
              <button className="admin-btn-edit" onClick={reply} disabled={busy || (!text.trim() && !file)}>{busy ? 'Enviando...' : 'Responder'}</button>
            </div>
          </div>
        </div>
        <div className="admin-panel">
          <div className="admin-panel-head"><span className="admin-panel-title">Detalle</span><span className={`admin-status ${st.cls}`}>{st.label}</span></div>
          <div className="support-detail"><span>Tipo</span><strong>{categoryLabel(ticket.category)}</strong></div>
          <div className="support-detail"><span>Curso</span><strong>{ticket.courseTitle || '—'}</strong></div>
          <div className="support-detail"><span>Enviada</span><strong>{fmt(ticket.createdAt)}</strong></div>
          <div className="support-detail"><span>Última respuesta</span><strong>{lastSupport ? fmt(lastSupport.at) : 'Aún sin respuesta'}</strong></div>
          <p className="admin-cell-sub" style={{ borderTop: '1px solid #ECEAF3', paddingTop: 10, marginBottom: 0 }}>Si ya se resolvió, márcalo. Si vuelve a pasar, respóndenos aquí y la solicitud se abre otra vez.</p>
        </div>
      </div>
    </div>
  );
};

export default StudentSoporteConversacion;
