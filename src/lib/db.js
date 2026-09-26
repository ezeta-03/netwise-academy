import { db, storage } from './firebase';
import { collection, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy, where, runTransaction } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { COURSES, CATEGORIES, LIVE_SESSIONS } from './data';

// Determine env (Firebase valid vs Mock)
const isConfigValid = !db.app.options.apiKey.includes('DummyKey');

/**
 * Repository layer for Database interactions.
 * In a real application, these will query Firestore mapping collections `courses`, `users`, etc.
 */

export const fetchCourses = async () => {
  if (!isConfigValid) {
    // Simulator
    return new Promise((resolve) => {
      setTimeout(() => resolve(COURSES), 400);
    });
  }

  // Real Firestore integration
  const querySnapshot = await getDocs(collection(db, "courses"));
  const courses = [];
  querySnapshot.forEach((doc) => {
    courses.push({ id: doc.id, ...doc.data() });
  });
  return courses;
};

export const fetchCourseById = async (courseId) => {
  if (!isConfigValid) {
    return new Promise((resolve) => {
      const course = COURSES.find(c => c.id.toString() === courseId.toString());
      setTimeout(() => resolve(course || null), 300);
    });
  }

  const docRef = doc(db, "courses", courseId.toString());
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  } else {
    throw new Error('Course not found');
  }
};

export const fetchCategories = async () => {
  if (!isConfigValid) {
    return new Promise(resolve => setTimeout(() => resolve(CATEGORIES), 200));
  }
  
  // Real logic...
  const querySnapshot = await getDocs(collection(db, "categories"));
  const cats = [];
  querySnapshot.forEach((doc) => {
    cats.push({ id: doc.id, ...doc.data() });
  });
  return cats;
};

// --- Clases en vivo (colección Firestore `liveSessions`) ---

export const fetchLiveSessions = async () => {
  if (!isConfigValid) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(LIVE_SESSIONS), 300);
    });
  }

  const q = query(collection(db, 'liveSessions'), orderBy('startsAt', 'asc'));
  const querySnapshot = await getDocs(q);
  const sessions = [];
  querySnapshot.forEach((doc) => {
    sessions.push({ id: doc.id, ...doc.data() });
  });
  return sessions;
};

