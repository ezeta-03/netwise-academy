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
import { getStorage } from 'firebase-admin/storage';
import { randomBytes, createHash } from 'node:crypto';
import dns from 'node:dns/promises';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'node:url';
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

// Todo lo que una persona deja en la academia, por colección y campo con su
// uid. Solo se borra al eliminar una cuenta de prueba (`purgeHistory`).
const HISTORY_BY_UID = [
  ['enrollments', 'uid'], ['orders', 'uid'], ['submissions', 'uid'], ['attendance', 'uid'],
  ['courseGrades', 'uid'], ['projectAdvances', 'uid'], ['projectProfiles', 'uid'],
  ['preregistrations', 'uid'], ['supportRequests', 'requesterUid'], ['aiUsage', 'uid'],
];

const purgeUserHistory = async (uid) => {
  let removed = 0;
  for (const [name, field] of HISTORY_BY_UID) {
    const snap = await db.collection(name).where(field, '==', uid).get();
    const writer = db.bulkWriter();
    snap.docs.forEach((d) => writer.delete(d.ref));
    await writer.close();
    removed += snap.size;
  }
  // Comprobantes de pago y archivos de entregas del alumno.
  const bucket = getStorage().bucket();
  await Promise.all(['paymentProofs', 'submissions'].map((folder) => bucket.deleteFiles({ prefix: `${folder}/${uid}/` }).catch((err) => console.error('purge storage', folder, err?.message))));
  return removed;
};

