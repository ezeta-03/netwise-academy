import { db } from './firebase';
import { collection, getDocs, doc, getDoc, setDoc, addDoc, query, orderBy, where } from 'firebase/firestore';
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

export const scheduleLiveSession = async ({ courseId, courseTitle, title, instructor, startsAt, durationMin }) => {
  const roomName = `netwise-academy-${courseId}-${Date.now()}`;
  const payload = { courseId, courseTitle, title, instructor, startsAt, durationMin, roomName, status: 'upcoming' };

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

// Functions to implement later:
// export const updateLessonProgress = async (uid, courseId, lessonId) => {}
