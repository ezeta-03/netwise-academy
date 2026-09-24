// Asistente IA (Docente y Alumno). El modelo (Groq) se llama desde la Cloud
// Function `askAssistant` (functions/index.js): la clave de Groq vive como
// secreto del servidor y ya no viaja en el bundle del navegador. La función
// exige sesión iniciada y aplica un tope diario por usuario.
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

// Sin un proyecto Firebase real (modo mock) no hay Functions a las que llamar.
export const isAiConfigured = () => !functions.app.options.apiKey.includes('DummyKey');

// El chat solo muestra texto plano -- el modelo no siempre respeta la regla
// de "sin Markdown" del system prompt, así que se limpia lo más común acá
// como red de seguridad (negritas/cursivas, títulos "#", backticks).
const stripMarkdown = (text) => text
  .replace(/\*\*(.*?)\*\*/g, '$1')
  .replace(/(?<!\*)\*(?!\*)(.*?)\*(?!\*)/g, '$1')
  .replace(/^#{1,6}\s+/gm, '')
  .replace(/`{1,3}/g, '');

// `history` es una lista de { role: 'user' | 'assistant', text }.
export const askAssistant = async ({ systemInstruction, history, message }) => {
  if (!isAiConfigured()) throw new Error('missing-backend');
  const call = httpsCallable(functions, 'askAssistant', { timeout: 60000 });
  const { data } = await call({ systemInstruction, history, message });
  const text = data?.text?.trim();
  if (!text) throw new Error('empty-response');
  return stripMarkdown(text);
};
