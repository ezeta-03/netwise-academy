// Guarda y borra los datos de ejemplo (ver lib/demoData.js). Lo ejecuta el
// admin desde Configuración, con su sesión: cada escritura pasa por las reglas
// de Firestore como cualquier otra del panel.
import { collection, doc, setDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { fetchCourseContent, fetchAllUsers } from './db';
import { buildDemoPlan, DEMO_COLLECTIONS } from './demoData';

const isConfigValid = !db.app.options.apiKey.includes('DummyKey');
const CONCURRENCY = 20;

// Ejecuta `tasks` (funciones que devuelven promesas) de a CONCURRENCY por vez.
const runPool = async (tasks, onProgress) => {
  let next = 0; let done = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const task = tasks[next];
      next += 1;
      await task();
      done += 1;
      if (done % 25 === 0 || done === tasks.length) onProgress?.(done, tasks.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, worker));
};

const demoDocs = (name) => getDocs(query(collection(db, name), where('demo', '==', true)));

// Cuántos documentos de ejemplo hay hoy: { enrollments, groups, orders, total }.
export const countDemoData = async () => {
  if (!isConfigValid) return { enrollments: 0, groups: 0, orders: 0, total: 0 };
  const sizes = await Promise.all(DEMO_COLLECTIONS.map((name) => demoDocs(name).then((s) => s.size)));
  const by = Object.fromEntries(DEMO_COLLECTIONS.map((name, i) => [name, sizes[i]]));
  return { enrollments: by.enrollments, groups: by.groups, orders: by.orders, total: sizes.reduce((a, b) => a + b, 0) };
};

// Crea los datos de ejemplo. `courses`: los de CourseOfferingsContext.
// Devuelve el resumen del plan (alumnos, matrículas, aulas...).
export const seedDemoData = async ({ courses, size, onProgress }) => {
  if (!isConfigValid) throw new Error('app/needs-firebase');
  const [contents, users] = await Promise.all([
    Promise.all(courses.map((c) => fetchCourseContent(c.id).then((data) => [c.id, data.modules || []]).catch(() => [c.id, []]))),
    fetchAllUsers().catch(() => []),
  ]);
  const teacherNames = Object.fromEntries((users || []).map((u) => [u.uid, u.displayName || u.email]));
  const { docs, summary } = buildDemoPlan({ courses, contentByCourse: Object.fromEntries(contents), teacherNames, size });

  // Primero aulas y matrículas (de ellas depende lo demás), luego el resto.
  const order = ['groups', 'enrollments', 'orders', 'liveSessions', 'groupProgress', 'attendance', 'submissions'];
  const tasks = order.flatMap((name) => (docs[name] || []).map(({ id, data }) => () => setDoc(doc(db, name, id), data)));
  await runPool(tasks, onProgress);
  return summary;
};

// Borra todo documento marcado `demo: true`. Devuelve cuántos quitó.
export const clearDemoData = async ({ onProgress } = {}) => {
  if (!isConfigValid) throw new Error('app/needs-firebase');
  const snaps = await Promise.all(DEMO_COLLECTIONS.map((name) => demoDocs(name)));
  const tasks = snaps.flatMap((snap) => snap.docs.map((d) => () => deleteDoc(d.ref)));
  // Si el admin aprobó un pedido de ejemplo pendiente, esa matrícula se creó
  // sin la marca: se quita por su id (el alumno ficticio no tiene nada real).
  const marked = new Set(snaps[DEMO_COLLECTIONS.indexOf('enrollments')].docs.map((d) => d.id));
  snaps[DEMO_COLLECTIONS.indexOf('orders')].docs.forEach((d) => {
    const { uid, courseId } = d.data();
    const id = `${uid}_${courseId}`;
    if (!String(uid).startsWith('demo-') || marked.has(id)) return;
    marked.add(id);
    tasks.unshift(() => deleteDoc(doc(db, 'enrollments', id)));
  });
  await runPool(tasks, onProgress);
  return tasks.length;
};