// deleteUserAccount: borra de verdad a un usuario -- su cuenta de acceso, su
// perfil y (salvo `keepInstitutional`) su correo de la academia en Google -- y
// lo quita como docente de los cursos que tuviera. Sus matrículas, pedidos y
// entregas (historial de la academia) se conservan, salvo con `purgeHistory`,
// pensado para cuentas de prueba. Nadie puede borrarse a sí mismo ni borrar a
// otro admin desde acá.
export const deleteUserAccount = onCall({ ...ADMIN_CALL, timeoutSeconds: 60 }, async (request) => {
  await assertAdmin(request);
  const uid = str(request.data?.uid).trim();
  if (!uid) throw new HttpsError('invalid-argument', 'Falta el usuario.');
  if (uid === request.auth.uid) throw new HttpsError('failed-precondition', 'No puedes eliminar tu propia cuenta.');
  const profile = await db.collection('users').doc(uid).get();
  if (profile.data()?.role === 'admin') throw new HttpsError('failed-precondition', 'Primero cámbiale el rol: no se elimina a un administrador.');

  // Primero Google: si falla, no se borra nada y el admin puede reintentar.
  const accountRef = db.collection('institutionalAccounts').doc(uid);
  const account = (await accountRef.get()).data();
  const dropInstitutional = !!account?.email && request.data?.keepInstitutional !== true;
  if (dropInstitutional) await deleteDirectoryAccount(account.email);

  try {
    await getAuth().deleteUser(uid);
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') {
      console.error('deleteUser', err?.code, err?.message);
      throw new HttpsError('internal', 'No se pudo eliminar la cuenta de acceso.');
    }
  }
  await db.collection('users').doc(uid).delete();
  await accountRef.delete();
  const taught = await db.collection('courseOfferings').where('teacherUid', '==', uid).get();
  await Promise.all(taught.docs.map((d) => d.ref.update({ teacherUid: null })));
  const historyRemoved = request.data?.purgeHistory === true ? await purgeUserHistory(uid) : 0;
  return { deleted: true, coursesUnassigned: taught.size, institutionalDeleted: dropInstitutional ? account.email : null, historyRemoved };
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
  // El admin se lo retiró (syncInstitutionalAccount): solo él lo vuelve a crear.
  if (data?.removed) throw new HttpsError('failed-precondition', 'Tu correo de la academia fue retirado.');
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

// Elimina la cuenta en Google (recuperable 20 días desde Google Admin). Si ya
// no existía, se da por eliminada.
const deleteDirectoryAccount = async (email) => {
  if (IS_EMULATOR) return;
  const res = await directoryFetch(`/${encodeURIComponent(email)}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) {
    console.error('directory delete', res.status, res.data?.error?.message);
    throw new HttpsError('internal', 'No se pudo eliminar la cuenta en Google Workspace.');
  }
};

// syncInstitutionalAccount: lleva a Google lo que el admin hace con una cuenta
// de la plataforma. 'suspend' / 'restore' acompañan a Desactivar / Reactivar
// (suspendida no entra a Meet, pero no pierde nada); 'remove' retira el correo
// de la academia -- elimina la cuenta de Google y libera su cupo -- sin tocar
// la cuenta de la plataforma, p. ej. cuando el alumno termina su curso. Queda
// una marca `removed` para que el alumno no lo reactive solo desde su panel.
export const syncInstitutionalAccount = onCall(ADMIN_CALL, async (request) => {
  await assertAdmin(request);
  const uid = str(request.data?.uid).trim();
  const action = str(request.data?.action);
  if (!uid || !['suspend', 'restore', 'remove'].includes(action)) throw new HttpsError('invalid-argument', 'Solicitud incompleta.');

  const accountRef = db.collection('institutionalAccounts').doc(uid);
  const account = (await accountRef.get()).data();
  if (!account?.email) return { email: null };

  if (action === 'remove') {
    await deleteDirectoryAccount(account.email);
    if (account.linked) {
      await getAuth().updateUser(uid, { providersToUnlink: ['google.com'] }).catch((err) => console.warn('providersToUnlink', err?.code, err?.message));
    }
    await accountRef.set({ uid, removed: true, removedAt: new Date().toISOString(), removedBy: request.auth.uid, previousEmail: account.email });
    return { email: account.email, removed: true };
  }

  const suspended = action === 'suspend';
  if (!IS_EMULATOR) {
    const res = await directoryFetch(`/${encodeURIComponent(account.email)}`, { method: 'PUT', body: { suspended } });
    if (!res.ok && res.status !== 404) {
      console.error('directory suspend', res.status, res.data?.error?.message);
      throw new HttpsError('internal', 'No se pudo actualizar la cuenta en Google Workspace.');
    }
  }
  await accountRef.update({ suspended });
  return { email: account.email, suspended };
});

// sendProgramEmail: el visitante que pide el programa de un curso (Recibir el
// programa en /course/:id) recibe un correo con el botón "Descargar programa":
// el PDF no viaja adjunto, se baja desde /programa/<código>. Así el contacto
// solo queda verificado (`verifiedAt`) si la persona abrió ese correo -- ver
// confirmProgramEmail. Antes de enviar se comprueba que el dominio del correo
// reciba correo (registro MX) y que el celular sea un móvil peruano de 9
// dígitos. El lead queda en `programLeads/{código}` desde el envío.
//
// Envía por SMTP de Gmail con la cuenta de la academia y una contraseña de
// aplicación (Cuenta de Google > Seguridad > Contraseñas de aplicaciones):
//   npx firebase-tools functions:secrets:set MAIL_USER
//   npx firebase-tools functions:secrets:set MAIL_PASSWORD
const MAIL_USER = defineSecret('MAIL_USER');
const MAIL_PASSWORD = defineSecret('MAIL_PASSWORD');
const PROGRAM_COURSES = {
  1: 'Estrategias de Redes Sociales',
  2: 'Branding y Gestión de Marcas',
  3: 'Marketing Digital desde 0',
  4: 'Creación de Negocios Digitales',
};
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const PROGRAM_MAILS_PER_EMAIL = 3;
const PROGRAM_MAILS_PER_IP = 20;

// Móvil peruano: 9 dígitos que empiezan en 9, con o sin +51 delante.
const peruMobile = (value) => {
  let digits = str(value).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('51')) digits = digits.slice(2);
  return /^9\d{8}$/.test(digits) ? digits : null;
};

// false solo si el dominio seguro no recibe correo; ante un error de DNS
// pasajero se deja pasar (el correo igual tiene que llegar para servir).
const domainReceivesMail = async (domain) => {
  try {
    const records = await dns.resolveMx(domain);
    return records.some((r) => r.exchange);
  } catch (err) {
    return !['ENOTFOUND', 'ENODATA', 'ESERVFAIL', 'EBADNAME'].includes(err?.code);
  }
};

const takeMailQuota = (key, limit) => db.runTransaction(async (tx) => {
  const day = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
  const ref = db.collection('programMailQuota').doc(`${createHash('sha256').update(key).digest('hex').slice(0, 32)}_${day}`);
  const snap = await tx.get(ref);
  if ((snap.data()?.count || 0) >= limit) return false;
  tx.set(ref, { day, count: FieldValue.increment(1) }, { merge: true });
  return true;
});

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const sendProgramEmail = onCall(
  { secrets: [MAIL_USER, MAIL_PASSWORD], region: 'us-central1', maxInstances: 5, timeoutSeconds: 60 },
  async (request) => {
    const data = request.data || {};
    const courseId = Number(data.courseId);
    const courseTitle = PROGRAM_COURSES[courseId];
    const name = str(data.name).trim().slice(0, 120);
    const email = str(data.email).trim().toLowerCase().slice(0, 160);
    const phone = peruMobile(data.phone);
    if (!courseTitle) throw new HttpsError('invalid-argument', 'Ese curso no tiene programa.');
    if (name.length < 3) throw new HttpsError('invalid-argument', 'Escribe tu nombre completo.');
    if (!EMAIL_FORMAT.test(email)) throw new HttpsError('invalid-argument', 'Revisa tu correo: no parece una dirección válida.');
    if (!phone) throw new HttpsError('invalid-argument', 'Escribe tu celular de 9 dígitos (empieza con 9).');
    if (!(await domainReceivesMail(email.split('@')[1]))) {
      throw new HttpsError('invalid-argument', `El dominio "${email.split('@')[1]}" no recibe correos. Revisa que esté bien escrito.`);
    }
    if (!(await takeMailQuota(`email:${email}`, PROGRAM_MAILS_PER_EMAIL))
      || !(await takeMailQuota(`ip:${request.rawRequest?.ip || 'sin-ip'}`, PROGRAM_MAILS_PER_IP))) {
      throw new HttpsError('resource-exhausted', 'Ya te enviamos el programa hoy. Revisa tu bandeja de entrada y la carpeta de spam.');
    }

    // El código del enlace es el id del lead: aleatorio y no adivinable.
    const token = randomBytes(18).toString('base64url');
    const leadRef = db.collection('programLeads').doc(token);
    const now = new Date().toISOString();
    await leadRef.set({
      courseId, courseTitle: str(data.courseTitle).slice(0, 120) || courseTitle, name, email, phone,
      source: 'download', marketingConsent: data.marketingConsent === true, createdAt: now, emailSentAt: now,
      verifiedAt: null, downloads: 0,
    });

    const requested = str(request.rawRequest?.headers?.origin);
    const origin = ACCESS_LINK_ORIGINS.includes(requested) || LOCAL_ORIGIN.test(requested) ? requested : ACCESS_LINK_ORIGINS[0];
    const downloadUrl = `${origin}/programa/${token}`;
    const courseUrl = `${origin}/course/${courseId}`;
    const firstName = escapeHtml(name.split(/\s+/)[0]);
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: MAIL_USER.value(), pass: MAIL_PASSWORD.value() },
    });
    try {
      await transport.sendMail({
        from: `"Netwise Academy" <${MAIL_USER.value()}>`,
        to: email,
        subject: `Tu programa de ${courseTitle} · Netwise Academy`,
        text: `Hola ${name.split(/\s+/)[0]},\n\nDescarga el programa completo de ${courseTitle} (módulos, contenidos y entregables) aquí:\n${downloadUrl}\n\nHorarios e inscripción: ${courseUrl}\n\nNetwise Academy`,
        // Logo blanco sobre una franja oscura, incrustado en el correo (cid):
        // Gmail no muestra imágenes en data: ni SVG.
        html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a2e">
<tr><td bgcolor="#1a1035" style="background:#1a1035;padding:22px 28px;border-radius:14px 14px 0 0"><img src="cid:netwise-logo" width="160" height="45" alt="Netwise Academy" style="display:block;border:0"></td></tr>
<tr><td style="padding:24px 28px;border:1px solid #ECEAF3;border-top:0;border-radius:0 0 14px 14px">
<p style="margin:0 0 14px">Hola ${firstName},</p>
<p style="margin:0 0 18px">Aquí tienes el programa completo de <strong>${escapeHtml(courseTitle)}</strong>: módulos, contenidos y entregables.</p>
<p style="margin:0 0 18px"><a href="${downloadUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Descargar programa</a></p>
<p style="margin:0 0 14px">¿Listo para empezar? <a href="${courseUrl}" style="color:#7c3aed;font-weight:bold">Ver horarios e inscribirme</a></p>
<p style="margin:0 0 14px">Si tienes dudas, responde este correo.</p>
<p style="margin:0">Netwise Academy<br><a href="https://netwiseacademy.pe" style="color:#7c3aed">netwiseacademy.pe</a></p>
</td></tr></table>`,
        attachments: [
          { filename: 'netwise.png', path: fileURLToPath(new URL('./assets/logo-email.png', import.meta.url)), cid: 'netwise-logo' },
        ],
      });
    } catch (err) {
      console.error('sendProgramEmail', err?.code, err?.responseCode, err?.message);
      await leadRef.delete().catch(() => {});
      if (err?.code === 'EENVELOPE') throw new HttpsError('invalid-argument', 'No pudimos entregar el correo a esa dirección. Revísala.');
      throw new HttpsError('unavailable', 'No pudimos enviar el correo. Intenta de nuevo en unos minutos.');
    }

    return { sent: true };
  },
);

