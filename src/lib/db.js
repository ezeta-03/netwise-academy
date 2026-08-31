import { db } from './firebase';
import { collection, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
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

export const scheduleLiveSession = async ({ courseId, courseTitle, title, instructor, instructorUid, startsAt, durationMin }) => {
  const roomName = `netwise-academy-${courseId}-${Date.now()}`;
  const payload = { courseId, courseTitle, title, instructor, instructorUid, startsAt, durationMin, roomName, status: 'upcoming' };

  if (!isConfigValid) {
    return new Promise((resolve) => {
      const newSession = { id: `mock-${Date.now()}`, ...payload };
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

  if (!isConfigValid) {
    const raw = localStorage.getItem('mock_course_offerings');
    const map = raw ? JSON.parse(raw) : {};
    map[courseId] = payload;
    localStorage.setItem('mock_course_offerings', JSON.stringify(map));
    return payload;
  }

  await setDoc(doc(db, 'courseOfferings', courseId.toString()), payload, { merge: true });
  return payload;
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

  if (!isConfigValid) {
    localStorage.setItem(`mock_course_content_${courseId}`, JSON.stringify(payload));
    return payload;
  }

  await setDoc(doc(db, 'courseContent', courseId.toString()), payload);
  return payload;
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

export const enrollInCourse = async (uid, course) => {
  const payload = {
    uid,
    courseId: course.id,
    courseTitle: course.title,
    enrolledAt: new Date().toISOString(),
    completedLessonIds: [],
    progress: 0,
  };

  if (!isConfigValid) {
    const key = `mock_enrollments_${uid}`;
    const map = JSON.parse(localStorage.getItem(key) || '{}');
    if (!map[course.id]) {
      map[course.id] = payload;
      localStorage.setItem(key, JSON.stringify(map));
    }
    return;
  }

  const ref = doc(db, 'enrollments', `${uid}_${course.id}`);
  const existing = await getDoc(ref);
  if (existing.exists()) return; // ya estaba inscrito -- no reinicia el progreso
  await setDoc(ref, payload);
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

  const ref = doc(db, 'enrollments', `${uid}_${courseId}`);
  const existing = await getDoc(ref);
  const current = existing.exists() ? existing.data() : { completedLessonIds: [] };
  const completedLessonIds = (current.completedLessonIds || []).includes(lessonId)
    ? current.completedLessonIds
    : [...(current.completedLessonIds || []), lessonId];
  const progress = totalLessons > 0 ? Math.round((completedLessonIds.length / totalLessons) * 100) : 0;
  const payload = { uid, courseId, completedLessonIds, progress, updatedAt: new Date().toISOString() };
  await setDoc(ref, payload, { merge: true });
  return payload;
};
