import React, { useMemo, useState } from 'react';
import { Search, Plus, Shuffle, Check } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { updateEnrollmentAccess, logChange } from '../../lib/db';
import { countByGroup, eligibleGroups, freeSeats, pickGroup, unassignedEnrollments, distributeEnrollments, enrollmentKey } from '../../lib/groupAssignment';

const METHOD_LABEL = { yape: 'Yape/Plin', transfer: 'Transferencia', card: 'Tarjeta' };
const sameCourse = (a, b) => a != null && b != null && a.toString() === b.toString();
const fmtShort = (iso) => (iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// "Aulas y horarios > Asignar alumnos": los alumnos que ya pagaron (matrícula
// activa) y todavía no tienen aula, por curso. Se asignan a mano (selección +
// aula) o con "Repartir automáticamente" (mismo criterio que la asignación al
// matricular, ver lib/groupAssignment.js).
const AdminAsignarAlumnos = ({ courses, groups, enrollments, orders, adminName, onChanged, onCreateGroup, renderGroupsTable }) => {
  const { addToast, confirmDialog } = useUI();
  const unassigned = useMemo(() => unassignedEnrollments(enrollments, groups), [enrollments, groups]);
  const countFor = (courseId) => unassigned.filter((e) => sameCourse(e.courseId, courseId)).length;
  // Por defecto, el primer curso con alumnos pendientes de aula.
  const [pickedCourseId, setCourseId] = useState(null);
  const courseId = pickedCourseId ?? (courses.find((c) => countFor(c.id) > 0) || courses[0])?.id ?? null;
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [groupChoice, setGroupChoice] = useState('');
  const [saving, setSaving] = useState(false);

  const course = courses.find((c) => sameCourse(c.id, courseId));
  const counts = countByGroup(enrollments);
  const courseGroups = groups.filter((g) => sameCourse(g.courseId, courseId));
  const options = eligibleGroups(groups, courseId);
  const suggested = pickGroup(groups, enrollments, courseId);
  const targetId = groupChoice || suggested?.id || '';

  // Pago confirmado de cada alumno: método y fecha del pedido pagado; sin
  // pedido (alta manual), la fecha de matrícula.
  const rows = unassigned
    .filter((e) => sameCourse(e.courseId, courseId))
    .map((e) => {
      const order = orders.find((o) => o.uid === e.uid && sameCourse(o.courseId, e.courseId) && o.status === 'paid');
      return {
        e, key: enrollmentKey(e),
        method: order ? (METHOD_LABEL[order.paymentMethod] || order.paymentMethod || 'Pago') : 'Alta manual',
        paidAt: order?.createdAt || e.enrolledAt || '',
      };
    })
    .sort((a, b) => String(a.paidAt).localeCompare(String(b.paidAt)));
  const q = search.trim().toLowerCase();
  const visible = rows.filter((r) => !q || `${r.e.studentName} ${r.e.studentEmail || ''}`.toLowerCase().includes(q));
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.includes(r.key));

  const changeCourse = (id) => { setCourseId(id); setSelected([]); setGroupChoice(''); setSearch(''); };
  const toggle = (key) => setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const apply = async (plan) => {
    setSaving(true);
    try {
      for (const { enrollment: e, group } of plan) {
        await updateEnrollmentAccess(e.id, e.uid, e.courseId, { status: e.status || 'active', groupId: group.id, groupName: group.name, reason: e.reason || '' });
      }
      const byGroup = plan.reduce((acc, p) => ({ ...acc, [p.group.name]: (acc[p.group.name] || 0) + 1 }), {});
      const summary = Object.entries(byGroup).map(([name, n]) => `${n} en ${name}`).join(', ');
      await logChange(adminName, `Asignó ${plan.length} alumno(s) de "${course?.title}" a aulas: ${summary}.`);
      addToast(`${plan.length} alumno${plan.length === 1 ? '' : 's'} asignado${plan.length === 1 ? '' : 's'} (${summary}).`, 'success');
      setSelected([]);
      setGroupChoice('');
      await onChanged();
    } catch {
      addToast('No se pudieron asignar todos los alumnos. Revisa y vuelve a intentar.', 'error');
      await onChanged();
    } finally {
      setSaving(false);
    }
  };

  const assignSelected = async () => {
    const group = groups.find((g) => g.id === targetId);
    if (!group) { addToast('Elige un aula.', 'error'); return; }
    const chosen = rows.filter((r) => selected.includes(r.key)).map((r) => r.e);
    const free = freeSeats(group, counts);
    if (chosen.length > free && !(await confirmDialog({ title: 'El aula no tiene cupos suficientes', message: `El aula "${group.name}" solo tiene ${free} cupo(s) libre(s) y vas a asignar ${chosen.length}. ¿Asignar igual?`, confirmLabel: 'Asignar igual' }))) return;
    apply(chosen.map((enrollment) => ({ enrollment, group })));
  };

  const autoDistribute = async () => {
    const plan = distributeEnrollments(rows.map((r) => r.e), groups, enrollments);
    if (plan.length === 0) { addToast('No hay aulas abiertas con cupos para este curso. Crea una o amplía los cupos.', 'warning'); return; }
    const byGroup = plan.reduce((acc, p) => ({ ...acc, [p.group.name]: (acc[p.group.name] || 0) + 1 }), {});
    const lines = Object.entries(byGroup).map(([name, n]) => `• ${name}: ${n}`).join('\n');
    const left = rows.length - plan.length;
    if (!(await confirmDialog({ title: 'Repartir alumnos automáticamente', message: `Repartir ${plan.length} alumno(s) de "${course?.title}":\n${lines}${left > 0 ? `\n\n${left} quedarán sin aula por falta de cupos.` : ''}`, confirmLabel: 'Repartir' }))) return;
    apply(plan);
  };

  if (courses.length === 0) return <div className="admin-empty-hint">Todavía no hay cursos.</div>;

  return (
    <>
      <div className="admin-chips">
        {courses.map((c) => (
          <button key={c.id} className={`admin-chip ${sameCourse(c.id, courseId) ? 'active' : ''}`} onClick={() => changeCourse(c.id)}>
            {c.title} <span>· {countFor(c.id)}</span>
          </button>
        ))}
      </div>

      <div className="assign-grid">
        <div className="admin-panel assign-list">
          <div className="admin-panel-head">
            <span className="admin-panel-title">Pagados sin aula · {rows.length}</span>
            <span className="admin-cell-sub">Ordenados por fecha de pago</span>
          </div>
          <div className="admin-search" style={{ marginBottom: 10 }}><Search size={15} /><input placeholder="Buscar alumno..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          {rows.length === 0 ? (
            <p className="admin-panel-caption" style={{ marginTop: 0 }}>Todos los alumnos pagados de este curso ya tienen aula. 🎉</p>
          ) : (
            <>
              <label className="admin-field-checkbox" style={{ marginBottom: 6, fontSize: '.8rem' }}>
                <input type="checkbox" checked={allVisibleSelected} onChange={(e) => setSelected(e.target.checked ? [...new Set([...selected, ...visible.map((r) => r.key)])] : selected.filter((k) => !visible.some((r) => r.key === k)))} />
                Seleccionar todos ({visible.length})
              </label>
              <div className="assign-rows">
                {visible.map((r) => (
                  <label key={r.key} className={`assign-row ${selected.includes(r.key) ? 'selected' : ''}`}>
                    <input type="checkbox" checked={selected.includes(r.key)} onChange={() => toggle(r.key)} />
                    <div className="assign-row-main">
                      <div className="admin-cell-name">{r.e.studentName || r.e.uid}</div>
                      <div className="admin-cell-sub">{r.e.studentEmail || 'Sin correo registrado'}</div>
                    </div>
                    <div className="assign-row-side">
                      <span className="admin-status admin-status-green">Pagado</span>
                      <div className="admin-cell-sub">{r.method}{r.paidAt ? ` · ${fmtShort(r.paidAt)}` : ''}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="assign-footer">
                <span className="admin-cell-sub">{selected.length} seleccionado{selected.length === 1 ? '' : 's'}</span>
                <select value={targetId} onChange={(e) => setGroupChoice(e.target.value)} disabled={options.length === 0}>
                  {options.length === 0 && <option value="">Sin aulas abiertas</option>}
                  {options.map((g) => {
                    const free = freeSeats(g, counts);
                    return <option key={g.id} value={g.id}>{g.name}{g.startDate ? ` · inicia ${fmtShort(g.startDate)}` : ''} · {free === Infinity ? 'sin tope' : `${free} cupos`}</option>;
                  })}
                </select>
                <button className="admin-btn-edit" disabled={saving || selected.length === 0 || !targetId} onClick={assignSelected}><Check size={14} /> {saving ? 'Asignando...' : 'Asignar'}</button>
              </div>
            </>
          )}
        </div>

        <div className="admin-panel assign-groups">
          <div className="admin-panel-head" style={{ gap: 10, flexWrap: 'wrap' }}>
            <span className="admin-panel-title">Aulas de {course?.title} · {courseGroups.length}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="admin-btn-ghost" onClick={() => onCreateGroup(courseId)}><Plus size={14} /> Aula</button>
              <button className="admin-btn-edit" disabled={saving || rows.length === 0} onClick={autoDistribute}><Shuffle size={14} /> Repartir automáticamente</button>
            </div>
          </div>
          {courseGroups.length === 0
            ? <p className="admin-panel-caption" style={{ marginTop: 0 }}>Este curso todavía no tiene aulas. Crea una para poder asignar alumnos.</p>
            : <div className="assign-groups-table">{renderGroupsTable(courseGroups, true)}</div>}
        </div>
      </div>
    </>
  );
};

export default AdminAsignarAlumnos;
