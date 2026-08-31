import React, { useState, useMemo, useEffect } from 'react';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { useCourseOfferings } from '../context/CourseOfferingsContext';
import { Search, Rocket } from 'lucide-react';
import { fetchAllUsers, updateUserRole, updateCourseOffering } from '../lib/db';
import { COURSE_THUMBNAILS } from '../lib/courseThumbnails';

// Lista de demo: se reemplaza automáticamente por los docs reales de
// Firestore (`users`) en cuanto hay un proyecto Firebase conectado.
const MOCK_USER_ROWS = [
  { id: 1, uid: 'mock-1', name: 'Ana Estudiante', email: 'demo@netwise.com', role: 'student', joined: '12 Ene 2024' },
  { id: 2, uid: 'mock-2', name: 'Carlos Profesor', email: 'profe@netwise.com', role: 'teacher', joined: '03 Mar 2023' },
  { id: 3, uid: 'mock-3', name: 'System Admin', email: 'admin@netwise.com', role: 'admin', joined: '01 Ene 2023' },
  { id: 4, uid: 'mock-4', name: 'Luis García', email: 'luis@netwise.com', role: 'student', joined: '28 Feb 2024' },
];

const formatJoined = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

const WorkshopOfferingRow = ({ course, adminUid, onSaved }) => {
  const { addToast } = useUI();
  const [price, setPrice] = useState(course.price ?? '');
  const [startDate, setStartDate] = useState(course.startDate ?? '');
  const [saving, setSaving] = useState(false);

  const isOpen = course.price != null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCourseOffering(course.id, { price, startDate }, adminUid);
      addToast(`"${course.title}" actualizado.`, 'success');
      onSaved();
    } catch {
      addToast('No se pudo guardar. Intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="reco-card" style={{ alignItems: 'center', padding: '16px 24px', flexWrap: 'wrap', gap: '16px' }}>
      <div className="reco-thumb" style={{ width: '56px', height: '56px', borderRadius: '8px' }}>
        <img src={COURSE_THUMBNAILS[course.id]} alt={course.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div className="reco-body" style={{ minWidth: '180px' }}>
        <div className="reco-title" style={{ fontSize: '1rem' }}>{course.title}</div>
        <div className="reco-meta" style={{ marginTop: '4px' }}>
          <span className={`badge ${isOpen ? 'badge-green' : 'badge-amber'}`}>{isOpen ? 'Abierto' : 'Por confirmar'}</span>
        </div>
      </div>
      <div className="input-group" style={{ width: '140px' }}>
        <label style={{ fontSize: '.75rem' }}>Precio (S/)</label>
        <input className="input" type="number" min="0" placeholder="Ej. 150" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <div className="input-group" style={{ width: '170px' }}>
        <label style={{ fontSize: '.75rem' }}>Fecha de inicio</label>
        <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving} style={{ alignSelf: 'flex-end' }}>
        <Rocket size={14} /> {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  );
};

const AdminDashboard = () => {
  const { addToast } = useUI();
  const { currentUser } = useAuth();
  const { courses: COURSES, refresh: refreshOfferings } = useCourseOfferings();
  const [activeTab, setActiveTab] = useState('users');

  // User State & Filters
  const [users, setUsers] = useState(MOCK_USER_ROWS);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    fetchAllUsers().then((realUsers) => {
      if (!realUsers) return; // modo mock: se queda con MOCK_USER_ROWS
      setUsers(realUsers.map((u) => ({
        id: u.uid,
        uid: u.uid,
        name: u.displayName || u.email,
        email: u.email,
        role: u.role || 'student',
        joined: formatJoined(u.createdAt),
      })));
    });
  }, []);

  const handleRoleChange = async (targetUser, newRole) => {
    if (targetUser.uid === currentUser?.uid) return; // un admin no puede cambiar su propio rol
    setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, role: newRole } : u));
    await updateUserRole(targetUser.uid, newRole);
    addToast(`Rol de ${targetUser.name} actualizado a "${newRole}".`, 'success');
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  return (
    <div className="view active" style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '8px' }}>Panel de Administrador</h1>
      <p style={{ color: 'var(--text2)', marginBottom: '30px' }}>Gestiona los talleres y los usuarios de la plataforma.</p>

      <div className="my-learning-tabs">
        <button className={`ml-tab ${activeTab === 'workshops' ? 'active' : ''}`} onClick={() => setActiveTab('workshops')}>Talleres</button>
        <button className={`ml-tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>Usuarios</button>
      </div>

      {activeTab === 'workshops' && (
        <div className="anim-fade-up d1" style={{ paddingTop: '32px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '30px', border: '1px solid var(--border)' }}>
            <h3 style={{ marginBottom: '8px' }}>Apertura de Cohorte</h3>
            <p style={{ color: 'var(--text2)', marginBottom: '24px' }}>
              Define precio y fecha de inicio de cada taller. Mientras un taller no tenga precio, los alumnos solo pueden preinscribirse; al guardarlo acá queda "Abierto" en Inicio, Catálogo y el detalle del curso al instante.
            </p>
            <div style={{ display: 'grid', gap: '16px' }}>
              {COURSES.map((course) => (
                <WorkshopOfferingRow key={course.id} course={course} adminUid={currentUser?.uid} onSaved={refreshOfferings} />
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="anim-fade-up d1" style={{ paddingTop: '32px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: '30px', border: '1px solid var(--border)' }}>
            <h3 style={{ marginBottom: '20px' }}>Gestión de Usuarios</h3>
            
            {/* Filters */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              <div className="search-bar" style={{ flex: 1, maxWidth: '400px' }}>
                <Search size={16} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre o correo..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="input-group" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <select className="input" style={{ minWidth: '160px' }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="all">Todos los roles</option>
                  <option value="student">Estudiantes</option>
                  <option value="teacher">Profesores</option>
                  <option value="admin">Administradores</option>
                </select>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '.95rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '16px' }}>Nombre</th>
                  <th style={{ padding: '16px' }}>Correo</th>
                  <th style={{ padding: '16px' }}>Rol</th>
                  <th style={{ padding: '16px' }}>Registro</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length > 0 ? filteredUsers.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '16px', fontWeight: 500 }}>{u.name}</td>
                    <td style={{ padding: '16px', color: 'var(--text2)' }}>{u.email}</td>
                    <td style={{ padding: '16px' }}>
                      <select
                        className="input"
                        style={{ padding: '6px 10px', fontSize: '.85rem', width: 'auto' }}
                        value={u.role}
                        disabled={u.uid === currentUser?.uid}
                        title={u.uid === currentUser?.uid ? 'No puedes cambiar tu propio rol de administrador.' : undefined}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                      >
                        <option value="student">student</option>
                        <option value="teacher">teacher</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text2)' }}>{u.joined}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)' }}>No se encontraron usuarios.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
