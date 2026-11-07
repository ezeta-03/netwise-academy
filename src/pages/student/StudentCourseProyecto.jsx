import React, { useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Plus, X, Upload, FileText, Download, FolderOpen, Pencil } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { saveProjectProfile, uploadSubmissionFile } from '../../lib/db';
import { isPendingUrl } from '../../lib/placeholders';
import { getGradingModel } from '../../lib/gradingScheme';
import { submissionFor } from '../../lib/workItems';
import { useStudentCourse } from '../../hooks/useStudentCourse';
import { useNow } from '../../hooks/useNow';
import ModalPortal from '../../components/ModalPortal';
import SubmitWorkModal from '../../components/SubmitWorkModal';
import WorkRow from '../../components/WorkRow';

// Mismos tipos y tope que las entregas (storage.rules, /submissions/{uid}).
const FICHA_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp';
const FICHA_TYPES = /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\..+|application\/vnd\.ms-powerpoint|application\/vnd\.ms-excel|image\/(png|jpeg|webp))$/;
const FICHA_MAX_MB = 50;
const fmtSize = (bytes) => (bytes ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : '');
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }).replace(/\./g, '') : '');

// La ficha en blanco que el docente comparte en Materiales del curso: el
// material cuyo nombre dice "ficha" (si hay varios, el primero).
const findBlankFicha = (modules) => (modules || [])
  .flatMap((m) => m.materials || [])
  .find((mat) => /ficha/i.test(mat.title || '') && !isPendingUrl(mat.url)) || null;

