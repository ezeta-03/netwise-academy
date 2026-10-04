// Siembra en los Firebase Emulators (proyecto demo-netwise) el escenario E2E
// completo de scripts/qaAccounts.mjs: admin, docente del curso 1 con 4 módulos,
// un aula con su calendario, una alumna matriculada con sus 4 entregas (una ya
// calificada) y un alumno con cuenta pero sin matrícula. Solo habla con
// 127.0.0.1: nunca toca producción.
//
// Uso: npm run emulators  (en otra terminal)  →  node scripts/seedEmulatorScenario.mjs
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const { initializeApp } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
const { getAuth } = await import('firebase-admin/auth');
const { QA_ACCOUNTS } = await import('./qaAccounts.mjs');

initializeApp({ projectId: 'demo-netwise' });
const db = getFirestore();
const auth = getAuth();
const now = new Date().toISOString();

const account = async (acc, role) => {
  let user;
  try { user = await auth.getUserByEmail(acc.email); } catch { user = await auth.createUser(acc); }
  await db.doc(`users/${user.uid}`).set({ email: acc.email, displayName: acc.displayName, role, createdAt: now });
  return user.uid;
};

await account(QA_ACCOUNTS.admin, 'admin');
const teacherUid = await account(QA_ACCOUNTS.teacher, 'teacher');
const studentUid = await account(QA_ACCOUNTS.student, 'student');
await account(QA_ACCOUNTS.student2, 'student');

const COURSE = { id: 1, title: 'Redes Sociales & IA' };
await db.doc('courseOfferings/1').set({ teacherUid }, { merge: true });

const mod = (n, title, weeksLabel, deliverable) => ({
  id: `m_qa_${n}`, title, weeksLabel, objective: `Objetivo del módulo ${n}`, practiceIntro: 'Aplica a tu proyecto', practiceBullets: ['Punto A', 'Punto B'],
  tools: [], materials: [],
  lessons: [{ id: `l_qa_${n}`, title: `Lección ${n}`, videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', duration: '10 min', resources: [] }],
  sessions: [1, 2].map((s) => ({ id: `s_qa_${n}_${s}`, dateLabel: '', time: '19:00-21:00', title: `Sesión ${(n - 1) * 2 + s}`, status: n === 1 ? 'done' : 'scheduled', learn: 'x', doInClass: 'y', task: 'z' })),
  deliverable: { open: true, description: deliverable, checklist: ['Criterio 1', 'Criterio 2'] },
});
const modules = [
  mod(1, 'Auditoría y estrategia', 'Semanas 1-2', 'Auditoría de canales y competencia'),
  mod(2, 'Contenido con IA', 'Semanas 3-4', 'Plan de contenidos de 30 días'),
  mod(3, 'Social selling', 'Semanas 5-6', 'Funnel en WhatsApp Business'),
  mod(4, 'Métricas y cierre', 'Semanas 7-8', 'Dashboard social y trabajo final'),
];
await db.doc('courseContent/1').set({ modules, updatedAt: now, updatedBy: teacherUid });
await db.doc('courseSummaries/1').set({ modules: modules.map((m) => ({ id: m.id, title: m.title, weeksLabel: m.weeksLabel })) });

// Aula que empieza el próximo lunes, con 4 clases generadas.
const monday = new Date(); monday.setUTCHours(0, 0, 0, 0);
monday.setUTCDate(monday.getUTCDate() + ((8 - monday.getUTCDay()) % 7 || 7));
const iso = (d) => d.toISOString().slice(0, 10);
const schedule = [{ day: 'Lunes', start: '19:00', end: '21:00' }, { day: 'Miércoles', start: '19:00', end: '21:00' }];
await db.doc('groups/qa-aula-01').set({
  name: 'Aula QA 01', courseId: COURSE.id, courseTitle: COURSE.title, startDate: iso(monday), endDate: null,
  schedule, scheduleTime: 'Lunes y Miércoles · 19:00-21:00', instructor: QA_ACCOUNTS.teacher.displayName, instructorUid: teacherUid,
  capacity: 30, status: 'open', classLink: 'https://meet.google.com/qa-demo-link', enrolledCount: 0, createdAt: now,
});
for (let i = 0; i < 4; i++) {
  const day = new Date(monday); day.setUTCDate(day.getUTCDate() + Math.floor(i / 2) * 7 + (i % 2) * 2);
  await db.doc(`liveSessions/qa-class-${i + 1}`).set({
    courseId: COURSE.id, courseTitle: COURSE.title, title: `Semana ${Math.floor(i / 2) + 1} · ${i % 2 ? 'Miércoles' : 'Lunes'}`,
    instructor: QA_ACCOUNTS.teacher.displayName, instructorUid: teacherUid, startsAt: `${iso(day)}T19:00:00-05:00`, durationMin: 120,
    roomName: `netwise-academy-1-qa-${i + 1}`, status: 'upcoming', groupId: 'qa-aula-01', generated: true,
  });
}

// Alumna: pedido pagado + matrícula activa + 4 entregas (la primera calificada).
await db.doc('orders/qa-order-paid').set({
  code: 'NW-QAPAID', uid: studentUid, studentName: QA_ACCOUNTS.student.displayName, studentEmail: QA_ACCOUNTS.student.email,
  courseId: COURSE.id, courseTitle: COURSE.title, amount: 300, paymentMethod: 'yape', couponId: null, couponCode: null,
  proofCode: 'QA-00312845', proofUrl: null, status: 'paid', createdAt: now,
});
await db.doc(`enrollments/${studentUid}_1`).set({
  uid: studentUid, studentName: QA_ACCOUNTS.student.displayName, studentEmail: QA_ACCOUNTS.student.email, courseId: COURSE.id, courseTitle: COURSE.title,
  groupId: 'qa-aula-01', groupName: 'Aula QA 01', status: 'active', reason: 'Pago validado manualmente (pedido NW-QAPAID)',
  completedLessonIds: [], progress: 0, enrolledAt: now,
});
for (const [i, m] of modules.entries()) {
  await db.doc(`submissions/${studentUid}_1_${m.id}`).set({
    courseId: COURSE.id, moduleId: m.id, moduleTitle: m.title, uid: studentUid, studentName: QA_ACCOUNTS.student.displayName,
    deliverableTitle: m.deliverable.description, note: 'https://drive.google.com/file/d/qa-entrega/view', submittedAt: now, updatedAt: now,
    ...(i === 0 ? { status: 'reviewed', grade: 17, feedback: 'Buena auditoría; falta benchmark de 2 competidores.' } : { status: 'submitted' }),
  });
}

console.log('✔ Escenario sembrado: admin, docente (curso 1), alumna matriculada con 4 entregas y alumno sin matrícula.');
process.exit(0);