export const fetchLiveSessionById = async (sessionId) => {
  if (!isConfigValid) {
    return new Promise((resolve) => {
      const session = LIVE_SESSIONS.find(s => s.id === sessionId);
      setTimeout(() => resolve(session || null), 200);
    });
  }

  const docRef = doc(db, 'liveSessions', sessionId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

// `groupId` + `generated` marcan las clases que el sistema genera para un aula
// (ver lib/scheduleSync.js): así, al editar el aula solo se ajustan ESAS clases
// y nunca las que el docente programó a mano.
export const scheduleLiveSession = async ({ courseId, courseTitle, title, instructor, instructorUid, startsAt, durationMin, groupId, generated }) => {
  const roomName = `netwise-academy-${courseId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const payload = { courseId, courseTitle, title, instructor, instructorUid, startsAt, durationMin, roomName, status: 'upcoming' };
  if (groupId) payload.groupId = groupId;
  if (generated) payload.generated = true;

  if (!isConfigValid) {
    return new Promise((resolve) => {
      const newSession = { id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...payload };
      LIVE_SESSIONS.push(newSession);
      setTimeout(() => resolve(newSession), 300);
    });
  }

  const docRef = await addDoc(collection(db, 'liveSessions'), payload);
  return { id: docRef.id, ...payload };
};

// Cancelar = baja "suave": el registro se conserva (con status 'cancelled')
// para que quien ya la tenía agendada vea que se canceló en vez de que
// desaparezca sin explicación. Eliminar = borra el doc por completo, para
// limpiar clases ya finalizadas/canceladas que ya no aportan nada.
export const cancelLiveSession = async (sessionId) => {
  if (!isConfigValid) {
    const session = LIVE_SESSIONS.find((s) => s.id === sessionId);
    if (session) session.status = 'cancelled';
    return;
  }
  await updateDoc(doc(db, 'liveSessions', sessionId), { status: 'cancelled' });
};

// Cambia campos de una clase existente (ej. el docente cuando se reasigna el aula).
export const updateLiveSession = async (sessionId, patch) => {
  if (!isConfigValid) {
    const session = LIVE_SESSIONS.find((s) => s.id === sessionId);
    if (session) Object.assign(session, patch);
    return;
  }
  await updateDoc(doc(db, 'liveSessions', sessionId), patch);
};

export const deleteLiveSession = async (sessionId) => {
  if (!isConfigValid) {
    const idx = LIVE_SESSIONS.findIndex((s) => s.id === sessionId);
    if (idx !== -1) LIVE_SESSIONS.splice(idx, 1);
    return;
  }
  await deleteDoc(doc(db, 'liveSessions', sessionId));
};

// --- Usuarios y roles (colección Firestore `users`, creada por AuthContext) ---

export const fetchAllUsers = async () => {
  if (!isConfigValid) return null; // AdminDashboard conserva su lista de demo local

  const querySnapshot = await getDocs(collection(db, 'users'));
  const users = [];
  querySnapshot.forEach((doc) => {
    users.push({ uid: doc.id, ...doc.data() });
  });
  return users;
};

export const updateUserRole = async (uid, role) => {
  if (!isConfigValid) return; // no-op en modo demo/mock
  await setDoc(doc(db, 'users', uid), { role }, { merge: true });
};

// Tutoriales ya vistos por el usuario (`users/{uid}.toursSeen.<clave>` =
// fecha). Se guarda en el perfil para que no reaparezca en otro dispositivo;
// localStorage es solo una copia rápida para no parpadear al cargar.
const tourCacheKey = (uid, key) => `nw_tour_${key}_${uid}`;

export const hasSeenTour = async (uid, key) => {
  try {
    if (localStorage.getItem(tourCacheKey(uid, key))) return true;
  } catch { /* almacenamiento bloqueado: se consulta Firestore */ }
  if (!isConfigValid) return false;
  const snap = await getDoc(doc(db, 'users', uid));
  const seen = !!snap.data()?.toursSeen?.[key];
  if (seen) { try { localStorage.setItem(tourCacheKey(uid, key), '1'); } catch { /* sin caché */ } }
  return seen;
};

export const markTourSeen = async (uid, key) => {
  try { localStorage.setItem(tourCacheKey(uid, key), '1'); } catch { /* sin caché */ }
  if (!isConfigValid) return;
  await setDoc(doc(db, 'users', uid), { toursSeen: { [key]: new Date().toISOString() } }, { merge: true });
};

// Bloquea/desbloquea el acceso de una cuenta (ver AuthContext: si
// `disabled` es true, se cierra su sesión apenas inicia y no puede volver a
// entrar mientras siga así). No borra nada -- es la forma real de "dar de
// baja" a alguien sin tocar su cuenta de Firebase Auth.
export const updateUserStatus = async (uid, disabled) => {
  if (!isConfigValid) return;
  await setDoc(doc(db, 'users', uid), { disabled }, { merge: true });
};

// Borra el perfil/rol de Firestore (Admin > Equipo y permisos, limpiar
// cuentas de prueba). Esto NO borra la cuenta de Firebase Auth -- si esa
// persona vuelve a iniciar sesión, `ensureUserProfile` le crea un perfil
// nuevo como 'student' (ver AuthContext). Para bloquear de verdad el
// acceso, usar updateUserStatus (disabled) en vez de esto.
export const deleteUserProfile = async (uid) => {
  if (!isConfigValid) return;
  await deleteDoc(doc(db, 'users', uid));
};

// --- Preinscripciones (colección Firestore `preregistrations`) ---
// Los 4 talleres todavía no tienen precio ni fecha de inicio confirmados, así
// que "Preinscribirme" no puede ser una compra real todavía. Lo que sí
// podemos hacer ahora es dejar registrado el interés del alumno para poder
// avisarle apenas se abra la cohorte -- doc id = `${uid}_${courseId}` para
// que un mismo alumno no quede duplicado si hace clic más de una vez.

export const fetchMyPreregistrations = async (uid) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem(`mock_preregistrations_${uid}`);
    return raw ? JSON.parse(raw) : [];
  }

  const q = query(collection(db, 'preregistrations'), where('uid', '==', uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data().courseId);
};

export const preregisterInterest = async (uid, course, user) => {
  const payload = {
    uid,
    courseId: course.id,
    courseTitle: course.title,
    name: user.displayName || user.email,
    email: user.email,
    createdAt: new Date().toISOString(),
  };

  if (!isConfigValid) {
    const key = `mock_preregistrations_${uid}`;
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    if (!current.includes(course.id)) {
      current.push(course.id);
      localStorage.setItem(key, JSON.stringify(current));
    }
    return payload;
  }

  await setDoc(doc(db, 'preregistrations', `${uid}_${course.id}`), payload);
  return payload;
};

// --- Apertura de cohorte (colección Firestore `courseOfferings`) ---
// El contenido del taller (título, descripción, highlights) sigue viviendo
// en data.js -- lo que decide el Admin acá es solo si el taller ya tiene
// precio y fecha de inicio confirmados ("abrir la cohorte"). Se guarda
// aparte, en un doc por curso, para no mezclar contenido editorial con una
// decisión de negocio.

export const fetchCourseOfferings = async () => {
  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_course_offerings');
    return raw ? JSON.parse(raw) : {};
  }

  const querySnapshot = await getDocs(collection(db, 'courseOfferings'));
  const offerings = {};
  querySnapshot.forEach((d) => {
    offerings[d.id] = d.data();
  });
  return offerings;
};

export const updateCourseOffering = async (courseId, { price, startDate }, adminUid) => {
  const payload = {
    price: price === '' || price == null ? null : Number(price),
    startDate: startDate || null,
    updatedAt: new Date().toISOString(),
    updatedBy: adminUid,
  };
  return patchCourseOffering(courseId, payload);
};

// Visibilidad en la web, apertura de inscripciones y promoción -- controles
// de "Cursos y precios" en el Admin. Un patch parcial: cada toggle solo
// manda el campo que cambió, sin pisar el resto de la oferta.
export const updateCourseVisibility = (courseId, visible) => patchCourseOffering(courseId, { visible });
export const updateCourseEnrollmentsOpen = (courseId, enrollmentsOpen) => patchCourseOffering(courseId, { enrollmentsOpen });
export const updateCoursePromo = (courseId, promoPercent) => patchCourseOffering(courseId, { promoPercent: promoPercent === '' || promoPercent == null ? null : Number(promoPercent) });
// Docente a cargo del curso -- filtra lo que ve ese docente en su panel
// (Mis cursos, dashboard, agenda). Un admin sigue viendo todos los cursos.
export const updateCourseTeacher = (courseId, teacherUid) => patchCourseOffering(courseId, { teacherUid: teacherUid || null });
// Horario público del curso (ficha /course/:id y programa descargable): lo
// copia Admin > Aulas al guardar un aula abierta, porque `groups` solo lo lee
// un usuario con sesión. `slots` = [{ day, start, end }] o null para volver al
// horario de data.js.
export const updateCourseSchedule = (courseId, slots) => patchCourseOffering(courseId, {
  schedule: slots?.length ? slots.map(({ day, start, end }) => ({ day, start, end })) : null,
});

const patchCourseOffering = async (courseId, patch) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_course_offerings');
    const map = raw ? JSON.parse(raw) : {};
    map[courseId] = { ...map[courseId], ...patch };
    localStorage.setItem('mock_course_offerings', JSON.stringify(map));
    return map[courseId];
  }

  await setDoc(doc(db, 'courseOfferings', courseId.toString()), patch, { merge: true });
  return patch;
};

// --- Contenido real de cada taller (colección Firestore `courseContent`) ---
// Módulos y lecciones que el docente arma para un curso específico -- lo que
// ve el estudiante en el reproductor. Antes esto era un temario genérico
// (CURRICULUM_DATA) idéntico para los 4 cursos, sin conexión a nada real.
// Cada lección guarda un link de video (YouTube/Vimeo) en vez de un archivo
// propio, porque el proyecto no tiene Firebase Storage habilitado.

const EMPTY_COURSE_CONTENT = { modules: [] };

export const fetchCourseContent = async (courseId) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem(`mock_course_content_${courseId}`);
    return raw ? JSON.parse(raw) : EMPTY_COURSE_CONTENT;
  }

  const docRef = doc(db, 'courseContent', courseId.toString());
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : EMPTY_COURSE_CONTENT;
};

export const saveCourseContent = async (courseId, modules, teacherUid) => {
  const payload = { modules, updatedAt: new Date().toISOString(), updatedBy: teacherUid };
  // Copia pública sin links de video ni materiales -- ver `fetchCourseSummary`.
  const summary = { modules: modules.map((m) => ({ id: m.id, title: m.title, weeksLabel: m.weeksLabel || '' })) };

  if (!isConfigValid) {
    localStorage.setItem(`mock_course_content_${courseId}`, JSON.stringify(payload));
    localStorage.setItem(`mock_course_summary_${courseId}`, JSON.stringify(summary));
    return payload;
  }

  await setDoc(doc(db, 'courseContent', courseId.toString()), payload);
  await setDoc(doc(db, 'courseSummaries', courseId.toString()), summary);
  return payload;
};

// Rúbrica de evaluación del curso (ver TeacherCourseRubrica.jsx) -- una sola
// por curso, exclusiva del docente. `status` es 'pending' | 'validated'
// (si coordinación ya la revisó).
const EMPTY_COURSE_RUBRIC = { criteria: [], status: 'pending' };

export const fetchCourseRubric = async (courseId) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem(`mock_course_rubric_${courseId}`);
    return raw ? JSON.parse(raw) : EMPTY_COURSE_RUBRIC;
  }
  const docRef = doc(db, 'courseRubrics', courseId.toString());
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : EMPTY_COURSE_RUBRIC;
};

export const saveCourseRubric = async (courseId, rubric, teacherUid) => {
  const payload = { ...rubric, updatedAt: new Date().toISOString(), updatedBy: teacherUid };
  if (!isConfigValid) {
    localStorage.setItem(`mock_course_rubric_${courseId}`, JSON.stringify(payload));
    return payload;
  }
  await setDoc(doc(db, 'courseRubrics', courseId.toString()), payload);
  return payload;
};

// Versión pública del temario (solo título y semanas de cada módulo, sin
// links de video ni materiales) -- para mostrar el programa a un visitante
// sin sesión en /course/:id, donde puede descargarlo dejando su contacto
// (ver DownloadProgramModal). `courseContent` sigue exigiendo login porque
// trae los links de las clases grabadas.
export const fetchCourseSummary = async (courseId) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem(`mock_course_summary_${courseId}`);
    return raw ? JSON.parse(raw) : EMPTY_COURSE_CONTENT;
  }

  const docRef = doc(db, 'courseSummaries', courseId.toString());
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : EMPTY_COURSE_CONTENT;
};

// --- Inscripciones y progreso reales (colección Firestore `enrollments`) ---
// A diferencia de `enrolled`/`progress` en COURSES (compartido entre TODOS
// los estudiantes y nunca actualizado por nada), esto es un doc por
// alumno+curso -- lo que permite que "Mi Aprendizaje" y "Marcar completada"
// reflejen el avance real de cada estudiante en cada curso.

export const fetchMyEnrollments = async (uid) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem(`mock_enrollments_${uid}`);
    return raw ? JSON.parse(raw) : {};
  }

  const q = query(collection(db, 'enrollments'), where('uid', '==', uid));
  const snapshot = await getDocs(q);
  const map = {};
  snapshot.forEach((d) => { map[d.data().courseId] = d.data(); });
  return map;
};

// Solo las matrículas que dan acceso: 'pending' (pago o alta sin confirmar)
// todavía no cuenta para cursos, agenda ni entregas del alumno.
export const isActiveEnrollment = (e) => !!e && (e.status || 'active') === 'active';

export const fetchMyActiveEnrollments = async (uid) => {
  const map = await fetchMyEnrollments(uid);
  return Object.fromEntries(Object.entries(map).filter(([, e]) => isActiveEnrollment(e)));
};

// --- Todas las inscripciones, para el Admin (colección `enrollments`) ---
// A diferencia de fetchMyEnrollments (filtrado por uid), esto trae TODOS
// los registros de todos los alumnos, para "Alumnos y accesos".

// `courseIds` (opcional, un id o una lista): trae solo las matrículas de esos
// cursos. Un docente SIEMPRE debe pasarlo con los cursos que le asignaron --
// las reglas de Firestore solo le dejan leer matrículas de sus cursos; sin
// filtro (Admin) trae todas.
export const fetchAllEnrollments = async (courseIds) => {
  const wanted = courseIds === undefined || courseIds === null ? null : (Array.isArray(courseIds) ? courseIds : [courseIds]).map((c) => c.toString());
  if (!isConfigValid) {
    const rows = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('mock_enrollments_')) {
        const map = JSON.parse(localStorage.getItem(key) || '{}');
        Object.values(map).forEach((e) => rows.push(e));
      }
    }
    return wanted ? rows.filter((e) => wanted.includes(e.courseId?.toString())) : rows;
  }

  if (wanted) {
    if (wanted.length === 0) return [];
    // El courseId se guardó con el mismo tipo que trae el curso (número en
    // los cursos actuales): se consulta con ese tipo, no como texto.
    const typed = (Array.isArray(courseIds) ? courseIds : [courseIds]);
    const snaps = await Promise.all(typed.map((c) => getDocs(query(collection(db, 'enrollments'), where('courseId', '==', c)))));
    return snaps.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
  const snapshot = await getDocs(collection(db, 'enrollments'));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// Compañeros de un mismo curso, para un ALUMNO (ej. armar una sala privada de
// estudio) -- a diferencia de fetchAllEnrollments, esto solo trae las
// matrículas de un curso puntual: un alumno no puede leer todas las
// matrículas de la plataforma (ver regla de `enrollments`), pero sí las de su
// propio curso, siempre que también esté matriculado ahí.
export const fetchCourseClassmates = async (courseId) => {
  if (!isConfigValid) {
    const rows = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('mock_enrollments_')) {
        const map = JSON.parse(localStorage.getItem(key) || '{}');
        if (map[courseId]) rows.push(map[courseId]);
      }
    }
    return rows;
  }

  const q = query(collection(db, 'enrollments'), where('courseId', '==', courseId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// Alta manual de matrícula desde el Admin (ej. pago fuera de línea) --
// (única vía de matrícula: las reglas no dejan que un alumno se matricule solo)
// porque acá el admin puede dejarla "pending" para validar luego.
export const adminCreateEnrollment = async ({ uid, studentName, studentEmail, courseId, courseTitle, groupId, groupName, status, reason }) => {
  const payload = {
    uid: uid || `manual-${Date.now()}`,
    studentName, studentEmail, courseId, courseTitle,
    groupId: groupId || null, groupName: groupName || null,
    status: status || 'active', reason: reason || 'Matrícula manual',
    completedLessonIds: [], progress: 0,
    enrolledAt: new Date().toISOString(),
  };

  if (!isConfigValid) {
    const key = `mock_enrollments_${payload.uid}`;
    const map = JSON.parse(localStorage.getItem(key) || '{}');
    map[courseId] = payload;
    localStorage.setItem(key, JSON.stringify(map));
    return payload;
  }

  // Un alumno con cuenta usa el id determinístico `${uid}_${courseId}` (el mismo
  // de markLessonComplete): así hay una sola matrícula por
  // alumno+curso y las reglas le dejan ver a sus compañeros. Un alta manual sin
  // cuenta (uid `manual-...`) sigue con id automático.
  const ref = uid ? doc(db, 'enrollments', `${uid}_${courseId}`) : doc(collection(db, 'enrollments'));
  if (uid) {
    // Si el alumno ya tenía matrícula, no se le borra el avance.
    const existing = await getDoc(ref);
    if (existing.exists()) {
      const rest = { ...payload };
      ['completedLessonIds', 'progress', 'enrolledAt'].forEach((k) => delete rest[k]);
      await setDoc(ref, rest, { merge: true });
      return { id: ref.id, ...existing.data(), ...rest };
    }
  }
  await setDoc(ref, payload);
  return { id: ref.id, ...payload };
};

export const updateEnrollmentAccess = async (enrollmentId, uid, courseId, { status, groupId, groupName, reason }) => {
  const patch = { status, groupId: groupId || null, groupName: groupName || null, reason };

  if (!isConfigValid) {
    const key = `mock_enrollments_${uid}`;
    const map = JSON.parse(localStorage.getItem(key) || '{}');
    if (map[courseId]) {
      map[courseId] = { ...map[courseId], ...patch };
      localStorage.setItem(key, JSON.stringify(map));
    }
    return;
  }

  await updateDoc(doc(db, 'enrollments', enrollmentId), patch);
};

// Borra una matrícula (ej. datos de prueba desde Admin > Alumnos y accesos).
// En mock mode el doc vive dentro del mapa `mock_enrollments_${uid}`, sin id
// propio -- se borra por uid+courseId en vez de por `id`.
export const deleteEnrollment = async ({ id, uid, courseId }) => {
  if (!isConfigValid) {
    const key = `mock_enrollments_${uid}`;
    const map = JSON.parse(localStorage.getItem(key) || '{}');
    delete map[courseId];
    localStorage.setItem(key, JSON.stringify(map));
    return;
  }
  await deleteDoc(doc(db, 'enrollments', id));
};

export const markLessonComplete = async (uid, courseId, lessonId, totalLessons) => {
  if (!isConfigValid) {
    const key = `mock_enrollments_${uid}`;
    const map = JSON.parse(localStorage.getItem(key) || '{}');
    const current = map[courseId] || { uid, courseId, completedLessonIds: [], progress: 0 };
    const completedLessonIds = current.completedLessonIds.includes(lessonId)
      ? current.completedLessonIds
      : [...current.completedLessonIds, lessonId];
    const progress = totalLessons > 0 ? Math.round((completedLessonIds.length / totalLessons) * 100) : 0;
    map[courseId] = { ...current, completedLessonIds, progress };
    localStorage.setItem(key, JSON.stringify(map));
    return map[courseId];
  }

  // Solo actualiza una matrícula que ya existe: la crea el admin al validar
  // el pago (las reglas no dejan que un alumno se matricule solo).
  const ref = doc(db, 'enrollments', `${uid}_${courseId}`);
  const existing = await getDoc(ref);
  if (!existing.exists()) return null;
  const current = existing.data();
  const completedLessonIds = (current.completedLessonIds || []).includes(lessonId)
    ? current.completedLessonIds
    : [...(current.completedLessonIds || []), lessonId];
  const progress = totalLessons > 0 ? Math.round((completedLessonIds.length / totalLessons) * 100) : 0;
  const payload = { uid, courseId, completedLessonIds, progress, updatedAt: new Date().toISOString() };
  await setDoc(ref, payload, { merge: true });
  return payload;
};

// --- Historial de cambios (colección Firestore `auditLog`) ---
// Un registro simple de "quién hizo qué" en el Admin -- no es un sistema de
// auditoría con antes/después, solo una bitácora legible para el equipo.

export const fetchAuditLog = async () => {
  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_audit_log');
    return raw ? JSON.parse(raw) : [];
  }
  const q = query(collection(db, 'auditLog'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const logChange = async (actor, message) => {
  const payload = { actor: actor || 'Admin', message, createdAt: new Date().toISOString() };

  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_audit_log');
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({ id: `mock-${Date.now()}`, ...payload });
    localStorage.setItem('mock_audit_log', JSON.stringify(list.slice(0, 200)));
    return;
  }

  await addDoc(collection(db, 'auditLog'), payload);
};

// --- Cupones (colección Firestore `coupons`) ---

export const fetchCoupons = async () => {
  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_coupons');
    return raw ? JSON.parse(raw) : [];
  }
  const snapshot = await getDocs(collection(db, 'coupons'));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const createCoupon = async (coupon) => {
  const payload = { usedCount: 0, active: true, createdAt: new Date().toISOString(), ...coupon };

  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_coupons');
    const list = raw ? JSON.parse(raw) : [];
    const withId = { id: `mock-${Date.now()}`, ...payload };
    list.push(withId);
    localStorage.setItem('mock_coupons', JSON.stringify(list));
    return withId;
  }

  const ref = await addDoc(collection(db, 'coupons'), payload);
  return { id: ref.id, ...payload };
};

export const updateCoupon = async (couponId, patch) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_coupons');
    const list = raw ? JSON.parse(raw) : [];
    const next = list.map((c) => (c.id === couponId ? { ...c, ...patch } : c));
    localStorage.setItem('mock_coupons', JSON.stringify(next));
    return;
  }
  await updateDoc(doc(db, 'coupons', couponId), patch);
};

// --- Aulas / grupos (colección Firestore `groups`) ---
// Una "aula" es una edición concreta de un curso: fechas, horario, docente y
// cupo. Un mismo curso puede tener varias aulas abiertas a la vez.

export const fetchGroups = async () => {
  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_groups');
    return raw ? JSON.parse(raw) : [];
  }
  const snapshot = await getDocs(collection(db, 'groups'));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const createGroup = async (group) => {
  const payload = { enrolledCount: 0, status: 'open', createdAt: new Date().toISOString(), ...group };

  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_groups');
    const list = raw ? JSON.parse(raw) : [];
    const withId = { id: `mock-${Date.now()}`, ...payload };
    list.push(withId);
    localStorage.setItem('mock_groups', JSON.stringify(list));
    return withId;
  }

  const ref = await addDoc(collection(db, 'groups'), payload);
  return { id: ref.id, ...payload };
};

export const updateGroup = async (groupId, patch) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_groups');
    const list = raw ? JSON.parse(raw) : [];
    const next = list.map((g) => (g.id === groupId ? { ...g, ...patch } : g));
    localStorage.setItem('mock_groups', JSON.stringify(next));
    return;
  }
  await updateDoc(doc(db, 'groups', groupId), patch);
};

export const deleteGroup = async (groupId) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_groups');
    const list = raw ? JSON.parse(raw) : [];
    localStorage.setItem('mock_groups', JSON.stringify(list.filter((g) => g.id !== groupId)));
    return;
  }
  await deleteDoc(doc(db, 'groups', groupId));
};

// --- Pedidos (colección Firestore `orders`) ---
// Un registro por cada pago cobrado (Culqi u otro medio). Las matrículas
// gratuitas o preinscripciones no generan pedido -- solo lo que sí cobra.

export const fetchOrders = async () => {
  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_orders');
    return raw ? JSON.parse(raw) : [];
  }
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// Pedidos de UN alumno -- a diferencia de fetchOrders (solo Admin, trae
// todos), esto lo usa el propio checkout para ver si ya tiene un pedido
// 'pending' de este curso antes de dejarlo pagar de nuevo (ver Checkout.jsx).
export const fetchMyOrders = async (uid) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_orders');
    const list = raw ? JSON.parse(raw) : [];
    return list.filter((o) => o.uid === uid);
  }
  const q = query(collection(db, 'orders'), where('uid', '==', uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// Comprobante de pago (captura de Yape/Plin o transferencia) que el alumno
// adjunta al pagar con un método manual -- es la "evidencia" que el admin
// revisa en Ventas antes de aprobar (ver AdminVentas.jsx). Sin proyecto
// Firebase real (modo mock) no hay Storage, así que se guarda como
// data URL directamente en el pedido -- vive solo en este navegador, igual
// que el resto de datos mock.
export const uploadPaymentProof = async (uid, courseId, file) => {
  if (!isConfigValid) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.readAsDataURL(file);
    });
  }
  const path = `paymentProofs/${uid}/${courseId}_${Date.now()}_${file.name}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file);
  return getDownloadURL(ref);
};

// Archivo del entregable que presenta el alumno (Alumno > Evaluación y
// Proyecto). Va en la carpeta del propio alumno: storage.rules solo le deja
// escribir ahí; el docente lo abre con el link de descarga guardado en la
// entrega. En modo mock se guarda como data URL, igual que los comprobantes.
export const uploadSubmissionFile = async (uid, courseId, moduleId, file) => {
  if (!isConfigValid) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.readAsDataURL(file);
    });
  }
  const safeName = file.name.replace(/[^\w.-]+/g, '_');
  const path = `submissions/${uid}/${courseId}_${moduleId}_${Date.now()}_${safeName}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: file.type });
  return getDownloadURL(ref);
};

// Archivo que el docente sube para "Materiales de este módulo" (PDF/DOCX/PPT)
// -- misma idea que uploadPaymentProof: en modo mock no hay Storage, así que
// se guarda como data URL en localStorage junto con el resto del contenido.
export const uploadCourseMaterial = async (courseId, moduleId, file) => {
  if (!isConfigValid) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.readAsDataURL(file);
    });
  }
  const path = `courseMaterials/${courseId}/${moduleId}_${Date.now()}_${file.name}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file);
  return getDownloadURL(ref);
};

