import { db } from './firebase';
import { collection, getDocs, doc, getDoc, setDoc, addDoc, query, orderBy } from 'firebase/firestore';
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
      setTimeout(() => resolve(course || COURSES[0]), 300);
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

// Functions to implement later:
// export const enrollUserInCourse = async (uid, courseId) => {}
// export const updateLessonProgress = async (uid, courseId, lessonId) => {}
