// SOLO LECTURA sobre el proyecto real (serviceAccountKey.json). Revisa que los
// datos de producción sean compatibles con las reglas de Firestore actuales
// antes de desplegarlas: no escribe ni borra nada.
//
// Uso: node scripts/checkProductionReadiness.mjs
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url)));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
console.log(`Proyecto: ${serviceAccount.project_id}\n`);

const all = async (name) => (await db.collection(name).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const [users, enrollments, orders, groups, liveSessions, offerings, content, workGroups, posts, rooms, submissions] = await Promise.all(
  ['users', 'enrollments', 'orders', 'groups', 'liveSessions', 'courseOfferings', 'courseContent', 'workGroups', 'communityPosts', 'privateRooms', 'submissions'].map(all),
);

const byRole = users.reduce((m, u) => ({ ...m, [u.role || '(sin rol)']: (m[u.role || '(sin rol)'] || 0) + 1 }), {});
console.log('Usuarios por rol:', byRole);
console.log('Documentos:', { enrollments: enrollments.length, orders: orders.length, groups: groups.length, liveSessions: liveSessions.length, submissions: submissions.length, workGroups: workGroups.length, communityPosts: posts.length, privateRooms: rooms.length });

const problems = [];
const userIds = new Set(users.map((u) => u.id));
const isActive = (e) => (e.status || 'active') === 'active';

// 1. El acceso del alumno exige una matrícula con id `${uid}_${courseId}`.
const badIds = enrollments.filter((e) => isActive(e) && userIds.has(e.uid) && e.id !== `${e.uid}_${e.courseId}`);
if (badIds.length) problems.push({ problema: 'Matrículas activas de cuentas reales con id distinto de uid_curso (perderían acceso)', cantidad: badIds.length, ejemplos: badIds.slice(0, 5).map((e) => `${e.id} (curso ${e.courseId})`).join(', ') });

// 2. Clases, aulas, equipos, comunidad y salas se leen por curso: necesitan courseId.
for (const [name, list] of [['liveSessions', liveSessions], ['groups', groups], ['workGroups', workGroups], ['communityPosts', posts], ['privateRooms', rooms]]) {
  const missing = list.filter((d) => d.courseId === undefined || d.courseId === null || d.courseId === '');
  if (missing.length) problems.push({ problema: `${name} sin courseId (solo las vería el admin)`, cantidad: missing.length, ejemplos: missing.slice(0, 5).map((d) => d.id).join(', ') });
}

// 3. Un docente solo gestiona los cursos que tiene asignados.
const teachers = users.filter((u) => u.role === 'teacher');
const assigned = new Set(offerings.map((o) => o.teacherUid).filter(Boolean));
const idle = teachers.filter((t) => !assigned.has(t.id));
if (idle.length) problems.push({ problema: 'Docentes sin ningún curso asignado (no verán cursos)', cantidad: idle.length, ejemplos: idle.map((t) => t.displayName || t.email).slice(0, 5).join(', ') });
const taught = new Set(liveSessions.map((s) => String(s.courseId)));
const noTeacher = [...taught].filter((c) => !offerings.find((o) => o.id === c)?.teacherUid);
if (noTeacher.length) problems.push({ problema: 'Cursos con clases programadas pero sin docente asignado en Cursos y precios', cantidad: noTeacher.length, ejemplos: noTeacher.join(', ') });

// 4. Alumnos con matrícula activa pero aula inexistente (verían "sin aula").
const groupIds = new Set(groups.map((g) => g.id));
const orphan = enrollments.filter((e) => isActive(e) && e.groupId && !groupIds.has(e.groupId));
if (orphan.length) problems.push({ problema: 'Matrículas que apuntan a un aula que ya no existe', cantidad: orphan.length, ejemplos: orphan.slice(0, 5).map((e) => e.id).join(', ') });
const noGroup = enrollments.filter((e) => isActive(e) && userIds.has(e.uid) && !e.groupId);

// 5. Entregas de alumnos sin matrícula activa (ya no podrían reemplazarlas).
const activeKeys = new Set(enrollments.filter(isActive).map((e) => `${e.uid}_${e.courseId}`));
const strays = submissions.filter((s) => !activeKeys.has(`${s.uid}_${s.courseId}`));

console.log('\nInformativo:');
console.log(`- Matrículas activas: ${enrollments.filter(isActive).length} (${noGroup.length} de cuentas reales sin aula: verán el aviso "todavía no tienes aula" y no verán calendario)`);
console.log(`- Pedidos pendientes: ${orders.filter((o) => o.status === 'pending').length}`);
console.log(`- Cursos con precio y promoción guardados (validación del importe activa): ${offerings.filter((o) => 'price' in o && 'promoPercent' in o).map((o) => o.id).join(', ') || 'ninguno todavía -- se guardan al abrir el panel de Admin'}`);
console.log(`- Cursos con contenido: ${content.map((c) => c.id).join(', ') || 'ninguno'}`);
console.log(`- Entregas de alumnos sin matrícula activa: ${strays.length}`);
console.log(`- Clases generadas con aula (groupId): ${liveSessions.filter((s) => s.groupId).length} de ${liveSessions.length}`);

console.log(problems.length ? '\nPROBLEMAS QUE RESOLVER ANTES DE DESPLEGAR LAS REGLAS:' : '\nSin problemas: los datos son compatibles con las reglas nuevas.');
if (problems.length) console.table(problems);
process.exit(0);