export const createOrder = async ({ uid, studentName, studentEmail, courseId, courseTitle, amount, status, paymentMethod, couponId, couponCode, proofCode, proofUrl }) => {
  const base = {
    uid, studentName, studentEmail: studentEmail || null, courseId, courseTitle, amount,
    paymentMethod: paymentMethod || null,
    couponId: couponId || null,
    couponCode: couponCode || null,
    proofCode: proofCode || null,
    proofUrl: proofUrl || null,
    status: status || 'paid',
    createdAt: new Date().toISOString(),
  };

  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_orders');
    const list = raw ? JSON.parse(raw) : [];
    const id = `mock-${Date.now()}`;
    const withId = { id, code: `NW-${id.slice(-6).toUpperCase()}`, ...base };
    list.push(withId);
    localStorage.setItem('mock_orders', JSON.stringify(list));
    return withId;
  }

  // Antes el código de pedido salía de `fetchOrders().length` -- una
  // lectura SIN filtro de toda la colección `orders`, que un alumno
  // (no-admin) no puede hacer según las reglas de Firestore (allow read:
  // solo su propio uid o admin). Eso tumbaba TODO pago real con
  // "permission-denied" apenas alguien intentaba comprar. En vez de leer
  // la colección, se arma el código a partir del ID que Firestore ya
  // genera para el doc -- no hace falta ninguna lectura previa.
  const ref = doc(collection(db, 'orders'));
  const payload = { code: `NW-${ref.id.slice(0, 6).toUpperCase()}`, ...base };
  await setDoc(ref, payload);
  return { id: ref.id, ...payload };
};

