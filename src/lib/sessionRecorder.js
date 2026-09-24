// Grabación de una clase en vivo en la computadora del docente (sin costo de
// servidor). Graba la PESTAÑA de la sala: video de la clase + audio de los
// participantes (audio de la pestaña) + el micrófono del docente, que la
// captura de pestaña no incluye y se mezcla aparte.
//
// El video se guarda en el disco (Origin Private File System), no en memoria
// -- 2 h de clase son ~1 GB. Se escribe en PARTES de ~1 minuto que se cierran
// al instante: lo que se escribe con createWritable no queda en disco hasta
// cerrar el archivo, así que un único archivo abierto se perdería entero si
// la pestaña se cierra o el navegador falla. MediaRecorder produce un solo
// flujo continuo, así que las partes unidas en orden son el video completo.
// Una grabación interrumpida se recupera después (listPendingRecordings).
// Solo Chrome / Edge de escritorio.

const DIR = 'netwise-recordings';
const CHUNK_MS = 4000;
const PART_MS = 60000;

const pickMimeType = () => {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return candidates.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
};

export const isRecordingSupported = () => {
  const ua = navigator.userAgent || '';
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  return !mobile
    && !!navigator.mediaDevices?.getDisplayMedia
    && !!window.MediaRecorder
    && !!pickMimeType()
    && !!navigator.storage?.getDirectory;
};

const getRoot = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(DIR, { create: true });

const safeName = (s) => String(s || 'clase').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export const buildRecordingName = (session) => {
  const d = new Date(session?.startsAt || Date.now());
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${safeName(session?.courseTitle)}_${safeName(session?.title)}_${stamp}.webm`;
};

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

// Inicia la grabación. Debe llamarse DIRECTO desde el clic (el navegador exige
// un gesto del usuario para compartir la pestaña). Devuelve { stop, name };
// stop() resuelve { blob, name, error }. Lanza un Error con `code`:
// 'cancelled' | 'no-mic' | 'unsupported'. `onStop` se llama si la grabación
// termina por fuera (botón "Dejar de compartir" del navegador).
export const startRecording = async ({ name, onStop }) => {
  if (!isRecordingSupported()) throw Object.assign(new Error('Tu navegador no permite grabar.'), { code: 'unsupported' });

  let display;
  try {
    display = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 24, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: { suppressLocalAudioPlayback: false },
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      surfaceSwitching: 'exclude',
      systemAudio: 'include',
    });
  } catch {
    throw Object.assign(new Error('Se canceló la selección de pantalla.'), { code: 'cancelled' });
  }

  let mic;
  try {
    mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    display.getTracks().forEach((t) => t.stop());
    throw Object.assign(new Error('Sin micrófono no se grabaría tu voz.'), { code: 'no-mic' });
  }

  // Mezcla: audio de la pestaña (participantes) + micrófono del docente.
  const ctx = new AudioContext();
  const mix = ctx.createMediaStreamDestination();
  if (display.getAudioTracks().length) ctx.createMediaStreamSource(new MediaStream(display.getAudioTracks())).connect(mix);
  ctx.createMediaStreamSource(mic).connect(mix);

  const stream = new MediaStream([...display.getVideoTracks(), ...mix.stream.getAudioTracks()]);
  const recorder = new MediaRecorder(stream, { mimeType: pickMimeType(), videoBitsPerSecond: 1_500_000, audioBitsPerSecond: 128_000 });

  const dir = await (await getRoot()).getDirectoryHandle(name, { create: true });
  let partIndex = 0;
  let pending = [];
  let pendingSince = Date.now();
  let queue = Promise.resolve();
  let writeError = null;

  const flush = () => {
    if (!pending.length) return queue;
    const blob = new Blob(pending, { type: 'video/webm' });
    pending = [];
    pendingSince = Date.now();
    const partName = `part-${String(partIndex++).padStart(6, '0')}`;
    queue = queue
      .then(async () => {
        const w = await (await dir.getFileHandle(partName, { create: true })).createWritable();
        await w.write(blob);
        await w.close();
      })
      .catch((err) => { writeError = err; });
    return queue;
  };

  recorder.ondataavailable = (e) => {
    if (!e.data?.size) return;
    pending.push(e.data);
    if (Date.now() - pendingSince >= PART_MS) flush();
  };

  let stopped = false;
  const finished = new Promise((resolve) => {
    recorder.onstop = async () => {
      await flush();
      display.getTracks().forEach((t) => t.stop());
      mic.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
      resolve({ blob: await assemble(dir), name, error: writeError });
    };
  });

  const stop = () => {
    if (!stopped) {
      stopped = true;
      if (recorder.state !== 'inactive') recorder.stop();
    }
    return finished;
  };

  // "Dejar de compartir" desde la barra del navegador también termina la grabación.
  display.getVideoTracks()[0]?.addEventListener('ended', () => {
    if (!stopped) stop().then((result) => onStop?.(result));
  });

  recorder.start(CHUNK_MS);
  return { stop, name };
};
