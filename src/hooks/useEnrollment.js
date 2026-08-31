import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchMyEnrollments, enrollInCourse } from '../lib/db';

// Inscripción real de ESTE alumno a ESTE curso (progreso incluido). Antes
// "inscrito" era un campo compartido en COURSES, igual para todos los
// estudiantes y nunca actualizado -- así que "Mi Aprendizaje" quedaba
// siempre vacío sin importar qué hiciera el alumno.
export const useEnrollment = (course) => {
  const { currentUser } = useAuth();
  const [record, setRecord] = useState(null);

  useEffect(() => {
    if (!currentUser || !course) return;
    fetchMyEnrollments(currentUser.uid).then((map) => setRecord(map[course.id] || null));
  }, [currentUser, course]);

  const isEnrolled = !!record;

  const enroll = useCallback(async () => {
    if (!course || !currentUser || isEnrolled) return;
    await enrollInCourse(currentUser.uid, course);
    setRecord({ courseId: course.id, progress: 0, completedLessonIds: [] });
  }, [course, currentUser, isEnrolled]);

  return { isEnrolled, progress: record?.progress ?? 0, enroll };
};
