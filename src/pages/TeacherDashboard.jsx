import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Video, FileText, Trash2, Edit2, Radio, LogIn, Link2, Save, X, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { COURSE_THUMBNAILS } from '../lib/courseThumbnails';
import { useCourseOfferings } from '../context/CourseOfferingsContext';
import { scheduleLiveSession, fetchLiveSessions, cancelLiveSession, deleteLiveSession, fetchCourseContent, saveCourseContent } from '../lib/db';
import { getLiveSessionStatus } from '../lib/liveSessionStatus';

const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const LiveClassScheduler = () => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const navigate = useNavigate();
  const { courses: COURSES } = useCourseOfferings();
  const [courseId, setCourseId] = useState(COURSES[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [durationMin, setDurationMin] = useState(60);
  const [mySessions, setMySessions] = useState([]);
  const [saving, setSaving] = useState(false);

  // Todas las clases en vivo que este docente ya programó (no solo las de
  // esta sesión del navegador), para poder entrar a la sala desde aquí.
  const loadMySessions = useCallback(() => {
    fetchLiveSessions().then((all) => {
      setMySessions(all.filter(s => s.instructorUid ? s.instructorUid === currentUser?.uid : s.instructor === currentUser?.displayName));
    });
  }, [currentUser]);

  useEffect(() => { loadMySessions(); }, [loadMySessions]);

  const handleSchedule = async () => {
    if (!title || !startsAt) return addToast('Completa el título y la fecha/hora de la clase.', 'error');
    const course = COURSES.find(c => c.id.toString() === courseId.toString());
    if (!course) return addToast('Todavía no hay cursos para asociar a la clase en vivo.', 'error');
    setSaving(true);
    try {
      await scheduleLiveSession({
        courseId: course.id,
        courseTitle: course.title,
        title,
        instructor: currentUser?.displayName || 'Docente',
        instructorUid: currentUser?.uid,
        startsAt,
        durationMin: Number(durationMin),
      });
      setTitle('');
      setStartsAt('');
      addToast('Clase en vivo programada. Aparecerá en "En Vivo" para los estudiantes.', 'success');
      loadMySessions();
    } catch {
      addToast('No se pudo programar la clase.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (session) => {
    if (!confirm(`¿Cancelar "${session.title}"? Los estudiantes verán la clase marcada como cancelada.`)) return;
    try {
      await cancelLiveSession(session.id);
      addToast('Clase cancelada.', 'success');
      loadMySessions();
    } catch {
      addToast('No se pudo cancelar la clase.', 'error');
    }
  };

  const handleDelete = async (session) => {
    if (!confirm(`¿Eliminar "${session.title}" definitivamente? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteLiveSession(session.id);
      addToast('Clase eliminada.', 'success');
      loadMySessions();
    } catch {
      addToast('No se pudo eliminar la clase.', 'error');
    }
  };

  return (
    <div className="anim-fade-up d1" style={{ paddingTop: '32px', maxWidth: '560px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '30px', border: '1px solid var(--border)', marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '20px' }}><Radio size={18} style={{ verticalAlign: '-3px', marginRight: '6px' }} />Programar clase en vivo</h3>

        {COURSES.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <p>Todavía no hay cursos publicados para programar una clase en vivo.</p>
          </div>
        ) : (
          <>
            <div className="input-group" style={{ marginBottom: '16px' }}>
              <label>Curso</label>
              <select className="input" value={courseId} onChange={e => setCourseId(e.target.value)}>
                {COURSES.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>

            <div className="input-group" style={{ marginBottom: '16px' }}>
              <label>Título de la sesión</label>
              <input className="input" type="text" placeholder="Ej. Q&A en vivo: dudas del módulo 3" value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label>Fecha y hora</label>
                <input className="input" type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
              </div>
              <div className="input-group" style={{ width: '140px' }}>
                <label>Duración (min)</label>
                <input className="input" type="number" min={15} step={15} value={durationMin} onChange={e => setDurationMin(e.target.value)} />
              </div>
            </div>

            <button className="btn btn-primary btn-full" onClick={handleSchedule} disabled={saving}>
              <Radio size={16} /> {saving ? 'Programando...' : 'Programar clase en vivo'}
            </button>
          </>
        )}
      </div>

      {mySessions.length > 0 && (
        <div>
          <h3 style={{ marginBottom: '12px', fontSize: '.95rem' }}>Tus clases en vivo</h3>
          {mySessions.map(s => {
            const liveStatus = getLiveSessionStatus(s);
            const joinable = liveStatus === 'live' || liveStatus === 'upcoming';
            const canCancel = liveStatus === 'upcoming' || liveStatus === 'live';
            return (
              <div key={s.id} style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '.9rem' }}>
                    {s.title}
                    {liveStatus === 'cancelled' && <span className="badge badge-rose" style={{ marginLeft: '8px' }}>Cancelada</span>}
                    {liveStatus === 'ended' && <span className="badge badge-accent" style={{ marginLeft: '8px' }}>Finalizada</span>}
                  </div>
                  <div style={{ fontSize: '.8rem', color: 'var(--text3)' }}>{s.courseTitle} · {new Date(s.startsAt).toLocaleString('es-PE')}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {joinable && (
                    <button className={`btn ${liveStatus === 'live' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => navigate(`/live/${s.id}`)}>
                      <LogIn size={14} /> Entrar
                    </button>
                  )}
                  {canCancel && (
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--rose)' }} onClick={() => handleCancel(s)}>
                      <XCircle size={14} /> Cancelar
                    </button>
                  )}
                  {!canCancel && (
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--rose)' }} onClick={() => handleDelete(s)}>
                      <Trash2 size={14} /> Eliminar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Formulario para crear/editar una lección: video (link de YouTube/Vimeo,
// convertido a embed recién al reproducirla) + materiales como enlaces --
// el proyecto no tiene Firebase Storage habilitado para subir archivos.
const LessonEditor = ({ initial, onSave, onCancel }) => {
  const [title, setTitle] = useState(initial?.title || '');
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl || '');
  const [duration, setDuration] = useState(initial?.duration || '');
  const [resources, setResources] = useState(initial?.resources || []);

  const addResource = () => setResources([...resources, { id: uid('r'), title: '', url: '' }]);
  const updateResource = (id, field, value) => setResources(resources.map(r => r.id === id ? { ...r, [field]: value } : r));
  const removeResource = (id) => setResources(resources.filter(r => r.id !== id));

  const canSave = title.trim() && videoUrl.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: initial?.id || uid('l'),
      title: title.trim(),
      videoUrl: videoUrl.trim(),
      duration: duration.trim(),
      resources: resources.filter(r => r.title.trim() && r.url.trim()),
    });
  };

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 'var(--r-sm)', padding: '16px', marginBottom: '10px' }}>
      <div className="input-group" style={{ marginBottom: '10px' }}>
        <label style={{ fontSize: '.75rem' }}>Título de la lección</label>
        <input className="input" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Introducción a los prompts" />
      </div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <div className="input-group" style={{ flex: 1 }}>
          <label style={{ fontSize: '.75rem' }}>Link del video (YouTube/Vimeo)</label>
          <input className="input" type="text" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
        </div>
        <div className="input-group" style={{ width: '110px' }}>
          <label style={{ fontSize: '.75rem' }}>Duración</label>
          <input className="input" type="text" value={duration} onChange={e => setDuration(e.target.value)} placeholder="12:00" />
        </div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label style={{ fontSize: '.75rem', color: 'var(--text2)' }}>Materiales (enlaces)</label>
          <button type="button" className="btn btn-ghost btn-sm" onClick={addResource}><Link2 size={12} /> Agregar material</button>
        </div>
        {resources.map(r => (
          <div key={r.id} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <input className="input" style={{ flex: 1 }} type="text" placeholder="Nombre (Ej. Slides)" value={r.title} onChange={e => updateResource(r.id, 'title', e.target.value)} />
            <input className="input" style={{ flex: 2 }} type="text" placeholder="https://..." value={r.url} onChange={e => updateResource(r.id, 'url', e.target.value)} />
            <button type="button" className="btn-icon" style={{ color: 'var(--rose)' }} onClick={() => removeResource(r.id)}><X size={14} /></button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancelar</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={!canSave}><Save size={14} /> Guardar lección</button>
      </div>
    </div>
  );
};

// Editor real del temario de un curso: módulos -> lecciones, cada una con su
// propio video y materiales. Antes "Constructor de Cursos" no tocaba
// Firestore para nada -- todo vivía en useState y se perdía al recargar, y
// lo que veían los estudiantes en el reproductor era un temario genérico
// idéntico para los 4 cursos.
const CourseContentBuilder = ({ courseId, onCourseIdChange }) => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const { courses: COURSES } = useCourseOfferings();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null); // { moduleId, lessonId | 'new' }

  const loadContent = useCallback(() => {
    if (!courseId) return;
    setLoading(true);
    fetchCourseContent(courseId).then((data) => {
      setModules(data.modules || []);
      setLoading(false);
      setEditingLesson(null);
    });
  }, [courseId]);

  useEffect(() => { loadContent(); }, [loadContent]);

  const addModule = () => setModules([...modules, { id: uid('m'), title: `Módulo ${modules.length + 1}`, lessons: [] }]);

  const renameModule = (id) => {
    const mod = modules.find(m => m.id === id);
    const title = prompt('Nuevo nombre del módulo:', mod?.title);
    if (title) setModules(modules.map(m => m.id === id ? { ...m, title } : m));
  };

  const deleteModule = (id) => {
    if (confirm('¿Eliminar este módulo y todas sus lecciones?')) {
      setModules(modules.filter(m => m.id !== id));
    }
  };

  const saveLesson = (moduleId, lesson) => {
    setModules(modules.map(m => {
      if (m.id !== moduleId) return m;
      const exists = m.lessons.some(l => l.id === lesson.id);
      const lessons = exists ? m.lessons.map(l => l.id === lesson.id ? lesson : l) : [...m.lessons, lesson];
      return { ...m, lessons };
    }));
    setEditingLesson(null);
  };

  const deleteLesson = (moduleId, lessonId) => {
    if (!confirm('¿Eliminar esta lección?')) return;
    setModules(modules.map(m => m.id === moduleId ? { ...m, lessons: m.lessons.filter(l => l.id !== lessonId) } : m));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await saveCourseContent(courseId, modules, currentUser?.uid);
      addToast('Contenido del curso guardado. Ya está disponible para los estudiantes.', 'success');
    } catch {
      addToast('No se pudo guardar el contenido.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (COURSES.length === 0) {
    return <div className="empty-state" style={{ padding: '32px 16px' }}><p>Todavía no hay cursos publicados.</p></div>;
  }

  return (
    <div className="anim-fade-up d1" style={{ paddingTop: '32px', maxWidth: '760px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '30px', border: '1px solid var(--border)', marginBottom: '24px' }}>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label>Curso a editar</label>
          <select className="input" value={courseId} onChange={e => onCourseIdChange(e.target.value)}>
            {COURSES.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text2)' }}>Cargando temario...</div>
      ) : (
        <>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '30px', border: '1px solid var(--border)', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Temario</h3>
              <button className="btn btn-ghost btn-sm" onClick={addModule}><Plus size={16} /> Agregar Módulo</button>
            </div>

            {modules.length === 0 && (
              <div className="empty-state" style={{ padding: '24px' }}><p>Este curso todavía no tiene módulos. Agrega el primero.</p></div>
            )}

            {modules.map((mod, mi) => (
              <div key={mod.id} style={{ background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: 'var(--r-sm)', padding: '16px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Módulo {mi + 1}: {mod.title}</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn-icon" style={{ padding: '6px', width: '28px', height: '28px' }} onClick={() => renameModule(mod.id)}><Edit2 size={12} /></button>
                    <button className="btn-icon" style={{ padding: '6px', width: '28px', height: '28px', color: 'var(--rose)' }} onClick={() => deleteModule(mod.id)}><Trash2 size={12} /></button>
                  </div>
                </div>

                <div style={{ marginTop: '14px' }}>
                  {mod.lessons.map((les) => (
                    editingLesson?.moduleId === mod.id && editingLesson?.lessonId === les.id ? (
                      <LessonEditor
                        key={les.id}
                        initial={les}
                        onSave={(l) => saveLesson(mod.id, l)}
                        onCancel={() => setEditingLesson(null)}
                      />
                    ) : (
                      <div key={les.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--surface)', borderRadius: 'var(--r-sm)', marginBottom: '8px', fontSize: '.85rem' }}>
                        <div>
                          <div style={{ fontWeight: 500 }}>{les.title}</div>
                          <div style={{ color: 'var(--text3)', fontSize: '.78rem' }}>
                            <Video size={11} style={{ verticalAlign: '-2px' }} /> {les.duration || 'Sin duración'} · {les.resources?.length || 0} material(es)
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn-icon" style={{ padding: '6px', width: '28px', height: '28px' }} onClick={() => setEditingLesson({ moduleId: mod.id, lessonId: les.id })}><Edit2 size={12} /></button>
                          <button className="btn-icon" style={{ padding: '6px', width: '28px', height: '28px', color: 'var(--rose)' }} onClick={() => deleteLesson(mod.id, les.id)}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    )
                  ))}

                  {editingLesson?.moduleId === mod.id && editingLesson?.lessonId === 'new' ? (
                    <LessonEditor onSave={(l) => saveLesson(mod.id, l)} onCancel={() => setEditingLesson(null)} />
                  ) : (
                    <button className="btn btn-ghost btn-sm" style={{ background: 'var(--surface)', fontSize: '.75rem' }} onClick={() => setEditingLesson({ moduleId: mod.id, lessonId: 'new' })}>
                      <Plus size={12} /> Agregar Lección
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button className="btn btn-primary btn-full" onClick={handleSaveAll} disabled={saving}>
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar contenido del curso'}
          </button>
        </>
      )}
    </div>
  );
};

const TeacherDashboard = () => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const { courses: COURSES } = useCourseOfferings();

  const [activeTab, setActiveTab] = useState('my-courses');
  const [builderCourseId, setBuilderCourseId] = useState(COURSES[0]?.id ?? '');

  const openContentEditor = (courseId) => {
    setBuilderCourseId(courseId);
    setActiveTab('builder');
  };

  return (
    <div className="view active" style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>Panel de Docente</h1>
          <p style={{ color: 'var(--text2)' }}>Hola, {currentUser?.displayName}. Gestiona tu oferta académica aquí.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openContentEditor(builderCourseId)}><Edit2 size={18} /> Editar Contenido</button>
      </div>

      <div className="my-learning-tabs">
        <button className={`ml-tab ${activeTab === 'my-courses' ? 'active' : ''}`} onClick={() => setActiveTab('my-courses')}>Mis Cursos Publicados</button>
        <button className={`ml-tab ${activeTab === 'builder' ? 'active' : ''}`} onClick={() => setActiveTab('builder')}>Contenido del Curso</button>
        <button className={`ml-tab ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>Clases en Vivo</button>
        <button className={`ml-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>Mi CV & Perfil</button>
      </div>

      {activeTab === 'live' && <LiveClassScheduler />}

      {activeTab === 'my-courses' && (
        <div className="anim-fade-up d1" style={{ paddingTop: '32px' }}>
          {COURSES.length === 0 ? (
            <div className="empty-state">
              <div className="es-icon">📭</div>
              <p>Todavía no hay cursos publicados.</p>
            </div>
          ) : (
            <div className="courses-grid">
              {COURSES.map(c => (
                <div className="course-card" key={c.id}>
                  <div className="course-thumb">
                    <img src={COURSE_THUMBNAILS[c.id]} alt={c.title} className="course-thumb-img" />
                  </div>
                  <div className="course-body">
                    <div className="course-title">{c.title}</div>
                    <div style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: '12px' }}>Estado: <strong>Publicado</strong></div>
                    <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={() => openContentEditor(c.id)}>
                      <Edit2 size={14} /> Editar contenido
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'builder' && <CourseContentBuilder courseId={builderCourseId} onCourseIdChange={setBuilderCourseId} />}

      {activeTab === 'profile' && (
        <div className="anim-fade-up d1" style={{ paddingTop: '32px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '30px', border: '1px solid var(--border)' }}>
            <h3 style={{ marginBottom: '24px' }}>Hoja de Vida Académica</h3>
            <div className="input-group" style={{ marginBottom: '20px' }}>
              <label>Grados Universitarios o Especialidades</label>
              <input type="text" className="input" placeholder="Ej. Ingeniero de Software, Universidad ABC" />
            </div>
            <div className="input-group" style={{ marginBottom: '20px' }}>
              <label>Biografía Profesional (Se mostrará en los cursos)</label>
              <textarea className="input" rows={5} placeholder="Cuéntanos sobre tu experiencia..."></textarea>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)', padding: '16px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', background: 'var(--accent-bg)', color: 'var(--accent)', borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '.9rem', fontWeight: 500 }}>Certificado_AWS.pdf</div>
                  <div style={{ fontSize: '.75rem', color: 'var(--text3)' }}>Validado hace 2 días</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm">Subir Nuevo Certificado</button>
            </div>

            <button className="btn btn-primary" onClick={() => addToast("CV actualizado exitosamente", "success")}>Guardar Perfil</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
