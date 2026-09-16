import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Plus, Users, Video, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { fetchCourseClassmates, fetchLiveSessions, fetchPrivateRooms, createPrivateRoom } from '../../lib/db';
import { getLiveSessionStatus } from '../../lib/liveSessionStatus';
import LiveRoom from '../../components/LiveRoom';
import ModalPortal from '../../components/ModalPortal';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
};

const scheduleLineFor = (s) => {
  const start = new Date(s.startsAt);
  const end = new Date(start.getTime() + s.durationMin * 60000);
  const day = start.toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'short' });
  const fmt = (d) => d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${fmt(start)} – ${fmt(end)}`;
};

const NewRoomModal = ({ course, group, currentUser, classmates, onClose, onCreated }) => {
  const { addToast } = useUI();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggleMember = (uid) => setSelected((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));

  const handleCreate = async () => {
    if (!name.trim()) { addToast('Ponle un nombre a tu sala.', 'error'); return; }
    setSaving(true);
    try {
      const members = classmates.filter((c) => selected.includes(c.uid));
      const room = await createPrivateRoom({
        courseId: course.id, courseTitle: course.title, groupName: group?.name,
        name: name.trim(), createdByUid: currentUser.uid, createdByName: currentUser.displayName || currentUser.email,
        memberUids: [currentUser.uid, ...members.map((m) => m.uid)],
        memberNames: [currentUser.displayName || currentUser.email, ...members.map((m) => m.name)],
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
        <div className="admin-modal-head">
          <div>
            <div className="admin-modal-title">Crear sala privada</div>
            <div className="admin-modal-sub">Prepara un espacio para conversar y trabajar con tu grupo.</div>
          </div>
          <button className="admin-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="admin-field"><label>Nombre de la sala</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Equipo 02 · Proyecto de contenidos" /></div>
        <div className="dash-course-context" style={{ marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-bg)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Video size={16} /></div>
          <div>
            <div className="dash-course-context-title" style={{ color: '#14141F' }}>{course.title}</div>
            <div className="dash-course-context-sub" style={{ color: '#8B8A9B' }}>{group?.name ? `Grupo ${group.name}` : 'Sin grupo'}</div>
          </div>
        </div>
        <label style={{ fontSize: '.82rem', fontWeight: 600, color: '#4A4860' }}>Selecciona a tus compañeros</label>
        {classmates.length === 0 ? (
          <p className="admin-panel-caption" style={{ marginTop: 4 }}>No hay más compañeros matriculados todavía.</p>
        ) : classmates.map((c) => (
          <label key={c.uid} className="room-member-row">
            <input type="checkbox" checked={selected.includes(c.uid)} onChange={() => toggleMember(c.uid)} />
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

const RoomCard = ({ room, onEnter }) => {
  const { addToast } = useUI();
  const copyLink = () => {
    const url = `${window.location.origin}/student/curso/${room.courseId}/sala?room=${room.id}`;
    navigator.clipboard?.writeText(url);
    addToast('Enlace copiado.', 'success');
  };

  return (
    <div className="room-card">
      <div className="room-card-head">
        <div className="room-card-icon"><Users size={16} /></div>
        <span className="admin-status admin-status-gray">Sala privada</span>
      </div>
      <div className="room-card-title">{room.name}</div>
      <div className="room-card-members">
        {(room.memberNames || []).slice(0, 3).map((n, i) => <div key={i} className="dash-post-avatar" style={{ width: 28, height: 28, fontSize: '.68rem' }}>{getInitials(n)}</div>)}
        <span className="room-card-members-count">{(room.memberNames || []).length} integrante{(room.memberNames || []).length === 1 ? '' : 's'}</span>
      </div>
      <div className="room-card-actions">
        <button className="admin-btn-ghost" onClick={copyLink}>Copiar enlace</button>
        <button className="admin-btn-edit" onClick={() => onEnter(room)}><Video size={13} /> Entrar</button>
      </div>
    </div>
  );
};

const StudentCourseSala = () => {
  const { course, group } = useOutletContext();
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sessions, setSessions] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [classmates, setClassmates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeRoom, setActiveRoom] = useState(null);

  const load = useCallback(() => {
    Promise.all([fetchLiveSessions(), fetchPrivateRooms(course.id), fetchCourseClassmates(course.id)]).then(([allSessions, allRooms, enrollments]) => {
      setSessions(allSessions.filter((s) => s.courseId?.toString() === course.id.toString()));
      setRooms(allRooms);
      setClassmates(
        enrollments
          .filter((e) => e.uid !== currentUser?.uid)
          .map((e) => ({ uid: e.uid, name: e.studentName || e.uid }))
      );
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [course.id, currentUser?.uid]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const roomId = searchParams.get('room');
    if (roomId && rooms.length) {
      const room = rooms.find((r) => r.id === roomId);
      if (room) setActiveRoom({ type: 'private', room });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms]);

  if (loading) return <div className="admin-empty-hint">Cargando sala de reuniones...</div>;

  const mainSession = sessions
    .filter((s) => getLiveSessionStatus(s) === 'live' || getLiveSessionStatus(s) === 'upcoming')
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];

  const exitRoom = () => {
    setActiveRoom(null);
    if (searchParams.get('room')) setSearchParams({});
    load();
  };

  if (activeRoom?.type === 'private') {
    return (
      <div className="anim-fade-up d1">
        <LiveRoom
          session={{ courseTitle: activeRoom.room.name, roomName: activeRoom.room.roomName }}
          currentUser={currentUser}
          roleLabel="Estudiante"
          lobbyHeadline={activeRoom.room.name}
          lobbyMeta="Reúnete con tu grupo sin salir de Netwise Academy."
          joinLabel="Entrar a la reunión"
          onExit={exitRoom}
        />
      </div>
    );
  }

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Sala de reuniones</h1><p className="admin-page-sub">{course.title}</p></div>
      </div>

      {mainSession ? (
        <div style={{ marginBottom: 32 }}>
          <LiveRoom
            session={mainSession}
            currentUser={currentUser}
            roleLabel="Estudiante"
            lobbyHeadline="Tu sala está lista. Esperamos al docente."
            lobbyMeta={mainSession.courseTitle}
            scheduleLine={scheduleLineFor(mainSession)}
            joinLabel="Entrar a la reunión"
            secondaryAction={{ label: 'Crear sala privada', onClick: () => setModalOpen(true) }}
            onExit={exitRoom}
          />
        </div>
      ) : (
        <div className="admin-panel" style={{ textAlign: 'center', color: '#8B8A9B', marginBottom: 32 }}>
          <p style={{ marginBottom: 14 }}>Tu docente todavía no programa una clase en vivo.</p>
          <button className="admin-btn-edit" style={{ margin: '0 auto' }} onClick={() => setModalOpen(true)}><Plus size={14} /> Crear sala privada</button>
        </div>
      )}

      <div className="admin-page-head">
        <div><h2 className="admin-page-title" style={{ fontSize: '1.1rem', marginBottom: 4 }}>Tus salas</h2><p className="admin-page-sub" style={{ marginBottom: 0 }}>Continúa una reunión o prepara un nuevo encuentro.</p></div>
      </div>
      {rooms.length === 0 ? (
        <p className="admin-panel-caption">Todavía no creas salas privadas para este curso.</p>
      ) : (
        <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {rooms.map((room) => <RoomCard key={room.id} room={room} onEnter={(r) => setActiveRoom({ type: 'private', room: r })} />)}
        </div>
      )}

      {modalOpen && (
        <NewRoomModal course={course} group={group} currentUser={currentUser} classmates={classmates} onClose={() => setModalOpen(false)} onCreated={(room) => { setModalOpen(false); setActiveRoom({ type: 'private', room }); }} />
      )}
    </div>
  );
};

export default StudentCourseSala;