// Cambia el estado de un pedido -- hoy solo lo usa approveOrder (pending ->
// paid), separado por si el admin necesita ajustar el estado desde Ventas.
export const updateOrderStatus = async (orderId, status) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_orders');
    const list = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((o) => o.id === orderId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], status };
      localStorage.setItem('mock_orders', JSON.stringify(list));
    }
    return;
  }
  await updateDoc(doc(db, 'orders', orderId), { status });
};

// Aprobación manual de un pedido con pago pendiente (Yape/Transferencia):
// el admin confirma que llegó el comprobante, así que recién acá se
// matricula al alumno (adminCreateEnrollment, igual que cualquier alta
// manual desde Admin), se canjea el cupón si usó uno (se difiere hasta
// aquí para no gastar el cupón de un pago que nunca se valide) y el
// pedido pasa a 'paid'. Antes de esto el alumno no tenía acceso al curso
// -- ver handlePay en Checkout.jsx.
// El cupón ya se canjeó al crear el pedido (ver handlePay): así los pedidos
// pendientes también cuentan para el tope de usos. `group` (opcional) es el
// aula donde queda matriculado.
export const approveOrder = async (order, group = null) => {
  await adminCreateEnrollment({
    uid: order.uid,
    studentName: order.studentName,
    studentEmail: order.studentEmail || null,
    courseId: order.courseId,
    courseTitle: order.courseTitle,
    groupId: group?.id || null,
    groupName: group?.name || null,
    status: 'active',
    reason: `Pago validado manualmente (pedido ${order.code})`,
  });
  await updateOrderStatus(order.id, 'paid');
};