// confirmProgramEmail: la página /programa/<código> (el botón del correo) la
// llama al abrirse. Marca el lead como verificado la primera vez -- el correo
// existe y la persona lo abrió -- y devuelve qué programa descargar.
// `firstTime` avisa a la página para que mande el contacto al Sheet de leads
// una sola vez.
const PROGRAM_TOKEN = /^[A-Za-z0-9_-]{24}$/;

export const confirmProgramEmail = onCall({ region: 'us-central1', maxInstances: 5, timeoutSeconds: 30 }, async (request) => {
  const token = str(request.data?.token);
  if (!PROGRAM_TOKEN.test(token)) throw new HttpsError('not-found', 'Este enlace no es válido.');
  const ref = db.collection('programLeads').doc(token);
  const lead = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const data = snap.data();
    const firstTime = !data.verifiedAt;
    const verifiedAt = data.verifiedAt || new Date().toISOString();
    tx.update(ref, { verifiedAt, downloads: FieldValue.increment(1), lastDownloadAt: new Date().toISOString() });
    return { ...data, verifiedAt, firstTime };
  });
  if (!lead) throw new HttpsError('not-found', 'Este enlace no es válido.');
  return {
    courseId: lead.courseId, courseTitle: lead.courseTitle, name: lead.name, email: lead.email, phone: lead.phone,
    marketingConsent: !!lead.marketingConsent, createdAt: lead.createdAt, verifiedAt: lead.verifiedAt, firstTime: lead.firstTime,
  };
});
