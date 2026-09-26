import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { COURSES } from '../lib/data';
import { fetchCourseOfferings } from '../lib/db';
import { buildScheduleLabel } from '../lib/liveScheduleGenerator';

const CourseOfferingsContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components -- hook junto a su Provider (patrón de contexto)
export const useCourseOfferings = () => useContext(CourseOfferingsContext);

// El contenido de cada taller (título, descripción, highlights...) sigue
// viviendo en data.js. Lo único que puede "abrir" el Admin -- precio y fecha
// de inicio -- se guarda aparte en Firestore (`courseOfferings`) y se
// combina acá encima del contenido estático, para que el resto de la app
// (Inicio, Catálogo, detalle de curso, Mi Aprendizaje...) siga usando
// `courses` exactamente como usaba `COURSES` antes.
export const CourseOfferingsProvider = ({ children }) => {
  const [offerings, setOfferings] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchCourseOfferings().then((map) => {
      setOfferings(map);
      setLoaded(true);
    });
  }, []);

  const refresh = useCallback(async () => {
    const map = await fetchCourseOfferings();
    setOfferings(map);
    setLoaded(true);
  }, []);

  // `has(field)` distingue "el admin lo dejó explícitamente en null/vacío"
  // (ej. apagó la promoción) de "nunca se tocó, usa el valor del taller" --
  // con `??` ambos casos se ven iguales (null también es "nullish"), así que
  // apagar una promoción o vaciar el precio volvía a mostrar el valor
  // original de data.js en vez de quedar realmente apagado/vacío.
  const courses = COURSES.map((c) => {
    const offer = offerings[c.id];
    const staticSlots = c.scheduleDays.map((day) => {
      const [start, end] = String(c.scheduleTime).split('-').map((t) => t.trim());
      return { day, start, end };
    });
    const staticLabel = `${c.scheduleDays.join(' y ')} · ${c.scheduleTime}`;
    if (!offer) return { ...c, scheduleSlots: staticSlots, scheduleLabel: staticLabel, visible: true, enrollmentsOpen: true, promoPercent: c.promoPercent ?? null, teacherUid: null };
    const has = (field) => Object.prototype.hasOwnProperty.call(offer, field);
    // Horario del aula abierta (ver updateCourseSchedule); si no hay, el de data.js.
    const slots = Array.isArray(offer.schedule) && offer.schedule.length ? offer.schedule : null;
    return {
      ...c,
      scheduleSlots: slots || staticSlots,
      scheduleLabel: slots ? buildScheduleLabel(slots) : staticLabel,
      price: has('price') ? offer.price : c.price,
      startDate: has('startDate') ? offer.startDate : (c.startDate ?? null),
      visible: offer.visible ?? true,
      enrollmentsOpen: offer.enrollmentsOpen ?? true,
      promoPercent: has('promoPercent') ? offer.promoPercent : (c.promoPercent ?? null),
      teacherUid: offer.teacherUid ?? null,
    };
  });

  return (
    <CourseOfferingsContext.Provider value={{ courses, loaded, refresh }}>
      {children}
    </CourseOfferingsContext.Provider>
  );
};