// --- Equipo de la academia (colección Firestore `teamMembers`) ---
// Directorio de quién participa y qué módulos podría administrar -- es una
// propuesta de alcance, no un sistema de permisos que bloquea acciones. El
// cambio de rol real (student/teacher/admin) sigue viviendo en `users`
// (ver fetchAllUsers/updateUserRole), porque de ahí depende el acceso real
// a rutas protegidas de la plataforma.

export const fetchTeamMembers = async () => {
  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_team_members');
    return raw ? JSON.parse(raw) : [];
  }
  const snapshot = await getDocs(collection(db, 'teamMembers'));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const createTeamMember = async (member) => {
  const payload = { status: 'active', createdAt: new Date().toISOString(), ...member };

  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_team_members');
    const list = raw ? JSON.parse(raw) : [];
    const withId = { id: `mock-${Date.now()}`, ...payload };
    list.push(withId);
    localStorage.setItem('mock_team_members', JSON.stringify(list));
    return withId;
  }

  const ref = await addDoc(collection(db, 'teamMembers'), payload);
  return { id: ref.id, ...payload };
};

export const updateTeamMember = async (memberId, patch) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_team_members');
    const list = raw ? JSON.parse(raw) : [];
    const next = list.map((m) => (m.id === memberId ? { ...m, ...patch } : m));
    localStorage.setItem('mock_team_members', JSON.stringify(next));
    return;
  }
  await updateDoc(doc(db, 'teamMembers', memberId), patch);
};

// --- Configuración de la academia (doc único Firestore `settings/academy`) ---

const DEFAULT_ACADEMY_SETTINGS = {
  name: 'Netwise Academy',
  supportEmail: 'hola@netwiseacademy.com',
  currency: 'PEN',
  timezone: 'America/Lima',
  // Métodos de pago del checkout -- "yape" y "transfer" son manuales (el
  // comprador paga afuera y el equipo confirma), por eso llevan el número y
  // nombre de cuenta donde debe pagar (con eso el checkout arma el mensaje
  // solo, ya con el monto exacto) más una nota libre opcional; "card" es el
  // único con formulario propio.
  paymentMethods: {
    yape: { enabled: true, number: '', accountName: '', note: '' },
    // Sin pasarela conectada todavía: no se ofrece en el checkout (ver
    // PAYMENT_METHODS.card.requiresGateway).
    card: { enabled: false },
    transfer: { enabled: false, number: '', accountName: '', note: '' },
  },
};

// El spread de nivel superior no alcanza para `paymentMethods`: si el doc
// guardado ya tiene esa llave, la reemplaza entera en vez de completarla --
// así, un método de pago agregado a DEFAULT_ACADEMY_SETTINGS más adelante
// nunca aparecería en una academia que ya guardó su configuración una vez.
const mergeAcademySettings = (saved) => ({
  ...DEFAULT_ACADEMY_SETTINGS,
  ...saved,
  paymentMethods: { ...DEFAULT_ACADEMY_SETTINGS.paymentMethods, ...saved?.paymentMethods },
});

export const fetchAcademySettings = async () => {
  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_academy_settings');
    return raw ? mergeAcademySettings(JSON.parse(raw)) : DEFAULT_ACADEMY_SETTINGS;
  }
  const docSnap = await getDoc(doc(db, 'settings', 'academy'));
  return docSnap.exists() ? mergeAcademySettings(docSnap.data()) : DEFAULT_ACADEMY_SETTINGS;
};

export const saveAcademySettings = async (settings) => {
  if (!isConfigValid) {
    localStorage.setItem('mock_academy_settings', JSON.stringify(settings));
    return settings;
  }
  await setDoc(doc(db, 'settings', 'academy'), settings, { merge: true });
  return settings;
};

// --- Entregas de un módulo (colección Firestore `submissions`) ---
// Un doc por alumno+módulo. El alumno presenta un archivo (Storage, ver
// uploadSubmissionFile) y/o un link o descripción (`note`); el docente la
// califica en el mismo doc.

