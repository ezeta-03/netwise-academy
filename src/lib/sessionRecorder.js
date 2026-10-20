// Grabaciones de clase que quedaron guardadas en este navegador. Antes la sala
// de Jitsi incrustada se podía grabar desde la app (la pestaña + el micrófono
// del docente, escrito en el disco por partes de ~1 minuto en el Origin Private
// File System). Ahora las clases se dan y se graban en Google Meet; esto solo
// queda para que el docente descargue y borre lo que haya quedado pendiente.

const DIR = 'netwise-recordings';

const getRoot = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(DIR, { create: true });

// Une las partes de una grabación en un Blob respaldado por disco (no se
// carga en memoria).
const assemble = async (dirHandle) => {
  const parts = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === 'file' && name.startsWith('part-')) parts.push([name, handle]);
  }
  parts.sort(([a], [b]) => a.localeCompare(b));
  const files = await Promise.all(parts.map(([, h]) => h.getFile()));
  return new Blob(files, { type: 'video/webm' });
};

export const downloadBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Dar tiempo a que el navegador copie el archivo antes de soltarlo.
  setTimeout(() => URL.revokeObjectURL(url), 120000);
};

// Grabaciones que quedaron en disco (pestaña cerrada, fallo o sin borrar).
export const listPendingRecordings = async () => {
  if (!navigator.storage?.getDirectory) return [];
  try {
    const root = await getRoot();
    const out = [];
    for await (const [name, handle] of root.entries()) {
      if (handle.kind !== 'directory') continue;
      const blob = await assemble(handle);
      if (blob.size > 0) out.push({ name, size: blob.size, blob });
      else await root.removeEntry(name, { recursive: true }).catch(() => {});
    }
    return out;
  } catch {
    return [];
  }
};

export const deletePendingRecording = async (name) => {
  try { await (await getRoot()).removeEntry(name, { recursive: true }); } catch { /* ya no existe */ }
};
