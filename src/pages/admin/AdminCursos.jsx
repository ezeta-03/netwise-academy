import React, { useEffect, useState } from 'react';
import { Search, Plus, X } from 'lucide-react';
import ModalPortal from '../../components/ModalPortal';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { COURSE_THUMBNAILS } from '../../lib/courseThumbnails';
import { CATEGORIES } from '../../lib/data';
import { updateCourseOffering, updateCourseVisibility, updateCourseEnrollmentsOpen, updateCoursePromo, updateCourseTeacher, fetchAllUsers, logChange } from '../../lib/db';

const catLabel = (catId) => {
  const cat = CATEGORIES.find((c) => c.id === catId);
  return cat ? cat.label.replace(/[^a-zA-Z\s]/g, '').trim() : catId;
};

const EditCourseModal = ({ course, adminName, onClose, onSaved }) => {
  const { addToast } = useUI();
  const [price, setPrice] = useState(course.price ?? '');
  const [startDate, setStartDate] = useState(course.startDate ?? '');
  const [promoPercent, setPromoPercent] = useState(course.promoPercent ?? '');
  const [teacherUid, setTeacherUid] = useState(course.teacherUid ?? '');
  const [teachers, setTeachers] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAllUsers().then((users) => setTeachers((users || []).filter((u) => u.role === 'teacher')));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCourseOffering(course.id, { price, startDate }, 'admin');
      await updateCoursePromo(course.id, promoPercent);
      await updateCourseTeacher(course.id, teacherUid);
      await logChange(adminName, `Actualizó precio/promoción/docente de "${course.title}".`);
      addToast(`"${course.title}" actualizado.`, 'success');
      onSaved();
      onClose();
    } catch {
      addToast('No se pudo guardar. Intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-head">
          <div>
            <div className="admin-modal-title">Editar curso</div>
            <div className="admin-modal-sub">{course.title}</div>
          </div>
          <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="admin-field-row">
          <div className="admin-field">
            <label>Precio de venta (S/)</label>
            <input type="number" min="0" placeholder="Ej. 300" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="admin-field">
            <label>Promoción (%)</label>
            <input type="number" min="0" max="90" placeholder="Ej. 25" value={promoPercent} onChange={(e) => setPromoPercent(e.target.value)} />
          </div>
        </div>
        <div className="admin-field">
          <label>Fecha de inicio</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="admin-field">
          <label>Docente asignado</label>
          <select value={teacherUid} onChange={(e) => setTeacherUid(e.target.value)}>
            <option value="">Sin asignar</option>
            {teachers.map((t) => <option key={t.uid} value={t.uid}>{t.displayName || t.email}</option>)}
          </select>
        </div>

        <div className="admin-modal-actions">
          <button className="admin-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="admin-btn-edit" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

const AdminCursos = () => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const { courses, refresh } = useCourseOfferings();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [editing, setEditing] = useState(null);

  const adminName = currentUser?.displayName || currentUser?.email || 'Admin';

  const filtered = courses.filter((c) => {
    const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase());
    const matchesCat = catFilter === 'all' || c.cat === catFilter;
    return matchesSearch && matchesCat;
  });

  const getOriginalPrice = (c) => {
    if (c.price == null || !c.promoPercent) return null;
    return Math.round(c.price / (1 - c.promoPercent / 100));
  };

  const toggleVisible = async (c) => {
    try {
      await updateCourseVisibility(c.id, !(c.visible !== false));
      await logChange(adminName, `${c.visible !== false ? 'Ocultó' : 'Mostró'} "${c.title}" en la web.`);
      refresh();
    } catch {
      addToast('No se pudo actualizar la visibilidad. Intenta de nuevo.', 'error');
    }
  };
  const toggleEnrollments = async (c) => {
    try {
      await updateCourseEnrollmentsOpen(c.id, !(c.enrollmentsOpen !== false));
      await logChange(adminName, `${c.enrollmentsOpen !== false ? 'Cerró' : 'Abrió'} inscripciones de "${c.title}".`);
      refresh();
    } catch {
      addToast('No se pudo actualizar las inscripciones. Intenta de nuevo.', 'error');
    }
  };
  const togglePromo = async (c) => {
    try {
      await updateCoursePromo(c.id, c.promoPercent ? null : 25);
      await logChange(adminName, `${c.promoPercent ? 'Quitó' : 'Activó'} la promoción de "${c.title}".`);
      refresh();
    } catch {
      addToast('No se pudo actualizar la promoción. Intenta de nuevo.', 'error');
    }
  };

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Cursos y precios</h1>
          <p className="admin-page-sub">Controla qué se muestra, cuándo se inscriben y cuánto cuesta.</p>
        </div>
        <button className="admin-btn-edit" onClick={() => addToast('Los talleres se arman en el contenido de la plataforma. Este panel controla su precio, visibilidad e inscripciones.', 'info')}>
          <Plus size={15} /> Nuevo curso
        </button>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={15} />
          <input placeholder="Buscar curso..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="admin-select" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="all">Todos los cursos</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{catLabel(c.id)}</option>)}
        </select>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Curso</th><th>En la web</th><th>Inscripciones</th><th>Precio de venta</th><th>Promoción</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const original = getOriginalPrice(c);
              return (
                <tr key={c.id}>
                  <td>
                    <div className="admin-table-course">
                      <img src={COURSE_THUMBNAILS[c.id]} alt={c.title} />
                      <div>
                        <div className="admin-table-course-title">{c.title}</div>
                        <div className="admin-table-course-meta">{catLabel(c.cat)}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <label className="admin-toggle">
                      <input type="checkbox" checked={c.visible !== false} onChange={() => toggleVisible(c)} />
                      <span className="admin-toggle-track"></span> {c.visible !== false ? 'Visible' : 'Oculto'}
                    </label>
                  </td>
                  <td>
                    <label className="admin-toggle">
                      <input type="checkbox" checked={c.enrollmentsOpen !== false} onChange={() => toggleEnrollments(c)} />
                      <span className="admin-toggle-track"></span> {c.enrollmentsOpen !== false ? 'Abiertas' : 'Cerradas'}
                    </label>
                  </td>
                  <td>
                    {c.price == null ? <span className="admin-cell-sub">Por confirmar</span> : (
                      <>
                        <span className="admin-price">{c.price === 0 ? 'Gratis' : `S/ ${c.price.toFixed(2)}`}</span>
                        {original && <span className="admin-price-old">S/ {original.toFixed(2)}</span>}
                      </>
                    )}
                  </td>
                  <td>
                    <label className="admin-toggle">
                      <input type="checkbox" checked={!!c.promoPercent} onChange={() => togglePromo(c)} />
                      <span className="admin-toggle-track"></span> {c.promoPercent ? `${c.promoPercent}% dto.` : 'Sin promo'}
                    </label>
                  </td>
                  <td>
                    <button className="admin-btn-edit" onClick={() => setEditing(c)}>Editar curso</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="admin-footnote">
          <span>Los cambios no afectan las matrículas existentes.</span>
          <span>Moneda PEN · Soles peruanos</span>
        </div>
      </div>

      {editing && (
        <EditCourseModal course={editing} adminName={adminName} onClose={() => setEditing(null)} onSaved={refresh} />
      )}
    </div>
  );
};

export default AdminCursos;
