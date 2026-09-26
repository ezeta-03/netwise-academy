// Siembra el primer admin en los Firebase Emulators locales (proyecto
// demo-netwise). Solo habla con 127.0.0.1: nunca toca producción.
// Las reglas no permiten auto-asignarse 'admin', así que el rol se escribe con
// el token "owner" del emulador (salta reglas).
//
// Uso: npm run emulators  (en otra terminal)  →  node scripts/seedEmulator.mjs
import { QA_ACCOUNTS } from './qaAccounts.mjs';

const PROJECT = 'demo-netwise';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;

const signUpOrIn = async ({ email, password, displayName }) => {
  let res = await fetch(`${AUTH}/accounts:signUp?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
  });
  if (!res.ok) {
    res = await fetch(`${AUTH}/accounts:signInWithPassword?key=demo-key`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
  }
  if (!res.ok) throw new Error(`Auth ${email}: ${await res.text()}`);
  return (await res.json()).localId;
};

const { admin } = QA_ACCOUNTS;
const uid = await signUpOrIn(admin);
const res = await fetch(`${FS}/users/${uid}`, {
  method: 'PATCH',
  headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields: {
    email: { stringValue: admin.email },
    displayName: { stringValue: admin.displayName },
    role: { stringValue: 'admin' },
    createdAt: { stringValue: new Date().toISOString() },
  } }),
});
if (!res.ok) throw new Error(`Firestore: ${await res.text()}`);
console.log(`✔ Admin sembrado en el emulador: ${admin.email} (uid ${uid})`);
