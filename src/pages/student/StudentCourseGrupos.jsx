import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Lock, Video, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { fetchCourseClassmates, fetchWorkGroups, createWorkGroup, updateWorkGroup, fetchPrivateRooms, createPrivateRoom } from '../../lib/db';
import LiveRoom from '../../components/LiveRoom';
import ModalPortal from '../../components/ModalPortal';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
};

const NewGroupModal = ({ course, currentUser, onClose, onCreated }) => {
  const { addToast } = useUI();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxMembers, setMaxMembers] = useState(5);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { addToast('Ponle un nombre a tu grupo.', 'error'); return; }
    setSaving(true);
    try {
      const group = await createWorkGroup({
        courseId: course.id, courseTitle: course.title, name: name.trim(), description: description.trim(), maxMembers: Number(maxMembers) || 5,
        leaderUid: currentUser.uid, leaderName: currentUser.displayName || currentUser.email,
        memberUids: [currentUser.uid], memberNames: [currentUser.displayName || currentUser.email],
      });
      onCreated(group);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="admin-modal-overlay" onClick={onClose}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head"><div><div className="admin-modal-title">Crear grupo</div><div className="admin-modal-sub">Arma tu equipo para el proyecto final.</div></div><button className="admin-modal-close" onClick={onClose}><X size={18} /></button></div>
          <div className="admin-field-row">
            <div className="admin-field" style={{ flex: 1 }}><label>Nombre del grupo</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Equipo Reels" /></div>
            <div className="admin-field"><label>Cupo</label><input type="number" min="2" max="10" value={maxMembers} onChange={(e) => setMaxMembers(e.target.value)} /></div>
          </div>
          <div className="admin-field"><label>Descripción</label><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Calendario de contenidos para el proyecto final" /></div>
          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="admin-btn-edit" onClick={handleCreate} disabled={saving}><Plus size={13} /> {saving ? 'Creando...' : 'Crear grupo'}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

const InviteModal = ({ group, classmates, onClose, onInvited }) => {
  const { addToast } = useUI();
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const already = new Set([...(group.memberUids || []), ...(group.pendingUids || [])]);
  const invitable = classmates.filter((c) => !already.has(c.uid));

  const toggle = (uid) => setSelected((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));

  const handleInvite = async () => {
    if (selected.length === 0) { onClose(); return; }
    setSaving(true);
    try {
      const invited = classmates.filter((c) => selected.includes(c.uid));
      await updateWorkGroup(group.id, group.courseId, {
        pendingUids: [...(group.pendingUids || []), ...invited.map((c) => c.uid)],
        pendingNames: [...(group.pendingNames || []), ...invited.map((c) => c.name)],
      });
      addToast('Invitaciones enviadas.', 'success');
      onInvited();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="admin-modal-overlay" onClick={onClose}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head"><div className="admin-modal-title">Invitar a {group.name}</div><button className="admin-modal-close" onClick={onClose}><X size={18} /></button></div>
          {invitable.length === 0 ? <p className="admin-panel-caption">No hay más compañeros disponibles para invitar.</p> : invitable.map((c) => (
            <label key={c.uid} className="room-member-row">
              <input type="checkbox" checked={selected.includes(c.uid)} onChange={() => toggle(c.uid)} />
              <div className="dash-post-avatar">{getInitials(c.name)}</div>
              <span>{c.name}</span>
            </label>
          ))}
          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="admin-btn-edit" onClick={handleInvite} disabled={saving}><UserPlus size={13} /> {saving ? 'Enviando...' : 'Enviar invitación'}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

const NewRoomModal = ({ course, currentUser, classmates, onClose, onCreated }) => {
  const { addToast } = useUI();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggle = (uid) => setSelected((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));

  const handleCreate = async () => {
    if (!name.trim()) { addToast('Ponle un nombre a tu sala.', 'error'); return; }
    setSaving(true);
    try {
      const members = classmates.filter((c) => selected.includes(c.uid));
      const room = await createPrivateRoom({
        courseId: course.id, courseTitle: course.title, name: name.trim(),
        createdByUid: currentUser.uid, createdByName: currentUser.displayName || currentUser.email,
        memberUids: [currentUser.uid, ...members.map((m) => m.uid)], memberNames: [currentUser.displayName || currentUser.email, ...members.map((m) => m.name)],
      });
      onCreated(room);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="admin-modal-overlay" onClick={onClose}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head"><div><div className="admin-modal-title">Crear sala privada</div><div className="admin-modal-sub">Prepara un espacio para conversar y trabajar con tu grupo.</div></div><button className="admin-modal-close" onClick={onClose}><X size={18} /></button></div>
          <div className="admin-field"><label>Nombre de la sala</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Equipo 02 · Proyecto de contenidos" /></div>
          <label style={{ fontSize: '.82rem', fontWeight: 600, color: '#4A4860' }}>Selecciona a tus compañeros</label>
          {classmates.length === 0 ? <p className="admin-panel-caption" style={{ marginTop: 4 }}>No hay más compañeros matriculados todavía.</p> : classmates.map((c) => (
            <label key={c.uid} className="room-member-row">
              <input type="checkbox" checked={selected.includes(c.uid)} onChange={() => toggle(c.uid)} />
              <div className="dash-post-avatar">{getInitials(c.name)}</div>
              <span>{c.name}</span>
            </label>
          ))}
          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="admin-btn-edit" onClick={handleCreate} disabled={saving}><Plus size={13} /> {saving ? 'Creando...' : 'Crear sala y continuar'}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

const StudentCourseGrupos = () => {
  const { course } = useOutletContext();
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const [classmates, setClassmates] = useState([]);
  const [groups, setGroups] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [invitingGroup, setInvitingGroup] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);

  const load = useCallback(() => {
    if (!currentUser) return;
    Promise.all([fetchCourseClassmates(course.id), fetchWorkGroups(course.id), fetchPrivateRooms(course.id)]).then(([enrollments, wg, rms]) => {
      setClassmates(enrollments.filter((e) => e.uid !== currentUser.uid).map((e) => ({ uid: e.uid, name: e.studentName || e.uid })));
      setGroups(wg);
      setRooms(rms.filter((r) => (r.memberUids || []).includes(currentUser.uid)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [course.id, currentUser]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="admin-empty-hint">Cargando grupos de trabajo...</div>;

  if (activeRoom) {
    return (
      <div className="anim-fade-up d1">
        <LiveRoom
          session={{ courseTitle: activeRoom.name, roomName: activeRoom.roomName }}
          currentUser={currentUser} roleLabel="Estudiante" lobbyHeadline={activeRoom.name}
          lobbyMeta="Reúnete con tu grupo sin salir de Netwise Academy." joinLabel="Entrar a la reunión"
          onExit={() => { setActiveRoom(null); load(); }}
        />
      </div>
    );
  }

  const invitations = groups.filter((g) => (g.pendingUids || []).includes(currentUser.uid));
  const misGrupos = groups.filter((g) => (g.memberUids || []).includes(currentUser.uid));
  const abiertos = groups.filter((g) => !(g.memberUids || []).includes(currentUser.uid) && !(g.pendingUids || []).includes(currentUser.uid) && (g.memberUids || []).length < (g.maxMembers || 5));

  const respond = async (group, accept) => {
    const pendingUids = (group.pendingUids || []).filter((u) => u !== currentUser.uid);
    const pendingNames = (group.pendingNames || []).filter((_, i) => (group.pendingUids || [])[i] !== currentUser.uid);
    const patch = accept
      ? { pendingUids, pendingNames, memberUids: [...(group.memberUids || []), currentUser.uid], memberNames: [...(group.memberNames || []), currentUser.displayName || currentUser.email] }
      : { pendingUids, pendingNames };
    await updateWorkGroup(group.id, course.id, patch);
    addToast(accept ? `Te uniste a ${group.name}.` : 'Invitación rechazada.', 'success');
    load();
  };

  const joinOpenGroup = async (group) => {
    await updateWorkGroup(group.id, course.id, {
      memberUids: [...(group.memberUids || []), currentUser.uid],
      memberNames: [...(group.memberNames || []), currentUser.displayName || currentUser.email],
    });
    addToast(`Te uniste a ${group.name}.`, 'success');
    load();
  };

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Grupos de trabajo</h1><p className="admin-page-sub">{course.title} · forma tu equipo y reúnanse en una sala privada.</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="admin-btn-ghost" onClick={() => setRoomModalOpen(true)}><Lock size={14} /> Crear sala privada</button>
          <button className="admin-btn-edit" onClick={() => setGroupModalOpen(true)}><Plus size={14} /> Crear grupo</button>
        </div>
      </div>

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="admin-panel-head"><span className="admin-panel-title">Invitaciones</span></div>
        {invitations.length === 0 ? <p className="admin-panel-caption" style={{ marginTop: 0 }}>Compañeros que te inviten a su grupo aparecerán aquí.</p> : invitations.map((g) => (
          <div key={g.id} className="dash-list-row">
            <div><div className="dash-list-row-title">{g.name}</div><div className="dash-list-row-sub">{g.leaderName} te invitó · {(g.memberUids || []).length}/{g.maxMembers} integrantes · {g.description}</div></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="admin-btn-ghost" onClick={() => respond(g, false)}>Rechazar</button>
              <button className="admin-btn-edit" onClick={() => respond(g, true)}>Aceptar</button>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="admin-panel-head"><span className="admin-panel-title">Mis grupos</span></div>
        {misGrupos.length === 0 ? <p className="admin-panel-caption" style={{ marginTop: 0 }}>Aún no formas parte de ningún grupo en este curso.</p> : misGrupos.map((g) => (
          <div key={g.id} className="dash-list-row">
            <div><div className="dash-list-row-title">{g.name}</div><div className="dash-list-row-sub">{g.description} · {(g.memberUids || []).length}/{g.maxMembers} integrantes</div></div>
            {g.leaderUid === currentUser.uid && <button className="admin-btn-ghost" onClick={() => setInvitingGroup(g)}><UserPlus size={13} /> Invitar</button>}
          </div>
        ))}
      </div>

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="admin-panel-head"><span className="admin-panel-title">Grupos abiertos de tu aula</span></div>
        {abiertos.length === 0 ? <p className="admin-panel-caption" style={{ marginTop: 0 }}>No hay grupos abiertos por ahora.</p> : (
          <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {abiertos.map((g) => (
              <div key={g.id} className="admin-stat-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div className="dash-list-row-title">{g.name}</div>
                  <span className="admin-status admin-status-green">Abierto</span>
                </div>
                <p className="admin-cell-sub" style={{ marginBottom: 12 }}>{g.description}</p>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                  {(g.memberNames || []).slice(0, 4).map((n, i) => <div key={i} className="dash-post-avatar" style={{ width: 26, height: 26, fontSize: '.65rem', marginRight: -6, border: '2px solid #fff' }}>{getInitials(n)}</div>)}
                  <span className="admin-cell-sub" style={{ marginLeft: 10 }}>{(g.memberUids || []).length}/{g.maxMembers} integrantes</span>
                </div>
                <button className="admin-btn-edit" style={{ width: '100%', justifyContent: 'center' }} onClick={() => joinOpenGroup(g)}>Unirme</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head"><span className="admin-panel-title">Próximas reuniones privadas</span></div>
        {rooms.length === 0 ? <p className="admin-panel-caption" style={{ marginTop: 0 }}>No tienes reuniones privadas programadas.</p> : rooms.map((r) => (
          <div key={r.id} className="dash-list-row">
            <div><div className="dash-list-row-title">{r.name}</div><div className="dash-list-row-sub">{(r.memberNames || []).length} integrantes</div></div>
            <button className="admin-btn-edit" onClick={() => setActiveRoom(r)}><Video size={13} /> Entrar</button>
          </div>
        ))}
      </div>

      {groupModalOpen && <NewGroupModal course={course} currentUser={currentUser} onClose={() => setGroupModalOpen(false)} onCreated={(g) => setGroups((prev) => [...prev, g])} />}
      {roomModalOpen && <NewRoomModal course={course} currentUser={currentUser} classmates={classmates} onClose={() => setRoomModalOpen(false)} onCreated={(r) => { setRoomModalOpen(false); setActiveRoom(r); }} />}
      {invitingGroup && <InviteModal group={invitingGroup} classmates={classmates} onClose={() => setInvitingGroup(null)} onInvited={load} />}
    </div>
  );
};

export default StudentCourseGrupos;