// `uid` (opcional): trae solo las entregas de ese alumno. Un alumno SIEMPRE
// debe pasarlo -- las reglas de Firestore solo le dejan leer las suyas.
export const fetchSubmissions = async (courseId, moduleId, uid) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem(`mock_submissions_${courseId}_${moduleId}`);
    const list = raw ? JSON.parse(raw) : [];
    return uid ? list.filter((s) => s.uid === uid) : list;
  }
  const constraints = [where('courseId', '==', courseId), where('moduleId', '==', moduleId)];
  if (uid) constraints.push(where('uid', '==', uid));
  const q = query(collection(db, 'submissions'), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// Todas las entregas de un curso (los módulos que sean), para el Registro de
// notas y el resumen del aula del docente -- a diferencia de fetchSubmissions
// (un módulo a la vez), esto trae todo en una sola llamada.
export const fetchCourseSubmissions = async (courseId, uid) => {
  if (!isConfigValid) {
    const prefix = `mock_submissions_${courseId}_`;
    const rows = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        rows.push(...JSON.parse(localStorage.getItem(key) || '[]'));
      }
    }
    return uid ? rows.filter((s) => s.uid === uid) : rows;
  }
  const constraints = [where('courseId', '==', courseId)];
  if (uid) constraints.push(where('uid', '==', uid));
  const q = query(collection(db, 'submissions'), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const upsertSubmission = async ({ courseId, moduleId, moduleTitle, uid, studentName, deliverableTitle, status, note, grade, feedback, file }) => {
  const docId = `${uid}_${courseId}_${moduleId}`;
  const payload = { courseId, moduleId, moduleTitle, uid, studentName, deliverableTitle, status, updatedAt: new Date().toISOString() };
  if (note !== undefined) payload.note = note || '';
  if (grade !== undefined) payload.grade = grade === null || grade === '' ? null : Number(grade);
  if (feedback !== undefined) payload.feedback = feedback || '';
  // `file` ({ url, name } o null) solo lo manda el alumno al presentar: null
  // borra el adjunto anterior si esta vez entregó solo un link.
  if (file !== undefined) { payload.fileUrl = file?.url || null; payload.fileName = file?.name || null; }
  // updatedAt cambia también cuando el docente califica; submittedAt solo
  // cuando el alumno presenta -- es la fecha que sirve para ver atrasos.
  if (status === 'submitted') payload.submittedAt = payload.updatedAt;

  if (!isConfigValid) {
    const key = `mock_submissions_${courseId}_${moduleId}`;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = list.findIndex((s) => s.uid === uid);
    if (idx >= 0) list[idx] = { ...list[idx], ...payload }; else list.push({ id: docId, ...payload });
    localStorage.setItem(key, JSON.stringify(list));
    return payload;
  }

  await setDoc(doc(db, 'submissions', docId), payload, { merge: true });
  return payload;
};

// --- Seguimiento de un alumno en un curso (extiende `enrollments`) ---

export const updateEnrollmentFollowUp = async (enrollmentId, uid, courseId, followUp) => {
  if (!isConfigValid) {
    const key = `mock_enrollments_${uid}`;
    const map = JSON.parse(localStorage.getItem(key) || '{}');
    if (map[courseId]) {
      map[courseId] = { ...map[courseId], followUp };
      localStorage.setItem(key, JSON.stringify(map));
    }
    return;
  }
  await updateDoc(doc(db, 'enrollments', enrollmentId), { followUp });
};

// --- Comunidad de un curso/grupo (colección Firestore `communityPosts`) ---

export const fetchCommunityPosts = async (courseId) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem(`mock_community_${courseId}`);
    return raw ? JSON.parse(raw) : [];
  }
  const q = query(collection(db, 'communityPosts'), where('courseId', '==', courseId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const createCommunityPost = async ({ courseId, groupName, authorName, authorRole, isAnnouncement, title, body }) => {
  const payload = { courseId, groupName, authorName, authorRole, isAnnouncement: !!isAnnouncement, title, body, comments: [], createdAt: new Date().toISOString() };

  if (!isConfigValid) {
    const key = `mock_community_${courseId}`;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const withId = { id: `mock-${Date.now()}`, ...payload };
    list.unshift(withId);
    localStorage.setItem(key, JSON.stringify(list));
    return withId;
  }

  const ref = await addDoc(collection(db, 'communityPosts'), payload);
  return { id: ref.id, ...payload };
};

export const addCommunityComment = async (courseId, postId, comment) => {
  if (!isConfigValid) {
    const key = `mock_community_${courseId}`;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const next = list.map((p) => (p.id === postId ? { ...p, comments: [...(p.comments || []), comment] } : p));
    localStorage.setItem(key, JSON.stringify(next));
    return;
  }
  const ref = doc(db, 'communityPosts', postId);
  const snap = await getDoc(ref);
  const comments = snap.exists() ? (snap.data().comments || []) : [];
  await updateDoc(ref, { comments: [...comments, comment] });
};

// --- Soporte y tutorías (colección Firestore `supportRequests`) ---

export const fetchSupportRequests = async (requesterUid) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem(`mock_support_${requesterUid}`);
    return raw ? JSON.parse(raw) : [];
  }
  const q = query(collection(db, 'supportRequests'), where('requesterUid', '==', requesterUid), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const createSupportRequest = async ({ requesterUid, requesterName, requesterRole, type, courseTitle, groupName, message }) => {
  const payload = {
    requesterUid, requesterName, requesterRole, type, courseTitle: courseTitle || null, groupName: groupName || null,
    message: message || '', status: 'pending', createdAt: new Date().toISOString(),
  };

  if (!isConfigValid) {
    const key = `mock_support_${requesterUid}`;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const withId = { id: `mock-${Date.now()}`, ...payload };
    list.unshift(withId);
    localStorage.setItem(key, JSON.stringify(list));
    return withId;
  }

  const ref = await addDoc(collection(db, 'supportRequests'), payload);
  return { id: ref.id, ...payload };
};

// Todas las solicitudes, para el Admin (a diferencia de fetchSupportRequests,
// que trae solo las de un alumno/docente puntual).
export const fetchAllSupportRequests = async () => {
  if (!isConfigValid) {
    const rows = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('mock_support_')) {
        JSON.parse(localStorage.getItem(key) || '[]').forEach((r) => rows.push(r));
      }
    }
    return rows;
  }
  const q = query(collection(db, 'supportRequests'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const updateSupportRequestStatus = async (requestId, status) => {
  if (!isConfigValid) return;
  await updateDoc(doc(db, 'supportRequests', requestId), { status });
};

// --- Leads del programa descargable (colección `programLeads`) ---
// Captura de contacto antes de descargar el programa de un curso, o interés
// general dejado en el formulario del hero de Inicio (ver HeroLeadPanel) --
// ninguno requiere cuenta, solo deja el interés registrado para seguimiento
// comercial. `source` distingue de dónde vino ('download' vs 'hero').

// Web App de Apps Script que agrega el lead como fila a un Google Sheet --
// ver scripts/google-apps-script/Code.gs para el código a pegar ahí y los
// pasos de instalación. Sin VITE_LEADS_WEBAPP_URL configurada, esto no hace
// nada (el lead igual se guarda en Firestore más abajo).
const LEADS_WEBAPP_URL = import.meta.env.VITE_LEADS_WEBAPP_URL;
const LEADS_WEBAPP_SECRET = import.meta.env.VITE_LEADS_WEBAPP_SECRET;

const sendLeadToSheet = (payload, url = LEADS_WEBAPP_URL, secret = LEADS_WEBAPP_SECRET) => {
  if (!url) return;
  // mode: 'no-cors' porque Apps Script no siempre manda los headers CORS que
  // el navegador exige para LEER la respuesta -- con no-cors el envío sí
  // llega, solo no podemos inspeccionar qué contestó. Content-Type
  // text/plain evita el preflight OPTIONS, que Apps Script no maneja.
  // Best-effort: si falla, no bloquea ni rompe el guardado en Firestore.
  fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...payload, secret: secret || null }),
  }).catch(() => {});
};

