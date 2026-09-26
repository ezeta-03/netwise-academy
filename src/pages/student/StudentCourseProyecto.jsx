import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { BookOpen, CheckCircle2, FileText, Pencil, Plus, Send, Sparkles, Video, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import {
  fetchCourseContent, fetchProjectProfile, saveProjectProfile,
  fetchProjectAdvances, toggleProjectAdvance, fetchSubmissions,
} from '../../lib/db';
import ModalPortal from '../../components/ModalPortal';
import SubmitDeliverableModal, { SubmissionContent } from '../../components/SubmitDeliverableModal';

const ProfileModal = ({ course, initial, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const [name, setName] = useState(initial?.name || '');
  const [activity, setActivity] = useState(initial?.activity || '');
  const [sector, setSector] = useState(initial?.sector || '');
  const [audience, setAudience] = useState(initial?.audience || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { addToast('Cuéntanos el nombre de tu empresa, marca o idea.', 'error'); return; }
    setSaving(true);
    try {
      await saveProjectProfile({
        uid: currentUser.uid, courseId: course.id, courseTitle: course.title,
        name: name.trim(), activity: activity.trim(), sector: sector.trim(), audience: audience.trim(), description: description.trim(),
      });
      addToast('Tu proyecto quedó definido.', 'success');
      onSaved();
      onClose();
    } catch {
      addToast('No se pudo guardar tu proyecto. Intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-head"><div className="admin-modal-title">Define tu empresa</div><button className="admin-modal-close" onClick={onClose}><X size={18} /></button></div>
        <div className="admin-banner" style={{ marginBottom: 16 }}>
          <div>
            <div className="admin-banner-title" style={{ fontSize: '.95rem' }}>Tu proyecto</div>
            <p className="admin-banner-desc">Cada módulo del curso suma un avance sobre esta misma empresa o idea. Cuéntanos de qué se trata y arrancamos.</p>
          </div>
        </div>
        <div className="admin-field"><label>Empresa, marca o idea</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="admin-field"><label>¿A qué se dedica la empresa?</label><input value={activity} onChange={(e) => setActivity(e.target.value)} /></div>
        <div className="admin-field"><label>Sector o rubro</label><input value={sector} onChange={(e) => setSector(e.target.value)} /></div>
        <div className="admin-field"><label>¿A quién te diriges? Público objetivo</label><textarea rows={2} value={audience} onChange={(e) => setAudience(e.target.value)} /></div>
        <div className="admin-field"><label>Descripción de lo que hace el negocio</label><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="admin-modal-actions">
          <button className="admin-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="admin-btn-edit" onClick={handleSave} disabled={saving}><Plus size={13} /> {saving ? 'Guardando...' : 'Crear mi proyecto'}</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};


const StudentCourseProyecto = () => {
  const { course } = useOutletContext();
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const navigate = useNavigate();
  const [modules, setModules] = useState([]);
  const [profile, setProfile] = useState(null);
  const [advances, setAdvances] = useState({});
  const [submissions, setSubmissions] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [submitModule, setSubmitModule] = useState(null);

  const load = useCallback(() => {
    if (!currentUser) return;
    Promise.all([fetchCourseContent(course.id), fetchProjectProfile(currentUser.uid, course.id), fetchProjectAdvances(currentUser.uid, course.id)]).then(async ([content, prof, adv]) => {
      const mods = content.modules || [];
      const subsByModule = {};
      for (const m of mods) {
        const subs = await fetchSubmissions(course.id, m.id, currentUser.uid);
        subsByModule[m.id] = subs.find((s) => s.uid === currentUser.uid) || null;
      }
      setModules(mods);
      setProfile(prof);
      setAdvances(adv);
      setSubmissions(subsByModule);
      setSelectedId((prev) => (prev && mods.some((m) => m.id === prev)) ? prev : (mods.find((m) => m.deliverable?.open !== false)?.id || mods[0]?.id || null));
      setLoading(false);
    }).catch(() => {
      addToast('No se pudo cargar tu proyecto. Intenta de nuevo.', 'error');
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id, currentUser]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="admin-empty-hint">Cargando tu proyecto...</div>;

  if (modules.length === 0) {
    return (
      <div className="anim-fade-up d1">
        <div className="admin-page-head"><div><h1 className="admin-page-title">Mi proyecto</h1><p className="admin-page-sub">{course.title}</p></div></div>
        <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B' }}>Este curso todavía no tiene módulos publicados.</div>
      </div>
    );
  }

  const selected = modules.find((m) => m.id === selectedId) || modules[0];
  const selectedIndex = modules.findIndex((m) => m.id === selected.id);
  const currentModuleIndex = modules.findIndex((m) => m.deliverable?.open !== false);
  const totalAdvances = modules.reduce((sum, m) => sum + (m.practiceBullets?.length || 0), 0);
  const doneAdvances = modules.reduce((sum, m) => sum + (advances[m.id]?.length || 0), 0);
  const submittedCount = Object.values(submissions).filter(Boolean).length;

  const toggleBullet = async (moduleId, idx) => {
    try {
      const next = await toggleProjectAdvance(currentUser.uid, course.id, moduleId, idx);
      setAdvances((prev) => ({ ...prev, [moduleId]: next }));
    } catch {
      addToast('No se pudo guardar tu avance. Intenta de nuevo.', 'error');
    }
  };

  const mySubmissions = modules
    .map((m) => ({ module: m, submission: submissions[m.id] }))
    .filter((x) => x.submission);

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Mi proyecto</h1><p className="admin-page-sub">{course.title}</p></div>
        <button className="admin-btn-edit" onClick={() => setSubmitModule(selected)}><Send size={14} /> {submissions[selected.id] ? 'Reemplazar avance' : 'Presentar avance'}</button>
      </div>

      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Módulo en curso <BookOpen size={16} /></div>
          <div className="admin-stat-value">{String(Math.max(currentModuleIndex, 0) + 1).padStart(2, '0')}</div>
          <div className="admin-cell-sub">de {modules.length} · {modules[Math.max(currentModuleIndex, 0)]?.weeksLabel || ''}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Avances del proyecto <CheckCircle2 size={16} /></div>
          <div className="admin-stat-value">{doneAdvances}/{totalAdvances}</div>
          <div className="admin-cell-sub">Tareas aplicadas a tu proyecto</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Entregas enviadas <FileText size={16} /></div>
          <div className="admin-stat-value">{submittedCount}</div>
          <div className="admin-cell-sub">{Object.values(submissions).filter((s) => s?.status === 'reviewed').length} con evaluación</div>
        </div>
      </div>

      <div className="admin-two-col" style={{ gridTemplateColumns: '1fr 280px', alignItems: 'flex-start' }}>
        <div>
          {profile ? (
            <div className="admin-panel" style={{ marginBottom: 20 }}>
              <div className="admin-panel-head">
                <span className="admin-panel-title" style={{ textTransform: 'uppercase', fontSize: '.72rem', letterSpacing: '.04em', color: 'var(--accent)' }}>Tu marca/empresa</span>
                <button className="admin-btn-ghost" onClick={() => setProfileModalOpen(true)}><Pencil size={13} /> Editar ficha</button>
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#14141F', marginBottom: 6 }}>{profile.name}</div>
              {profile.description && <p style={{ fontSize: '.88rem', color: '#4A4860' }}>{profile.description}</p>}
              <div className="dash-profile-stats">
                <div><div className="dash-profile-stat-label">Sector</div><div className="dash-profile-stat-value">{profile.sector || '—'}</div></div>
                <div><div className="dash-profile-stat-label">Público objetivo</div><div className="dash-profile-stat-value">{profile.audience || '—'}</div></div>
                <div><div className="dash-profile-stat-label">Meta del curso</div><div className="dash-profile-stat-value">{profile.activity || '—'}</div></div>
              </div>
            </div>
          ) : (
            <div className="admin-banner" style={{ marginBottom: 20 }}>
              <div className="admin-banner-badge">Primer paso</div>
              <div className="admin-banner-title">Define tu marca/empresa</div>
              <p className="admin-banner-desc">Elige la empresa, marca o idea sobre la que vas a trabajar. Se define una sola vez y todos los avances del curso se construyen sobre ella.</p>
              <button className="admin-btn-edit" style={{ marginTop: 14 }} onClick={() => setProfileModalOpen(true)}><Plus size={14} /> Crear mi proyecto</button>
            </div>
          )}

          <div className="admin-panel" style={{ marginBottom: 20 }}>
            <span className="dash-eyebrow">{selected.title.toUpperCase()}</span>
            <h2 style={{ fontSize: '1.1rem', margin: '4px 0 14px', color: '#14141F' }}>{selected.title}</h2>
            {selected.objective && (
              <div className="dash-callout" style={{ marginBottom: 16 }}>
                <div className="dash-callout-label">Objetivo de este módulo</div>
                <div className="dash-callout-text">{selected.objective}</div>
              </div>
            )}
            {selected.deliverable?.description && (
              <p className="admin-cell-sub" style={{ marginBottom: 14 }}><strong>Entregable:</strong> {selected.deliverable.description}</p>
            )}

            {selected.practiceBullets?.length > 0 && (
              <>
                <div className="dash-eyebrow" style={{ marginBottom: 4 }}>Avances de esta clase</div>
                {selected.practiceBullets.map((b, i) => {
                  const checked = (advances[selected.id] || []).includes(i);
                  return (
                    <label key={i} className={`dash-check-row ${checked ? 'checked' : ''}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleBullet(selected.id, i)} />
                      <span>{b}</span>
                    </label>
                  );
                })}
              </>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
              {selected.lessons?.length > 0 && (
                <button className="admin-btn-edit" onClick={() => navigate(`/player/${course.id}/${selectedIndex + 1}-1`)}><Video size={14} /> Ver la clase</button>
              )}
              <button className="admin-btn-ghost" onClick={() => navigate(`/student/curso/${course.id}/materiales`)}><FileText size={14} /> Consultar materiales</button>
              <button className="admin-btn-ghost" onClick={() => setSubmitModule(selected)}><Send size={14} /> {submissions[selected.id] ? 'Reemplazar avance' : 'Presentar avance'}</button>
            </div>
          </div>

          <div className="admin-panel" style={{ marginBottom: 20 }}>
            <div className="admin-panel-head">
              <span className="admin-panel-title">Ruta de tu proyecto</span>
              <span className="admin-status admin-status-gray">{doneAdvances} de {totalAdvances} avances</span>
            </div>
            {modules.map((m, i) => {
              const done = m.deliverable?.open === false;
              const bulletsTotal = m.practiceBullets?.length || 0;
              const bulletsDone = advances[m.id]?.length || 0;
              return (
                <div key={m.id} className="dash-list-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="dash-module-num" style={done ? { background: '#E3F9EE', color: '#15803D' } : undefined}>{done ? <CheckCircle2 size={13} /> : String(i + 1).padStart(2, '0')}</div>
                    <div>
                      <div className="dash-list-row-title" style={{ color: m.id === selected.id ? 'var(--accent)' : undefined }}>{m.title}</div>
                      <div className="dash-list-row-sub">{done ? 'Validado por tu docente' : 'Por empezar'} · {bulletsDone} de {bulletsTotal} avances</div>
                    </div>
                  </div>
                  <button className="admin-btn-ghost" onClick={() => setSelectedId(m.id)}>{m.id === selected.id ? 'Viendo' : done ? 'Abrir' : 'Continuar'}</button>
                </div>
              );
            })}
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head"><span className="admin-panel-title">Mis entregas de este curso</span></div>
            {mySubmissions.length === 0 ? (
              <p className="admin-panel-caption" style={{ marginTop: 0 }}>Aún no hay avances enviados en este curso. Adjunta tu trabajo cuando esté listo.</p>
            ) : mySubmissions.map(({ module, submission }) => (
              <div key={module.id} className="dash-list-row">
                <div>
                  <div className="dash-list-row-title">{module.deliverable?.description || module.title}</div>
                  <SubmissionContent submission={submission} emptyText="Avance presentado." />
                </div>
                <span className={`admin-status ${submission.status === 'reviewed' ? 'admin-status-green' : 'admin-status-gray'}`}>{submission.status === 'reviewed' ? 'Revisado' : 'En revisión'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-panel" style={{ background: 'var(--accent-bg)' }}>
          <div className="admin-panel-head"><span className="admin-panel-title"><Sparkles size={15} style={{ verticalAlign: -2, marginRight: 4 }} color="var(--accent)" /> Asistente IA</span></div>
          <p className="admin-cell-sub" style={{ marginBottom: 14 }}>Resuelve dudas sobre este curso.</p>
          <button className="admin-btn-edit" onClick={() => navigate(`/student/curso/${course.id}/ia`)}>Abrir asistente</button>
        </div>
      </div>

      {profileModalOpen && <ProfileModal course={course} initial={profile} onClose={() => setProfileModalOpen(false)} onSaved={load} />}
      {submitModule && (
        <SubmitDeliverableModal course={course} module={submitModule} existing={submissions[submitModule.id] || null} onClose={() => setSubmitModule(null)} onSaved={load}
          title={submissions[submitModule.id] ? 'Reemplazar avance' : 'Presentar avance'} noteLabel="Cuéntanos qué avanzaste o pega el link (opcional si adjuntas archivo)"
          submitLabel="Enviar avance" successMsg="Avance presentado. Tu docente lo revisará pronto." />
      )}
    </div>
  );
};

export default StudentCourseProyecto;
