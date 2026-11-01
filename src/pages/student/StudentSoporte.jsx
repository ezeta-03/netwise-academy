import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Minus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { fetchMyEnrollments, fetchSupportRequests, createSupportRequest, uploadSupportAttachment, fetchAcademySettings } from '../../lib/db';
import { SUPPORT_CATEGORIES, DEFAULT_SUPPORT_FAQ, categoryLabel, ticketStatus, ticketTitle, lastSupportReply, STUDENT_STATUS } from '../../lib/support';

const ATTACH_TYPES = /^(image\/(png|jpeg|webp)|application\/pdf)$/;
const fmtWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? `hoy ${d.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' })}` : d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
};

// Adjuntar una captura (opcional): imagen o PDF de hasta 10 MB.
export const AttachPicker = ({ file, onChange, label = 'Adjunta una captura (opcional)' }) => {
  const { addToast } = useUI();
  const ref = useRef(null);
  const pick = (f) => {
    if (!f) return;
    if (!ATTACH_TYPES.test(f.type)) { addToast('Adjunta una imagen (PNG o JPG) o un PDF.', 'error'); return; }
    if (f.size > 10 * 1024 * 1024) { addToast('La captura pesa más de 10 MB.', 'error'); return; }
    onChange(f);
  };
  return (
    <>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      {file ? (
        <div className="submit-work-file"><span className="submit-work-ext">IMG</span><div className="submit-work-file-name" style={{ flex: 1 }}>{file.name}</div><button type="button" className="admin-panel-link" onClick={() => onChange(null)}>Quitar</button></div>
      ) : (
        <button type="button" className="support-attach" onClick={() => ref.current?.click()}><strong>{label}</strong> <span>PNG o JPG · hasta 10 MB</span></button>
      )}
    </>
  );
};

