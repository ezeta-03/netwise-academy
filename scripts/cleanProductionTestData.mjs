// Limpia los datos de PRUEBA del proyecto real (serviceAccountKey.json).
// IRREVERSIBLE cuando se ejecuta con --confirmar. Sin esa opción solo cuenta
// lo que borraría y no toca nada.
//
//   node scripts/cleanProductionTestData.mjs                 -> simulación
//   node scripts/cleanProductionTestData.mjs --confirmar     -> borra
//
// Opciones (se suman a lo de abajo):
//   --docentes   borra también las cuentas con rol docente
//   --aulas      borra también aulas y clases en vivo programadas
//   --cupones    borra también los cupones
//   --historial  borra también el historial de cambios del admin
//   --conservar=correo1,correo2   no borra esas cuentas (p. ej. un docente real)
//
// SIEMPRE se borra: cuentas de alumno (acceso y perfil), matrículas, pedidos,
// entregas, asistencia, notas, avance por aula, equipos, comunidad, salas
// privadas, soporte, proyectos, preinscripciones y los archivos subidos
// (comprobantes de pago y entregables).
// NUNCA se borra: cuentas admin, leads del programa y de las masterclass
// (son personas reales interesadas), contenido de los cursos, precios y
// configuración de la academia.
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

const args = new Set(process.argv.slice(2));
const CONFIRM = args.has('--confirmar');
const serviceAccount = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url)));
initializeApp({ credential: cert(serviceAccount), storageBucket: process.env.NW_BUCKET || `${serviceAccount.project_id}.firebasestorage.app` });
const db = getFirestore();
const auth = getAuth();

console.log(`Proyecto: ${serviceAccount.project_id}`);
console.log(CONFIRM ? '*** MODO BORRADO: esto no se puede deshacer ***\n' : 'Simulación: no se borra nada (añade --confirmar para borrar).\n');

const ALWAYS = ['enrollments', 'orders', 'submissions', 'attendance', 'courseGrades', 'groupProgress', 'workGroups', 'communityPosts', 'privateRooms', 'supportRequests', 'projectProfiles', 'projectAdvances', 'preregistrations', 'aiUsage'];
const OPTIONAL = { '--aulas': ['groups', 'liveSessions'], '--cupones': ['coupons'], '--historial': ['auditLog'] };
const collections = [...ALWAYS, ...Object.entries(OPTIONAL).filter(([flag]) => args.has(flag)).flatMap(([, list]) => list)];

const report = [];
const deleteDocs = async (refs) => {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
};

// 1. Colecciones de datos.
for (const name of collections) {
  const snap = await db.collection(name).get();
  report.push({ qué: name, cantidad: snap.size, acción: CONFIRM ? 'borrado' : 'se borraría' });
  if (CONFIRM && snap.size) await deleteDocs(snap.docs.map((d) => d.ref));
}

// 2. Cuentas: se conservan los admin (y los docentes salvo --docentes).
const profiles = (await db.collection('users').get()).docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
const roleOf = new Map(profiles.map((p) => [p.id, p.role || 'student']));
const keepRole = (role) => role === 'admin' || (role === 'teacher' && !args.has('--docentes'));
const authUsers = [];
let pageToken;
do {
  const page = await auth.listUsers(1000, pageToken);
  authUsers.push(...page.users);
  pageToken = page.pageToken;
} while (pageToken);
// --conservar=correo1,correo2 salva cuentas concretas (p. ej. un docente real).
const keepEmails = new Set([...args].filter((a) => a.startsWith('--conservar=')).flatMap((a) => a.slice('--conservar='.length).split(',')).map((e) => e.trim().toLowerCase()).filter(Boolean));
const keptUids = new Set(authUsers.filter((u) => keepEmails.has((u.email || '').toLowerCase())).map((u) => u.uid));
profiles.filter((p) => keepEmails.has((p.email || '').toLowerCase())).forEach((p) => keptUids.add(p.id));
// Una cuenta sin perfil cuenta como alumno (así las crea la app).
const authToDelete = authUsers.filter((u) => !keptUids.has(u.uid) && !keepRole(roleOf.get(u.uid) || 'student'));
const profilesToDelete = profiles.filter((p) => !keptUids.has(p.id) && !keepRole(p.role || 'student'));
const row = (u) => ({ correo: u.email, nombre: u.displayName || '', rol: roleOf.get(u.uid) || '(sin perfil)' });
console.log('Cuentas que se CONSERVAN:');
console.table(authUsers.filter((u) => !authToDelete.includes(u)).map(row));
console.log(`Cuentas que se ${CONFIRM ? 'BORRAN' : 'BORRARÍAN'}:`);
console.table(authToDelete.map(row));
report.push({ qué: 'cuentas de acceso (Auth)', cantidad: authToDelete.length, acción: CONFIRM ? 'borrado' : 'se borraría' });
report.push({ qué: 'perfiles (users)', cantidad: profilesToDelete.length, acción: CONFIRM ? 'borrado' : 'se borraría' });
if (CONFIRM) {
  for (let i = 0; i < authToDelete.length; i += 1000) await auth.deleteUsers(authToDelete.slice(i, i + 1000).map((u) => u.uid));
  await deleteDocs(profilesToDelete.map((p) => p.ref));
  // Un curso no puede quedar asignado a un docente que ya no existe.
  if (args.has('--docentes')) {
    const gone = new Set([...profilesToDelete.map((p) => p.id), ...authToDelete.map((u) => u.uid)]);
    for (const d of (await db.collection('courseOfferings').get()).docs) {
      if (gone.has(d.data().teacherUid)) await d.ref.update({ teacherUid: null });
    }
  }
}

// 3. Archivos subidos por alumnos.
try {
  const bucket = getStorage().bucket();
  for (const prefix of ['paymentProofs/', 'submissions/']) {
    const [files] = await bucket.getFiles({ prefix });
    report.push({ qué: `archivos ${prefix}`, cantidad: files.length, acción: CONFIRM ? 'borrado' : 'se borraría' });
    if (CONFIRM) for (const f of files) await f.delete().catch(() => {});
  }
} catch (e) {
  report.push({ qué: 'archivos subidos', cantidad: '?', acción: `no se pudo acceder al bucket (${e.message.slice(0, 60)})` });
}

console.table(report);
const kept = {};
for (const name of ['masterclassLeads', 'programLeads', 'courseContent', 'courseOfferings', 'settings', ...Object.values(OPTIONAL).flat().filter((c) => !collections.includes(c))]) {
  kept[name] = (await db.collection(name).count().get()).data().count;
}
console.log('Se conserva (documentos):', kept);
console.log(CONFIRM ? '\nLimpieza terminada.' : '\nNada fue modificado. Si el resumen es correcto, repite el comando con --confirmar.');
process.exit(0);
