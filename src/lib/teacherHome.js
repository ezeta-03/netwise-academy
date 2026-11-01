// Datos del Inicio del docente (D1): qué hay por revisar y qué alumnos
// necesitan atención. Funciones puras, sin Firestore (ver tests/teacherHome).
import { attendanceStats } from './attendance.js';

export const MIN_ATTENDANCE_PCT = 75;

// Entregas que llegaron y aún no tienen nota, agrupadas por entregable (una
// fila por curso + módulo), lo más antiguo primero. `late` cuenta las que
// llegaron después de la fecha límite. Mismo criterio que la campana:
// status 'submitted' = por revisar.
export const buildToReview = ({ courses, submissionsByCourse, modulesByCourse, dueDateOf, practices = [] }) => {
  const rows = [];
  courses.forEach((course) => {
    const subs = (submissionsByCourse[course.id] || []).filter((s) => s.status === 'submitted');
    const modules = modulesByCourse[course.id] || [];
    const byModule = new Map();
    subs.forEach((s) => {
      if (!byModule.has(s.moduleId)) byModule.set(s.moduleId, []);
      byModule.get(s.moduleId).push(s);
    });
    byModule.forEach((list, moduleId) => {
      // Avance de una práctica de clase: va con su nombre y su propia fecha límite.
      const practice = practices.find((p) => `p-${p.id}` === moduleId) || (list[0]?.practiceId ? { id: list[0].practiceId, title: list[0].deliverableTitle } : null);
      if (practice) {
        const sent = (s) => String(s.submittedAt || s.updatedAt || '');
        const due = practice.dueAt || null;
        rows.push({
          course, moduleId, practiceId: practice.id, moduleIndex: -1,
          title: practice.classTitle ? `Avance · ${practice.classTitle}` : `Avance · ${practice.title || 'práctica'}`,
          count: list.length, late: due ? list.filter((s) => new Date(sent(s)) > new Date(due)).length : 0, due,
          oldest: list.map(sent).sort()[0] || '',
        });
        return;
      }
      const index = modules.findIndex((m) => m.id === moduleId);
      const module = modules[index];
      const due = module ? dueDateOf?.(course, module, index) : null;
      const sentAt = (s) => String(s.submittedAt || s.updatedAt || '');
      const late = due ? list.filter((s) => sentAt(s).slice(0, 10) > due).length : 0;
      rows.push({
        course, moduleId, moduleIndex: index,
        title: `Entrega Módulo ${index >= 0 ? index + 1 : ''}`.trim(),
        count: list.length, late, due,
        oldest: list.map(sentAt).sort()[0] || '',
      });
    });
  });
  return rows.sort((a, b) => a.oldest.localeCompare(b.oldest));
};

// Faltas seguidas al final: sesiones dictadas (en orden) sin asistencia,
// contando desde la última hacia atrás. "No aplica" no corta ni suma.
export const trailingAbsences = (sessions, records) => {
  const byId = new Map((records || []).map((r) => [r.sessionId, r]));
  const dictated = (sessions || []).filter((s) => !byId.get(s.id)?.excused && (s.done || byId.has(s.id)));
  let n = 0;
  for (let i = dictated.length - 1; i >= 0; i--) {
    if (byId.get(dictated[i].id)?.present) break;
    n += 1;
  }
  return n;
};

// Alumnos que necesitan atención: 2+ faltas seguidas, entregas vencidas sin
// presentar o asistencia bajo 75%. Cada fila dice el motivo (el más urgente
// primero) y sale de la lista cuando el motivo se resuelve.
// `students`: [{ uid, studentName, email, course, sessions, attendance, submissions, overdueModules }]
// `overdueModules`: [{ id, label }] de entregables con fecha límite ya pasada.
export const buildAttentionList = (students) => students.map((st) => {
  const reasons = [];
  const streak = trailingAbsences(st.sessions, st.attendance);
  if (streak >= 2) reasons.push({ key: 'streak', label: `${streak} faltas seguidas`, tone: 'rose' });
  const delivered = new Set((st.submissions || []).map((s) => s.moduleId));
  const missing = (st.overdueModules || []).filter((m) => !delivered.has(m.id));
  if (missing.length) reasons.push({ key: 'missing', label: missing.length === 1 ? `Sin entrega del ${missing[0].label}` : `${missing.length} entregas vencidas`, tone: 'amber' });
  const stats = attendanceStats(st.sessions, st.attendance);
  if (stats.taken >= 2 && stats.raw < MIN_ATTENDANCE_PCT && streak < 2) reasons.push({ key: 'low', label: `Asistencia bajo ${MIN_ATTENDANCE_PCT}%`, tone: 'rose' });
  return { ...st, reasons };
}).filter((st) => st.reasons.length > 0);
