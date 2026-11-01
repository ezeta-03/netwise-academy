import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Sparkles, X, Video } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { fetchCourseClassmates, fetchWorkGroups, createWorkGroup, updateWorkGroup } from '../../lib/db';
import { groupsOfAula, groupOf, invitationsFor, withoutUid, addTo } from '../../lib/workGroups';
import ModalPortal from '../../components/ModalPortal';
import { CopyLink, HowItWorks } from '../../components/WorkGroupParts';

const initials = (name) => (name || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const ago = (iso) => {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `hace ${Math.max(1, mins)} min`;
  if (mins < 1440) return `hace ${Math.round(mins / 60)} h`;
  return `hace ${Math.round(mins / 1440)} días`;
};

// Elegir compañeros del aula con un buscador por nombre (crear e invitar).
const PeoplePicker = ({ people, selected, onToggle }) => {
  const [q, setQ] = useState('');
  const shown = people.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <input className="admin-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por nombre" />
      <div className="people-picker">
        {people.length === 0 ? <p className="admin-cell-sub" style={{ padding: 10, margin: 0 }}>No hay compañeros disponibles: todos ya tienen grupo o una invitación tuya.</p>
          : shown.map((p) => (
            <label key={p.uid} className={`people-row ${selected.includes(p.uid) ? 'is-on' : ''}`}>
              <input type="checkbox" checked={selected.includes(p.uid)} onChange={() => onToggle(p.uid)} />
              <span>{p.name}</span>
            </label>
          ))}
      </div>
    </>
  );
};

