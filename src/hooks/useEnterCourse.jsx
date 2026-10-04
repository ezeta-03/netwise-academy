import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AulaPickerModal from '../components/AulaPickerModal';
import { fetchGroups, fetchAllEnrollments } from '../lib/db';
import { aulaRoster } from '../lib/roster';

// Entrada del docente a un curso. Si el curso tiene varias aulas abiertas,
// primero pregunta con cuál va a trabajar ("Selecciona un aula") y deja la
// elección donde la lee TeacherCourseLayout (sessionStorage `nw_aula_<curso>`);
// con una sola aula, o ninguna, entra directo. Devuelve `enterCourse(course,
// path?)` y `picker`, el modal que hay que pintar en la página.
export const useEnterCourse = () => {
  const navigate = useNavigate();
  const [pending, setPending] = useState(null); // { course, path, aulas }

  const go = (course, path) => navigate(path || `/teacher/curso/${course.id}`);

  const enterCourse = async (course, path) => {
    try {
      const [groups, enrollments] = await Promise.all([fetchGroups(course.id), fetchAllEnrollments(course.id)]);
      const open = groups.filter((g) => g.status !== 'closed').sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
      if (open.length > 1) {
        setPending({ course, path, aulas: open.map((g) => ({ id: g.id, name: g.name, scheduleTime: g.scheduleTime, students: aulaRoster(enrollments, course.id, groups, g.id).length })) });
        return;
      }
    } catch { /* sin datos de aulas: se entra directo y el curso muestra lo que haya */ }
    go(course, path);
  };

  const pick = (aulaId) => {
    const { course, path } = pending;
    try { sessionStorage.setItem(`nw_aula_${course.id}`, aulaId); } catch { /* sin almacenamiento: el curso abre en la primera aula */ }
    setPending(null);
    go(course, path);
  };

  const picker = pending ? <AulaPickerModal course={pending.course} aulas={pending.aulas} onPick={pick} onClose={() => setPending(null)} /> : null;
  return { enterCourse, picker };
};
