// Las clases en vivo nuevas se guardan con zona horaria de Perú
// ("2026-08-11T19:00-05:00"). Las creadas antes quedaron sin zona
// ("2026-08-11T19:00") y cada persona las interpreta en SU zona horaria.
// Este script les agrega "-05:00" (todas se programaron en hora de Perú).
//
// Por defecto solo MUESTRA lo que cambiaría (simulacro). Para aplicarlo:
//   node scripts/fixLiveSessionOffsets.mjs --apply
// Requiere serviceAccountKey.json en la raíz (Admin SDK, no toca las reglas).
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

const apply = process.argv.includes('--apply');
const NO_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

const snap = await db.collection('liveSessions').get();
let pending = 0;
for (const d of snap.docs) {
  const startsAt = d.data().startsAt;
  if (typeof startsAt !== 'string' || !NO_OFFSET.test(startsAt)) continue;
  pending += 1;
  console.log(`${apply ? 'actualiza' : 'cambiaría'} ${d.id}: ${startsAt} -> ${startsAt}-05:00`);
  if (apply) await d.ref.update({ startsAt: `${startsAt}-05:00` });
}

console.log(pending === 0
  ? '✔ Todas las clases ya tienen zona horaria.'
  : (apply ? `✔ ${pending} clase(s) actualizada(s).` : `Simulacro: ${pending} clase(s) por actualizar. Corre con --apply para aplicarlo.`));
process.exit(0);
