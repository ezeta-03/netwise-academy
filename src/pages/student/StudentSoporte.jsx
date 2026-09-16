import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Headphones, Sparkles, ArrowRight, X } from 'lucide-react';
import ModalPortal from '../../components/ModalPortal';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { fetchGroups, fetchMyEnrollments, fetchSupportRequests, createSupportRequest } from '../../lib/db';

const REQUEST_STATUS = {
  pending: { label: 'Pendiente', cls: 'admin-status-amber' },
  resolved: { label: 'Resuelto', cls: 'admin-status-green' },
};

const RequestModal = ({ requesterUid, requesterName, requesterRole, onClose, onSaved }) => {
  const { addToast } = useUI();
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!message.trim()) { addToast('Cuéntanos brevemente qué necesitas.', 'error'); return; }
    setSaving(true);
    try {
      await createSupportRequest({ requesterUid, requesterName, requesterRole, type: 'plataforma', message: message.trim() });
      addToast('Solicitud enviada. Te responderemos pronto.', 'success');
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-head">
          <div className="admin-modal-title">Nueva solicitud</div>
          <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="admin-field">
          <label>¿En qué te ayudamos?</label>
          <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ej. No puedo ver la grabación de una clase..." />
        </div>
        <div className="admin-modal-actions">
          <button className="admin-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="admin-btn-edit" onClick={handleSave} disabled={saving}>{saving ? 'Enviando...' : 'Enviar solicitud'}</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

const StudentSoporte = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const { courses } = useCourseOfferings();
  const [enrollments, setEnrollments] = useState({});
  const [groups, setGroups] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const requesterName = currentUser?.displayName || currentUser?.email || 'Estudiante';

  const load = useCallback(() => Promise.all([fetchGroups(), fetchMyEnrollments(currentUser?.uid), fetchSupportRequests(currentUser?.uid)]).then(([g, enr, r]) => {
    setGroups(g); setEnrollments(enr); setRequests(r); setLoading(false);
  }), [currentUser?.uid]);
  useEffect(() => { load(); }, [load]);

  const reserveTutoring = async (course, group) => {
    await createSupportRequest({
      requesterUid: currentUser?.uid, requesterName, requesterRole: 'student', type: 'tutoria',
      courseTitle: course.title, groupName: group?.name,
    });
    addToast(`Tutoría solicitada para "${course.title}".`, 'success');
    load();
  };

  const enrolledCourses = courses.filter((c) => enrollments[c.id.toString()]);
  // Un curso puede tener varias aulas -- usar el groupId de la matrícula
  // (cuando el admin ya lo asignó) en vez de la primera aula que coincida
  // por curso, que mostraba el grupo equivocado si había más de una.
  const courseGroups = enrolledCourses.map((c) => ({
    course: c,
    group: groups.find((g) => g.id === enrollments[c.id.toString()]?.groupId) || groups.find((g) => g.courseId?.toString() === c.id.toString()),
  }));

  if (loading) return <div className="admin-empty-hint">Cargando soporte...</div>;

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Soporte y tutorías</h1>
          <p className="admin-page-sub">Solicita ayuda o reserva una tutoría.</p>
        </div>
        <button className="admin-btn-edit" onClick={() => setModalOpen(true)}><Plus size={15} /> Crear solicitud</button>
      </div>

      <div className="admin-two-col">
        <div>
          <div className="admin-panel" style={{ marginBottom: 20 }}>
            <div className="admin-panel-head">
              <span className="admin-panel-title">Mis solicitudes</span>
              <span className="admin-status admin-status-gray">{requests.length} registrada{requests.length === 1 ? '' : 's'}</span>
            </div>
            {requests.length === 0 ? (
              <p className="admin-panel-caption" style={{ marginTop: 0 }}>Aún no hay solicitudes ni reservas en este campus.</p>
            ) : requests.map((r) => {
              const status = REQUEST_STATUS[r.status] || REQUEST_STATUS.pending;
              return (
                <div key={r.id} className="dash-list-row">
                  <div>
                    <div className="dash-list-row-title">{r.type === 'tutoria' ? `Tutoría · ${r.courseTitle}` : 'Soporte de plataforma'}</div>
                    <div className="dash-list-row-sub">{r.message || r.groupName || '—'}</div>
                  </div>
                  <span className={`admin-status ${status.cls}`}>{status.label}</span>
                </div>
              );
            })}
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head"><span className="admin-panel-title">Reservar una tutoría</span></div>
            <p className="admin-cell-sub" style={{ marginBottom: 6 }}>Elige el curso para tu tutoría.</p>
            {courseGroups.length === 0 ? (
              <p className="admin-panel-caption" style={{ marginTop: 0 }}>Todavía no estás inscrito en ningún curso.</p>
            ) : courseGroups.map(({ course, group }) => (
              <div key={course.id} className="dash-list-row">
                <div>
                  <div className="dash-list-row-title">{course.title}</div>
                  <div className="dash-list-row-sub">{group?.name || 'Sin grupo asignado'}</div>
                </div>
                <button className="admin-btn-ghost" onClick={() => reserveTutoring(course, group)}><ArrowRight size={13} /> Reservar tutoría</button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="admin-panel" style={{ marginBottom: 20 }}>
            <div className="admin-panel-head"><span className="admin-panel-title">Soporte de la plataforma</span></div>
            <p className="admin-cell-sub" style={{ marginBottom: 14 }}>Ayuda con acceso, archivos y clases.</p>
            <button className="admin-btn-ghost" onClick={() => setModalOpen(true)}><Headphones size={14} /> Solicitar ayuda</button>
          </div>

          <div className="admin-banner" style={{ marginBottom: 0 }}>
            <div>
              <div className="admin-banner-title" style={{ fontSize: '1rem' }}>¿Una duda del contenido?</div>
              <p className="admin-banner-desc">Cada curso tiene su propio asistente IA con el contexto de sus módulos.</p>
              <button className="admin-btn-edit" style={{ marginTop: 14 }} onClick={() => navigate('/student/cursos')}><Sparkles size={14} /> Entrar a un curso</button>
            </div>
          </div>
        </div>
      </div>

      <p className="admin-page-footer">Netwise Academy</p>

      {modalOpen && (
        <RequestModal
          requesterUid={currentUser?.uid}
          requesterName={requesterName}
          requesterRole="student"
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  );
};

export default StudentSoporte;
