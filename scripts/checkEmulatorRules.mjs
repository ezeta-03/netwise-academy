// Comprueba contra los Firebase Emulators (npm run emulators) que un alumno NO
// puede matricularse solo, crear pedidos pagados ni pasarse del tope de un
// cupón. Usa las cuentas de scripts/qaAccounts.mjs.
//
// Uso: node scripts/checkEmulatorRules.mjs
import { QA_ACCOUNTS } from './qaAccounts.mjs';

const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const FS = 'http://127.0.0.1:8080/v1/projects/demo-netwise/databases/(default)/documents';

const signIn = async ({ email, password }) => {
  const res = await fetch(`${AUTH}/accounts:signInWithPassword?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!res.ok) throw new Error(`login ${email}: ${await res.text()}`);
  return res.json();
};

const toFields = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k,
  typeof v === 'number' ? { integerValue: String(v) } : v === null ? { nullValue: null } : { stringValue: String(v) }]));

const write = (token, path, data) => fetch(`${FS}/${path}`, {
  method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields: toFields(data) }),
}).then((r) => r.status);

const { localId: uid, idToken } = await signIn(QA_ACCOUNTS.student);
const results = [];
const expect = (name, status, ok) => results.push({ name, status, pass: ok(status) });

expect('Alumno se matricula solo en el curso 1 (debe fallar)',
  await write(idToken, `enrollments/${uid}_1`, { uid, courseId: 1, courseTitle: 'x', progress: 0 }), (s) => s === 403);
expect('Alumno crea pedido "paid" (debe fallar)',
  await write(idToken, `orders/qa-paid-${Date.now()}`, { uid, courseId: 1, amount: 0, status: 'paid' }), (s) => s === 403);
const pendingId = `qa-pending-${Date.now()}`;
expect('Alumno crea pedido "pending" (debe funcionar)',
  await write(idToken, `orders/${pendingId}`, { uid, courseId: 1, amount: 100, status: 'pending' }), (s) => s === 200);
// Limpieza: el pedido de prueba no debe quedar en Ventas.
await fetch(`${FS}/orders/${pendingId}`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
expect('Alumno se cambia el estado de su matrícula (debe fallar)',
  await fetch(`${FS}/enrollments/${uid}_2?updateMask.fieldPaths=status`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { status: { stringValue: 'suspended' } } }),
  }).then((r) => r.status), (s) => s === 403);

console.table(results);
process.exitCode = results.every((r) => r.pass) ? 0 : 1;
