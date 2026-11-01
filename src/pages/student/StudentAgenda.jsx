import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCourseOfferings } from '../../context/CourseOfferingsContext';
import { fetchLiveSessions, fetchMyActiveEnrollments } from '../../lib/db';
import { sessionsForStudent } from '../../lib/groupAssignment';
import { useClassLinks } from '../../hooks/useClassLinks';
import ClassAgenda from '../../components/ClassAgenda';

// Agenda del alumno (E2): sus clases de todos sus cursos, con "Entrar a Meet"
// en cada fila (ver ClassAgenda).
const StudentAgenda = () => {
  const { currentUser } = useAuth();
  const { courses } = useCourseOfferings();
  const [enrolledIds, setEnrolledIds] = useState([]);
  const [sessions, setSessions] = useState([]);
  const classLinks = useClassLinks(sessions);

  useEffect(() => {
    if (!currentUser) return;
    // Las clases se leen por curso: solo las de los cursos donde está matriculado.
    fetchMyActiveEnrollments(currentUser.uid).then((map) => {
      const ids = Object.keys(map);
      setEnrolledIds(ids);
      // Con varias aulas por curso, solo las clases de la suya.
      return fetchLiveSessions(ids).then((all) => setSessions(sessionsForStudent(all, map)));
    }).catch(() => {});
  }, [currentUser]);

  const mine = sessions.filter((s) => enrolledIds.includes(s.courseId?.toString()));

  return <ClassAgenda sessions={mine} courses={courses} classLinks={classLinks} role="student" />;
};

export default StudentAgenda;