// Soporte del alumno (E9): primero las respuestas rápidas; si no se resuelve,
// escribe con el tipo de problema (el mismo que ve el admin en A5) y sigue la
// respuesta en "Mis solicitudes". Por ahora sin pedido de tutoría.
const StudentSoporte = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const { courses } = useCourseOfferings();
  const [enrollments, setEnrollments] = useState({});
  const [requests, setRequests] = useState([]);
  const [faq, setFaq] = useState(DEFAULT_SUPPORT_FAQ);
  const [open, setOpen] = useState(0);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [courseId, setCourseId] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(() => Promise.all([
    fetchMyEnrollments(currentUser?.uid), fetchSupportRequests(currentUser?.uid),
    fetchAcademySettings().catch(() => ({})),
  ]).then(([enr, reqs, settings]) => {
    setEnrollments(enr);
    // Las tutorías ya no se piden aquí: solo se muestran las solicitudes de soporte.
    setRequests(reqs.filter((r) => r.type !== 'tutoria'));
    if (Array.isArray(settings.supportFaq) && settings.supportFaq.length) setFaq(settings.supportFaq);
    setLoading(false);
  }).catch(() => setLoading(false)), [currentUser?.uid]);
   
  useEffect(() => { load(); }, [load]);

  const myCourses = courses.filter((c) => enrollments[c.id.toString()]);

  const send = async () => {
    setSending(true);
    try {
      const attachment = file ? await uploadSupportAttachment(currentUser.uid, file) : null;
      const course = myCourses.find((c) => c.id.toString() === courseId);
      const created = await createSupportRequest({
        requesterUid: currentUser.uid, requesterName: currentUser.displayName || currentUser.email, requesterRole: 'student', requesterEmail: currentUser.email,
        type: 'plataforma', category, courseId: course?.id ?? null, courseTitle: course?.title || null,
        groupName: course ? enrollments[course.id]?.groupName || null : null, message: message.trim(), attachment,
      });
      addToast('Solicitud enviada. Te avisaremos en la campana cuando respondamos.', 'success');
      setCategory(''); setCourseId(''); setMessage(''); setFile(null);
      navigate(`/student/soporte/${created.id}`);
    } catch {
      addToast('No se pudo enviar tu solicitud. Intenta de nuevo.', 'error');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="admin-empty-hint">Cargando soporte...</div>;

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Soporte</h1>
          <p className="admin-page-sub">Encuentra una respuesta rápida o escríbenos. Te respondemos aquí y en la campana.</p>
        </div>
      </div>

      <div className="admin-two-col" style={{ gridTemplateColumns: 'minmax(0, 1fr) 320px', alignItems: 'flex-start' }}>
        <div>
          <div className="admin-panel" style={{ marginBottom: 20 }}>
            <div className="admin-panel-head" style={{ marginBottom: 2 }}><span className="admin-panel-title">Respuestas rápidas</span></div>
            <p className="admin-panel-caption" style={{ marginTop: 0 }}>Lo que más nos preguntan. Ábrelo y revisa si te sirve.</p>
            {faq.map((f, i) => (
              <div key={f.q} className="faq-item">
                <button type="button" className="faq-q" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                  <span>{f.q}</span>{open === i ? <Minus size={15} /> : <Plus size={15} />}
                </button>
                {open === i && (
                  <div className="faq-a">
                    <p>{f.a}</p>
                    {f.linkLabel && f.linkTo && <button type="button" className="admin-panel-link" onClick={() => navigate(f.linkTo)}>{f.linkLabel} →</button>}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head"><span className="admin-panel-title">¿No se resolvió? Escríbenos</span></div>
            <div className="admin-field">
              <label>¿Sobre qué es?</label>
              <div className="chip-row">
                {SUPPORT_CATEGORIES.map((c) => (
                  <button key={c.key} type="button" className={`chip ${category === c.key ? 'active' : ''}`} onClick={() => setCategory(c.key)}>{c.label}</button>
                ))}
              </div>
            </div>
            <div className="admin-field">
              <label>Curso (opcional)</label>
              <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">Ninguno en particular</option>
                {myCourses.map((c) => <option key={c.id} value={c.id.toString()}>{c.title}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label>Cuéntanos qué pasó</label>
              <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Por ejemplo: entro a la clase y Meet me pide permiso." />
            </div>
            <AttachPicker file={file} onChange={setFile} />
            <div className="admin-modal-actions" style={{ alignItems: 'center' }}>
              <span className="admin-cell-sub" style={{ marginRight: 'auto' }}>Te avisamos en la campana.</span>
              <button className="admin-btn-edit" onClick={send} disabled={sending || !category || !message.trim()} title={!category ? 'Elige sobre qué es' : !message.trim() ? 'Cuéntanos qué pasó' : undefined}>
                {sending ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </div>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head"><span className="admin-panel-title">Mis solicitudes</span></div>
          {requests.length === 0 ? (
            <p className="admin-panel-caption" style={{ marginTop: 0 }}>Aún no nos escribes. Si algo falla, cuéntanos aquí al lado.</p>
          ) : requests.map((r) => {
            const st = STUDENT_STATUS[ticketStatus(r)];
            const reply = lastSupportReply(r);
            return (
              <div key={r.id} className="support-ticket">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div className="dash-list-row-title">{ticketTitle(r)}</div>
                  <span className={`admin-status ${st.cls}`} style={{ fontSize: '.68rem' }}>{st.label}</span>
                </div>
                <div className="admin-cell-sub">{categoryLabel(r.category)} · {fmtWhen(r.createdAt)}</div>
                {reply && ticketStatus(r) === 'answered' && (
                  <div className="support-reply-preview"><strong>Soporte Netwise respondió</strong>{reply.text.length > 120 ? `${reply.text.slice(0, 117)}…` : reply.text}</div>
                )}
                <button className="admin-panel-link" onClick={() => navigate(`/student/soporte/${r.id}`)}>Ver conversación →</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StudentSoporte;
