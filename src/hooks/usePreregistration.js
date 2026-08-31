import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { preregisterInterest, fetchMyPreregistrations } from '../lib/db';

// Mientras los talleres no tengan precio/fecha de inicio confirmados,
// "Preinscribirme" no puede procesar un pago real -- pero sí puede dejar
// registrado el interés del alumno de una vez (Firestore/localStorage según
// el entorno) para avisarle apenas se abra la cohorte, en vez de ser un
// botón puramente decorativo.
export const usePreregistration = (course) => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const [registeredIds, setRegisteredIds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    fetchMyPreregistrations(currentUser.uid).then(setRegisteredIds);
  }, [currentUser]);

  const isPreregistered = course ? registeredIds.includes(course.id) : false;

  const preregister = useCallback(async () => {
    if (!course || !currentUser || isPreregistered || saving) return;
    setSaving(true);
    try {
      await preregisterInterest(currentUser.uid, course, currentUser);
      setRegisteredIds((prev) => [...prev, course.id]);
      addToast(`¡Listo! Te avisaremos apenas abramos inscripciones para "${course.title}".`, 'success');
    } catch {
      addToast('No se pudo registrar tu interés. Intenta de nuevo.', 'error');
    } finally {
      setSaving(false);
    }
  }, [course, currentUser, isPreregistered, saving, addToast]);

  return { isPreregistered, saving, preregister };
};
