// Siembra inicial de Firestore con los datos mock del proyecto.
// Uso: node --env-file=.env.local scripts/seed.mjs
// Requiere que las reglas de Firestore permitan escritura (ver README para el
// flujo recomendado: abrir reglas temporalmente, sembrar, volver a cerrarlas).
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';
import { COURSES, CATEGORIES, LIVE_SESSIONS } from '../src/lib/data.js';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId) {
  console.error('Faltan variables VITE_FIREBASE_* en el entorno. Corre con: node --env-file=.env.local scripts/seed.mjs');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const seedCollection = async (name, items) => {
  for (const item of items) {
    const { id, ...data } = item;
    await setDoc(doc(collection(db, name), id.toString()), data);
  }
  console.log(`✔ ${items.length} documentos escritos en "${name}"`);
};

await seedCollection('courses', COURSES);
await seedCollection('categories', CATEGORIES);
await seedCollection('liveSessions', LIVE_SESSIONS);

console.log('Siembra completada.');
process.exit(0);
