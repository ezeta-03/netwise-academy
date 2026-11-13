// Cursos creados desde el panel (Admin > Cursos y precios > "+ Nuevo curso").
//
// Se guardan en `courseOfferings/{id}` con `isCustom: true` y todo su
// contenido dentro de `custom`, así no hace falta una colección ni reglas
// nuevas: las reglas de `courseOfferings` ya dejan leer a todos y escribir
// solo al admin. Los campos de precio, visibilidad e inscripciones quedan en
// el nivel superior porque las reglas de checkout los validan ahí.
//
// `courseFromOffering` convierte ese documento a la misma forma que tienen
// los cursos de data.js, para que la ficha, el checkout y el panel lo
// traten igual que a los talleres originales. `courseToForm` hace el camino
// inverso para editar un curso ya creado.

import { CATEGORIES } from './data';
import { toEmbedUrl } from './embedUrl';

export const LEVELS = ['Nivel básico', 'Nivel intermedio', 'Nivel avanzado'];
export const BADGES = ['Ninguna', 'Nuevo', 'Más vendido', 'Últimos cupos'];
export const DEFAULT_THUMB_ID = 1;

export const emptyCourseForm = () => ({
  title: '',
  cardTitle1: '',
  cardTitle2: '',
  cardDesc: '',
  cat: CATEGORIES[0].id,
  level: LEVELS[0],
  badge: 'Ninguna',
  cover: null, // { url, name } ya subida a Storage
  videoUrl: '', // enlace de YouTube o Vimeo; se embebe en la ficha
  summary: '',
  outcomeHeadline: '',
  description: '',
  doable: '', // una línea por punto
  projectFinal: '',
  intro: '',
  modules: [], // [{ title, week, desc, deliverable }]
  durationWeeks: '',
  sessionsPerWeek: '',
  sessionHours: '',
  price: '',
  promoPercent: '',
  visible: false, // se activa en el paso 6; un borrador nunca sale en la web
  enrollmentsOpen: true,
  draft: true,
});

const num = (v) => (v === '' || v == null ? null : Number(v));

// Solo se embeben videos de YouTube y Vimeo: el iframe no abre otros sitios.
// Devuelve la URL embebible o null si el enlace no es válido.
export const normalizeVideoUrl = (raw) => {
  const text = (raw || '').trim();
  if (!text) return null;
  const embed = toEmbedUrl(text);
  return /^https:\/\/(www\.youtube\.com\/embed\/[\w-]{11}|player\.vimeo\.com\/video\/\d+)$/.test(embed) ? embed : null;
};

// Campos obligatorios para publicar. Devuelve la lista de lo que falta,
// en el mismo orden en que aparecen en el formulario.
export const courseFormMissing = (f) => {
  const missing = [];
  if (!f.title.trim()) missing.push('Nombre del curso');
  if (!f.cardTitle1.trim() || !f.cardTitle2.trim()) missing.push('Título de tarjeta (las dos líneas)');
  if (!f.cardDesc.trim()) missing.push('Descripción corta');
  if (!f.cover?.url) missing.push('Imagen del curso');
  if (f.videoUrl.trim() && !normalizeVideoUrl(f.videoUrl)) missing.push('Video: enlace de YouTube o Vimeo válido');
  if (!f.summary.trim()) missing.push('Bajada');
  if (!f.outcomeHeadline.trim()) missing.push('Lo que lograrás');
  if (!f.description.trim()) missing.push('Descripción');
  if (!f.doable.split('\n').some((l) => l.trim())) missing.push('Lo que podrás hacer');
  if (!f.projectFinal.trim()) missing.push('Proyecto final');
  if (!f.intro.trim()) missing.push('Introducción del programa');
  if (!Number(f.durationWeeks)) missing.push('Duración en semanas');
  if (!Number(f.sessionsPerWeek)) missing.push('Sesiones por semana');
  if (!Number(f.sessionHours)) missing.push('Duración de cada sesión');
  if (f.price === '' || f.price == null || Number(f.price) < 0) missing.push('Precio de venta');
  return missing;
};

