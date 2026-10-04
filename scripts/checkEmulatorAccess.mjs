// Comprueba contra los Firebase Emulators que clases, aulas, salas, comunidad y
// equipos solo los lee gente del curso, y que avance y pedidos están acotados.
// Usa el SDK web real (las mismas consultas que la app) con las cuentas de
// scripts/qaAccounts.mjs. Uso: node scripts/seedEmulatorScenario.mjs && node scripts/checkEmulatorAccess.mjs
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, query, where, getDocs, getDoc, doc, setDoc, updateDoc, addDoc, orderBy } from 'firebase/firestore';
import { QA_ACCOUNTS } from './qaAccounts.mjs';

const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-netwise' });
const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);

const out = [];
const attempt = async (name, want, fn) => {
  let got;
  try { const r = await fn(); got = `ok${r !== undefined ? ` (${r})` : ''}`; } catch (e) { got = e.code || e.message; }
  const allowed = got.startsWith('ok');
  out.push({ prueba: name, esperado: want, obtenido: got, veredicto: (want === 'permitir') === allowed ? 'OK' : '⚠ FALLA' });
};
const byCourse = (name, c) => getDocs(query(collection(db, name), where('courseId', '==', c))).then((s) => s.size);
const as = async (acc) => (await signInWithEmailAndPassword(auth, acc.email, acc.password)).user.uid;

// --- Alumna matriculada en el curso 1 ---
let uid = await as(QA_ACCOUNTS.student);
await attempt('Matriculada: clases de su curso', 'permitir', () => byCourse('liveSessions', 1));
await attempt('Matriculada: aulas de su curso', 'permitir', () => byCourse('groups', 1));
await attempt('Matriculada: salas privadas de su curso', 'permitir', () => getDocs(query(collection(db, 'privateRooms'), where('courseId', '==', 1), orderBy('createdAt', 'desc'))).then((s) => s.size));
await attempt('Matriculada: comunidad de su curso', 'permitir', () => getDocs(query(collection(db, 'communityPosts'), where('courseId', '==', 1), orderBy('createdAt', 'desc'))).then((s) => s.size));
await attempt('Matriculada: equipos de su curso', 'permitir', () => byCourse('workGroups', 1));
await attempt('Matriculada: TODAS las clases (sin filtro)', 'bloquear', () => getDocs(collection(db, 'liveSessions')).then((s) => s.size));
await attempt('Matriculada: clases de OTRO curso (2)', 'bloquear', () => byCourse('liveSessions', 2));
await attempt('Matriculada: aulas de OTRO curso (2)', 'bloquear', () => byCourse('groups', 2));
await attempt('Matriculada: crea sala privada en su curso', 'permitir', async () => { await addDoc(collection(db, 'privateRooms'), { courseId: 1, name: 'Sala QA', roomName: 'qa', createdByUid: uid, createdAt: new Date().toISOString() }); });
await attempt('Matriculada: crea equipo en su curso', 'permitir', async () => { await addDoc(collection(db, 'workGroups'), { courseId: 1, name: 'Equipo QA', leaderUid: uid, memberUids: [uid], memberNames: ['QA'], pendingUids: [], pendingNames: [] }); });
await attempt('Matriculada: avance directo a 100% sin lecciones', 'bloquear', () => updateDoc(doc(db, 'enrollments', `${uid}_1`), { completedLessonIds: [], progress: 100 }));
await attempt('Matriculada: marca 5 lecciones de golpe', 'bloquear', () => updateDoc(doc(db, 'enrollments', `${uid}_1`), { completedLessonIds: ['a', 'b', 'c', 'd', 'e'], progress: 100 }));
await attempt('Matriculada: marca 1 lección (flujo real)', 'permitir', () => setDoc(doc(db, 'enrollments', `${uid}_1`), { uid, courseId: 1, completedLessonIds: ['l_qa_1'], progress: 25, updatedAt: new Date().toISOString() }, { merge: true }));
await attempt('Matriculada: pedido con campo extra "paidBy"', 'bloquear', () => setDoc(doc(db, 'orders', `qa-extra-${Date.now()}`), { uid, courseId: 2, amount: 10, status: 'pending', paidBy: 'x' }));
const sessionId = (await getDocs(query(collection(db, 'liveSessions'), where('courseId', '==', 1)))).docs[0]?.id;
await attempt('Matriculada: abre una clase por id', 'permitir', () => getDoc(doc(db, 'liveSessions', sessionId)).then((d) => d.exists()));
await signOut(auth);

// --- Cuenta registrada SIN matrícula ---
uid = await as(QA_ACCOUNTS.student2);
for (const [label, name] of [['clases en vivo', 'liveSessions'], ['aulas', 'groups'], ['salas privadas', 'privateRooms'], ['comunidad', 'communityPosts'], ['equipos', 'workGroups']]) {
  await attempt(`No matriculado: ${label} del curso 1`, 'bloquear', () => byCourse(name, 1));
}
await attempt('No matriculado: abre una clase por id', 'bloquear', () => getDoc(doc(db, 'liveSessions', sessionId)).then((d) => d.exists()));
await attempt('No matriculado: crea sala privada en curso 1', 'bloquear', () => addDoc(collection(db, 'privateRooms'), { courseId: 1, name: 'x', roomName: 'x', createdByUid: uid, createdAt: 'x' }));
await attempt('No matriculado: su propio pedido pendiente (checkout)', 'permitir', async () => { await setDoc(doc(db, 'orders', `qa-s2-${uid}`), { uid, studentName: 'QA Alumno Quispe', studentEmail: QA_ACCOUNTS.student2.email, courseId: 2, courseTitle: 'Branding & Marca', amount: 360, paymentMethod: 'yape', couponId: null, couponCode: null, proofCode: 'QA-1', proofUrl: null, status: 'pending', createdAt: new Date().toISOString(), code: 'NW-QAS2' }); });
await signOut(auth);

// --- Docente del curso 1 ---
uid = await as(QA_ACCOUNTS.teacher);
await attempt('Docente: clases de su curso', 'permitir', () => byCourse('liveSessions', 1));
await attempt('Docente: aulas de su curso', 'permitir', () => byCourse('groups', 1));
await attempt('Docente: clases del curso 2 (no es suyo)', 'bloquear', () => byCourse('liveSessions', 2));
await attempt('Docente: entregas de su curso (campana)', 'permitir', () => byCourse('submissions', 1));
await signOut(auth);

// --- Admin ---
await as(QA_ACCOUNTS.admin);
await attempt('Admin: todas las clases', 'permitir', () => getDocs(query(collection(db, 'liveSessions'), orderBy('startsAt', 'asc'))).then((s) => s.size));
await attempt('Admin: todas las aulas', 'permitir', () => getDocs(collection(db, 'groups')).then((s) => s.size));
await signOut(auth);

console.table(out);
console.log(out.every((r) => r.veredicto === 'OK') ? 'TODO OK' : 'HAY FALLAS');
process.exit(0);
