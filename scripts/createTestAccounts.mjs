// Crea (o actualiza) 3 cuentas reales en Firebase Auth + su rol en Firestore:
// un admin, un docente y un estudiante de prueba.
//
// Requiere una clave de cuenta de servicio guardada como serviceAccountKey.json
// en la raíz del proyecto (gitignored). Se descarga desde:
// Consola de Firebase → Configuración del proyecto → Cuentas de servicio →
// "Generar nueva clave privada".
//
// Uso: node scripts/createTestAccounts.mjs
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url)));
} catch {
  console.error('No se encontró serviceAccountKey.json en la raíz del proyecto. Ver instrucciones arriba en este archivo.');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();
const db = getFirestore();

const ACCOUNTS = [
  { email: 'admin@netwise.com', password: 'Netwise2026!', displayName: 'System Admin', role: 'admin' },
  { email: 'profe@netwise.com', password: 'Netwise2026!', displayName: 'Carlos Profesor', role: 'teacher' },
  { email: 'demo@netwise.com', password: 'Netwise2026!', displayName: 'Ana Estudiante', role: 'student' },
];

for (const acc of ACCOUNTS) {
  let user;
  try {
    user = await auth.getUserByEmail(acc.email);
    await auth.updateUser(user.uid, { password: acc.password, displayName: acc.displayName });
    console.log(`↻ ${acc.email} ya existía — contraseña y nombre actualizados.`);
  } catch {
    user = await auth.createUser({ email: acc.email, password: acc.password, displayName: acc.displayName });
    console.log(`✔ ${acc.email} creado.`);
  }

  await db.collection('users').doc(user.uid).set({
    email: acc.email,
    displayName: acc.displayName,
    role: acc.role,
    createdAt: new Date().toISOString(),
  }, { merge: true });
  console.log(`  → role: ${acc.role} (uid: ${user.uid})`);
}

console.log('\nListo. Credenciales de prueba:');
ACCOUNTS.forEach(a => console.log(`  ${a.email} / ${a.password}  →  ${a.role}`));
process.exit(0);
