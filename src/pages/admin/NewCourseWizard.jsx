import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, ImagePlus, CheckCircle2, AlertCircle } from 'lucide-react';
import ModalPortal from '../../components/ModalPortal';
import CourseCard from '../../components/CourseCard';
import { useUI } from '../../context/UIContext';
import { CATEGORIES } from '../../lib/data';
import { COURSE_THUMBNAILS } from '../../lib/courseThumbnails';
import { saveCustomCourse, uploadCourseCover, logChange } from '../../lib/db';
import { emptyCourseForm, courseFormMissing, courseFormToOffering, courseToForm, normalizeVideoUrl, LEVELS, BADGES, DEFAULT_THUMB_ID } from '../../lib/customCourses';
import './NewCourseWizard.css';

const STEPS = [
  'Datos básicos',
  'Imagen',
  'Página del curso',
  'Programa',
  'Duración y modalidad',
  'Precio y publicación',
];

const newCourseId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const Field = ({ label, required, hint, children, wide }) => (
  <div className={`admin-field nc-field${wide ? ' nc-wide' : ''}`}>
    <label>{label}{required && <span className="nc-req"> *</span>}</label>
    {children}
    {hint && <span className="nc-hint">{hint}</span>}
  </div>
);

// Pasos 1-6 del formulario "Nuevo curso" o "Editar curso". Cada campo llena una
// parte de la ficha del curso o de su tarjeta del catálogo.
// `nextOrder` es el puesto que ocupa un curso nuevo al guardarse: siempre el 1,
// y los demás bajan un puesto. Al editar, se conserva el puesto que ya tenía.
// `editing` es el curso (de CourseOfferingsContext) cuando se edita.
const NewCourseWizard = ({ adminUid, adminName, nextOrder, editing = null, onClose, onSaved }) => {
  const { addToast } = useUI();
  const [form, setForm] = useState(() => (editing ? courseToForm(editing) : emptyCourseForm()));
  const [step, setStep] = useState(0);
  const [courseId] = useState(() => editing?.id ?? newCourseId());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showMissing, setShowMissing] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const missing = useMemo(() => courseFormMissing(form), [form]);

  // Vista previa de la tarjeta del catálogo, armada con lo que va escrito.
  const preview = useMemo(() => {
    const cat = CATEGORIES.find((c) => c.id === form.cat);
    return {
      title: form.title || 'Nombre del curso',
      cardTitle: [form.cardTitle1 || 'Título de tarjeta', form.cardTitle2 || ''],
      cardDesc: form.cardDesc || 'Descripción corta del curso.',
      cardTag: cat ? cat.label.replace(/^\S+\s/, '') : '',
      duration: form.durationWeeks ? `${form.durationWeeks} semanas` : '— semanas',
      level: form.level,
      badge: form.badge === 'Ninguna' ? null : form.badge,
      price: form.price === '' ? null : Number(form.price),
      promoPercent: form.promoPercent === '' ? null : Number(form.promoPercent),
      thumb: form.cover?.url || COURSE_THUMBNAILS[DEFAULT_THUMB_ID],
    };
  }, [form]);

  const handleCover = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      addToast('La imagen debe ser PNG, JPG o WEBP.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast('La imagen pesa más de 5 MB.', 'error');
      return;
    }
    setUploading(true);
    try {
      const cover = await uploadCourseCover(courseId, file);
      setForm((f) => ({ ...f, cover }));
    } catch {
      addToast('No se pudo subir la imagen. Intenta de nuevo.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const save = async ({ publish }) => {
    if (publish && missing.length) {
      setShowMissing(true);
      addToast('Faltan datos para publicar. Revisa la lista «Antes de publicar».', 'error');
      return;
    }
    setSaving(true);
    try {
      const draft = !publish;
      const payload = courseFormToOffering({ ...form, draft }, { id: courseId, order: editing ? editing.order : nextOrder });
      await saveCustomCourse(courseId, payload, adminUid);
      const verb = editing ? 'Editó' : (publish ? 'Publicó' : 'Guardó borrador de');
      await logChange(adminName, `${verb} el curso "${form.title || 'sin nombre'}".`);
      addToast(editing ? `"${form.title}" actualizado.` : (publish ? `"${form.title}" publicado.` : 'Borrador guardado.'), 'success');
      onSaved();
      onClose();
    } catch {
      addToast('No se pudo guardar. Intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateModule = (i, key, value) => setForm((f) => ({
    ...f,
    modules: f.modules.map((m, idx) => (idx === i ? { ...m, [key]: value } : m)),
  }));
  const addModule = () => setForm((f) => ({ ...f, modules: [...f.modules, { title: '', week: '', desc: '', deliverable: '' }] }));
  const removeModule = (i) => setForm((f) => ({ ...f, modules: f.modules.filter((_, idx) => idx !== i) }));

  const isLast = step === STEPS.length - 1;

  return (
    <ModalPortal>
      <div className="admin-modal-overlay">
        <div className="admin-modal nc-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head">
            <div>
              <div className="admin-modal-title">{editing ? 'Editar curso' : 'Nuevo curso'}</div>
              <div className="admin-modal-sub">Paso {step + 1} de {STEPS.length} · {STEPS[step]}</div>
            </div>
            <button className="admin-modal-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
          </div>

          <div className="nc-steps">
            {STEPS.map((name, i) => (
              <button
                key={name}
                type="button"
                className={`nc-step${i === step ? ' active' : ''}${i < step ? ' done' : ''}`}
                onClick={() => setStep(i)}
              >
                <span>{i + 1}</span>{name}
              </button>
            ))}
          </div>

          <div className="nc-body">
            <div className="nc-form">
              {step === 0 && (
                <>
                  <Field label="Nombre del curso" required wide>
                    <input value={form.title} onChange={set('title')} placeholder="Ej. E-commerce y ventas online" />
                  </Field>
                  <div className="admin-field-row">
                    <Field label="Título de tarjeta · línea 1" required>
                      <input value={form.cardTitle1} onChange={set('cardTitle1')} placeholder="E-commerce" />
                    </Field>
                    <Field label="Título de tarjeta · línea 2 (morado)" required>
                      <input value={form.cardTitle2} onChange={set('cardTitle2')} placeholder="y ventas online" />
                    </Field>
                  </div>
                  <Field label="Descripción corta" required wide hint="Aparece en la tarjeta del catálogo.">
                    <textarea rows={2} value={form.cardDesc} onChange={set('cardDesc')} />
                  </Field>
                  <div className="admin-field-row">
                    <Field label="Categoría" required>
                      <select value={form.cat} onChange={set('cat')}>
                        {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Nivel" required>
                      <select value={form.level} onChange={set('level')}>
                        {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Etiqueta de la tarjeta" hint="«Ninguna» no muestra sello.">
                    <select value={form.badge} onChange={set('badge')}>
                      {BADGES.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </Field>
                </>
              )}

              {step === 1 && (
                <>
                  <Field label="Imagen del curso" required wide hint="PNG, JPG o WEBP de hasta 5 MB. Se usa en la tarjeta, en «Sigue explorando» y en el aula.">
                    <label className="nc-upload">
                      {form.cover?.url
                        ? <img src={form.cover.url} alt="Portada" />
                        : <span><ImagePlus size={22} /> {uploading ? 'Subiendo...' : 'Elegir imagen'}</span>}
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleCover} disabled={uploading} />
                    </label>
                    {form.cover?.url && <span className="nc-hint">{form.cover.name}</span>}
                  </Field>
                  <Field label="Video de presentación" hint="Enlace de YouTube o Vimeo (opcional). Se muestra junto al título de la página; no se sube archivo, así no pesa en la plataforma.">
                    <input value={form.videoUrl} onChange={set('videoUrl')} placeholder="https://www.youtube.com/watch?v=…" />
                  </Field>
                  {form.videoUrl.trim() && !normalizeVideoUrl(form.videoUrl) && (
                    <p className="nc-note nc-note-warn">Ese enlace no es de YouTube ni de Vimeo: no se mostrará hasta que lo corrijas.</p>
                  )}
                  <p className="nc-note">El sílabo (PDF) se sube desde «Sílabo» de cada curso en la tabla.</p>
                </>
              )}

              {step === 2 && (
                <>
                  <Field label="Bajada" required wide hint="Párrafo corto bajo el título.">
                    <textarea rows={2} value={form.summary} onChange={set('summary')} />
                  </Field>
                  <Field label="Lo que lograrás" required wide hint="Recuadro morado junto al video.">
                    <textarea rows={2} value={form.outcomeHeadline} onChange={set('outcomeHeadline')} />
                  </Field>
                  <Field label="Descripción" required wide hint="Párrafos de presentación. Separa cada párrafo con una línea en blanco.">
                    <textarea rows={6} value={form.description} onChange={set('description')} />
                  </Field>
                  <Field label="Lo que podrás hacer" required wide hint="Una línea por punto.">
                    <textarea rows={4} value={form.doable} onChange={set('doable')} />
                  </Field>
                  <Field label="Proyecto final" required wide>
                    <input value={form.projectFinal} onChange={set('projectFinal')} />
                  </Field>
                </>
              )}

              {step === 3 && (
                <>
                  <Field label="Introducción del programa" required wide>
                    <textarea rows={4} value={form.intro} onChange={set('intro')} />
                  </Field>
                  <div className="nc-modules-head">
                    <strong>Módulos</strong>
                    <button type="button" className="admin-btn-ghost" onClick={addModule}><Plus size={14} /> Agregar módulo</button>
                  </div>
                  {form.modules.length === 0 && <p className="nc-note">Aún no hay módulos. Se numeran 1, 2, 3… en el orden en que se agregan.</p>}
                  {form.modules.map((m, i) => (
                    <div className="nc-module" key={i}>
                      <div className="nc-module-top">
                        <span className="nc-module-num">Módulo {i + 1}</span>
                        <button type="button" className="admin-btn-ghost" onClick={() => removeModule(i)} aria-label="Quitar módulo"><Trash2 size={14} /></button>
                      </div>
                      <div className="admin-field-row">
                        <Field label="Título"><input value={m.title} onChange={(e) => updateModule(i, 'title', e.target.value)} /></Field>
                        <Field label="Semana"><input value={m.week} onChange={(e) => updateModule(i, 'week', e.target.value)} placeholder="Ej. Semana 1" /></Field>
                      </div>
                      <Field label="Descripción"><textarea rows={2} value={m.desc} onChange={(e) => updateModule(i, 'desc', e.target.value)} /></Field>
                      <Field label="Entregable"><input value={m.deliverable} onChange={(e) => updateModule(i, 'deliverable', e.target.value)} /></Field>
                    </div>
                  ))}
                </>
              )}

              {step === 4 && (
                <>
                  <div className="admin-field-row">
                    <Field label="Duración (semanas)" required>
                      <input type="number" min="1" max="52" value={form.durationWeeks} onChange={set('durationWeeks')} placeholder="Ej. 4" />
                    </Field>
                    <Field label="Sesiones por semana" required>
                      <input type="number" min="1" max="7" value={form.sessionsPerWeek} onChange={set('sessionsPerWeek')} placeholder="Ej. 2" />
                    </Field>
                  </div>
                  <div className="admin-field-row">
                    <Field label="Duración de cada sesión (horas)" required>
                      <input type="number" min="0.5" step="0.5" value={form.sessionHours} onChange={set('sessionHours')} placeholder="Ej. 2" />
                    </Field>
                    <Field label="Modalidad">
                      <input value="Online en vivo" readOnly />
                    </Field>
                  </div>
                  <p className="nc-note">
                    Carga semanal: {Number(form.sessionsPerWeek) * Number(form.sessionHours) || 0} horas por semana.
                    Las aulas, con sus fechas y horarios, se crean después en Aulas y horarios.
                  </p>
                </>
              )}

              {step === 5 && (
                <>
                  <div className="admin-field-row">
                    <Field label="Precio de venta (S/)" required>
                      <input type="number" min="0" value={form.price} onChange={set('price')} placeholder="Ej. 350" />
                    </Field>
                    <Field label="Promoción (%)">
                      <input type="number" min="0" max="90" value={form.promoPercent} onChange={set('promoPercent')} placeholder="Ej. 50" />
                    </Field>
                  </div>
                  <label className="admin-toggle nc-toggle">
                    <input type="checkbox" checked={form.visible} onChange={set('visible')} />
                    <span className="admin-toggle-track"></span> En la web: {form.visible ? 'Visible' : 'Oculto'}
                  </label>
                  <label className="admin-toggle nc-toggle">
                    <input type="checkbox" checked={form.enrollmentsOpen} onChange={set('enrollmentsOpen')} />
                    <span className="admin-toggle-track"></span> Inscripciones: {form.enrollmentsOpen ? 'Abiertas' : 'Cerradas'}
                  </label>
                  <p className="nc-note">Al publicar con «Visible», el curso aparece en el catálogo «Cursos prácticos» como primer curso.</p>
                </>
              )}
            </div>

            <aside className="nc-side">
              <div className="nc-side-label">Así se ve en el catálogo</div>
              <div className="nc-preview">
                <CourseCard course={preview} />
              </div>
              <div className="nc-checklist">
                <div className="nc-checklist-title">Antes de publicar</div>
                {missing.length === 0
                  ? <div className="nc-ok"><CheckCircle2 size={15} /> Todo listo para publicar.</div>
                  : (
                    <ul>
                      {missing.map((m) => <li key={m}><AlertCircle size={13} /> {m}</li>)}
                    </ul>
                  )}
                {showMissing && missing.length > 0 && <div className="nc-hint">Completa estos campos para poder publicar.</div>}
              </div>
            </aside>
          </div>

          <div className="admin-modal-actions nc-actions">
            <button className="admin-btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Atrás</button>
            <button className="admin-btn-ghost" onClick={() => save({ publish: false })} disabled={saving}>Guardar borrador</button>
            {isLast
              ? <button className="admin-btn-edit" onClick={() => save({ publish: true })} disabled={saving}>{saving ? 'Guardando...' : 'Publicar curso'}</button>
              : <button className="admin-btn-edit" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>Siguiente</button>}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default NewCourseWizard;
