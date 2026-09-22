// Asistente IA conectado a Groq (API gratuita, sin tarjeta -- ver
// VITE_GROQ_API_KEY en .env.local). Usa el endpoint compatible con OpenAI
// (chat/completions), así que no hace falta ningún SDK extra.
const API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const MODEL = 'openai/gpt-oss-20b';
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

export const isAiConfigured = () => !!API_KEY;

// El chat solo muestra texto plano -- el modelo no siempre respeta la regla
// de "sin Markdown" del system prompt, así que se limpia lo más común acá
// como red de seguridad (negritas/cursivas, títulos "#", backticks).
const stripMarkdown = (text) => text
  .replace(/\*\*(.*?)\*\*/g, '$1')
  .replace(/(?<!\*)\*(?!\*)(.*?)\*(?!\*)/g, '$1')
  .replace(/^#{1,6}\s+/gm, '')
  .replace(/`{1,3}/g, '');

// `history` es una lista de { role: 'user' | 'assistant', text }. El
// backend de Groq habla el formato de OpenAI (role/content), así que se
// traduce acá para que el resto de la app no tenga que pensar en eso.
export const askAssistant = async ({ systemInstruction, history, message }) => {
  if (!API_KEY) throw new Error('missing-key');

  const messages = [
    { role: 'system', content: systemInstruction },
    ...history.map((m) => ({ role: m.role, content: m.text })),
    { role: 'user', content: message },
  ];

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.6, max_tokens: 700 }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || `Groq error ${res.status}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('empty-response');
  return stripMarkdown(text);
};
