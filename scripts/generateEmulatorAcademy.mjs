// Arma una academia de prueba completa en los Firebase Emulators (proyecto
// demo-netwise). Solo habla con 127.0.0.1: nunca toca producción.
//
//   node scripts/generateEmulatorAcademy.mjs          -> fase 1
//   (el admin aprueba los pedidos en Admin > Ventas)
//   node scripts/generateEmulatorAcademy.mjs phase2   -> fase 2
//
// Fase 1: borra TODOS los usuarios y datos excepto el admin de qaAccounts.mjs;
// luego crea docentes, contenido, aulas con su calendario, cupones y alumnos
// con un pedido pendiente cada uno. Salvo la limpieza, todo se escribe con el
// SDK web y la sesión de cada rol, o sea, pasando por firestore.rules.
// Fase 2: los alumnos ya matriculados presentan entregables y los docentes
// califican y toman asistencia; al final se revisa el cuadro de notas.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { initializeApp as initAdmin } from 'firebase-admin/app';
import { getFirestore as adminFirestore } from 'firebase-admin/firestore';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, doc, setDoc, addDoc, updateDoc, getDocs, getDoc, query, where, runTransaction } from 'firebase/firestore';
import { QA_ACCOUNTS } from './qaAccounts.mjs';
import { COURSES } from '../src/lib/data.js';
import { buildRecurringSessions, buildScheduleLabel } from '../src/lib/liveScheduleGenerator.js';
import { getGradingModel, buildStudentRows } from '../src/lib/gradingScheme.js';
import { computeGradeSummary } from '../src/lib/gradebook.js';
import { getOrderedSessions } from '../src/lib/courseSessions.js';
import { attendanceStats } from '../src/lib/attendance.js';
import { evaluateApproval } from '../src/lib/approval.js';
import { courseRoster } from '../src/lib/roster.js';

const PROJECT = 'demo-netwise';
const adminApp = initAdmin({ projectId: PROJECT });
const adb = adminFirestore(adminApp);
const aauth = adminAuth(adminApp);

const app = initializeApp({ apiKey: 'demo-key', projectId: PROJECT });
const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);

// Cuentas de prueba (solo existen en el emulador).
const TEACHERS = [
  { key: 't1', email: 'docente.rivera@netwise.test', password: 'QaDocente!2026', displayName: 'Lucía Rivera', courses: [1, 2] },
  { key: 't2', email: 'docente.salas@netwise.test', password: 'QaDocente!2026', displayName: 'Marco Salas', courses: [3] },
  { key: 't3', email: 'docente.paredes@netwise.test', password: 'QaDocente!2026', displayName: 'Diana Paredes', courses: [4] },
];
const NAMES = ['Ana Torres', 'Bruno Quispe', 'Carla Mendoza', 'Diego Huamán', 'Elena Rojas', 'Fabio Castro', 'Gabriela León', 'Hugo Vargas', 'Inés Flores', 'Jorge Ramos',
  'Karen Soto', 'Luis Chávez', 'María Poma', 'Nicolás Vega', 'Olga Cruz', 'Pablo Núñez', 'Rosa Medina', 'Sergio Ortiz', 'Tania Campos', 'Ulises Navarro', 'Valeria Ríos', 'Walter Díaz'];
const STUDENTS = NAMES.map((displayName, i) => ({ email: `alumno${String(i + 1).padStart(2, '0')}@netwise.test`, password: 'QaAlumno!2026', displayName }));

// Qué curso compra cada alumno (índice en STUDENTS) y con qué cupón.
const PURCHASES = [
  ...Array.from({ length: 13 }, (_, i) => ({ s: i, course: 1 })),            // 13 para 2 aulas de 6 cupos -> 1 queda sin aula
  ...[13, 14, 15, 16, 17].map((s, i) => ({ s, course: 2, coupon: i < 2 ? 'NETWISE30' : (i === 2 ? 'BRAND10' : null) })), // aula de 4 cupos
  ...[18, 19, 0, 1].map((s) => ({ s, course: 3 })),                          // 0 y 1 llevan dos cursos
  ...[20, 21].map((s) => ({ s, course: 4 })),                                // curso sin aula
];