// Crear mi proyecto (E7): el proyecto se crea con la ficha de proyecto. El
// alumno descarga la ficha en blanco de Materiales, la llena y la sube aquí
// junto con el nombre de la empresa y una breve descripción.
const ProfileModal = ({ course, initial, blankFicha, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const navigate = useNavigate();
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const hasFicha = !!file || !!initial?.fichaUrl;

  const pick = (list) => {
    const f = list?.[0];
    if (!f) return;
    if (!FICHA_TYPES.test(f.type)) { addToast(`"${f.name}" no es un tipo aceptado. Sube la ficha en PDF, Word, Excel, PowerPoint o imagen.`, 'error'); return; }
    if (f.size > FICHA_MAX_MB * 1024 * 1024) { addToast(`La ficha pesa más de ${FICHA_MAX_MB} MB.`, 'error'); return; }
    setFile(f);
  };

  const missing = !hasFicha ? 'Sube tu ficha llena' : !name.trim() ? 'Escribe el nombre de tu empresa' : !description.trim() ? 'Escribe una breve descripción' : '';

  const handleSave = async () => {
    if (missing) { addToast(missing, 'error'); return; }
    setSaving(true);
    try {
      const ficha = file
        ? { fichaUrl: await uploadSubmissionFile(currentUser.uid, course.id, 'ficha', file), fichaName: file.name, fichaSize: file.size, fichaUploadedAt: new Date().toISOString() }
        : { fichaUrl: initial.fichaUrl, fichaName: initial.fichaName || 'Ficha de proyecto', fichaSize: initial.fichaSize || null, fichaUploadedAt: initial.fichaUploadedAt || null };
      await saveProjectProfile({
        uid: currentUser.uid, courseId: course.id, courseTitle: course.title,
        studentName: currentUser.displayName || '', studentEmail: currentUser.email || '',
        name: name.trim(), description: description.trim(), ...ficha,
      });
      addToast(initial ? 'Tu proyecto quedó actualizado.' : 'Tu proyecto quedó creado con tu ficha.', 'success');
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
        <div className="admin-modal-head">
          <div className="admin-modal-title">{initial ? 'Editar mi proyecto' : 'Crear mi proyecto'}</div>
          <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dark-card ficha-steps">
          <span className="dark-card-badge">Tu proyecto</span>
          <p>Tu proyecto se crea con la ficha de proyecto: descárgala en Materiales del curso, llénala y súbela aquí.</p>
          {blankFicha
            ? <a className="admin-btn-ghost" href={blankFicha.url} target="_blank" rel="noreferrer"><Download size={13} /> Descargar ficha en blanco</a>
            : <button type="button" className="admin-btn-ghost" onClick={() => { onClose(); navigate('../materiales'); }}><FolderOpen size={13} /> Ir a Materiales del curso</button>}
        </div>

        <div className="admin-field">
          <label>Ficha de proyecto llena</label>
          <input ref={inputRef} type="file" accept={FICHA_ACCEPT} hidden onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
          {hasFicha ? (
            <div className="ficha-file">
              <FileText size={18} />
              <div className="ficha-file-body">
                <div className="dash-list-row-title">{file ? file.name : initial.fichaName || 'Ficha de proyecto'}</div>
                <div className="admin-cell-sub">{file ? `${fmtSize(file.size)} · Lista para subir` : `Subida el ${fmtDay(initial.fichaUploadedAt)}`}</div>
              </div>
              <button type="button" className="admin-panel-link ficha-change" onClick={() => inputRef.current?.click()}>Cambiar</button>
            </div>
          ) : (
            <div
              role="button" tabIndex={0}
              className={`qr-upload-drop ${dragOver ? 'over' : ''}`}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files); }}
            >
              <Upload size={18} />
              <strong>Arrastra tu ficha o elige un archivo</strong>
              <span>PDF, Word, Excel, PowerPoint o imagen · hasta {FICHA_MAX_MB} MB</span>
            </div>
          )}
        </div>
        <div className="admin-field"><label>Nombre de la empresa, marca o idea</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Café Altura" /></div>
        <div className="admin-field"><label>Breve descripción</label><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="¿A qué se dedica y a quién se dirige?" /></div>
        <div className="admin-modal-actions">
          <button className="admin-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="admin-btn-edit" onClick={handleSave} disabled={saving || !!missing} title={missing || undefined}>
            {initial ? <Pencil size={13} /> : <Plus size={13} />} {saving ? 'Guardando...' : initial ? 'Guardar cambios' : 'Crear mi proyecto'}
          </button>
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
            <button className="admin-btn-ghost" onClick={() => setProfileModalOpen(true)}><Pencil size={13} /> Editar</button>
          </div>
          <p className="admin-panel-caption" style={{ marginTop: 0 }}>Todas tus prácticas se trabajan sobre ella.</p>
          <div className="dash-list-row-title">{profile.name}</div>
          {(profile.description || profile.activity) && <div className="admin-cell-sub">{profile.description || profile.activity}</div>}
          {profile.fichaUrl ? (
            <div className="ficha-file" style={{ marginTop: 12 }}>
              <FileText size={18} />
              <div className="ficha-file-body">
                <div className="dash-list-row-title">{profile.fichaName || 'Ficha de proyecto'}</div>
                <div className="admin-cell-sub">Ficha de proyecto{profile.fichaUploadedAt ? ` · subida el ${fmtDay(profile.fichaUploadedAt)}` : ''}</div>
              </div>
              <a className="admin-btn-ghost" href={profile.fichaUrl} target="_blank" rel="noreferrer"><Download size={13} /> Ver ficha</a>
            </div>
          ) : (
            <div className="ficha-file is-missing" style={{ marginTop: 12 }}>
              <FileText size={18} />
              <div className="ficha-file-body">
                <div className="dash-list-row-title">Falta tu ficha de proyecto</div>
                <div className="admin-cell-sub">Descárgala en Materiales del curso, llénala y súbela.</div>
              </div>
              <button className="admin-btn-edit" onClick={() => setProfileModalOpen(true)}><Upload size={13} /> Subir ficha</button>
            </div>
          )}
        </div>
      ) : (
        <div className="dark-card" style={{ margin: '14px 0 20px' }}>
          <span className="dark-card-badge">Primer paso</span>
          <h3>Crea tu proyecto con la ficha</h3>
          <p>Descarga la ficha de proyecto en Materiales del curso, llénala con los datos de tu empresa, marca o idea y súbela. Todos los avances del curso se construyen sobre ella.</p>
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

      {profileModalOpen && <ProfileModal course={course} initial={profile} blankFicha={findBlankFicha(modules)} onClose={() => setProfileModalOpen(false)} onSaved={reload} />}
      {submitItem && <SubmitWorkModal course={course} item={submitItem} existing={submissionFor(submitItem, submissions)} onClose={() => setSubmitItem(null)} onSaved={reload} />}
    </div>
  );
};

export default StudentCourseProyecto;
