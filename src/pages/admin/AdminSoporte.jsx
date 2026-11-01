import React, { useCallback, useEffect, useState } from 'react';
import { Check, Send, UserRound, Zap, Pencil, X, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import ModalPortal from '../../components/ModalPortal';
import { fetchAllSupportRequests, addSupportMessage, updateSupportRequest, fetchAllUsers, fetchMyEnrollments, fetchMyOrders, fetchAcademySettings, saveAcademySettings } from '../../lib/db';
import { DEFAULT_SUPPORT_FAQ, DEFAULT_SUPPORT_REPLIES, categoryLabel, ticketStatus, ticketTitle, ticketMessages, fillReply, daysWaiting, ADMIN_STATUS } from '../../lib/support';
import { SupportMessage } from '../student/StudentSoporteConversacion';

const fmt = (iso) => (iso ? new Date(iso).toLocaleString('es-PE', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).replace(/\./g, '') : '—');
const ago = (iso) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `Hace ${Math.max(1, mins)} min`;
  if (mins < 1440) return `Hace ${Math.round(mins / 60)} h`;
  return `Hace ${Math.round(mins / 1440)} días`;
};
const initials = (name) => (name || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const ACADEMY_DOMAIN = /@netwiseacademy\.pe$/i;

// Respuestas rápidas del alumno (FAQ) y respuestas listas del admin: el admin
// las edita aquí, sin pedirle cambios a TI (se guardan en settings/academy).
const QuickAnswersModal = ({ faq, replies, onClose, onSaved }) => {
  const { addToast } = useUI();
  const [items, setItems] = useState(faq);
  const [ready, setReady] = useState(replies);
  const [saving, setSaving] = useState(false);
  const setItem = (i, k, v) => setItems((list) => list.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const setReadyItem = (i, k, v) => setReady((list) => list.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const save = async () => {
    setSaving(true);
    try {
      const supportFaq = items.filter((x) => x.q.trim() && x.a.trim());
      const supportReplies = ready.filter((x) => x.label.trim() && x.text.trim());
      await saveAcademySettings({ supportFaq, supportReplies });
      addToast('Respuestas rápidas guardadas.', 'success');
      onSaved({ supportFaq, supportReplies });
      onClose();
    } catch {
      addToast('No se pudieron guardar. Intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <ModalPortal>
      <div className="admin-modal-overlay" onClick={onClose}>
        <div className="admin-modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head">
            <div><div className="admin-modal-title">Respuestas rápidas</div><div className="admin-modal-sub">Lo que ve el alumno en Soporte y las respuestas listas para contestar.</div></div>
            <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="submit-work-label">Para el alumno (antes de escribir)</div>
          {items.map((f, i) => (
            <div key={i} className="qa-edit">
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="admin-input" value={f.q} onChange={(e) => setItem(i, 'q', e.target.value)} placeholder="Pregunta" />
                <button className="admin-icon-btn" aria-label="Quitar" onClick={() => setItems((l) => l.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
              </div>
              <textarea className="admin-input" rows={2} value={f.a} onChange={(e) => setItem(i, 'a', e.target.value)} placeholder="Respuesta" />
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="admin-input" value={f.linkLabel || ''} onChange={(e) => setItem(i, 'linkLabel', e.target.value)} placeholder="Texto del enlace (opcional)" />
                <input className="admin-input" value={f.linkTo || ''} onChange={(e) => setItem(i, 'linkTo', e.target.value)} placeholder="Ruta, ej. /student/entregas" />
              </div>
            </div>
          ))}
          <button className="admin-btn-ghost" style={{ marginBottom: 16 }} onClick={() => setItems((l) => [...l, { q: '', a: '', linkLabel: '', linkTo: '' }])}><Plus size={13} /> Agregar pregunta</button>
          <div className="submit-work-label">Respuestas listas del equipo (usa {'{nombre}'} para el nombre del alumno)</div>
          {ready.map((r, i) => (
            <div key={i} className="qa-edit">
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="admin-input" value={r.label} onChange={(e) => setReadyItem(i, 'label', e.target.value)} placeholder="Nombre corto" />
                <button className="admin-icon-btn" aria-label="Quitar" onClick={() => setReady((l) => l.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
              </div>
              <textarea className="admin-input" rows={2} value={r.text} onChange={(e) => setReadyItem(i, 'text', e.target.value)} placeholder="Texto de la respuesta" />
            </div>
          ))}
          <button className="admin-btn-ghost" onClick={() => setReady((l) => [...l, { label: '', text: '' }])}><Plus size={13} /> Agregar respuesta lista</button>
          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="admin-btn-edit" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

// Soporte del admin (A5): pedidos abiertos a la izquierda; a la derecha el
// pedido con los datos del alumno, el hilo, respuestas listas, "Asignar a",
// "Marcar resuelto" y "Enviar respuesta" (le llega en la campana). Las
// tutorías no entran aquí por ahora.
const AdminSoporte = () => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const { courses } = useCourseOfferings();
  const [requests, setRequests] = useState([]);
  const [team, setTeam] = useState([]);
  const [faq, setFaq] = useState(DEFAULT_SUPPORT_FAQ);
  const [replies, setReplies] = useState(DEFAULT_SUPPORT_REPLIES);
  const [tab, setTab] = useState('open');
  const [selectedId, setSelectedId] = useState(null);
  const [student, setStudent] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingAnswers, setEditingAnswers] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const load = useCallback(() => Promise.all([
    fetchAllSupportRequests(), fetchAllUsers().catch(() => []), fetchAcademySettings().catch(() => ({})),
  ]).then(([list, users, settings]) => {
    setRequests(list.filter((r) => r.type !== 'tutoria'));
    setTeam((users || []).filter((u) => u.role === 'admin'));
    if (Array.isArray(settings.supportFaq) && settings.supportFaq.length) setFaq(settings.supportFaq);
    if (Array.isArray(settings.supportReplies) && settings.supportReplies.length) setReplies(settings.supportReplies);
    setLoading(false);
  }).catch(() => setLoading(false)), []);
   
  useEffect(() => { load(); }, [load]);

  const isOpen = (r) => ticketStatus(r) !== 'resolved';
  const visible = requests
    .filter((r) => (tab === 'open' ? isOpen(r) : tab === 'resolved' ? !isOpen(r) : true))
    .sort((a, b) => String(b.lastMessageAt || b.createdAt).localeCompare(String(a.lastMessageAt || a.createdAt)));
  const selected = requests.find((r) => r.id === selectedId) || visible[0] || null;
  const openCount = requests.filter(isOpen).length;

  // Datos del alumno del pedido: curso, aula, pago y con qué correo entra.
  const selectedUid = selected?.requesterUid;
  useEffect(() => {
    if (!selectedUid) return undefined;
    let cancelled = false;
    Promise.all([fetchMyEnrollments(selectedUid).catch(() => ({})), fetchMyOrders(selectedUid).catch(() => [])])
      .then(([enr, orders]) => { if (!cancelled) setStudent({ uid: selectedUid, enrollments: Object.values(enr || {}), orders }); });
    return () => { cancelled = true; };
  }, [selectedUid]);

  const patchLocal = (id, patch) => setRequests((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const send = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const msg = await addSupportMessage(selected.id, { from: 'support', authorName: currentUser.displayName || 'Soporte Netwise', authorUid: currentUser.uid, text: draft.trim() });
      patchLocal(selected.id, { messages: [...ticketMessages(selected), msg], status: 'answered', lastMessageAt: msg.at, lastMessageFrom: 'support' });
      setDraft('');
      addToast(`Respuesta enviada a ${selected.requesterName}.`, 'success');
    } catch {
      addToast('No se pudo enviar la respuesta. Intenta de nuevo.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const resolve = async () => {
    setBusy(true);
    try {
      await updateSupportRequest(selected.id, { status: 'resolved', resolvedAt: new Date().toISOString() });
      patchLocal(selected.id, { status: 'resolved' });
      addToast('Pedido marcado como resuelto.', 'success');
    } catch {
      addToast('No se pudo actualizar el pedido.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const assign = async (member) => {
    setAssignOpen(false);
    const assignedTo = member ? { uid: member.uid, name: member.displayName || member.email } : null;
    try {
      await updateSupportRequest(selected.id, { assignedTo });
      patchLocal(selected.id, { assignedTo });
      addToast(member ? `Asignado a ${assignedTo.name}.` : 'Pedido sin asignar.', 'success');
    } catch {
      addToast('No se pudo asignar el pedido.', 'error');
    }
  };

  if (loading) return <div className="admin-empty-hint">Cargando soporte...</div>;

  const st = selected ? ADMIN_STATUS[ticketStatus(selected)] : null;
  const info = student && student.uid === selected?.requesterUid ? student : null;
  const enr = info?.enrollments.find((e) => !selected?.courseId || e.courseId?.toString() === selected.courseId?.toString()) || info?.enrollments[0];
  const paid = info?.orders.some((o) => o.status === 'paid') || (enr && (enr.status || 'active') === 'active');
  const email = selected?.requesterEmail || enr?.studentEmail || '';
  const courseTitle = (id) => courses.find((c) => c.id.toString() === id?.toString())?.title;
  const lastFromStudent = selected ? [...ticketMessages(selected)].reverse().find((m) => m.from === 'requester') : null;

  return (
    <div className="anim-fade-up d1">
      <span className="admin-eyebrow">Administración / Netwise Academy</span>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Soporte</h1>
          <p className="admin-page-sub">Responde aquí mismo. A la persona le llega como notificación.</p>
        </div>
        <button className="admin-btn-ghost" onClick={() => setEditingAnswers(true)}><Pencil size={13} /> Respuestas rápidas</button>
      </div>

      <div className="chip-row" style={{ marginBottom: 16 }}>
        {[['open', `Abiertos · ${openCount}`], ['resolved', 'Resueltos'], ['all', 'Todos']].map(([k, label]) => (
          <button key={k} className={`chip ${tab === k ? 'active is-dark' : ''}`} onClick={() => { setTab(k); setSelectedId(null); }}>{label}</button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B' }}>{tab === 'open' ? 'No hay pedidos abiertos. ¡Todo al día!' : 'No hay pedidos aquí.'}</div>
      ) : (
        <div className="support-admin">
          <div className="admin-panel support-list">
            {visible.map((r) => {
              const wait = daysWaiting(r);
              return (
                <button key={r.id} type="button" className={`support-list-item ${selected?.id === r.id ? 'active' : ''}`} onClick={() => setSelectedId(r.id)}>
                  <div className="dash-list-row-title">{ticketTitle(r)}</div>
                  <div className="admin-cell-sub">{r.requesterName}{r.groupName ? ` · ${r.groupName}` : r.courseTitle ? ` · ${r.courseTitle}` : ''}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    <span className="admin-status admin-status-violet" style={{ fontSize: '.66rem' }}>{categoryLabel(r.category)}</span>
                    {ticketStatus(r) === 'new' && wait >= 1
                      ? <span className="admin-status admin-status-rose" style={{ fontSize: '.66rem' }}>{wait} día{wait === 1 ? '' : 's'} sin respuesta</span>
                      : <span className={`admin-status ${ADMIN_STATUS[ticketStatus(r)].cls}`} style={{ fontSize: '.66rem' }}>{ticketStatus(r) === 'new' ? ago(r.lastMessageAt || r.createdAt) : ADMIN_STATUS[ticketStatus(r)].label}</span>}
                    {r.assignedTo && <span className="admin-status admin-status-gray" style={{ fontSize: '.66rem' }}>{r.assignedTo.name}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="admin-panel">
              <div className="admin-panel-head" style={{ alignItems: 'flex-start' }}>
                <div>
                  <span className="admin-panel-title" style={{ fontSize: '1.1rem' }}>{ticketTitle(selected)}</span>
                  <div className="admin-cell-sub">Recibido el {fmt(selected.createdAt)} · <span className={`admin-status ${st.cls}`} style={{ fontSize: '.66rem' }}>{st.label}</span></div>
                </div>
                <div style={{ position: 'relative' }}>
                  <button className="admin-btn-ghost" onClick={() => setAssignOpen((o) => !o)}><UserRound size={13} /> {selected.assignedTo ? selected.assignedTo.name : 'Asignar a'}</button>
                  {assignOpen && (
                    <div className="assign-menu">
                      {team.map((m) => <button key={m.uid} onClick={() => assign(m)}>{m.displayName || m.email}</button>)}
                      {selected.assignedTo && <button onClick={() => assign(null)}>Quitar asignación</button>}
                      {team.length === 0 && <span className="admin-cell-sub" style={{ padding: 8 }}>No hay administradores.</span>}
                    </div>
                  )}
                </div>
              </div>

              <div className="support-student">
                <div className="support-avatar" style={{ width: 40, height: 40 }}>{initials(selected.requesterName)}</div>
                <div>
                  <div className="dash-list-row-title">{selected.requesterName}</div>
                  <div className="admin-cell-sub">{[email, enr?.groupName || selected.groupName, courseTitle(enr?.courseId) || selected.courseTitle].filter(Boolean).join(' · ')}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {email && (ACADEMY_DOMAIN.test(email)
                      ? <span className="admin-status admin-status-green" style={{ fontSize: '.66rem' }}>Entra con el correo de la academia</span>
                      : <span className="admin-status admin-status-amber" style={{ fontSize: '.66rem' }}>Entra con su correo personal</span>)}
                    {info && (paid ? <span className="admin-status admin-status-green" style={{ fontSize: '.66rem' }}>Pagado</span> : <span className="admin-status admin-status-rose" style={{ fontSize: '.66rem' }}>Pago pendiente</span>)}
                    {info && !enr?.groupId && <span className="admin-status admin-status-rose" style={{ fontSize: '.66rem' }}>Sin aula</span>}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                {ticketMessages(selected).map((m, i) => <SupportMessage key={i} m={m} mineFrom="support" />)}
              </div>

              {ticketStatus(selected) !== 'resolved' || lastFromStudent ? (
                <>
                  <div className="support-quick-head"><Zap size={13} /> Respuestas rápidas</div>
                  <div className="chip-row" style={{ marginBottom: 10 }}>
                    {replies.map((r) => <button key={r.label} type="button" className="chip" onClick={() => setDraft(fillReply(r.text, selected.requesterName))}>{r.label}</button>)}
                  </div>
                  <textarea className="admin-input" rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escribe la respuesta o elige una respuesta rápida y edítala." />
                  <div className="admin-modal-actions" style={{ alignItems: 'center' }}>
                    <span className="admin-cell-sub" style={{ marginRight: 'auto' }}>Le llega como notificación.</span>
                    {ticketStatus(selected) !== 'resolved' && <button className="admin-btn-ghost" onClick={resolve} disabled={busy}><Check size={13} /> Marcar resuelto</button>}
                    <button className="admin-btn-edit" onClick={send} disabled={busy || !draft.trim()}><Send size={13} /> {busy ? 'Enviando...' : 'Enviar respuesta'}</button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {editingAnswers && (
        <QuickAnswersModal faq={faq} replies={replies} onClose={() => setEditingAnswers(false)}
          onSaved={({ supportFaq, supportReplies }) => { setFaq(supportFaq.length ? supportFaq : DEFAULT_SUPPORT_FAQ); setReplies(supportReplies.length ? supportReplies : DEFAULT_SUPPORT_REPLIES); }} />
      )}
    </div>
  );
};

export default AdminSoporte;
