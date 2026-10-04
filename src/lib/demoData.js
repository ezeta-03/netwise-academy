// Datos de ejemplo para ver la academia "poblada" (Admin > Configuración >
// Datos de ejemplo). Esta parte es pura: arma el plan de documentos a escribir;
// lib/demoSeed.js lo guarda y lo borra. Todo documento lleva `demo: true`, que
// es por lo que después se elimina sin tocar nada real.
//
// Los alumnos de ejemplo no tienen cuenta de acceso: solo existen como
// matrículas (uid `demo-...`, correo @ejemplo.com), igual que en el Figma.
import { buildRecurringSessions, buildScheduleLabel } from './liveScheduleGenerator.js';
import { getOrderedSessions } from './courseSessions.js';
import { allDeliverableModules } from './weights.js';

export const DEMO_SIZES = [
  { value: 20, label: 'Pequeña · 20 alumnos' },
  { value: 100, label: 'Mediana · 100 alumnos' },
  { value: 300, label: 'Grande · 300 alumnos' },
];

// Primero los nombres del diseño; después, combinaciones.
const FIGMA_PEOPLE = ['Lucía Ramírez', 'Diego Salazar', 'Camila Huamán', 'Mateo Vargas', 'Valentina Rojas', 'Sebastián Quispe', 'Daniela Flores', 'Andrés Castillo', 'Mariana Chávez', 'Joaquín Mendoza',
  'Fernanda Torres', 'Gabriel Paredes', 'Sofía Gutiérrez', 'Nicolás Ríos', 'Isabella Medina', 'Rodrigo Aguilar', 'Renata Silva', 'Emilio Cárdenas', 'Ximena Paz', 'Tomás Herrera'];
const FIRST = ['Alejandra', 'Bruno', 'Carla', 'Daniel', 'Elena', 'Fabián', 'Gabriela', 'Héctor', 'Inés', 'Jorge', 'Karen', 'Luis', 'Milagros', 'Néstor', 'Olga', 'Pablo', 'Rosa', 'Sergio', 'Tania', 'Ulises', 'Vanessa', 'Walter', 'Yolanda', 'Álvaro', 'Brenda', 'César', 'Diana', 'Esteban', 'Flor', 'Gonzalo'];
const LAST = ['Acosta', 'Benavides', 'Campos', 'Delgado', 'Espinoza', 'Fernández', 'García', 'Huanca', 'Ibáñez', 'Jiménez', 'León', 'Mamani', 'Navarro', 'Ortiz', 'Poma', 'Quiroz', 'Ramos', 'Soto', 'Ticona', 'Uribe', 'Vega', 'Yupanqui', 'Zapata', 'Cruz', 'Díaz', 'Morales', 'Núñez', 'Palacios', 'Reyes', 'Salas'];
const METHODS = ['yape', 'yape', 'transfer', 'yape'];
const GROUP_MONTHS = ['Octubre', 'Noviembre', 'Diciembre', 'Enero', 'Febrero', 'Marzo'];
const AULA_CAPACITY = 25;
const ASSIGNED_RATIO = 0.6; // el resto queda "sin aula", como en el diseño
const DAY_MS = 24 * 3600 * 1000;

// Aleatorio reproducible: la misma semilla da siempre los mismos datos.
const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const slug = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
const shortTitle = (title) => title.split(/[\s&]/)[0];
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

export const demoPeople = (count) => Array.from({ length: count }, (_, i) => {
  const name = i < FIGMA_PEOPLE.length ? FIGMA_PEOPLE[i] : `${FIRST[(i * 7) % FIRST.length]} ${LAST[(i * 11 + Math.floor(i / LAST.length)) % LAST.length]}`;
  const id = `${slug(name)}${i < FIGMA_PEOPLE.length ? '' : `.${i}`}`;
  return { uid: `demo-${id}`, name, email: `${id}@ejemplo.com` };
});

// Lunes en o después de `ms`.
const mondayOnOrAfter = (ms) => { const d = new Date(ms); d.setUTCHours(0, 0, 0, 0); while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1); return d.getTime(); };

