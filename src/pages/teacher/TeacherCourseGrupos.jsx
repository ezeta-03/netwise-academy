import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { X, Plus } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { fetchAllEnrollments, fetchWorkGroups, updateWorkGroup, deleteWorkGroup } from '../../lib/db';
import { aulaRoster } from '../../lib/roster';
import { groupsOfAula, groupOf, invitationsFor, withoutUid, addTo } from '../../lib/workGroups';
import ModalPortal from '../../components/ModalPortal';
import { CopyLink, HowItWorks } from '../../components/WorkGroupParts';

const initials = (name) => (name || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

// Editar grupo (D7): nombre, integrantes (Quitar), invitados (Cancelar
// invitación), sumar a un alumno sin grupo y eliminar. La sala se ve pero no se cambia.
const EditGroupModal = ({ group, withoutGroup, onClose, onSave, onDelete }) => {
  const [name, setName] = useState(group.name);
  const [draft, setDraft] = useState(group);
  const [adding, setAdding] = useState('');
  const [saving, setSaving] = useState(false);
  const remove = (uid) => setDraft((g) => ({ ...g, ...withoutUid(g, uid) }));
  const available = withoutGroup.filter((s) => !(draft.memberUids || []).includes(s.uid));
  const add = () => {
    const s = available.find((x) => x.uid === adding);
    if (!s) return;
    setDraft((g) => { const base = { ...g, ...withoutUid(g, s.uid) }; return { ...base, ...addTo(base, 'member', [{ uid: s.uid, name: s.studentName }]) }; });
    setAdding('');
  };
  const save = async () => {
    setSaving(true);
    try {
      await onSave({ name: name.trim() || group.name, memberUids: draft.memberUids, memberNames: draft.memberNames, pendingUids: draft.pendingUids, pendingNames: draft.pendingNames, invitedAt: draft.invitedAt || {} });
      onClose();
    } finally { setSaving(false); }
  };
  const members = (draft.memberUids || []).length;
  const pending = (draft.pendingUids || []).length;
  return (
    <ModalPortal>
      <div className="admin-modal-overlay" onClick={onClose}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head"><div className="admin-modal-title">Editar grupo</div><button className="admin-modal-close" onClick={onClose}><X size={18} /></button></div>
          <div className="admin-field"><label>Nombre del grupo</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="admin-field">
            <label>Sala del grupo</label>
            <div className="readonly-box"><CopyLink link={group.meetLink} /></div>
            <span className="admin-cell-sub">La sala se creó con el grupo. Es una sola y no se puede cambiar.</span>
          </div>
          <div className="submit-work-label">Integrantes ({members}{pending ? ` + ${pending} pendiente${pending === 1 ? '' : 's'}` : ''})</div>
          <div className="people-picker" style={{ maxHeight: 'none' }}>
            {(draft.memberUids || []).map((uid, i) => (
              <div key={uid} className="people-row">
                <strong>{draft.memberNames?.[i]}</strong>{uid === group.leaderUid && <span className="admin-status admin-status-violet" style={{ fontSize: '.64rem' }}>Creador</span>}
                <button type="button" className="admin-panel-link danger-link" onClick={() => remove(uid)}>Quitar</button>
              </div>
            ))}
            {(draft.pendingUids || []).map((uid, i) => (
              <div key={uid} className="people-row">
                <strong>{draft.pendingNames?.[i]}</strong><span className="admin-status admin-status-amber" style={{ fontSize: '.64rem' }}>Pendiente</span>
                <button type="button" className="admin-panel-link danger-link" onClick={() => remove(uid)}>Cancelar invitación</button>
              </div>
            ))}
          </div>
          {available.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <select className="admin-select" style={{ flex: 1 }} value={adding} onChange={(e) => setAdding(e.target.value)}>
                <option value="">+ Agregar alumno sin grupo</option>
                {available.map((s) => <option key={s.uid} value={s.uid}>{s.studentName}</option>)}
              </select>
              <button className="admin-btn-ghost" disabled={!adding} onClick={add}><Plus size={13} /> Agregar</button>
            </div>
          )}
          <div className="admin-modal-actions">
            <button className="admin-panel-link danger-link" style={{ marginRight: 'auto' }} onClick={onDelete}>Eliminar grupo</button>
            <button className="admin-btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="admin-btn-edit" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

// Agregar a un grupo (D7): el alumno entra al instante, sin aceptar invitación.
const AddToGroupModal = ({ student, aulaName, groups, onClose, onAdd }) => {
  const [chosen, setChosen] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <ModalPortal>
      <div className="admin-modal-overlay" onClick={onClose}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head"><div className="admin-modal-title">Agregar a un grupo</div><button className="admin-modal-close" onClick={onClose}><X size={18} /></button></div>
          <div className="support-student" style={{ marginTop: 0, marginBottom: 14 }}>
            <div className="dash-post-avatar">{initials(student.studentName)}</div>
            <div><div className="dash-list-row-title">{student.studentName}</div><div className="admin-cell-sub">{[student.studentEmail, aulaName].filter(Boolean).join(' · ')}</div></div>
          </div>
          <div className="submit-work-label">Elige el grupo</div>
          <div className="people-picker" style={{ maxHeight: 'none' }}>
            {groups.length === 0 ? <p className="admin-cell-sub" style={{ padding: 10, margin: 0 }}>Todavía no hay grupos en esta aula.</p> : groups.map((g) => (
              <label key={g.id} className={`people-row ${chosen === g.id ? 'is-on' : ''}`}>
                <input type="radio" name="grupo" checked={chosen === g.id} onChange={() => setChosen(g.id)} />
                <span><strong>{g.name}</strong> <span className="admin-cell-sub">· creado por {g.leaderName} · {(g.memberUids || []).length} integrantes</span></span>
              </label>
            ))}
          </div>
          <p className="admin-cell-sub">Entra al instante y ve la sala del grupo. A los integrantes les llega un aviso.</p>
          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="admin-btn-edit" disabled={!chosen || saving} onClick={async () => { setSaving(true); try { await onAdd(groups.find((g) => g.id === chosen)); onClose(); } finally { setSaving(false); } }}>Agregar al grupo</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

// Grupos de trabajo del docente (D7): no los crea, los administra. Ve los
// grupos de su aula con su sala de Meet, quién no tiene grupo y puede editar
// integrantes, agregar a alguien o eliminar un grupo.
const TeacherCourseGrupos = () => {
  const { course, group: aula, groups: aulas, aulaId } = useOutletContext();
  const { addToast, confirmDialog } = useUI();
  const [enrollments, setEnrollments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [addingStudent, setAddingStudent] = useState(null);

  const load = useCallback(() => Promise.all([fetchAllEnrollments(course.id), fetchWorkGroups(course.id)]).then(([enr, wg]) => {
    setEnrollments(enr);
    setGroups(groupsOfAula(wg, aula?.id));
    setLoading(false);
  }).catch(() => setLoading(false)), [course.id, aula?.id]);
   
  useEffect(() => { load(); }, [load]);

  const roster = useMemo(() => aulaRoster(enrollments, course.id, aulas, aulaId).map((r) => ({
    ...r, studentEmail: enrollments.find((e) => e.uid === r.uid && e.courseId?.toString() === course.id.toString())?.studentEmail || '',
  })), [enrollments, course.id, aulas, aulaId]);

  if (loading) return <div className="admin-empty-hint">Cargando grupos de trabajo...</div>;

  const withoutGroup = roster.filter((r) => !groupOf(groups, r.uid));
  const inGroup = roster.length - withoutGroup.length;

  const saveGroup = async (g, patch) => {
    try {
      await updateWorkGroup(g.id, course.id, patch);
      // Quien entra a este grupo sale de cualquier otro (un alumno, un grupo).
      const added = (patch.memberUids || []).filter((uid) => !(g.memberUids || []).includes(uid));
      await Promise.all(groups.filter((o) => o.id !== g.id && added.some((uid) => (o.memberUids || []).includes(uid) || (o.pendingUids || []).includes(uid)))
        .map((o) => updateWorkGroup(o.id, course.id, added.reduce((acc, uid) => ({ ...acc, ...withoutUid({ ...o, ...acc }, uid) }), {}))));
      addToast('Grupo actualizado. Tus alumnos ya ven el cambio.', 'success');
      load();
    } catch {
      addToast('No se pudo guardar el grupo. Intenta de nuevo.', 'error');
    }
  };

  const removeGroup = async (g) => {
    if (!(await confirmDialog({ title: 'Eliminar grupo', message: `¿Eliminar "${g.name}"? Sus integrantes quedan sin grupo y su sala deja de aparecer.`, confirmLabel: 'Eliminar', danger: true }))) return;
    try {
      await deleteWorkGroup(g.id, course.id);
      setEditing(null);
      addToast('Grupo eliminado.', 'success');
      load();
    } catch {
      addToast('No se pudo eliminar el grupo.', 'error');
    }
  };

  const addStudent = async (g) => {
    const base = { ...g, ...withoutUid(g, addingStudent.uid) };
    await saveGroup(g, { ...withoutUid(g, addingStudent.uid), ...addTo(base, 'member', [{ uid: addingStudent.uid, name: addingStudent.studentName }]) });
  };

  return (
    <div className="anim-fade-up d1">
      <div className="admin-page-head">
        <div><h1 className="admin-page-title">Grupos de trabajo</h1><p className="admin-page-sub">{course.title}{aula?.name ? ` · ${aula.name}` : ''} · Los grupos los arman tus alumnos. Aquí los ves y los administras.</p></div>
      </div>

      <div className="dark-card group-hero">
        <div>
          <div className="grade-hero-eyebrow">Grupos del aula</div>
          <div className="group-hero-name">{groups.length} grupo{groups.length === 1 ? '' : 's'}</div>
          <span className="grade-hero-chip is-ok">{inGroup} de {roster.length} alumnos en un grupo</span>
          <p style={{ marginTop: 8 }}>{withoutGroup.length} alumno{withoutGroup.length === 1 ? '' : 's'} todavía sin grupo</p>
        </div>
        <div>
          <h3>Las salas de tus grupos</h3>
          <p>Cada grupo tiene su propio link de Meet. Puedes entrar a cualquiera para acompañarlos o copiar el link.</p>
        </div>
      </div>

      <div className="admin-panel" style={{ margin: '20px 0' }}>
        <div className="admin-panel-head" style={{ marginBottom: 2 }}><span className="admin-panel-title">Grupos</span></div>
        <p className="admin-panel-caption" style={{ marginTop: 0 }}>Creados por tus alumnos. Toca «Editar» para ver o cambiar a sus integrantes.</p>
        {groups.length === 0 ? <p className="admin-cell-sub" style={{ margin: 0 }}>Tus alumnos todavía no crean grupos.</p> : groups.map((g) => {
          const pending = (g.pendingUids || []).length;
          return (
            <div key={g.id} className="dash-list-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="dash-post-avatar">{initials(g.name)}</div>
                <div>
                  <div className="dash-list-row-title">{g.name}</div>
                  <div className="dash-list-row-sub">Creado por {g.leaderName || '—'} · {(g.memberUids || []).length} integrantes{pending ? ` · ${pending} invitación${pending === 1 ? '' : 'es'} pendiente${pending === 1 ? '' : 's'}` : ''}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <CopyLink link={g.meetLink} />
                {g.meetLink && <a className="admin-btn-ghost" style={{ color: 'var(--accent)' }} href={g.meetLink} target="_blank" rel="noreferrer">Entrar</a>}
                <button className="admin-btn-ghost" onClick={() => setEditing(g)}>Editar</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="admin-panel-head" style={{ marginBottom: 2 }}><span className="admin-panel-title">Alumnos sin grupo</span></div>
        <p className="admin-panel-caption" style={{ marginTop: 0 }}>Puedes agregarlos a un grupo o esperar a que acepten una invitación.</p>
        {withoutGroup.length === 0 ? <p className="admin-cell-sub" style={{ margin: 0 }}>Todos tus alumnos están en un grupo.</p> : withoutGroup.map((s) => {
          const invited = invitationsFor(groups, s.uid);
          return (
            <div key={s.uid} className="dash-list-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="dash-post-avatar" style={{ background: '#EFEEF5', color: '#6B6980' }}>{initials(s.studentName)}</div>
                <div><div className="dash-list-row-title">{s.studentName}</div><div className="dash-list-row-sub">{s.studentEmail}</div></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {invited.length > 0 && <span className="admin-status admin-status-amber">Invitado a {invited.map((g) => g.name).join(', ')}</span>}
                <button className="admin-btn-ghost" style={{ color: 'var(--accent)' }} onClick={() => setAddingStudent(s)}>Agregar a un grupo</button>
              </div>
            </div>
          );
        })}
      </div>

      <HowItWorks>Tus alumnos crean los grupos e invitan a sus compañeros de aula. Tú no necesitas armarlos: solo los revisas y puedes cambiar integrantes o eliminar un grupo. Los alumnos ven los cambios al instante.</HowItWorks>

      {editing && (
        <EditGroupModal group={editing} withoutGroup={withoutGroup} onClose={() => setEditing(null)}
          onSave={(patch) => saveGroup(editing, patch)} onDelete={() => removeGroup(editing)} />
      )}
      {addingStudent && <AddToGroupModal student={addingStudent} aulaName={aula?.name} groups={groups} onClose={() => setAddingStudent(null)} onAdd={addStudent} />}
    </div>
  );
};

export default TeacherCourseGrupos;
