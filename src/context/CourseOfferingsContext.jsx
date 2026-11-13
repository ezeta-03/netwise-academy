import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { COURSES } from '../lib/data';
import { fetchCourseOfferings } from '../lib/db';
import { buildScheduleLabel } from '../lib/liveScheduleGenerator';
import { COURSE_THUMBNAILS } from '../lib/courseThumbnails';
import { courseFromOffering, DEFAULT_THUMB_ID } from '../lib/customCourses';

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
  // Los cursos creados desde el panel (isCustom) se suman a los de data.js.
  const customOffers = Object.entries(offerings).filter(([, o]) => o?.isCustom);
  const customIds = new Set(customOffers.map(([id]) => String(id)));
  const baseCourses = [
    ...COURSES.filter((c) => !customIds.has(String(c.id))),
    ...customOffers.map(([id, o]) => ({ ...courseFromOffering(o), id: o.custom?.id ?? id })),
  ];

  const courses = baseCourses.map((c, index) => {
    const offer = offerings[c.id] ?? offerings[String(c.id)];
    const thumb = c.imageUrl || COURSE_THUMBNAILS[c.isCustom ? DEFAULT_THUMB_ID : c.id];
    if (c.isCustom) {
      const has = (field) => Object.prototype.hasOwnProperty.call(offer, field);
      return {
        ...c,
        thumb,
        scheduleSlots: [],
        scheduleLabel: 'Horario por confirmar',
        price: has('price') ? offer.price : null,
        startDate: null,
        visible: offer.visible ?? false,
        enrollmentsOpen: offer.enrollmentsOpen ?? true,
        promoPercent: has('promoPercent') ? offer.promoPercent : null,
        teacherUid: offer.teacherUid ?? null,
        syllabus: offer.syllabus || null,
        order: offer.order ?? 0,
        draft: !!offer.draft,
      };
    }
    const staticSlots = c.scheduleDays.map((day) => {
      const [start, end] = String(c.scheduleTime).split('-').map((t) => t.trim());
      return { day, start, end };
    });
    const staticLabel = `${c.scheduleDays.join(' y ')} · ${c.scheduleTime}`;
    const base = { ...c, thumb, order: index + 1, draft: false };
    if (!offer) return { ...base, scheduleSlots: staticSlots, scheduleLabel: staticLabel, visible: true, enrollmentsOpen: true, promoPercent: c.promoPercent ?? null, teacherUid: null, syllabus: null };
    const has = (field) => Object.prototype.hasOwnProperty.call(offer, field);
    // Horario del aula abierta (ver updateCourseSchedule); si no hay, el de data.js.
    const slots = Array.isArray(offer.schedule) && offer.schedule.length ? offer.schedule : null;
    return {
      ...base,
      scheduleSlots: slots || staticSlots,
      scheduleLabel: slots ? buildScheduleLabel(slots) : staticLabel,
      price: has('price') ? offer.price : c.price,
      startDate: has('startDate') ? offer.startDate : (c.startDate ?? null),
      visible: offer.visible ?? true,
      enrollmentsOpen: offer.enrollmentsOpen ?? true,
      promoPercent: has('promoPercent') ? offer.promoPercent : (c.promoPercent ?? null),
      teacherUid: offer.teacherUid ?? null,
      // Sílabo subido por el admin (A8): lo usa "Descargar programa" y el asistente.
      syllabus: offer.syllabus || null,
      // Orden en el catálogo: el que fijó el admin, o el de data.js por defecto.
      order: offer.order ?? base.order,
    };
  }).sort((a, b) => a.order - b.order);

  return (
    <CourseOfferingsContext.Provider value={{ courses, offerings, loaded, refresh }}>
      {children}
    </CourseOfferingsContext.Provider>
  );
};
