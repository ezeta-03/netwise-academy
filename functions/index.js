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
import { randomBytes } from 'node:crypto';
import process from 'node:process';

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
  // Su cuenta de Google Workspace no se borra: solo se suelta el vínculo.
  await db.collection('institutionalAccounts').doc(uid).delete();
  const taught = await db.collection('courseOfferings').where('teacherUid', '==', uid).get();
  await Promise.all(taught.docs.map((d) => d.ref.update({ teacherUid: null })));
  return { deleted: true, coursesUnassigned: taught.size };
});

// provisionInstitutionalAccount: correo institucional (nombre@netwiseacademy.pe)
// de una persona de la plataforma. Crea la cuenta en Google (Cloud Identity
// Free, sin buzón) con la Directory API y la enlaza a su cuenta de acceso, para
// que también pueda entrar con "Continuar con Google". Con `reset` le genera
// otra contraseña temporal; con `useExisting` adopta una dirección que ya
// existía en Google en vez de crearla.
//
// La función se autentica con su propia cuenta de servicio, sin clave: en
// admin.google.com esa cuenta de servicio debe tener el rol "Administrador de
// gestión de usuarios", y el proyecto, la Admin SDK API habilitada.
//
// El vínculo vive en `institutionalAccounts/{uid}`, que solo escribe el Admin
// SDK: si estuviera en el perfil, el propio alumno podría apuntarlo al correo
// de otra persona y heredar su contraseña en el siguiente restablecimiento.
const WORKSPACE_DOMAIN = 'netwiseacademy.pe';
const DIRECTORY_USERS = 'https://admin.googleapis.com/admin/directory/v1/users';
const DIRECTORY_SCOPE = 'https://www.googleapis.com/auth/admin.directory.user';
const METADATA_TOKEN = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
const LOCAL_PART = /^[a-z0-9]+([._-][a-z0-9]+)*$/;
const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';

