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
