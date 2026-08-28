import React, { useState } from 'react';
import { UploadCloud, Plus, Video, FileText, Trash2, Edit2, Play, CheckCircle, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { COURSES } from '../lib/data';
import { scheduleLiveSession } from '../lib/db';

const LiveClassScheduler = () => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const [courseId, setCourseId] = useState(COURSES[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [durationMin, setDurationMin] = useState(60);
  const [scheduled, setScheduled] = useState([]);
  const [saving, setSaving] = useState(false);

  const handleSchedule = async () => {
    if (!title || !startsAt) return addToast('Completa el título y la fecha/hora de la clase.', 'error');
    const course = COURSES.find(c => c.id.toString() === courseId.toString());
    setSaving(true);
    try {
      const session = await scheduleLiveSession({
        courseId: course.id,
        courseTitle: course.title,
        title,
        instructor: currentUser?.displayName || 'Docente',
        startsAt,
        durationMin: Number(durationMin),
      });
      setScheduled(prev => [session, ...prev]);
      setTitle('');
      setStartsAt('');
      addToast('Clase en vivo programada. Aparecerá en "En Vivo" para los estudiantes.', 'success');
    } catch {
      addToast('No se pudo programar la clase.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="anim-fade-up d1" style={{ paddingTop: '32px', maxWidth: '560px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '30px', border: '1px solid var(--border)', marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '20px' }}><Radio size={18} style={{ verticalAlign: '-3px', marginRight: '6px' }} />Programar clase en vivo</h3>

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
      </div>

      {scheduled.length > 0 && (
        <div>
          <h3 style={{ marginBottom: '12px', fontSize: '.95rem' }}>Programadas en esta sesión</h3>
          {scheduled.map(s => (
            <div key={s.id} style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', marginBottom: '10px' }}>
              <div style={{ fontWeight: 600, fontSize: '.9rem' }}>{s.title}</div>
              <div style={{ fontSize: '.8rem', color: 'var(--text3)' }}>{s.courseTitle} · {new Date(s.startsAt).toLocaleString('es-PE')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const TeacherDashboard = () => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();

  const [activeTab, setActiveTab] = useState('my-courses');
  const [modules, setModules] = useState([{ id: 1, title: 'Introducción', lessons: [] }]);
  const [courseTitle, setCourseTitle] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Module Management
  const addModule = () => setModules([...modules, { id: Date.now(), title: 'Nuevo Módulo', lessons: [] }]);
  
  const renameModule = (id) => {
    const title = prompt("Nuevo nombre del módulo:");
    if (title) setModules(modules.map(m => m.id === id ? { ...m, title } : m));
  };
  
  const deleteModule = (id) => {
    if (confirm("¿Seguro que deseas eliminar este módulo?")) {
      setModules(modules.filter(m => m.id !== id));
    }
  };

  // Drag & Drop Handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      addToast(`Archivo ${e.dataTransfer.files[0].name} cargado vía Drag & Drop.`, "success");
    }
  };

  const handleUploadClick = (e) => {
    e.preventDefault();
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = (e) => {
      if (e.target.files[0]) addToast(`Añadido archivo: ${e.target.files[0].name}`, "info");
    };
    input.click();
  };

  const submitToApproval = () => {
    if(!courseTitle) return addToast("Añade un título al curso antes de publicarlo.", "error");
    addToast(`¡El curso "${courseTitle}" ha sido enviado a revisión!`, "success");
    setCourseTitle('');
    setActiveTab('my-courses');
  };

  return (
    <div className="view active" style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>Panel de Docente</h1>
          <p style={{ color: 'var(--text2)' }}>Hola, {currentUser?.displayName}. Gestiona tu oferta académica aquí.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setActiveTab('builder')}><Plus size={18} /> Crear Nuevo Curso</button>
      </div>

      <div className="my-learning-tabs">
        <button className={`ml-tab ${activeTab === 'my-courses' ? 'active' : ''}`} onClick={() => setActiveTab('my-courses')}>Mis Cursos Publicados</button>
        <button className={`ml-tab ${activeTab === 'builder' ? 'active' : ''}`} onClick={() => setActiveTab('builder')}>Constructor de Cursos</button>
        <button className={`ml-tab ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>Clases en Vivo</button>
        <button className={`ml-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>Mi CV & Perfil</button>
      </div>

      {activeTab === 'live' && <LiveClassScheduler />}

      {activeTab === 'my-courses' && (
        <div className="anim-fade-up d1" style={{ paddingTop: '32px' }}>
          <div className="courses-grid">
            <div className="course-card">
              <div className="course-thumb">
                <div className="course-thumb-bg">☁️</div>
              </div>
              <div className="course-body">
                <div className="course-title">React Avanzado: Arquitectura Empresarial</div>
                <div style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: '12px' }}>Estado: <strong>Publicado</strong></div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1 }}><Edit2 size={14} /> Editar</button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: '8px', color: 'var(--rose)' }} onClick={() => addToast('Curso eliminado', 'success')}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'builder' && (
        <div className="anim-fade-up d1" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '40px', paddingTop: '32px' }}>
          <div>
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '30px', border: '1px solid var(--border)', marginBottom: '24px' }}>
              <h3 style={{ marginBottom: '20px' }}>1. Información General</h3>
              <div className="input-group" style={{ marginBottom: '16px' }}>
                <label>Título del Curso</label>
                <input className="input" type="text" placeholder="Ej. Master en Diseño UI" value={courseTitle} onChange={e => setCourseTitle(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Descripción corta para estudiantes</label>
                <textarea className="input" placeholder="Resumen de lo que aprenderán..." rows={4}></textarea>
              </div>
            </div>

            <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '30px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ margin: 0 }}>2. Temario del Curso</h3>
                <button className="btn btn-ghost btn-sm" onClick={addModule}><Plus size={16} /> Agregar Módulo</button>
              </div>
              
              {modules.map((mod, i) => (
                <div key={mod.id} style={{ background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: 'var(--r-sm)', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Módulo {i + 1}: {mod.title}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn-icon" style={{ padding: '6px', width:'28px', height:'28px' }} onClick={() => renameModule(mod.id)}><Edit2 size={12} /></button>
                      <button className="btn-icon" style={{ padding: '6px', width:'28px', height:'28px', color: 'var(--rose)' }} onClick={() => deleteModule(mod.id)}><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                    <button className="btn btn-ghost btn-sm" style={{ background: 'var(--surface)', fontSize: '.75rem' }}><Video size={12} /> Añadir Video</button>
                    <button className="btn btn-ghost btn-sm" style={{ background: 'var(--surface)', fontSize: '.75rem' }}><FileText size={12} /> Añadir Recurso</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-xl)', padding: '30px', border: '1px solid var(--border)', position: 'sticky', top: '100px' }}>
              <h3 style={{ marginBottom: '8px' }}>Materiales</h3>
              <p style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: '20px' }}>Sube videos y documentos para adjuntarlos a tus módulos.</p>
              
              <div 
                className={`upload-box ${dragActive ? 'drag-active' : ''}`}
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                onClick={handleUploadClick}
                style={{ 
                  border: `2px dashed ${dragActive ? 'var(--accent)' : 'var(--border2)'}`, 
                  background: dragActive ? 'var(--accent-bg)' : 'var(--bg)',
                  borderRadius: 'var(--r-md)', padding: '40px 20px', textAlign: 'center', marginBottom: '24px', cursor: 'pointer', transition: 'all .2s'
                }}
              >
                <UploadCloud size={40} style={{ color: dragActive ? 'var(--accent)' : 'var(--text3)', marginBottom: '16px' }} />
                <p style={{ fontSize: '.95rem', fontWeight: 500, marginBottom: '6px', color: dragActive ? 'var(--accent)' : 'var(--text)' }}>
                  Arrastra tu archivo aquí
                </p>
                <p style={{ fontSize: '.8rem', color: 'var(--text3)' }}>Soportado: MP4, PDF, DOCX, XLSX (Max 2GB)</p>
              </div>

              <div style={{ height: '1px', background: 'var(--border)', margin: '24px 0' }}></div>

              <h3 style={{ marginBottom: '16px', fontSize: '.95rem' }}>Acciones Finales</h3>
              <button onClick={submitToApproval} className="btn btn-primary btn-full" style={{ marginBottom: '12px' }}>
                <CheckCircle size={16} /> Enviar a Revisión de Admin
              </button>
              <button className="btn btn-ghost btn-full" onClick={() => addToast('Borrador guardado localmente', 'info')}>Guardar Borrador</button>
            </div>
          </div>
        </div>
      )}

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