const CreateGroupModal = ({ invitable, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const toggle = (uid) => setSelected((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  const save = async () => {
    setSaving(true);
    try { await onCreate(name.trim(), invitable.filter((p) => selected.includes(p.uid))); onClose(); } finally { setSaving(false); }
  };
  return (
    <ModalPortal>
      <div className="admin-modal-overlay" onClick={onClose}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head"><div className="admin-modal-title">Crea tu grupo</div><button className="admin-modal-close" onClick={onClose}><X size={18} /></button></div>
          <div className="dark-card" style={{ display: 'flex', gap: 12, padding: '14px 16px', marginBottom: 14 }}>
            <Sparkles size={20} style={{ flexShrink: 0, color: '#B794FF' }} />
            <div><h3 style={{ margin: '0 0 4px', fontSize: '.88rem' }}>Tu grupo tendrá su propia sala de Meet</h3><p>Invita a compañeros de tu aula. Cada uno recibe la invitación y decide si se une.</p></div>
          </div>
          <div className="admin-field"><label>Nombre del grupo</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Marca Lab" /></div>
          <div className="admin-field"><label>Invita a tus compañeros</label><PeoplePicker people={invitable} selected={selected} onToggle={toggle} /></div>
          <p className="admin-cell-sub" style={{ marginTop: 0 }}>{selected.length} seleccionado{selected.length === 1 ? '' : 's'} · Puedes invitar a más después.</p>
          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="admin-btn-edit" onClick={save} disabled={saving || !name.trim()}><Plus size={13} /> {saving ? 'Creando...' : 'Crear grupo e invitar'}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

const InviteModal = ({ invitable, onClose, onInvite }) => {
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const toggle = (uid) => setSelected((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  return (
    <ModalPortal>
      <div className="admin-modal-overlay" onClick={onClose}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head"><div className="admin-modal-title">Invitar compañeros</div><button className="admin-modal-close" onClick={onClose}><X size={18} /></button></div>
          <PeoplePicker people={invitable} selected={selected} onToggle={toggle} />
          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="admin-btn-edit" disabled={saving || !selected.length} onClick={async () => { setSaving(true); try { await onInvite(invitable.filter((p) => selected.includes(p.uid))); onClose(); } finally { setSaving(false); } }}>
              {saving ? 'Enviando...' : `Invitar${selected.length ? ` (${selected.length})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

// Grupos de trabajo del alumno (E12): crea su grupo con compañeros de su aula
// o acepta una invitación; ve a los integrantes, los pendientes y la sala de
// Meet propia del grupo (se crea sola y no cambia). El proyecto sigue siendo individual.
const StudentCourseGrupos = () => {
  const { course, group: aula } = useOutletContext();
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const [classmates, setClassmates] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'create' | 'invite'
  const aulaId = aula?.id || null;

  const load = useCallback(() => {
    if (!currentUser) return Promise.resolve();
    return Promise.all([fetchCourseClassmates(course.id), fetchWorkGroups(course.id)]).then(([enrollments, wg]) => {
      // Solo compañeros de SU aula.
      setClassmates(enrollments
        .filter((e) => e.uid !== currentUser.uid && (e.status || 'active') === 'active' && (!aulaId || e.groupId === aulaId))
        .map((e) => ({ uid: e.uid, name: e.studentName || e.uid, email: e.studentEmail || '' })));
      setGroups(groupsOfAula(wg, aulaId));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [course.id, currentUser, aulaId]);
   
  useEffect(() => { load(); }, [load]);

  // La sala se crea en el servidor un momento después de crear el grupo: se vuelve a leer hasta que llegue.
  const mine = groupOf(groups, currentUser?.uid);
  useEffect(() => {
    if (!mine || mine.meetLink || mine.meetError) return undefined;
    const t = setTimeout(() => load(), 3000);
    return () => clearTimeout(t);
  }, [mine, load]);

  if (loading) return <div className="admin-empty-hint">Cargando grupos de trabajo...</div>;

  const me = { uid: currentUser.uid, name: currentUser.displayName || currentUser.email, email: currentUser.email };
  const invitations = invitationsFor(groups, currentUser.uid);
  const busy = new Set(groups.flatMap((g) => [...(g.memberUids || [])]));
  const invitable = classmates.filter((c) => !busy.has(c.uid) && !(mine?.pendingUids || []).includes(c.uid));
  const emailOf = (uid) => (uid === me.uid ? me.email : classmates.find((c) => c.uid === uid)?.email || '');

  const createGroup = async (name, invited) => {
    await createWorkGroup({
      courseId: course.id, courseTitle: course.title, groupId: aulaId, name,
      leaderUid: me.uid, leaderName: me.name, memberUids: [me.uid], memberNames: [me.name],
      pendingUids: invited.map((p) => p.uid), pendingNames: invited.map((p) => p.name),
    });
    addToast(invited.length ? `Grupo creado. Invitamos a ${invited.length} compañero${invited.length === 1 ? '' : 's'}.` : 'Grupo creado.', 'success');
    load();
  };

  const invite = async (people) => {
    await updateWorkGroup(mine.id, course.id, addTo(mine, 'pending', people));
    addToast('Invitaciones enviadas.', 'success');
    load();
  };

  const respond = async (g, accept) => {
    try {
      const base = withoutUid(g, me.uid);
      await updateWorkGroup(g.id, course.id, accept ? { ...base, ...addTo(base, 'member', [me]) } : base);
      // Al unirse, las demás invitaciones quedan rechazadas.
      if (accept) await Promise.all(invitations.filter((x) => x.id !== g.id).map((x) => updateWorkGroup(x.id, course.id, withoutUid(x, me.uid))));
      addToast(accept ? `Te uniste a ${g.name}.` : 'Invitación rechazada.', 'success');
      load();
    } catch {
      addToast('No se pudo responder la invitación. Intenta de nuevo.', 'error');
    }
  };

  const pendingCount = (mine?.pendingUids || []).length;
  const memberCount = (mine?.memberUids || []).length;

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Grupos de trabajo</h1><p className="admin-page-sub">{course.title}</p></div>
      </div>

      <div className="dark-card group-hero">
        <div>
          <div className="grade-hero-eyebrow">Tu grupo</div>
          <div className="group-hero-name">{mine ? mine.name : 'Sin grupo'}</div>
          {mine?.leaderUid === me.uid && <span className="grade-hero-chip">Creado por ti</span>}
          <p style={{ marginTop: 8 }}>{mine ? `${memberCount} integrante${memberCount === 1 ? '' : 's'}${pendingCount ? ` · ${pendingCount} invitación${pendingCount === 1 ? '' : 'es'} pendiente${pendingCount === 1 ? '' : 's'}` : ''}` : 'Crea uno o acepta una invitación.'}</p>
        </div>
        <div>
          {mine ? (
            <>
              <h3>Sala del grupo</h3>
              <p>Un link de Meet solo para tu grupo. Úsenlo cuando quieran, fuera del horario de clase.</p>
              {mine.meetLink
                ? <a className="class-meet-btn" style={{ marginTop: 12 }} href={mine.meetLink} target="_blank" rel="noreferrer"><Video size={14} /> Entrar a la sala del grupo</a>
                : <button className="class-meet-btn is-disabled" style={{ marginTop: 12 }} disabled>{mine.meetError ? 'No se pudo crear la sala' : 'Creando la sala…'}</button>}
              <div style={{ marginTop: 8 }}><CopyLink link={mine.meetLink} dark /></div>
              {mine.meetError && <p style={{ marginTop: 6 }}>Avísale a la academia por Soporte para crearla de nuevo.</p>}
            </>
          ) : (
            <>
              <h3>Crea tu grupo</h3>
              <p>Ponle un nombre e invita a compañeros de tu aula. Tu grupo tendrá su propia sala de Meet.</p>
              <button className="admin-btn-edit" style={{ marginTop: 12 }} onClick={() => setModal('create')}><Plus size={14} /> Crear grupo</button>
            </>
          )}
        </div>
      </div>

      {mine ? (
        <div className="admin-panel" style={{ margin: '20px 0' }}>
          <div className="admin-panel-head" style={{ marginBottom: 2 }}><span className="admin-panel-title">Integrantes</span></div>
          <p className="admin-panel-caption" style={{ marginTop: 0 }}>Los compañeros de tu aula que aceptaron tu invitación.</p>
          {(mine.memberUids || []).map((uid, i) => (
            <div key={uid} className="dash-list-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="dash-post-avatar">{initials(mine.memberNames?.[i])}</div>
                <div><div className="dash-list-row-title">{mine.memberNames?.[i]}</div><div className="dash-list-row-sub">{emailOf(uid)}</div></div>
              </div>
              {(uid === me.uid || uid === mine.leaderUid) && <span className="admin-status admin-status-violet">{[uid === me.uid && 'Tú', uid === mine.leaderUid && 'creador'].filter(Boolean).join(' · ')}</span>}
            </div>
          ))}
          {(mine.pendingUids || []).map((uid, i) => (
            <div key={uid} className="dash-list-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="dash-post-avatar" style={{ background: '#EFEEF5', color: '#6B6980' }}>{initials(mine.pendingNames?.[i])}</div>
                <div><div className="dash-list-row-title">{mine.pendingNames?.[i]}</div><div className="dash-list-row-sub">Invitación enviada {ago(mine.invitedAt?.[uid])}</div></div>
              </div>
              <span className="admin-status admin-status-amber">Pendiente</span>
            </div>
          ))}
          <button className="admin-btn-ghost" style={{ marginTop: 12, color: 'var(--accent)' }} onClick={() => setModal('invite')}><Plus size={13} /> Invitar compañeros</button>
        </div>
      ) : invitations.length > 0 && (
        <div className="admin-panel" style={{ margin: '20px 0' }}>
          <div className="admin-panel-head" style={{ marginBottom: 2 }}><span className="admin-panel-title">Invitaciones para ti</span></div>
          <p className="admin-panel-caption" style={{ marginTop: 0 }}>Compañeros de tu aula que te invitaron a su grupo.</p>
          {invitations.map((g) => (
            <div key={g.id} className="dash-list-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="dash-post-avatar">{initials(g.name)}</div>
                <div><div className="dash-list-row-title">{g.name}</div><div className="dash-list-row-sub">{g.leaderName} te invitó · {ago(g.invitedAt?.[me.uid] || g.createdAt)} · {(g.memberUids || []).length} integrante{(g.memberUids || []).length === 1 ? '' : 's'}</div></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="admin-btn-ghost" onClick={() => respond(g, false)}>Rechazar</button>
                <button className="admin-btn-edit" onClick={() => respond(g, true)}>Unirme</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <HowItWorks>Cualquier alumno del aula puede crear un grupo e invitar a sus compañeros. Si aceptas una invitación, entras a ese grupo y a su sala. Tu docente ve todos los grupos y sus salas. Tu proyecto sigue siendo individual.</HowItWorks>
      </div>

      {modal === 'create' && <CreateGroupModal invitable={invitable} onClose={() => setModal(null)} onCreate={createGroup} />}
      {modal === 'invite' && mine && <InviteModal invitable={invitable} onClose={() => setModal(null)} onInvite={invite} />}
    </div>
  );
};

export default StudentCourseGrupos;
