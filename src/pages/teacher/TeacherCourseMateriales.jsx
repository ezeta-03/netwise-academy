import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Search, Download } from 'lucide-react';
import { fetchCourseContent } from '../../lib/db';

const TeacherCourseMateriales = () => {
  const { course } = useOutletContext();
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourseContent(course.id).then((data) => {
      const all = (data.modules || []).flatMap((m) => (m.materials || []).map((mat) => ({ ...mat, moduleTitle: m.title })));
      setMaterials(all);
      setLoading(false);
    });
  }, [course.id]);

  const filtered = materials.filter((m) => {
    const matchesSearch = m.title.toLowerCase().includes(search.toLowerCase());
    const matchesCat = category === 'all' || m.category === category;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Nutre cada clase.</h1>
          <p className="admin-page-sub">Sube presentaciones, lecturas, videos, plantillas y material complementario.</p>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search"><Search size={15} /><input placeholder="Buscar un material..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select className="admin-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">Todos</option>
          <option value="Material de clase">Material de clase</option>
          <option value="Plantillas">Plantillas</option>
          <option value="Material de apoyo">Material de apoyo</option>
        </select>
      </div>

      {loading ? <div className="admin-empty-hint">Cargando materiales...</div> : filtered.length === 0 ? (
        <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B' }}>
          <p style={{ marginBottom: 12 }}>Todavía no subes materiales. Agrégalos desde cada módulo en "Contenido".</p>
        </div>
      ) : (
        <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {filtered.map((mat) => (
            <div key={mat.id} className="admin-stat-card">
              <span className="admin-status admin-status-gray" style={{ marginBottom: 12, display: 'inline-block' }}>{mat.category}</span>
              <div className="dash-list-row-title" style={{ marginBottom: 4 }}>{mat.title}</div>
              <div className="admin-cell-sub" style={{ marginBottom: 14 }}>{mat.moduleTitle} · Netwise Academy</div>
              <a className="admin-btn-ghost" href={mat.url} target="_blank" rel="noreferrer"><Download size={13} /> Descargar</a>
            </div>
          ))}
        </div>
      )}
      <p className="admin-panel-caption" style={{ marginTop: 16 }}><Plus size={12} style={{ verticalAlign: -1 }} /> Sube nuevos materiales desde el módulo correspondiente en "Contenido".</p>
    </div>
  );
};

export default TeacherCourseMateriales;