// `courses`: los de CourseOfferingsContext (id, title, price, scheduleSlots,
// teacherUid). `contentByCourse`: { [courseId]: modules }. `teacherNames`:
// { [uid]: nombre }. Devuelve { docs: { colección: [{ id, data }] }, summary }.
export const buildDemoPlan = ({ courses, contentByCourse = {}, teacherNames = {}, size = 20, now = Date.now(), seed = 2026 }) => {
  const rand = mulberry32(seed);
  const docs = { groups: [], liveSessions: [], enrollments: [], orders: [], submissions: [], attendance: [], groupProgress: [] };
  const sellable = courses.filter((c) => c.price != null);
  if (sellable.length === 0) return { docs, summary: { students: 0, enrollments: 0, groups: 0, unassigned: 0 } };
  const people = demoPeople(size);
  const nowIso = new Date(now).toISOString();

  // 1. Quién se matricula en qué: un curso cada uno, y uno de cada cuatro lleva dos.
  const byCourse = new Map(sellable.map((c) => [c.id, []]));
  people.forEach((p, i) => {
    const first = sellable[i % sellable.length];
    byCourse.get(first.id).push(p);
    if (i % 4 !== 1 || sellable.length < 2) return;
    const candidate = sellable[(i + 1 + Math.floor(i / 4)) % sellable.length];
    const second = candidate.id === first.id ? sellable[(i + 2) % sellable.length] : candidate;
    if (second.id !== first.id) byCourse.get(second.id).push(p);
  });

  let orderN = 0;
  sellable.forEach((course, ci) => {
    const students = byCourse.get(course.id);
    const modules = contentByCourse[course.id] || [];
    const teacher = course.teacherUid ? { uid: course.teacherUid, name: teacherNames[course.teacherUid] || 'Docente' } : null;

    // 2. Aulas del curso: las necesarias para ~60% de sus alumnos.
    const toAssign = Math.round(students.length * ASSIGNED_RATIO);
    const aulaCount = toAssign > 0 ? Math.ceil(toAssign / AULA_CAPACITY) : 0;
    const slots = (course.scheduleSlots || []).map(({ day, start, end }) => ({ day, start, end }));
    const aulas = Array.from({ length: aulaCount }, (_, k) => {
      // La primera aula ya empezó hace dos semanas (hay clases dictadas); las demás empiezan pronto.
      const start = isoDay(mondayOnOrAfter(now + (k === 0 ? -14 : 7 + (ci + k) * 7) * DAY_MS));
      const id = `demo-aula-${course.id}-${k + 1}`;
      const name = `${shortTitle(course.title)} · Grupo ${GROUP_MONTHS[(ci + k) % GROUP_MONTHS.length]}`;
      docs.groups.push({ id, data: {
        name, courseId: course.id, courseTitle: course.title, startDate: start, endDate: null,
        schedule: slots, scheduleTime: slots.length ? buildScheduleLabel(slots) : '', instructor: teacher?.name || 'Por asignar', instructorUid: teacher?.uid || null,
        capacity: AULA_CAPACITY, status: 'open', classLink: null, enrolledCount: 0, createdAt: nowIso, demo: true,
      } });
      // Calendario de clases (solo si el curso ya tiene docente a quien asignarlas).
      if (teacher && slots.length) {
        buildRecurringSessions({ slots, weeksLabel: '8' }, start).forEach((e, n) => {
          docs.liveSessions.push({ id: `${id}-clase-${n + 1}`, data: {
            courseId: course.id, courseTitle: course.title, title: e.title, instructor: teacher.name, instructorUid: teacher.uid,
            startsAt: e.startsAt, durationMin: e.durationMin, roomName: `netwise-academy-${course.id}-${id}-${n + 1}`, status: 'upcoming', groupId: id, generated: true, demo: true,
          } });
        });
      }
      return { id, name, started: k === 0, count: 0 };
    });

    // 3. Matrícula y pedido pagado de cada alumno.
    const sessions = getOrderedSessions(modules);
    const deliverables = allDeliverableModules(modules);
    const dictated = sessions.slice(0, Math.min(4, sessions.length));
    students.forEach((p, i) => {
      const aula = i < toAssign ? aulas[i % aulas.length] : null;
      if (aula) aula.count += 1;
      const paidAt = new Date(now - (2 + ((i * 3 + ci * 5) % 24)) * DAY_MS).toISOString();
      orderN += 1;
      docs.enrollments.push({ id: `${p.uid}_${course.id}`, data: {
        uid: p.uid, studentName: p.name, studentEmail: p.email, courseId: course.id, courseTitle: course.title,
        groupId: aula?.id || null, groupName: aula?.name || null, status: 'active', reason: 'Matrícula de ejemplo',
        completedLessonIds: [], progress: aula?.started ? Math.round(rand() * 6) * 10 : 0, enrolledAt: paidAt, demo: true,
      } });
      docs.orders.push({ id: `demo-pedido-${orderN}`, data: {
        code: `NW-EJ${String(orderN).padStart(4, '0')}`, uid: p.uid, studentName: p.name, studentEmail: p.email, courseId: course.id, courseTitle: course.title,
        amount: course.price, paymentMethod: METHODS[(i + ci) % METHODS.length], couponId: null, couponCode: null,
        proofCode: String(10000000 + Math.floor(rand() * 89999999)), proofUrl: null, status: 'paid', createdAt: paidAt, demo: true,
      } });

      // 4. En el aula que ya empezó: asistencia de las sesiones dictadas y entregas.
      if (!aula?.started) return;
      dictated.forEach((s) => {
        const r = rand();
        docs.attendance.push({ id: `${p.uid}_${course.id}_${s.id}`, data: {
          courseId: course.id, sessionId: s.id, moduleId: s.moduleId, uid: p.uid, studentName: p.name,
          present: r < 0.92, late: r >= 0.85 && r < 0.92, excused: false, updatedAt: nowIso, demo: true,
        } });
      });
      deliverables.slice(0, 2).forEach((m, mi) => {
        const r = rand();
        if (r > (mi === 0 ? 0.85 : 0.35)) return; // no todos entregan
        const reviewed = mi === 0 && r < 0.6;
        docs.submissions.push({ id: `${p.uid}_${course.id}_${m.id}`, data: {
          courseId: course.id, moduleId: m.id, moduleTitle: m.title, uid: p.uid, studentName: p.name,
          deliverableTitle: m.deliverable.description, note: 'https://drive.google.com/file/d/ejemplo/view', status: reviewed ? 'reviewed' : 'submitted',
          ...(reviewed ? { grade: 11 + Math.floor(rand() * 9), feedback: 'Buen avance. Revisa los criterios que faltan para la siguiente entrega.' } : {}),
          submittedAt: paidAt, updatedAt: nowIso, demo: true,
        } });
      });
    });

    aulas.filter((a) => a.started && dictated.length && a.count > 0).forEach((a) => {
      docs.groupProgress.push({ id: a.id, data: { groupId: a.id, courseId: course.id, doneSessionIds: dictated.map((s) => s.id), updatedAt: nowIso, demo: true } });
    });
  });

  // 5. Pedidos por revisar en Ventas: algunos pendientes y uno rechazado.
  const extras = demoPeople(size + 4).slice(size);
  extras.forEach((p, i) => {
    const course = sellable[i % sellable.length];
    orderN += 1;
    docs.orders.push({ id: `demo-pedido-${orderN}`, data: {
      code: `NW-EJ${String(orderN).padStart(4, '0')}`, uid: p.uid, studentName: p.name, studentEmail: p.email, courseId: course.id, courseTitle: course.title,
      amount: course.price, paymentMethod: 'yape', couponId: null, couponCode: null, proofCode: String(20000000 + i), proofUrl: null,
      status: i === 3 ? 'rejected' : 'pending', ...(i === 3 ? { rejectReason: 'No encontramos el pago con ese N.° de operación', rejectedAt: nowIso } : {}),
      createdAt: new Date(now - i * 3600 * 1000).toISOString(), demo: true,
    } });
  });

  const unassigned = docs.enrollments.filter((e) => !e.data.groupId).length;
  return { docs, summary: { students: people.length, enrollments: docs.enrollments.length, groups: docs.groups.length, unassigned, classes: docs.liveSessions.length, orders: docs.orders.length, submissions: docs.submissions.length, attendance: docs.attendance.length } };
};

// Colecciones que pueden tener documentos de ejemplo, en el orden en que se borran.
export const DEMO_COLLECTIONS = ['attendance', 'submissions', 'groupProgress', 'liveSessions', 'orders', 'enrollments', 'groups'];
