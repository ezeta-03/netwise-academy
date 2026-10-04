// Comprueba contra los Firebase Emulators quién puede leer y marcar las
// sesiones dictadas de cada aula (`groupProgress`). Usa las cuentas que crea
// scripts/generateEmulatorAcademy.mjs. Uso: node scripts/checkEmulatorAulas.mjs
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-netwise' });
const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);

const out = [];
const attempt = async (name, want, fn) => {
  let got;
  try { await fn(); got = 'permitido'; } catch (e) { got = e.code === 'permission-denied' ? 'bloqueado' : (e.code || e.message); }
  out.push({ prueba: name, esperado: want, obtenido: got, veredicto: want === got ? 'OK' : '⚠ FALLA' });
};
const as = (email, password) => signInWithEmailAndPassword(auth, email, password);
const mark = (aula, courseId, sessionId, done = true) => setDoc(doc(db, 'groupProgress', aula), { groupId: aula, courseId, doneSessionIds: done ? arrayUnion(sessionId) : arrayRemove(sessionId) }, { merge: true });

await as('docente.rivera@netwise.test', 'QaDocente!2026'); // cursos 1 y 2
await attempt('Docente marca una sesión en un aula de su curso', 'permitido', () => mark('aula-redes-b', 1, 's_qa_check'));
await attempt('Docente la desmarca', 'permitido', () => mark('aula-redes-b', 1, 's_qa_check', false));
await attempt('Docente marca en un aula de un curso ajeno (3)', 'bloqueado', () => mark('aula-mkt-a', 3, 's_qa_check'));
await attempt('Docente cambia el curso de un avance ya creado', 'bloqueado', () => setDoc(doc(db, 'groupProgress', 'aula-redes-b'), { courseId: 3 }, { merge: true }));
await signOut(auth);

await as('alumno06@netwise.test', 'QaAlumno!2026'); // Fabio, aula Redes B
await attempt('Alumno lee el avance de su aula', 'permitido', () => getDoc(doc(db, 'groupProgress', 'aula-redes-b')));
await attempt('Alumno lee un aula que aún no tiene nada marcado', 'permitido', () => getDoc(doc(db, 'groupProgress', 'aula-sin-marcas')));
await attempt('Alumno marca una sesión como dictada', 'bloqueado', () => mark('aula-redes-b', 1, 's_1_4_2'));
await attempt('Alumno lee el avance de un aula de otro curso (3)', 'bloqueado', () => getDoc(doc(db, 'groupProgress', 'aula-mkt-a')));
await signOut(auth);

console.table(out);
console.log(out.every((r) => r.veredicto === 'OK') ? 'TODO OK' : 'HAY FALLAS');
process.exit(0);
