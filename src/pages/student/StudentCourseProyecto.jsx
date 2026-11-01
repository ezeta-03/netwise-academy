import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { saveProjectProfile } from '../../lib/db';
import { getGradingModel } from '../../lib/gradingScheme';
import { submissionFor } from '../../lib/workItems';
import { useStudentCourse } from '../../hooks/useStudentCourse';
import { useNow } from '../../hooks/useNow';
import ModalPortal from '../../components/ModalPortal';
import SubmitWorkModal from '../../components/SubmitWorkModal';
import WorkRow from '../../components/WorkRow';

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
    <div className="admin-modal-overlay">
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
          <button className="admin-btn-edit" onClick={handleSave} disabled={saving}><Plus size={13} /> {saving ? 'Guardando...' : initial ? 'Guardar cambios' : 'Crear mi proyecto'}</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

const pct = (n) => `${String(n).replace('.', ',')}%`;
const joinNames = (names) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`);

// Mi proyecto (E7): todo lo que el alumno entrega en el curso. Arriba su
// empresa (o el "Primer paso" para definirla); luego un bloque por módulo con
// su peso en la nota y, dentro, la entrega del módulo y las prácticas de sus
// clases, ordenadas por fecha. Al final, juntos, los módulos que aún no empiezan.
const StudentCourseProyecto = () => {
  const { course, group } = useOutletContext();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { data, reload } = useStudentCourse(course, group, currentUser?.uid);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [submitItem, setSubmitItem] = useState(null);
  const now = useNow(60000);

  if (!data) return <div className="admin-empty-hint">Cargando tu proyecto...</div>;
  if (data.error) return <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B' }}>No se pudo cargar tu proyecto. Recarga la página.</div>;

  const { modules, items, submissions, profile, classList } = data;
  const model = getGradingModel(course.id, modules);
  const weightOf = Object.fromEntries(model.components.filter((c) => c.kind === 'module').map((c) => [c.moduleId, c.weight]));
  const manual = model.components.filter((c) => c.kind === 'manual');
  const blocked = !profile;
  const view = (item) => navigate(`../entrega/${item.kind === 'practice' ? 'practica' : 'modulo'}/${item.kind === 'practice' ? item.practiceId : item.moduleId}`);

  // Un módulo "empezó" cuando es el primero, ya tuvo su primera clase, tiene
  // prácticas o ya hay algo entregado.
  const started = (m, i) => i === 0
    || items.some((it) => it.kind === 'practice' && it.moduleId === m.id)
    || classList.some((c) => c.moduleId === m.id && c.startsAt && new Date(c.startsAt).getTime() <= now)
    || submissions.some((s) => s.moduleId === m.id);
  const startedModules = modules.filter((m, i) => started(m, i) && items.some((it) => it.moduleId === m.id));
  const laterModules = modules.filter((m, i) => !started(m, i) && m.deliverable?.description);
  const orphanPractices = items.filter((it) => it.kind === 'practice' && !modules.some((m) => m.id === it.moduleId));
  const laterWeights = [...new Set(laterModules.map((m) => weightOf[m.id]).filter((w) => w !== undefined))];

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Mi proyecto</h1><p className="admin-page-sub">{course.title} · Tu empresa, la entrega de cada módulo y tus prácticas de clase.</p></div>
      </div>

      {profile ? (
        <div className="admin-panel" style={{ marginBottom: 20 }}>
          <div className="admin-panel-head" style={{ marginBottom: 2 }}>
            <span className="admin-panel-title">Mi empresa</span>
            <button className="admin-btn-ghost" onClick={() => setProfileModalOpen(true)}>Editar</button>
          </div>
          <p className="admin-panel-caption" style={{ marginTop: 0 }}>Todas tus prácticas se trabajan sobre ella.</p>
          <div className="dash-list-row-title">{profile.name}</div>
          <div className="admin-cell-sub">{[profile.description || profile.activity, profile.updatedAt ? `Definida el ${new Date(profile.updatedAt).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')}` : ''].filter(Boolean).join(' · ')}</div>
        </div>
      ) : (
        <div className="dark-card" style={{ margin: '14px 0 20px' }}>
          <span className="dark-card-badge">Primer paso</span>
          <h3>Define tu marca/empresa</h3>
          <p>Elige la empresa, marca o idea sobre la que vas a trabajar. Se define una sola vez y todos los avances del curso se construyen sobre ella.</p>
          <button className="admin-btn-edit" style={{ marginTop: 14 }} onClick={() => setProfileModalOpen(true)}><Plus size={14} /> Crear mi proyecto</button>
        </div>
      )}

      {items.length === 0 && (
        <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B' }}>Este curso todavía no tiene entregas publicadas.</div>
      )}

      {startedModules.map((m) => {
        const index = modules.indexOf(m);
        return (
          <div key={m.id} className="admin-panel module-block">
            <div className="module-block-head">
              <div>
                <div className="module-block-eyebrow">Módulo {index + 1}</div>
                <div className="module-block-title">{m.title}</div>
              </div>
              {weightOf[m.id] !== undefined && <span className="admin-status admin-status-violet">{pct(weightOf[m.id])} de tu nota</span>}
            </div>
            {items.filter((it) => it.moduleId === m.id).map((it) => (
              <WorkRow key={it.key} item={it} sub={submissionFor(it, submissions)} blocked={blocked} onSubmit={setSubmitItem} onView={view} />
            ))}
          </div>
        );
      })}

      {orphanPractices.length > 0 && (
        <div className="admin-panel module-block">
          <div className="module-block-head"><div className="module-block-title">Otras prácticas</div></div>
          {orphanPractices.map((it) => <WorkRow key={it.key} item={it} sub={submissionFor(it, submissions)} blocked={blocked} onSubmit={setSubmitItem} onView={view} />)}
        </div>
      )}

      {laterModules.length > 0 && (
        <div className="admin-panel module-block">
          <div className="module-block-head">
            <div>
              <div className="dash-list-row-title">{joinNames(laterModules.map((m) => `Módulo ${modules.indexOf(m) + 1}`))}</div>
              <div className="admin-cell-sub">
                Se abren cuando empiecen.{manual.length > 0 ? ` Al final va ${manual.map((c) => `${c.label.toLowerCase()} (${pct(c.weight)} de tu nota)`).join(' y ')}.` : ''}
              </div>
            </div>
            {laterWeights.length === 1 && <span className="admin-status admin-status-violet">{pct(laterWeights[0])}{laterModules.length > 1 ? ' cada uno' : ' de tu nota'}</span>}
          </div>
        </div>
      )}

      {profileModalOpen && <ProfileModal course={course} initial={profile} onClose={() => setProfileModalOpen(false)} onSaved={reload} />}
      {submitItem && <SubmitWorkModal course={course} item={submitItem} existing={submissionFor(submitItem, submissions)} onClose={() => setSubmitItem(null)} onSaved={reload} />}
    </div>
  );
};

export default StudentCourseProyecto;
