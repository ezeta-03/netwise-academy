import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchMyEnrollments } from '../lib/db';

// Inscripción real de ESTE alumno a ESTE curso (progreso incluido). La
// matrícula la crea el admin al validar el pago (ver approveOrder): una
// matrícula en estado 'pending' todavía no da acceso.
export const useEnrollment = (course) => {
  const { currentUser } = useAuth();
  const [record, setRecord] = useState(null);

  useEffect(() => {
    if (!currentUser || !course) return;
    fetchMyEnrollments(currentUser.uid).then((map) => setRecord(map[course.id] || null));
  }, [currentUser, course]);

  const isEnrolled = !!record && (record.status || 'active') === 'active';

  return { isEnrolled, progress: record?.progress ?? 0 };
};
