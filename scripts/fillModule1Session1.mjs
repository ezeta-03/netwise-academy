// Completa el detalle desplegable de la Sesión 01 del Módulo 1 de "Redes
// Sociales & IA" (Aprenderás / Harás en clase / Tarea). Solo toca esa sesión
// y solo los campos vacíos: no pisa lo que el docente ya haya editado.
//
// Uso: node scripts/fillModule1Session1.mjs
// Requiere serviceAccountKey.json en la raíz (Admin SDK).
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url)));
} catch {
  console.error('No se encontró serviceAccountKey.json en la raíz del proyecto.');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const MODULE_1_ID = 'm_1788190829966_ktr3v';
const SESSION_ID = 's_1';
const DETAIL = {
  learn: 'Canales propios, ganados y pagados. Rol de cada red en el recorrido del cliente: atraer, convencer y convertir. Arquitectura de canales y puntos de fuga.',
  doInClass: 'Dibuja en grupo el mapa de canales de una marca de caso y detecta dónde se pierde el usuario antes de comprar.',
  task: 'Mapea los canales de tu proyecto: qué red atrae, cuál convence y dónde se concreta la venta.',
};

const docRef = db.collection('courseContent').doc('1');
const snap = await docRef.get();
if (!snap.exists) {
  console.error('No existe courseContent/1.');
  process.exit(1);
}

let touched = [];
const modules = snap.data().modules.map((m) => {
  if (m.id !== MODULE_1_ID) return m;
  return {
    ...m,
    sessions: (m.sessions || []).map((s) => {
      if (s.id !== SESSION_ID) return s;
      const next = { ...s };
      for (const [k, v] of Object.entries(DETAIL)) {
        if (!String(s[k] || '').trim()) { next[k] = v; touched.push(k); }
      }
      return next;
    }),
  };
});

if (touched.length === 0) {
  console.log('La Sesión 01 ya tenía su detalle completo: no se cambió nada.');
  process.exit(0);
}
await docRef.update({ modules, updatedAt: new Date().toISOString() });
console.log(`✔ Sesión 01 del Módulo 1 completada (${touched.join(', ')}).`);
process.exit(0);