// Sin caracteres que se confunden al dictarla o copiarla (0/O, 1/l/I).
const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const tempPassword = () => Array.from(randomBytes(12), (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('');

const directoryFetch = async (path, { method = 'GET', body } = {}) => {
  const tokenRes = await fetch(`${METADATA_TOKEN}?scopes=${encodeURIComponent(DIRECTORY_SCOPE)}`, { headers: { 'Metadata-Flavor': 'Google' } });
  const { access_token: token } = tokenRes.ok ? await tokenRes.json() : {};
  if (!token) {
    console.error('directory token', tokenRes.status);
    throw new HttpsError('internal', 'No se pudo conectar con Google Workspace.');
  }
  const res = await fetch(`${DIRECTORY_USERS}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401 || res.status === 403) {
    console.error('directory', method, res.status, data?.error?.message);
    throw new HttpsError('failed-precondition', 'Google Workspace todavía no autoriza a la plataforma a gestionar usuarios.');
  }
  return { status: res.status, ok: res.ok, data };
};

const setDirectoryPassword = async (email, password) => {
  const res = await directoryFetch(`/${encodeURIComponent(email)}`, { method: 'PUT', body: { password, changePasswordAtNextLogin: true } });
  if (res.status === 404) throw new HttpsError('not-found', 'Esa cuenta ya no existe en Google Workspace.');
  if (!res.ok) {
    console.error('directory password', res.status, res.data?.error?.message);
    throw new HttpsError('internal', 'No se pudo cambiar la contraseña en Google Workspace.');
  }
};

const emailTaken = async (email) => !(await db.collection('institutionalAccounts').where('email', '==', email).limit(1).get()).empty;

// Crea la cuenta en Google (o, con `useExisting`, adopta una que ya estaba y le
// cambia la contraseña) y devuelve su id de Google. Lanza 'already-exists' si
// la dirección ya existe y no se pidió adoptarla.
const createDirectoryAccount = async ({ email, displayName, password, recoveryEmail, useExisting = false }) => {
  if (IS_EMULATOR) return null; // Emulador: no se toca Google, solo se registra el vínculo.
  if (useExisting) {
    const found = await directoryFetch(`/${encodeURIComponent(email)}`);
    if (found.status === 404) throw new HttpsError('not-found', 'Esa dirección no existe en Google Workspace.');
    if (!found.ok) throw new HttpsError('internal', 'No se pudo consultar la cuenta en Google Workspace.');
    if (found.data.isAdmin || found.data.isDelegatedAdmin) throw new HttpsError('permission-denied', 'Esa dirección es de un administrador de Google Workspace.');
    await setDirectoryPassword(email, password);
    return found.data.id;
  }
  const [givenName, ...rest] = displayName.split(/\s+/);
  // El correo de recuperación solo sirve si es uno externo de verdad.
  const recovery = recoveryEmail && !recoveryEmail.toLowerCase().endsWith(`@${WORKSPACE_DOMAIN}`) ? { recoveryEmail } : {};
  const created = await directoryFetch('', {
    method: 'POST',
    body: { primaryEmail: email, name: { givenName, familyName: rest.join(' ') || givenName }, password, changePasswordAtNextLogin: true, ...recovery },
  });
  if (created.status === 409) throw new HttpsError('already-exists', 'Esa dirección ya existe en Google Workspace.');
  if (!created.ok) {
    console.error('directory create', created.status, created.data?.error?.message);
    throw new HttpsError('internal', 'No se pudo crear la cuenta en Google Workspace.');
  }
  return created.data.id;
};

// Enlaza la cuenta de Google a la cuenta de acceso de la persona (al entrar con
// Google cae en su mismo perfil y matrículas) y guarda el vínculo. Si ya tenía
// otro Google enlazado no se reemplaza: sigue entrando como antes y el correo
// le sirve para Meet.
const linkAndSaveAccount = async ({ accountRef, uid, email, googleId, displayName, createdBy }) => {
  let linked = false;
  if (googleId) {
    try {
      await getAuth().updateUser(uid, { providerToLink: { providerId: 'google.com', uid: googleId, email, displayName } });
      linked = true;
    } catch (err) {
      console.warn('providerToLink', err?.code, err?.message);
    }
  }
  const now = new Date().toISOString();
  await accountRef.set({ uid, email, googleId, linked, createdAt: now, createdBy, passwordIssuedAt: now });
  return linked;
};

export const provisionInstitutionalAccount = onCall(ADMIN_CALL, async (request) => {
  await assertAdmin(request);
  const uid = str(request.data?.uid).trim();
  if (!uid) throw new HttpsError('invalid-argument', 'Falta el usuario.');
  const profile = (await db.collection('users').doc(uid).get()).data();
  if (!profile) throw new HttpsError('not-found', 'Esa persona no tiene cuenta en la plataforma.');

  const accountRef = db.collection('institutionalAccounts').doc(uid);
  const account = (await accountRef.get()).data();
  const password = tempPassword();

  if (account?.email) {
    if (request.data?.reset !== true) return { email: account.email, linked: !!account.linked };
    if (!IS_EMULATOR) await setDirectoryPassword(account.email, password);
    await accountRef.update({ passwordIssuedAt: new Date().toISOString() });
    return { email: account.email, password, linked: !!account.linked };
  }

  const localPart = str(request.data?.localPart).trim().toLowerCase();
  if (!LOCAL_PART.test(localPart) || localPart.length > 60) throw new HttpsError('invalid-argument', 'La dirección solo admite letras, números y puntos.');
  const email = `${localPart}@${WORKSPACE_DOMAIN}`;
  if (await emailTaken(email)) throw new HttpsError('permission-denied', 'Esa dirección ya es de otra persona de la plataforma.');

  const displayName = str(profile.displayName).trim() || localPart;
  // Única respuesta 'already-exists': el panel ofrece vincular esa cuenta.
  const googleId = await createDirectoryAccount({ email, displayName, password, recoveryEmail: profile.email, useExisting: request.data?.useExisting === true });
  const linked = await linkAndSaveAccount({ accountRef, uid, email, googleId, displayName, createdBy: request.auth.uid });
  return { email, password, linked };
});

// activateInstitutionalAccount: el propio alumno activa su correo de la academia
// desde su panel. La primera vez se lo crea (la dirección sale de su nombre, con
// un número si ya está tomada) y le muestra la contraseña temporal; con `reset`
// le genera otra. Solo para quien ya tiene una matrícula activa -- es decir, el
// admin ya validó su pago -- o es parte del equipo.
const RESET_COOLDOWN_MS = 5 * 60 * 1000;
const PENDING_TTL_MS = 2 * 60 * 1000;

// Misma propuesta que suggestLocalPart en src/lib/institutionalEmail.js.
const NAME_PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do', 'dos', 'van', 'von']);
const suggestLocalPart = (fullName) => {
  const words = str(fullName).split('@')[0]
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/).filter((w) => w && !NAME_PARTICLES.has(w));
  if (words.length <= 1) return words[0] || '';
  return `${words[0]}.${words[words.length >= 4 ? 2 : 1]}`;
};

const hasActiveEnrollment = async (uid) => {
  const snap = await db.collection('enrollments').where('uid', '==', uid).get();
  return snap.docs.some((d) => (d.data().status || 'active') === 'active');
};

// Devuelve el vínculo si la persona ya tiene correo; si no, deja una reserva
// para que dos clics seguidos no creen dos direcciones. Una reserva vieja (la
// función se cortó a medias) se pisa.
const reserveAccount = (accountRef, uid) => db.runTransaction(async (tx) => {
  const data = (await tx.get(accountRef)).data();
  if (data?.email) return data;
  if (data?.pending && Date.now() - Date.parse(data.pendingAt) < PENDING_TTL_MS) throw new HttpsError('aborted', 'Tu correo ya se está creando. Espera un momento.');
  tx.set(accountRef, { uid, pending: true, pendingAt: new Date().toISOString() });
  return null;
});

export const activateInstitutionalAccount = onCall({ region: 'us-central1', maxInstances: 5, timeoutSeconds: 60 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  const uid = request.auth.uid;
  const profile = (await db.collection('users').doc(uid).get()).data();
  if (!profile || profile.disabled) throw new HttpsError('permission-denied', 'Tu cuenta no puede activar un correo.');
  const isTeam = profile.role === 'teacher' || profile.role === 'admin';
  if (!isTeam && !(await hasActiveEnrollment(uid))) throw new HttpsError('failed-precondition', 'Podrás activar tu correo cuando confirmemos tu pago.');

  const accountRef = db.collection('institutionalAccounts').doc(uid);
  const account = await reserveAccount(accountRef, uid);
  const password = tempPassword();

  if (account) {
    if (request.data?.reset !== true) return { email: account.email, linked: !!account.linked };
    if (account.passwordIssuedAt && Date.now() - Date.parse(account.passwordIssuedAt) < RESET_COOLDOWN_MS) {
      throw new HttpsError('resource-exhausted', 'Acabas de generar una contraseña. Espera unos minutos para pedir otra.');
    }
    if (!IS_EMULATOR) await setDirectoryPassword(account.email, password);
    await accountRef.update({ passwordIssuedAt: new Date().toISOString() });
    return { email: account.email, password, linked: !!account.linked };
  }

  try {
    const base = suggestLocalPart(profile.displayName) || suggestLocalPart(profile.email) || 'alumno';
    const displayName = str(profile.displayName).trim() || base;
    for (let n = 1; n <= 9; n += 1) {
      const email = `${n === 1 ? base : `${base}${n}`}@${WORKSPACE_DOMAIN}`;
      if (await emailTaken(email)) continue;
      let googleId;
      try {
        googleId = await createDirectoryAccount({ email, displayName, password, recoveryEmail: profile.email });
      } catch (err) {
        if (err?.code === 'already-exists') continue; // tomada en Google: se prueba la siguiente
        throw err;
      }
      const linked = await linkAndSaveAccount({ accountRef, uid, email, googleId, displayName, createdBy: uid });
      return { email, password, linked };
    }
    throw new HttpsError('internal', 'No se pudo asignar una dirección.');
  } catch (err) {
    await accountRef.delete().catch(() => {});
    throw err;
  }
});