// Inscripciones a las masterclass gratuitas (landing /masterclass). Van a su
// PROPIO Google Sheet -- ver scripts/google-apps-script/Masterclass.gs -- y
// a Firestore (`masterclassLeads`) como respaldo: el envío al Sheet es
// no-cors y no se puede confirmar desde el navegador.
const MASTERCLASS_WEBAPP_URL = import.meta.env.VITE_MASTERCLASS_WEBAPP_URL;
const MASTERCLASS_WEBAPP_SECRET = import.meta.env.VITE_MASTERCLASS_WEBAPP_SECRET;

export const captureMasterclassLead = async ({ firstName, lastName, email, whatsapp, masterclasses, marketingConsent, source }) => {
  const now = new Date().toISOString();
  const payload = {
    firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim().toLowerCase(), whatsapp: whatsapp.trim(),
    masterclasses, marketingConsent: !!marketingConsent, termsAcceptedAt: now,
    source: source || 'landing', createdAt: now,
  };

  sendLeadToSheet(payload, MASTERCLASS_WEBAPP_URL, MASTERCLASS_WEBAPP_SECRET);

  if (!isConfigValid) {
    const list = JSON.parse(localStorage.getItem('mock_masterclass_leads') || '[]');
    list.push({ id: `mock-${Date.now()}`, ...payload });
    localStorage.setItem('mock_masterclass_leads', JSON.stringify(list));
    return payload;
  }

  await addDoc(collection(db, 'masterclassLeads'), payload);
  return payload;
};

export const captureProgramLead = async ({ courseId, courseTitle, name, email, phone, marketingConsent, acceptedTerms, source }) => {
  const now = new Date().toISOString();
  const payload = {
    courseId: courseId || null, courseTitle: courseTitle || null, name, email, phone: phone || null,
    source: source || 'download',
    marketingConsent: !!marketingConsent, createdAt: now,
    // Constancia de la casilla de Términos (formularios que la piden, p. ej. el hero).
    ...(acceptedTerms ? { termsAcceptedAt: now } : {}),
  };

  sendLeadToSheet(payload);

  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_program_leads');
    const list = raw ? JSON.parse(raw) : [];
    list.push({ id: `mock-${Date.now()}`, ...payload });
    localStorage.setItem('mock_program_leads', JSON.stringify(list));
    return payload;
  }

  await addDoc(collection(db, 'programLeads'), payload);
  return payload;
};

// --- Teléfono del usuario (extiende `users/{uid}`) ---
// El registro base (AuthContext) solo pide nombre/correo; el checkout de un
// curso también pide WhatsApp, así que se guarda aparte en vez de tocar el
// flujo de registro genérico.

export const saveUserPhone = async (uid, phone) => {
  if (!isConfigValid) {
    localStorage.setItem(`mock_user_phone_${uid}`, phone);
    return;
  }
  await setDoc(doc(db, 'users', uid), { phone }, { merge: true });
};

// --- Canje de un cupón (extiende `coupons`) ---
// Incrementa el contador de usos justo cuando se confirma un pago, no al
// solo validarlo -- así un cupón consultado pero no usado no cuenta.

export const redeemCoupon = async (couponId) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_coupons');
    const list = raw ? JSON.parse(raw) : [];
    const next = list.map((c) => (c.id === couponId ? { ...c, usedCount: (c.usedCount || 0) + 1 } : c));
    localStorage.setItem('mock_coupons', JSON.stringify(next));
    return;
  }
  // Transacción: dos compras simultáneas no pueden leer el mismo contador y
  // pasarse del tope (las reglas además rechazan usedCount > maxUses).
  const ref = doc(db, 'coupons', couponId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('coupon-not-found');
    const { usedCount = 0, maxUses = 0 } = snap.data();
    if (maxUses && usedCount >= maxUses) throw new Error('coupon-limit-reached');
    tx.update(ref, { usedCount: usedCount + 1 });
  });
};

// --- Perfil de negocio del proyecto del alumno (colección `projectProfiles`) ---
// Un doc por alumno+curso: la empresa/marca/idea sobre la que trabaja durante
// todo el curso (se define una sola vez, ver "Mi proyecto" del estudiante).

export const fetchProjectProfile = async (uid, courseId) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem(`mock_project_profile_${uid}_${courseId}`);
    return raw ? JSON.parse(raw) : null;
  }
  const docSnap = await getDoc(doc(db, 'projectProfiles', `${uid}_${courseId}`));
  return docSnap.exists() ? docSnap.data() : null;
};

export const saveProjectProfile = async ({ uid, courseId, courseTitle, name, activity, sector, audience, description }) => {
  const payload = { uid, courseId, courseTitle, name, activity, sector, audience, description, updatedAt: new Date().toISOString() };

  if (!isConfigValid) {
    localStorage.setItem(`mock_project_profile_${uid}_${courseId}`, JSON.stringify(payload));
    return payload;
  }

  await setDoc(doc(db, 'projectProfiles', `${uid}_${courseId}`), payload);
  return payload;
};

// --- Avances de práctica del proyecto (colección `projectAdvances`) ---
// Qué puntos de "Contenidos y práctica" de cada módulo ya marcó el alumno
// como aplicados a su proyecto -- independiente de si el docente ya validó
// el módulo (eso sigue viviendo en `courseContent` -> deliverable.open).

export const fetchProjectAdvances = async (uid, courseId) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem(`mock_project_advances_${uid}_${courseId}`);
    return raw ? JSON.parse(raw) : {};
  }
  const q = query(collection(db, 'projectAdvances'), where('uid', '==', uid), where('courseId', '==', courseId));
  const snapshot = await getDocs(q);
  const map = {};
  snapshot.forEach((d) => { map[d.data().moduleId] = d.data().checkedIndexes || []; });
  return map;
};

export const toggleProjectAdvance = async (uid, courseId, moduleId, bulletIndex) => {
  const docId = `${uid}_${courseId}_${moduleId}`;

  if (!isConfigValid) {
    const key = `mock_project_advances_${uid}_${courseId}`;
    const map = JSON.parse(localStorage.getItem(key) || '{}');
    const current = map[moduleId] || [];
    map[moduleId] = current.includes(bulletIndex) ? current.filter((i) => i !== bulletIndex) : [...current, bulletIndex];
    localStorage.setItem(key, JSON.stringify(map));
    return map[moduleId];
  }

  const ref = doc(db, 'projectAdvances', docId);
  const snap = await getDoc(ref);
  const current = snap.exists() ? (snap.data().checkedIndexes || []) : [];
  const checkedIndexes = current.includes(bulletIndex) ? current.filter((i) => i !== bulletIndex) : [...current, bulletIndex];
  await setDoc(ref, { uid, courseId, moduleId, checkedIndexes }, { merge: true });
  return checkedIndexes;
};

