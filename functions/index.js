// Cloud Functions de Netwise Academy (requieren el plan Blaze).
//
// askAssistant: proxy del Asistente IA (Docente y Alumno) hacia Groq. Antes
// el navegador llamaba a Groq directo con VITE_GROQ_API_KEY, así que la clave
// viajaba dentro del bundle público. Ahora vive como secreto de Functions:
//   npx firebase-tools functions:secrets:set GROQ_API_KEY
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

initializeApp();
const db = getFirestore();

const GROQ_API_KEY = defineSecret('GROQ_API_KEY');
const MODEL = 'openai/gpt-oss-20b';
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

// Topes para que la función no sirva de proxy gratuito a cualquier LLM.
const DAILY_LIMIT = 80;
const MAX_SYSTEM = 24000;
const MAX_MESSAGE = 2000;
const MAX_HISTORY = 20;
const MAX_HISTORY_TEXT = 4000;

const str = (v) => (typeof v === 'string' ? v : '');

// Contador por usuario y día (hora de Perú) en `aiUsage/{uid}_{YYYY-MM-DD}`.
// Solo lo toca el Admin SDK: las reglas de Firestore no lo exponen.
const consumeQuota = async (uid) => {
  const day = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
  const ref = db.collection('aiUsage').doc(`${uid}_${day}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? snap.data().count || 0 : 0;
    if (count >= DAILY_LIMIT) return false;
    tx.set(ref, { uid, day, count: FieldValue.increment(1), updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  });
};

export const askAssistant = onCall(
  { secrets: [GROQ_API_KEY], region: 'us-central1', maxInstances: 5, timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Inicia sesión para usar el asistente.');

    const { systemInstruction, history, message } = request.data || {};
    const text = str(message).trim();
    if (!text) throw new HttpsError('invalid-argument', 'Mensaje vacío.');
    if (text.length > MAX_MESSAGE) throw new HttpsError('invalid-argument', 'El mensaje es demasiado largo.');

    const turns = (Array.isArray(history) ? history : [])
      .slice(-MAX_HISTORY)
      .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && str(m.text).trim())
      .map((m) => ({ role: m.role, content: str(m.text).slice(0, MAX_HISTORY_TEXT) }));

    if (!(await consumeQuota(request.auth.uid))) {
      throw new HttpsError('resource-exhausted', 'Llegaste al límite diario del asistente. Vuelve mañana.');
    }

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY.value()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: str(systemInstruction).slice(0, MAX_SYSTEM) }, ...turns, { role: 'user', content: text }],
        temperature: 0.6,
        max_tokens: 700,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      console.error('Groq error', res.status, err?.error?.message);
      throw new HttpsError('unavailable', 'El modelo no respondió.');
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new HttpsError('unavailable', 'Respuesta vacía del modelo.');
    return { text: reply };
  },
);

// createAccessLink: enlace de un solo uso para que una persona cree (o cambie)
// su contraseña en la página propia de la academia (/auth/accion). Lo pide el
// admin desde Equipo y permisos y se lo pasa al docente por WhatsApp: así el
// alta no depende de las plantillas de correo de Firebase, que este proyecto
// no puede editar. Solo un admin puede generarlo.
const ACCESS_LINK_ORIGINS = ['https://netwiseacademy.pe', 'https://www.netwiseacademy.pe', 'https://netwise-academy-2ea16.web.app'];
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// Las funciones de administración de cuentas solo las llama un admin.
const assertAdmin = async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  const caller = await db.collection('users').doc(request.auth.uid).get();
  if (caller.data()?.role !== 'admin') throw new HttpsError('permission-denied', 'Solo un administrador puede hacer esto.');
};
const ADMIN_CALL = { region: 'us-central1', maxInstances: 5, timeoutSeconds: 30 };

export const createAccessLink = onCall(
  ADMIN_CALL,
  async (request) => {
    await assertAdmin(request);

    const email = str(request.data?.email).trim().toLowerCase();
    if (!email) throw new HttpsError('invalid-argument', 'Falta el correo.');
    const requested = str(request.data?.origin);
    const origin = ACCESS_LINK_ORIGINS.includes(requested) || LOCAL_ORIGIN.test(requested) ? requested : ACCESS_LINK_ORIGINS[0];

    let firebaseLink;
    try {
      firebaseLink = await getAuth().generatePasswordResetLink(email);
    } catch (err) {
      if (err?.code === 'auth/user-not-found' || err?.code === 'auth/email-not-found') throw new HttpsError('not-found', 'No existe una cuenta con ese correo.');
      console.error('generatePasswordResetLink', err?.code, err?.message);
      throw new HttpsError('internal', 'No se pudo generar el enlace.');
    }
    // Del enlace de Firebase solo se usa el código: el destino es nuestra página.
    const oobCode = new URL(firebaseLink).searchParams.get('oobCode');
    if (!oobCode) throw new HttpsError('internal', 'No se pudo generar el enlace.');
    return { link: `${origin}/auth/accion?mode=resetPassword&oobCode=${encodeURIComponent(oobCode)}` };
  },
);

// findAccountByEmail: uid de la cuenta de acceso de un correo, o null. Sirve
// para recuperar una cuenta que quedó sin perfil (se borró el perfil pero no el
// acceso): el alta de docente la reutiliza en vez de fallar por correo repetido.
export const findAccountByEmail = onCall(ADMIN_CALL, async (request) => {
  await assertAdmin(request);
  const email = str(request.data?.email).trim().toLowerCase();
  if (!email) throw new HttpsError('invalid-argument', 'Falta el correo.');
  try {
    const user = await getAuth().getUserByEmail(email);
    return { uid: user.uid, displayName: user.displayName || null };
  } catch (err) {
    if (err?.code === 'auth/user-not-found') return { uid: null };
    console.error('getUserByEmail', err?.code, err?.message);
    throw new HttpsError('internal', 'No se pudo consultar la cuenta.');
  }
});

// deleteUserAccount: borra de verdad a un usuario -- su cuenta de acceso y su
// perfil -- y lo quita como docente de los cursos que tuviera. No toca sus
// matrículas, pedidos ni entregas (historial de la academia). Nadie puede
// borrarse a sí mismo ni borrar a otro admin desde acá.
export const deleteUserAccount = onCall(ADMIN_CALL, async (request) => {
  await assertAdmin(request);
  const uid = str(request.data?.uid).trim();
  if (!uid) throw new HttpsError('invalid-argument', 'Falta el usuario.');
  if (uid === request.auth.uid) throw new HttpsError('failed-precondition', 'No puedes eliminar tu propia cuenta.');
  const profile = await db.collection('users').doc(uid).get();
  if (profile.data()?.role === 'admin') throw new HttpsError('failed-precondition', 'Primero cámbiale el rol: no se elimina a un administrador.');

  try {
    await getAuth().deleteUser(uid);
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') {
      console.error('deleteUser', err?.code, err?.message);
      throw new HttpsError('internal', 'No se pudo eliminar la cuenta de acceso.');
    }
  }
  await db.collection('users').doc(uid).delete();
  const taught = await db.collection('courseOfferings').where('teacherUid', '==', uid).get();
  await Promise.all(taught.docs.map((d) => d.ref.update({ teacherUid: null })));
  return { deleted: true, coursesUnassigned: taught.size };
});