const now = () => new Date().toISOString();
const isoDay = (d) => d.toISOString().slice(0, 10);
const nextMonday = (weeksOffset = 0) => {
  const d = new Date(); d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7) + weeksOffset * 7);
  return d;
};
const login = async (acc) => (await signInWithEmailAndPassword(auth, acc.email, acc.password)).user.uid;
const results = [];
const check = (name, ok, detail = '') => { results.push({ comprobación: name, resultado: ok ? 'OK' : '⚠ FALLA', detalle: detail }); };
const denied = async (fn) => { try { await fn(); return false; } catch (e) { return e.code === 'permission-denied'; } };

// Mismo cálculo que Checkout.jsx.
const priceFor = (course, coupon) => {
  const original = course.promoPercent ? course.price / (1 - course.promoPercent / 100) : course.price;
  const promoDiscount = original - course.price;
  if (!coupon) return { amount: course.price, usingCoupon: false };
  const couponDiscount = coupon.stackable ? promoDiscount + course.price * (coupon.discountPercent / 100) : original * (coupon.discountPercent / 100);
  const usingCoupon = couponDiscount > promoDiscount;
  return { amount: Math.round((original - Math.max(promoDiscount, couponDiscount)) * 100) / 100, usingCoupon };
};

const moduleOf = (courseId, n, title, weeksLabel, deliverable, graded = true) => ({
  id: `m_${courseId}_${n}`, title, weeksLabel, objective: `Objetivo del módulo ${n}`, practiceIntro: 'Aplica lo visto a tu proyecto.', practiceBullets: ['Diagnóstico', 'Propuesta'],
  tools: [], materials: [{ id: `mat_${courseId}_${n}`, title: `Guía del módulo ${n}`, category: 'Guía', url: 'https://example.com/guia.pdf' }],
  lessons: [{ id: `l_${courseId}_${n}`, title: `Grabación del módulo ${n}`, videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', duration: '45 min', resources: [] }],
  sessions: [1, 2].map((s) => ({ id: `s_${courseId}_${n}_${s}`, dateLabel: '', time: '19:00-21:00', title: `Sesión ${(n - 1) * 2 + s}`, status: n === 1 ? 'done' : 'scheduled', learn: 'Conceptos', doInClass: 'Taller', task: 'Avance' })),
  deliverable: { open: true, description: deliverable, graded, checklist: ['Cumple el formato', 'Aplica a un caso real'] },
});
const contentFor = (courseId) => [
  moduleOf(courseId, 1, 'Diagnóstico', 'Semanas 1-2', 'Diagnóstico inicial'),
  moduleOf(courseId, 2, 'Estrategia', 'Semanas 3-4', 'Plan estratégico'),
  moduleOf(courseId, 3, 'Ejecución', 'Semanas 5-6', 'Piezas y evidencias'),
  moduleOf(courseId, 4, 'Cierre', 'Semanas 7-8', 'Trabajo final'),
];

// ------------------------------------------------------------------ fase 1
const phase1 = async () => {
  // 1. Limpieza: fuera todos los usuarios y datos, menos el admin.
  let adminUser;
  try { adminUser = await aauth.getUserByEmail(QA_ACCOUNTS.admin.email); } catch { adminUser = await aauth.createUser(QA_ACCOUNTS.admin); }
  const all = await aauth.listUsers(1000);
  const toDelete = all.users.filter((u) => u.uid !== adminUser.uid).map((u) => u.uid);
  if (toDelete.length) await aauth.deleteUsers(toDelete);
  for (const col of await adb.listCollections()) {
    if (col.id === 'settings') continue;
    const snap = await col.get();
    for (const d of snap.docs) if (!(col.id === 'users' && d.id === adminUser.uid)) await d.ref.delete();
  }
  await adb.doc(`users/${adminUser.uid}`).set({ email: QA_ACCOUNTS.admin.email, displayName: QA_ACCOUNTS.admin.displayName, role: 'admin', createdAt: now() });
  const left = await aauth.listUsers(1000);
  check('Limpieza: solo queda el admin', left.users.length === 1 && left.users[0].uid === adminUser.uid, `${toDelete.length} cuentas eliminadas`);

  // 2. Docentes y alumnos se registran como cualquier persona (rol student).
  const register = async (acc) => {
    const cred = await createUserWithEmailAndPassword(auth, acc.email, acc.password);
    await updateProfile(cred.user, { displayName: acc.displayName });
    await setDoc(doc(db, 'users', cred.user.uid), { email: acc.email, displayName: acc.displayName, role: 'student', createdAt: now() });
    acc.uid = cred.user.uid;
    await signOut(auth);
  };
  for (const acc of [...TEACHERS, ...STUDENTS]) await register(acc);

  // 3. Admin: precios guardados, docentes promovidos y asignados, cupones, aulas.
  await login(QA_ACCOUNTS.admin);
  for (const c of COURSES) await setDoc(doc(db, 'courseOfferings', String(c.id)), { price: c.price, promoPercent: c.promoPercent ?? null }, { merge: true });
  for (const t of TEACHERS) {
    await setDoc(doc(db, 'users', t.uid), { role: 'teacher' }, { merge: true });
    for (const c of t.courses) await setDoc(doc(db, 'courseOfferings', String(c)), { teacherUid: t.uid }, { merge: true });
  }
  const coupons = {};
  for (const c of [
    { code: 'NETWISE30', discountPercent: 30, stackable: false, scope: 'all', maxUses: 2 },
    { code: 'BRAND10', discountPercent: 10, stackable: true, scope: '2', maxUses: 0 },
    { code: 'SOLOMKT', discountPercent: 50, stackable: true, scope: '3', maxUses: 0 },
  ]) {
    const ref = await addDoc(collection(db, 'coupons'), { usedCount: 0, active: true, createdAt: now(), ...c });
    coupons[c.code] = { id: ref.id, ...c };
  }

  const AULAS = [
    { id: 'aula-redes-a', course: 1, name: 'Redes A · Noche', slots: [['Lunes', '19:00', '21:00'], ['Miércoles', '19:00', '21:00']], start: nextMonday(), capacity: 6, status: 'open', teacher: TEACHERS[0] },
    { id: 'aula-redes-b', course: 1, name: 'Redes B · Noche', slots: [['Martes', '19:00', '21:00'], ['Jueves', '19:00', '21:00']], start: nextMonday(), capacity: 6, status: 'open', teacher: TEACHERS[0] },
    { id: 'aula-brand-a', course: 2, name: 'Branding A', slots: [['Martes', '21:00', '23:00'], ['Jueves', '21:00', '23:00']], start: nextMonday(1), capacity: 4, status: 'open', teacher: TEACHERS[0] },
    { id: 'aula-mkt-a', course: 3, name: 'Marketing A (ya en curso)', slots: [['Sábado', '09:00', '12:00']], start: nextMonday(-3), capacity: 10, status: 'open', teacher: TEACHERS[1] },
  ];
  let sessionCount = 0;
  for (const a of AULAS) {
    const course = COURSES.find((c) => c.id === a.course);
    const schedule = a.slots.map(([day, start, end]) => ({ day, start, end }));
    await setDoc(doc(db, 'groups', a.id), {
      name: a.name, courseId: course.id, courseTitle: course.title, startDate: isoDay(a.start), endDate: null,
      schedule, scheduleTime: buildScheduleLabel(schedule), instructor: a.teacher.displayName, instructorUid: a.teacher.uid,
      capacity: a.capacity, status: a.status, classLink: 'https://meet.google.com/qa-demo-link', enrolledCount: 0, createdAt: now(),
    });
    for (const e of buildRecurringSessions({ slots: schedule, weeksLabel: '8' }, isoDay(a.start))) {
      await addDoc(collection(db, 'liveSessions'), {
        courseId: course.id, courseTitle: course.title, title: e.title, instructor: a.teacher.displayName, instructorUid: a.teacher.uid,
        startsAt: e.startsAt, durationMin: e.durationMin, roomName: `netwise-academy-${course.id}-${a.id}-${sessionCount}`, status: 'upcoming', groupId: a.id, generated: true,
      });
      sessionCount += 1;
    }
  }
  check('Aulas y calendario creados por el admin', sessionCount > 0, `${AULAS.length} aulas, ${sessionCount} clases`);
  await signOut(auth);

  // 4. Cada docente publica el contenido de SUS cursos (y no puede tocar otro).
  for (const t of TEACHERS) {
    await login(t);
    for (const c of t.courses) {
      const modules = contentFor(c);
      await setDoc(doc(db, 'courseContent', String(c)), { modules, updatedAt: now(), updatedBy: t.uid });
      await setDoc(doc(db, 'courseSummaries', String(c)), { modules: modules.map((m) => ({ id: m.id, title: m.title, weeksLabel: m.weeksLabel })) });
    }
    const foreign = COURSES.find((c) => !t.courses.includes(c.id)).id;
    check(`${t.displayName}: no puede editar el curso ${foreign} (ajeno)`, await denied(() => setDoc(doc(db, 'courseContent', String(foreign)), { modules: [] })));
    await signOut(auth);
  }

  // 5. Alumnos: pedido pendiente con el importe del checkout.
  const redeem = (couponId) => runTransaction(db, async (tx) => {
    const ref = doc(db, 'coupons', couponId);
    const snap = await tx.get(ref);
    const { usedCount = 0, maxUses = 0 } = snap.data();
    if (maxUses && usedCount >= maxUses) throw new Error('coupon-limit-reached');
    tx.update(ref, { usedCount: usedCount + 1 });
  });
  const order = (student, course, amount, coupon) => {
    const ref = doc(collection(db, 'orders'));
    return setDoc(ref, {
      code: `NW-${ref.id.slice(0, 6).toUpperCase()}`, uid: student.uid, studentName: student.displayName, studentEmail: student.email,
      courseId: course.id, courseTitle: course.title, amount, paymentMethod: 'yape', couponId: coupon?.id || null, couponCode: coupon?.code || null,
      proofCode: `OP-${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, proofUrl: null, status: 'pending', createdAt: now(),
    });
  };
  let created = 0;
  for (const p of PURCHASES) {
    const student = STUDENTS[p.s];
    const course = COURSES.find((c) => c.id === p.course);
    await login(student);
    let coupon = p.coupon ? coupons[p.coupon] : null;
    let { amount, usingCoupon } = priceFor(course, coupon);
    if (!usingCoupon) coupon = null;
    if (coupon) {
      try { await redeem(coupon.id); } catch { coupon = null; amount = course.price; }
    }
    await order(student, course, amount, coupon);
    created += 1;
    await signOut(auth);
  }
  check('Pedidos pendientes creados por los alumnos', created === PURCHASES.length, `${created} pedidos`);

  // 6. Intentos que la base debe rechazar.
  const cheater = STUDENTS[2];
  const course1 = COURSES.find((c) => c.id === 1);
  await login(cheater);
  check('Pedido por un monto menor (S/ 1) -> rechazado', await denied(() => order(cheater, course1, 1, null)));
  check('Pedido por S/ 0 -> rechazado', await denied(() => order(cheater, course1, 0, null)));
  check('Cupón de otro curso (SOLOMKT en curso 1) -> rechazado', await denied(() => order(cheater, course1, priceFor(course1, coupons.SOLOMKT).amount, coupons.SOLOMKT)));
  check('Precio con cupón pero sin declarar el cupón -> rechazado', await denied(() => order(cheater, COURSES.find((c) => c.id === 2), 324, null)));
  check('Tercer canje de NETWISE30 (tope 2) -> rechazado', await denied(() => updateDoc(doc(db, 'coupons', coupons.NETWISE30.id), { usedCount: 3 })));
  check('Matricularse solo -> rechazado', await denied(() => setDoc(doc(db, 'enrollments', `${cheater.uid}_1`), { uid: cheater.uid, courseId: 1, status: 'active' })));
  check('Leer contenido sin matrícula -> rechazado', await denied(() => getDoc(doc(db, 'courseContent', '1'))));
  check('Leer clases en vivo sin matrícula -> rechazado', await denied(() => getDocs(query(collection(db, 'liveSessions'), where('courseId', '==', 1)))));
  await signOut(auth);
};

// ------------------------------------------------------------------ fase 2
const phase2 = async () => {
  const uidOf = async (acc) => { acc.uid = (await aauth.getUserByEmail(acc.email)).uid; };
  for (const acc of [...TEACHERS, ...STUDENTS]) await uidOf(acc);

  // Lo que dejó el admin al aprobar en la pantalla de Ventas.
  const enrollments = (await adb.collection('enrollments').get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const orders = (await adb.collection('orders').get()).docs.map((d) => d.data());
  const groups = (await adb.collection('groups').get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const active = enrollments.filter((e) => (e.status || 'active') === 'active');
  check('Cada pedido pagado tiene su matrícula activa', orders.filter((o) => o.status === 'paid').every((o) => active.some((e) => e.uid === o.uid && String(e.courseId) === String(o.courseId))), `${orders.filter((o) => o.status === 'paid').length} pagados, ${active.length} matrículas`);
  check('Ninguna matrícula sin pedido pagado', active.every((e) => orders.some((o) => o.status === 'paid' && o.uid === e.uid && String(o.courseId) === String(e.courseId))));
  check('Id de matrícula con formato uid_curso', enrollments.every((e) => e.id === `${e.uid}_${e.courseId}`));
  for (const g of groups) {
    const n = active.filter((e) => e.groupId === g.id).length;
    check(`Aula "${g.name}": no supera su cupo`, n <= g.capacity, `${n}/${g.capacity}`);
  }
  const noAula = active.filter((e) => !e.groupId);
  check('Sin aula solo quienes no tenían cupo o aula disponible', noAula.every((e) => {
    const courseGroups = groups.filter((g) => String(g.courseId) === String(e.courseId));
    return courseGroups.every((g) => active.filter((x) => x.groupId === g.id).length >= g.capacity);
  }), `${noAula.length} sin aula: ${noAula.map((e) => `${e.studentName} (curso ${e.courseId})`).join(', ') || '—'}`);

  // Alumnos: presentan entregables (el primero de cada curso no entrega nada;
  // el segundo solo dos). Un pedido sin aprobar no debe poder entregar.
  const byCourse = (c) => active.filter((e) => String(e.courseId) === String(c));
  let submitted = 0;
  for (const course of COURSES) {
    const modules = contentFor(course.id);
    for (const [i, e] of byCourse(course.id).entries()) {
      const student = STUDENTS.find((s) => s.uid === e.uid);
      const howMany = i === 0 ? 0 : i === 1 ? 2 : 4;
      if (!howMany) continue;
      await login(student);
      for (const m of modules.slice(0, howMany)) {
        await setDoc(doc(db, 'submissions', `${e.uid}_${course.id}_${m.id}`), {
          courseId: course.id, moduleId: m.id, moduleTitle: m.title, uid: e.uid, studentName: e.studentName,
          deliverableTitle: m.deliverable.description, status: 'submitted', note: 'https://drive.google.com/file/d/entrega/view', updatedAt: now(), submittedAt: now(),
        }, { merge: true });
        submitted += 1;
      }
      await signOut(auth);
    }
  }
  check('Entregas presentadas por alumnos matriculados', submitted > 0, `${submitted} entregas`);
  const pendingOrder = orders.find((o) => o.status !== 'paid');
  if (pendingOrder) {
    const student = STUDENTS.find((s) => s.uid === pendingOrder.uid);
    await login(student);
    check(`${student.displayName} (pedido ${pendingOrder.status}) no puede entregar`, await denied(() => setDoc(doc(db, 'submissions', `${student.uid}_${pendingOrder.courseId}_m_${pendingOrder.courseId}_1`), { courseId: pendingOrder.courseId, moduleId: `m_${pendingOrder.courseId}_1`, uid: student.uid, status: 'submitted', note: 'x' })));
    await signOut(auth);
  }

  // Docentes: califican, toman asistencia y ponen las notas manuales.
  for (const t of TEACHERS) {
    await login(t);
    for (const c of t.courses) {
      const modules = contentFor(c);
      const subs = (await getDocs(query(collection(db, 'submissions'), where('courseId', '==', c)))).docs;
      for (const [i, d] of subs.entries()) {
        // Se deja una entrega sin calificar en cada curso (la última).
        if (i === subs.length - 1) continue;
        await updateDoc(d.ref, { status: 'reviewed', grade: 12 + ((i * 3) % 9), feedback: 'Buen avance; revisa los criterios pendientes.', updatedAt: now() });
      }
      const sessions = getOrderedSessions(modules).filter((s) => s.done);
      for (const [i, e] of byCourse(c).entries()) {
        for (const [j, s] of sessions.entries()) {
          // El tercer alumno falta a todo; el cuarto queda sin registro.
          if (i === 3) continue;
          await setDoc(doc(db, 'attendance', `${e.uid}_${c}_${s.id}`), { courseId: c, sessionId: s.id, moduleId: s.moduleId, uid: e.uid, studentName: e.studentName, present: i !== 2 && !(i === 4 && j === 0), excused: false, updatedAt: now() });
        }
        for (const comp of getGradingModel(c, modules).components.filter((x) => x.kind === 'manual')) {
          if (i < 2) continue;
          await setDoc(doc(db, 'courseGrades', `${e.uid}_${c}`), { uid: e.uid, courseId: c, studentName: e.studentName, scores: { [comp.key]: 14 + (i % 6) }, updatedAt: now() }, { merge: true });
        }
      }
    }
    await signOut(auth);
  }

  // Cuadro de notas con las mismas funciones que usan las pantallas.
  const table = [];
  for (const course of COURSES) {
    const modules = contentFor(course.id);
    const model = getGradingModel(course.id, modules);
    check(`Curso ${course.id}: los pesos suman 100%`, Math.abs(model.total - 100) < 0.05, `${model.total}%`);
    const subs = (await adb.collection('submissions').where('courseId', '==', course.id).get()).docs.map((d) => d.data());
    const att = (await adb.collection('attendance').where('courseId', '==', course.id).get()).docs.map((d) => d.data());
    const grades = (await adb.collection('courseGrades').where('courseId', '==', course.id).get()).docs.map((d) => d.data());
    const sessions = getOrderedSessions(modules);
    for (const r of courseRoster(enrollments, course.id)) {
      const rows = buildStudentRows(model, subs.filter((s) => s.uid === r.uid), grades.find((g) => g.uid === r.uid)?.scores);
      const summary = computeGradeSummary(rows);
      const st = attendanceStats(sessions, att.filter((a) => a.uid === r.uid));
      const verdict = evaluateApproval(summary, { taken: st.taken, pct: st.raw });
      table.push({ curso: course.id, alumno: r.studentName, notas: `${summary.gradedCount}/${summary.totalCount}`, promedio: summary.promedioParcial ?? '—', asistencia: st.pct === null ? '—' : `${st.pct}%`, estado: verdict.overall });
      if (summary.promedioParcial !== null) check(`Promedio dentro de 0-20 (${r.studentName}, curso ${course.id})`, summary.promedioParcial >= 0 && summary.promedioParcial <= 20);
      if (!summary.allGraded && verdict.overall !== 'pending') check(`Sin todas las notas el estado debe ser "en curso" (${r.studentName})`, false, verdict.overall);
    }
  }
  console.table(table);
};

await (process.argv[2] === 'phase2' ? phase2() : phase1());
const failures = results.filter((r) => r.resultado !== 'OK');
console.table(process.argv[2] === 'phase2' ? results.filter((r) => !r.comprobación.startsWith('Promedio dentro')) : results);
console.log(failures.length ? `${failures.length} FALLA(S)` : `TODO OK (${results.length} comprobaciones)`);
process.exit(0);