// --- Salas privadas de estudio (colección `privateRooms`) ---
// Espacios de videollamada ad-hoc que un alumno arma con compañeros de su
// mismo curso/grupo -- misma sala real de Jitsi que las clases en vivo, pero
// sin necesitar programación del docente.

export const fetchPrivateRooms = async (courseId) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem(`mock_private_rooms_${courseId}`);
    return raw ? JSON.parse(raw) : [];
  }
  const q = query(collection(db, 'privateRooms'), where('courseId', '==', courseId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const createPrivateRoom = async ({ courseId, courseTitle, groupName, name, createdByUid, createdByName, memberUids, memberNames, groupId }) => {
  const roomName = `netwise-academy-private-${courseId}-${Date.now()}`;
  const payload = {
    courseId, courseTitle, groupName: groupName || null, name, roomName,
    createdByUid, createdByName, memberUids: memberUids || [], memberNames: memberNames || [],
    groupId: groupId || null,
    createdAt: new Date().toISOString(),
  };

  if (!isConfigValid) {
    const key = `mock_private_rooms_${courseId}`;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const withId = { id: `mock-${Date.now()}`, ...payload };
    list.unshift(withId);
    localStorage.setItem(key, JSON.stringify(list));
    return withId;
  }

  const ref = await addDoc(collection(db, 'privateRooms'), payload);
  return { id: ref.id, ...payload };
};

// --- Asistencia por sesión (colección Firestore `attendance`) ---
// Un doc por alumno+sesión. Las sesiones vienen de `module.sessions` (ver
// `courseSessions.js`), así que sessionId es el id de esa sesión dentro del
// módulo -- no hace falta una colección de "sesiones" aparte.

// `uid` (opcional): un alumno solo puede leer su propia asistencia (reglas).
export const fetchCourseAttendance = async (courseId, uid) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem(`mock_attendance_${courseId}`);
    const list = raw ? JSON.parse(raw) : [];
    return uid ? list.filter((a) => a.uid === uid) : list;
  }
  const constraints = [where('courseId', '==', courseId)];
  if (uid) constraints.push(where('uid', '==', uid));
  const q = query(collection(db, 'attendance'), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const setAttendance = async ({ courseId, sessionId, moduleId, uid, studentName, present }) => {
  const docId = `${uid}_${courseId}_${sessionId}`;
  const payload = { courseId, sessionId, moduleId, uid, studentName, present, updatedAt: new Date().toISOString() };

  if (!isConfigValid) {
    const key = `mock_attendance_${courseId}`;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = list.findIndex((a) => a.uid === uid && a.sessionId === sessionId);
    if (idx >= 0) list[idx] = { ...list[idx], ...payload }; else list.push({ id: docId, ...payload });
    localStorage.setItem(key, JSON.stringify(list));
    return payload;
  }

  await setDoc(doc(db, 'attendance', docId), payload, { merge: true });
  return payload;
};

// --- Notas de componentes manuales (colección Firestore `courseGrades`) ---
// Un doc por alumno+curso con `scores: { [componente]: nota 0-20 }` para lo que
// el docente califica directo en el Registro de notas (sustentación final,
// participación, caso, proyecto...; ver lib/gradingScheme.js). Las notas de
// cada módulo NO van acá: salen de las entregas revisadas (`submissions`).

// `uid` (opcional): un alumno solo puede leer su propio doc (reglas).
export const fetchCourseGrades = async (courseId, uid) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem(`mock_course_grades_${courseId}`);
    const list = raw ? JSON.parse(raw) : [];
    return uid ? list.filter((g) => g.uid === uid) : list;
  }
  const constraints = [where('courseId', '==', courseId)];
  if (uid) constraints.push(where('uid', '==', uid));
  const snapshot = await getDocs(query(collection(db, 'courseGrades'), ...constraints));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// `value` null borra la nota de ese componente.
export const setCourseScore = async ({ courseId, uid, studentName, key, value }) => {
  const docId = `${uid}_${courseId}`;
  const score = value === null || value === undefined || String(value).trim() === '' ? null : Number(value);
  if (score !== null && (!Number.isFinite(score) || score < 0 || score > 20)) throw new Error('La nota debe estar entre 0 y 20.');

  if (!isConfigValid) {
    const storageKey = `mock_course_grades_${courseId}`;
    const list = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const idx = list.findIndex((g) => g.uid === uid);
    if (idx >= 0) list[idx] = { ...list[idx], studentName, scores: { ...(list[idx].scores || {}), [key]: score } };
    else list.push({ id: docId, uid, courseId, studentName, scores: { [key]: score } });
    localStorage.setItem(storageKey, JSON.stringify(list));
    return;
  }
  await setDoc(doc(db, 'courseGrades', docId), { uid, courseId, studentName, scores: { [key]: score }, updatedAt: new Date().toISOString() }, { merge: true });
};

// "Sin registrar": borra el registro de esa sesión para ese alumno.
export const deleteAttendance = async ({ courseId, sessionId, uid }) => {
  if (!isConfigValid) {
    const key = `mock_attendance_${courseId}`;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify(list.filter((a) => !(a.uid === uid && a.sessionId === sessionId))));
    return;
  }
  await deleteDoc(doc(db, 'attendance', `${uid}_${courseId}_${sessionId}`));
};

// --- Grupos de trabajo del proyecto (colección Firestore `workGroups`) ---
// Equipos que los alumnos arman para el trabajo final de un curso -- distinto
// de `groups` (que es el aula/cohorte). El docente también puede crearlos.
// `pendingUids`/`pendingNames` son las invitaciones aún no respondidas.

export const fetchWorkGroups = async (courseId) => {
  if (!isConfigValid) {
    const raw = localStorage.getItem(`mock_work_groups_${courseId}`);
    return raw ? JSON.parse(raw) : [];
  }
  const q = query(collection(db, 'workGroups'), where('courseId', '==', courseId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const createWorkGroup = async ({ courseId, courseTitle, name, description, maxMembers, leaderUid, leaderName, memberUids, memberNames }) => {
  const payload = {
    courseId, courseTitle, name, description: description || '', maxMembers: maxMembers || 5,
    leaderUid: leaderUid || null, leaderName: leaderName || null,
    memberUids: memberUids || [], memberNames: memberNames || [],
    pendingUids: [], pendingNames: [],
    createdAt: new Date().toISOString(),
  };

  if (!isConfigValid) {
    const key = `mock_work_groups_${courseId}`;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const withId = { id: `mock-${Date.now()}`, ...payload };
    list.push(withId);
    localStorage.setItem(key, JSON.stringify(list));
    return withId;
  }

  const ref = await addDoc(collection(db, 'workGroups'), payload);
  return { id: ref.id, ...payload };
};

export const updateWorkGroup = async (groupId, courseId, patch) => {
  if (!isConfigValid) {
    const key = `mock_work_groups_${courseId}`;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const next = list.map((g) => (g.id === groupId ? { ...g, ...patch } : g));
    localStorage.setItem(key, JSON.stringify(next));
    return;
  }
  await updateDoc(doc(db, 'workGroups', groupId), patch);
};
