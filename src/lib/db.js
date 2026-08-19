import { db } from './firebase';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { COURSES, CATEGORIES } from './data';

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

// Functions to implement later:
// export const enrollUserInCourse = async (uid, courseId) => {}
// export const updateLessonProgress = async (uid, courseId, lessonId) => {}
