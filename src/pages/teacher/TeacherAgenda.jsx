import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { fetchLiveSessions } from '../../lib/db';
import { useClassLinks } from '../../hooks/useClassLinks';
import ClassAgenda from '../../components/ClassAgenda';

// Agenda del docente: la misma del alumno (E2), con "Iniciar clase en Meet"
// en cada fila. Las grabaciones se suben desde Clases en vivo del curso.
const TeacherAgenda = () => {
  const { currentUser } = useAuth();
  const { courses: allCourses } = useCourseOfferings();
  // Un admin ve todo; un docente solo su(s) curso(s) asignado(s).
  // useMemo: sin él `courses` es un array nuevo en cada render y el efecto de
  // abajo (que depende de él) se volvía a disparar sin parar para un docente.
  const courses = useMemo(
    () => (currentUser?.role === 'admin' ? allCourses : allCourses.filter((c) => c.teacherUid === currentUser?.uid)),
    [allCourses, currentUser?.role, currentUser?.uid],
  );
  const myCourseIds = useMemo(() => new Set(courses.map((c) => c.id.toString())), [courses]);
  const [sessions, setSessions] = useState([]);
  const classLinks = useClassLinks(sessions);

  useEffect(() => { fetchLiveSessions([...myCourseIds]).then(setSessions).catch(() => {}); }, [myCourseIds]);

  return <ClassAgenda sessions={sessions} courses={courses} classLinks={classLinks} role="teacher" subtitle="Tus clases en vivo. Inícialas desde aquí a la hora de clase." />;
};

export default TeacherAgenda;