// Documento que se guarda en courseOfferings para un curso nuevo, un borrador
// o una edición. `order` lo decide quien llama (el primero, o el que ya tenía).
export const courseFormToOffering = (f, { id, order }) => {
  const doable = f.doable.split('\n').map((l) => l.trim()).filter(Boolean);
  const modules = f.modules
    .filter((m) => m.title.trim())
    .map((m, i) => ({ ...m, title: m.title.trim(), number: i + 1 }));
  return {
    isCustom: true,
    draft: !!f.draft,
    order,
    price: num(f.price),
    promoPercent: num(f.promoPercent),
    visible: f.draft ? false : !!f.visible,
    enrollmentsOpen: !!f.enrollmentsOpen,
    custom: {
      id,
      title: f.title.trim(),
      cat: f.cat,
      cardTitle: [f.cardTitle1.trim(), f.cardTitle2.trim()],
      cardDesc: f.cardDesc.trim(),
      badge: f.badge === 'Ninguna' ? null : f.badge,
      level: f.level,
      imageUrl: f.cover?.url || null,
      videoUrl: normalizeVideoUrl(f.videoUrl),
      summary: f.summary.trim(),
      outcomeHeadline: f.outcomeHeadline.trim(),
      description: f.description.trim(),
      highlights: doable,
      doableList: doable,
      projectFinal: f.projectFinal.trim(),
      longDescription: f.intro.trim().split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
      modules,
      duration: `${Number(f.durationWeeks)} semanas`,
      sessionsPerWeek: Number(f.sessionsPerWeek),
      sessionHours: Number(f.sessionHours),
      modality: 'Online en vivo',
    },
  };
};

// Pasa un documento de courseOfferings (con isCustom) a la forma de un curso.
export const courseFromOffering = (offer) => {
  const c = offer.custom || {};
  const catLabel = CATEGORIES.find((x) => x.id === c.cat)?.label || '';
  return {
    id: c.id,
    isCustom: true,
    title: c.title,
    cat: c.cat,
    cardTag: catLabel.replace(/^\S+\s/, ''),
    cardTitle: c.cardTitle || [c.title, ''],
    cardDesc: c.cardDesc || '',
    badge: c.badge || null,
    level: c.level || LEVELS[0],
    imageUrl: c.imageUrl || null,
    videoUrl: c.videoUrl || null,
    summary: c.summary || '',
    outcomeHeadline: c.outcomeHeadline || '',
    description: c.description || '',
    highlights: c.highlights || [],
    doableList: c.doableList || [],
    projectFinal: c.projectFinal || '',
    longDescription: c.longDescription || [],
    modules: c.modules || [],
    duration: c.duration || '',
    sessionsPerWeek: Number(c.sessionsPerWeek) || 0,
    sessionHours: Number(c.sessionHours) || 0,
    icon: 'sparkles',
    emoji: '✨',
    color: '#1a1035,#0d1628',
    instructor: 'Netwise Agencia',
    labName: 'Netwise Lab™',
    scheduleDays: [],
    scheduleTime: '',
    startDate: null,
  };
};

// Inverso de courseFromOffering: el formulario prellenado con un curso ya creado.
// `course` es el objeto que entrega CourseOfferingsContext (con precio, visibilidad, etc.).
export const courseToForm = (course) => ({
  ...emptyCourseForm(),
  title: course.title || '',
  cardTitle1: course.cardTitle?.[0] || '',
  cardTitle2: course.cardTitle?.[1] || '',
  cardDesc: course.cardDesc || '',
  cat: course.cat || CATEGORIES[0].id,
  level: course.level || LEVELS[0],
  badge: course.badge || 'Ninguna',
  cover: course.imageUrl ? { url: course.imageUrl, name: 'Portada actual' } : null,
  videoUrl: course.videoUrl || '',
  summary: course.summary || '',
  outcomeHeadline: course.outcomeHeadline || '',
  description: course.description || '',
  doable: (course.doableList || []).join('\n'),
  projectFinal: course.projectFinal || '',
  intro: (course.longDescription || []).join('\n\n'),
  modules: (course.modules || []).map((m) => ({
    title: m.title || '',
    week: m.week || '',
    desc: m.desc || '',
    deliverable: m.deliverable || '',
  })),
  durationWeeks: parseInt(course.duration, 10) || '',
  sessionsPerWeek: course.sessionsPerWeek || '',
  sessionHours: course.sessionHours || '',
  price: course.price ?? '',
  promoPercent: course.promoPercent ?? '',
  visible: course.visible !== false,
  enrollmentsOpen: course.enrollmentsOpen !== false,
  draft: !!course.draft,
});
