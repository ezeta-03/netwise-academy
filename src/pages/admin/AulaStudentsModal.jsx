import React, { useState } from 'react';
import { X } from 'lucide-react';
import ModalPortal from '../../components/ModalPortal';
import { useUI } from '../../context/UIContext';
import { updateEnrollmentAccess, logChange } from '../../lib/db';
import { countByGroup, freeSeats } from '../../lib/groupAssignment';
import { usePagedTable } from '../../hooks/usePagedTable';

const PAYMENT_SHORT = { yape: 'Yape/Plin', transfer: 'Transferencia', card: 'Tarjeta' };
const fmtDay = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
};

// "Ver alumnos" de un aula (Admin > Aulas y horarios): quiénes están en ella,
// con qué pagaron, y desde aquí se les mueve a otra aula del mismo curso o se
// les quita (quedan pagados y "sin aula", listos para reasignar).
const AulaStudentsModal = ({ group, groups, enrollments, orders, adminName, onClose, onChanged, onEditGroup }) => {
  const { addToast } = useUI();
  const [busyId, setBusyId] = useState(null);

  const students = enrollments.filter((e) => e.groupId === group.id && (e.status || 'active') === 'active');
  const { rows: pageRows, pager, tableRef } = usePagedTable(students, { label: 'alumnos' });
  const counts = countByGroup(enrollments);
  const siblings = groups.filter((g) => g.courseId?.toString() === group.courseId?.toString() && g.status !== 'closed');
  const paymentOf = (e) => orders.find((o) => o.status === 'paid' && o.uid === e.uid && o.courseId?.toString() === e.courseId?.toString()) || null;

  const move = async (e, targetId) => {
    if (targetId === group.id) return;
    const target = siblings.find((g) => g.id === targetId) || null;
    setBusyId(e.id);
    try {
      await updateEnrollmentAccess(e.id, e.uid, e.courseId, { status: e.status || 'active', groupId: target?.id, groupName: target?.name, reason: e.reason || '' });
      await logChange(adminName, target ? `Movió a ${e.studentName} del aula "${group.name}" a "${target.name}".` : `Quitó a ${e.studentName} del aula "${group.name}".`);
      addToast(target ? `${e.studentName} pasó al aula ${target.name}.` : `${e.studentName} quedó sin aula.`, 'success');
      await onChanged();
    } catch {
      addToast('No se pudo actualizar el aula del alumno.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const summary = [group.courseTitle, group.startDate ? `inicia ${fmtDay(group.startDate)}` : null, group.scheduleTime, group.instructor, `${students.length}/${group.capacity || '∞'} cupos`].filter(Boolean).join(' · ');

  return (
    <ModalPortal>
      <div className="admin-modal-overlay">
        <div className="admin-modal" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-head">
            <div>
              <div className="admin-modal-title">{group.name}</div>
              <div className="admin-modal-sub">{summary}</div>
            </div>
            <button className="admin-modal-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
          </div>

          {students.length === 0 ? (
            <p className="admin-panel-caption" style={{ marginTop: 0 }}>Esta aula todavía no tiene alumnos. Asígnalos desde la pestaña "Asignar alumnos".</p>
          ) : (
            <div className="admin-table-wrap">
              <><table ref={tableRef} className="admin-table admin-table-compact table-cards">
                <thead><tr><th>Alumno</th><th>Pago</th><th>Mover a</th><th></th></tr></thead>
                <tbody>
                  {pageRows.map((e) => {
                    const order = paymentOf(e);
                    return (
                      <tr key={e.id}>
                        <td><div className="admin-cell-name">{e.studentName || e.uid}</div><div className="admin-cell-sub">{e.studentEmail}</div></td>
                        <td className="admin-cell-sub">{order ? <>{PAYMENT_SHORT[order.paymentMethod] || 'Pago'}<br />{fmtDay(order.createdAt)}</> : (e.reason || 'Matrícula manual')}</td>
                        <td>
                          <select className="admin-select" style={{ maxWidth: 240 }} value={group.id} disabled={busyId === e.id} aria-label={`Mover a ${e.studentName} a otra aula`} onChange={(ev) => move(e, ev.target.value)}>
                            {siblings.map((g) => {
                              const free = freeSeats(g, counts);
                              const full = g.id !== group.id && free === 0;
                              return <option key={g.id} value={g.id} disabled={full}>{g.name}{g.startDate ? ` · inicia ${fmtDay(g.startDate)}` : ''}{full ? ' · sin cupos' : ''}</option>;
                            })}
                          </select>
                        </td>
                        <td><button className="admin-btn-ghost" style={{ color: '#BE123C' }} disabled={busyId === e.id} onClick={() => move(e, null)}>Quitar</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>{pager}</>
            </div>
          )}

          <div className="admin-modal-actions">
            <button className="admin-btn-ghost" onClick={onEditGroup}>Editar aula</button>
            <button className="admin-btn-edit" onClick={onClose}>Listo</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default AulaStudentsModal;
