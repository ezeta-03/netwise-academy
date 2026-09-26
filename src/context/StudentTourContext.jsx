import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { useCourseOfferings } from './CourseOfferingsContext';
import { fetchMyActiveEnrollments, hasSeenTour, markTourSeen } from '../lib/db';
import { STUDENT_TOUR_KEY, buildStudentTourSteps } from '../lib/studentTourSteps';
import CourseTour from '../components/CourseTour';

// Recorrido guiado del estudiante. Vive por encima de las rutas porque recorre
// varias páginas (Inicio, Agenda... y el aula de un curso): cada paso navega a
// su página y el tutorial sigue abierto aunque cambie el layout.
//
// Se abre solo la primera vez que un alumno entra a su área; después queda en
// el botón "Ver tutorial" (StudentLayout y StudentCourseLayout).
const StudentTourContext = createContext({ startTour: () => {}, sidebarRequest: null });

// eslint-disable-next-line react-refresh/only-export-components -- hook junto a su Provider (patrón de contexto)
export const useStudentTour = () => useContext(StudentTourContext);

const COURSE_PATH = /^\/student\/curso\/([^/]+)/;

export const StudentTourProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const { courses } = useCourseOfferings();
  const navigate = useNavigate();
  const location = useLocation();
  const [tour, setTour] = useState(null); // { steps, startIndex, returnTo }
  // En el teléfono el menú lateral es un cajón: el paso pide abrirlo o
  // cerrarlo (null = sin tutorial, cada layout maneja el suyo).
  const [sidebarRequest, setSidebarRequest] = useState(null);
  const checkedUid = useRef(null);

  const isStudentArea = currentUser?.role === 'student' && location.pathname.startsWith('/student');

  // `fromStepId` (opcional): arrancar en ese paso, ej. el bloque del aula
  // cuando se pide desde dentro de un curso.
  const startTour = useCallback(async (fromStepId) => {
    if (!currentUser) return;
    const enrollments = await fetchMyActiveEnrollments(currentUser.uid).catch(() => ({}));
    const here = window.location.pathname.match(COURSE_PATH)?.[1];
    const courseId = here && enrollments[here] ? here : Object.keys(enrollments)[0];
    const course = courses.find((c) => c.id.toString() === courseId?.toString()) || null;
    const steps = buildStudentTourSteps(course);
    const startIndex = Math.max(0, steps.findIndex((s) => s.id === fromStepId));
    setTour({ steps, startIndex, returnTo: window.location.pathname + window.location.search });
  }, [currentUser, courses]);

  useEffect(() => {
    if (!isStudentArea || checkedUid.current === currentUser.uid) return;
    checkedUid.current = currentUser.uid;
    hasSeenTour(currentUser.uid, STUDENT_TOUR_KEY)
      .then((seen) => { if (!seen) startTour(); })
      .catch(() => {});
  }, [isStudentArea, currentUser, startTour]);

  const prepareStep = useCallback((step) => {
    const here = window.location.pathname + window.location.search;
    if (step.route && here !== step.route) navigate(step.route);
    if (window.matchMedia('(max-width: 640px)').matches) setSidebarRequest(!!step.inSidebar);
  }, [navigate]);

  const closeTour = useCallback((reason) => {
    const returnTo = tour?.returnTo;
    setTour(null);
    setSidebarRequest(null);
    if (currentUser) markTourSeen(currentUser.uid, STUDENT_TOUR_KEY).catch(() => {});
    if (reason === 'skipped') {
      // Omitido a mitad de camino: volver a donde estaba el alumno.
      if (returnTo && returnTo !== window.location.pathname + window.location.search) navigate(returnTo);
      addToast('Puedes ver el tutorial cuando quieras desde "Ver tutorial".', 'info');
    }
    document.querySelector('[data-tour="tour-help"]')?.focus();
  }, [tour, currentUser, navigate, addToast]);

  return (
    <StudentTourContext.Provider value={{ startTour, sidebarRequest }}>
      {children}
      {tour && (
        <CourseTour steps={tour.steps} startIndex={tour.startIndex} onClose={closeTour} onBeforeStep={prepareStep} />
      )}
    </StudentTourContext.Provider>
  );
};
