import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { fetchAllEnrollments, fetchWorkGroups, createWorkGroup } from '../../lib/db';
import { aulaRoster } from '../../lib/roster';
import WorkRoomCard from '../../components/WorkRoomCard';
import ModalPortal from '../../components/ModalPortal';
import { usePagedTable } from '../../hooks/usePagedTable';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
};

const NewGroupModal = ({ course, roster, onClose, onCreated }) => {
  const { addToast } = useUI();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxMembers, setMaxMembers] = useState(5);
  const [leaderUid, setLeaderUid] = useState('');
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggleMember = (uid) => setSelected((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));

  const handleCreate = async () => {
    if (!name.trim()) { addToast('Ponle un nombre al grupo.', 'error'); return; }
    setSaving(true);
    try {
      const members = roster.filter((r) => selected.includes(r.uid));
      const leader = roster.find((r) => r.uid === leaderUid);
      const group = await createWorkGroup({
        courseId: course.id, courseTitle: course.title, name: name.trim(), description: description.trim(),
        maxMembers: Number(maxMembers) || 5,
        leaderUid: leader?.uid || null, leaderName: leader?.studentName || null,
        memberUids: members.map((m) => m.uid), memberNames: members.map((m) => m.studentName),
      });
      onCreated(group);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="admin-modal-overlay">
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head">
            <div><div className="admin-modal-title">Crear grupo</div><div className="admin-modal-sub">Arma un equipo de proyecto para este curso.</div></div>
            <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="admin-field-row">
            <div className="admin-field" style={{ flex: 1 }}><label>Nombre del grupo</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Equipo Reels" /></div>
            <div className="admin-field"><label>Cupo</label><input type="number" min="2" max="10" value={maxMembers} onChange={(e) => setMaxMembers(e.target.value)} /></div>
          </div>
          <div className="admin-field"><label>Descripción</label><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Calendario de contenidos para el proyecto final" /></div>
          <div className="admin-field">
            <label>Coordina</label>
            <select value={leaderUid} onChange={(e) => setLeaderUid(e.target.value)}>
              <option value="">Sin asignar</option>
              {roster.map((r) => <option key={r.uid} value={r.uid}>{r.studentName}</option>)}
            </select>
          </div>
          <label style={{ fontSize: '.82rem', fontWeight: 600, color: '#4A4860' }}>Integrantes</label>
          {roster.map((r) => (
            <label key={r.uid} className="room-member-row">
              <input type="checkbox" checked={selected.includes(r.uid)} onChange={() => toggleMember(r.uid)} />
              <div className="dash-post-avatar">{getInitials(r.studentName)}</div>
              <span>{r.studentName}</span>
            </label>
          ))}
          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="admin-btn-edit" onClick={handleCreate} disabled={saving}><Plus size={13} /> {saving ? 'Creando...' : 'Crear grupo'}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

const ViewGroupModal = ({ group, onClose }) => (
  <ModalPortal>
    <div className="admin-modal-overlay">
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-head">
          <div><div className="admin-modal-title">{group.name}</div><div className="admin-modal-sub">{group.description || 'Sin descripción.'}</div></div>
          <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="admin-cell-sub" style={{ marginBottom: 10 }}>Coordina: {group.leaderName || 'Sin asignar'}</p>
        {(group.memberNames || []).length === 0 ? <p className="admin-panel-caption">Todavía no tiene integrantes.</p> : (group.memberNames || []).map((n, i) => (
          <div key={i} className="room-member-row" style={{ cursor: 'default' }}>
            <div className="dash-post-avatar">{getInitials(n)}</div>
            <span>{n}</span>
          </div>
        ))}
        <div className="admin-modal-actions"><button className="admin-btn-ghost" onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  </ModalPortal>
);

const TeacherCourseGrupos = () => {
  const { course, group: aula, groups: aulas, aulaId } = useOutletContext();
  const [roster, setRoster] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingGroup, setViewingGroup] = useState(null);

  const load = useCallback(() => {
    Promise.all([fetchAllEnrollments(course.id), fetchWorkGroups(course.id)]).then(([enrollments, wg]) => {
      // Con varias aulas, se ve el aula elegida: sus alumnos y los equipos donde participan.
      const members = aulaRoster(enrollments, course.id, aulas, aulaId);
      const uids = new Set(members.map((m) => m.uid));
      setRoster(members.map((m) => ({ uid: m.uid, studentName: m.studentName })));
      setGroups(aulaId == null ? wg : wg.filter((g) => {
        const people = [g.leaderUid, ...(g.memberUids || []), ...(g.pendingUids || [])].filter(Boolean);
        return people.length === 0 || people.some((u) => uids.has(u));
      }));
      setLoading(false);
    }).catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id, aulaId, aulas?.length]);

  useEffect(() => { load(); }, [load]);

  const { rows: pageRows, pager, tableRef } = usePagedTable(groups, { label: 'grupos' });

  if (loading) return <div className="admin-empty-hint">Cargando grupos de trabajo...</div>;

  const memberUidSet = new Set(groups.flatMap((g) => g.memberUids || []));
  const sinGrupo = roster.filter((r) => !memberUidSet.has(r.uid));

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Grupos de trabajo</h1><p className="admin-page-sub">{course.title} · cómo se organizan tus alumnos y quién falta por agruparse.</p></div>
        <button className="admin-btn-edit" onClick={() => setModalOpen(true)}><Plus size={14} /> Crear grupo</button>
      </div>

      <WorkRoomCard group={aula} sub="Abierta siempre: úsala para asesorías y para que los grupos trabajen fuera de clase." />

      <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="admin-stat-card"><div className="admin-stat-label">Grupos formados</div><div className="admin-stat-value">{groups.length}</div></div>
        <div className="admin-stat-card"><div className="admin-stat-label">Alumnos en un grupo</div><div className="admin-stat-value">{memberUidSet.size}</div><div className="admin-cell-sub">de {roster.length} alumnos</div></div>
        <div className="admin-stat-card"><div className="admin-stat-label">Sin grupo</div><div className="admin-stat-value">{sinGrupo.length}</div></div>
      </div>

      <div className="admin-table-wrap" style={{ marginBottom: 20 }}>
        {groups.length === 0 ? (
          <div className="admin-empty-hint">Todavía no hay grupos en este curso. Los alumnos pueden armar los suyos desde su panel, o crea uno tú.</div>
        ) : (
          <><table ref={tableRef} className="admin-table table-cards">
            <thead><tr><th>Grupo</th><th>Integrantes</th><th>Coordina</th><th></th></tr></thead>
            <tbody>
              {pageRows.map((g) => {
                return (
                  <tr key={g.id}>
                    <td><div className="dash-list-row-title">{g.name}</div><div className="admin-cell-sub">{g.description}</div></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {(g.memberNames || []).slice(0, 4).map((n, i) => <div key={i} className="dash-post-avatar" style={{ width: 26, height: 26, fontSize: '.65rem', marginRight: -6, border: '2px solid #fff' }}>{getInitials(n)}</div>)}
                        <span className="admin-cell-sub" style={{ marginLeft: 10 }}>{(g.memberUids || []).length}/{g.maxMembers}</span>
                      </div>
                    </td>
                    <td>{g.leaderName || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="admin-btn-ghost" onClick={() => setViewingGroup(g)}>Ver grupo</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>{pager}</>
        )}
      </div>
      <p className="admin-panel-caption" style={{ marginTop: -12, marginBottom: 20 }}>Los alumnos forman sus grupos desde su panel · también puedes crearlos tú.</p>

      <div>
        <div className="admin-panel">
          <div className="admin-panel-head"><span className="admin-panel-title">Alumnos sin grupo · {sinGrupo.length}</span></div>
          {sinGrupo.length === 0 ? <p className="admin-panel-caption" style={{ marginTop: 0 }}>Todos los alumnos tienen equipo.</p> : sinGrupo.map((r) => (
            <div key={r.uid} className="dash-list-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div className="dash-post-avatar">{getInitials(r.studentName)}</div><div className="dash-list-row-title">{r.studentName}</div></div>
            </div>
          ))}
        </div>
      </div>

      {modalOpen && <NewGroupModal course={course} roster={roster} onClose={() => setModalOpen(false)} onCreated={(g) => setGroups((prev) => [...prev, g])} />}
      {viewingGroup && <ViewGroupModal group={viewingGroup} onClose={() => setViewingGroup(null)} />}
    </div>
  );
};

export default TeacherCourseGrupos;
