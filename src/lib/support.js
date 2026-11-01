// Soporte (E9 alumno, A5 admin): tipos de problema, respuestas rápidas y
// estados de una solicitud. Las respuestas rápidas las edita el admin
// (settings/academy: supportFaq y supportReplies); estas son las de arranque.

export const SUPPORT_CATEGORIES = [
  { key: 'acceso', label: 'Acceso a clase' },
  { key: 'curso', label: 'Mi curso' },
  { key: 'entregas', label: 'Entregas y notas' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'otro', label: 'Otro' },
];
export const categoryLabel = (key) => SUPPORT_CATEGORIES.find((c) => c.key === key)?.label || 'Soporte de plataforma';

// Lo que el alumno ve antes de escribir (E9): pregunta, respuesta y a dónde ir.
export const DEFAULT_SUPPORT_FAQ = [
  { q: '¿Cómo entro a mi clase?', a: 'En Inicio verás tu clase de hoy arriba, con el botón «Entrar a Meet». Se activa 10 minutos antes de empezar.', linkLabel: 'Ir a Inicio', linkTo: '/student/inicio' },
  { q: 'Meet me pide permiso para entrar', a: 'Entra a Meet con tu correo de la academia (@netwiseacademy.pe). Con tu correo personal Meet te deja esperando a que el docente te admita.', linkLabel: 'Ver mi correo de la academia', linkTo: '/student/inicio' },
  { q: 'No veo mi curso', a: 'Tu curso aparece cuando validamos tu pago y te asignamos un aula. Si ya pasaron 24 horas, escríbenos abajo con el tipo «Mi curso».', linkLabel: 'Ver mis cursos', linkTo: '/student/cursos' },
  { q: 'No puedo subir mi entrega', a: 'Cada archivo puede pesar hasta 50 MB. Si pesa más, súbelo a Drive (con acceso para cualquiera con el enlace) y pega el link en «Links» de tu entrega.', linkLabel: 'Ir a Mis entregas', linkTo: '/student/entregas' },
  { q: 'No veo mi nota', a: 'Tu nota aparece cuando el docente la publica. Mientras tanto tu entrega figura como «Enviada · por calificar».', linkLabel: 'Ir a Mis entregas', linkTo: '/student/entregas' },
  { q: 'Olvidé mi contraseña', a: 'En «Iniciar sesión» usa «Olvidé mi contraseña» y te llegará un correo para crear una nueva.', linkLabel: '', linkTo: '' },
];

// Respuestas listas para el admin (A5): se insertan y se pueden editar antes de enviar.
export const DEFAULT_SUPPORT_REPLIES = [
  { label: 'Cómo entrar a la clase', text: 'Hola, {nombre}. Entra a la plataforma con tu correo de la academia. En Inicio verás tu clase de hoy arriba, con el botón «Entrar a Meet», que se activa 10 minutos antes. Si algo falla, respóndenos aquí.' },
  { label: 'Usar el correo @netwiseacademy.pe', text: 'Hola, {nombre}. Para entrar a Meet sin esperar, usa tu correo @netwiseacademy.pe. Con tu correo personal Meet te pide permiso al docente.' },
  { label: 'Asignar aula', text: 'Hola, {nombre}. Ya te asignamos tu aula: tu curso y tu horario aparecen en Inicio y en tu Agenda.' },
  { label: 'Recuperar contraseña', text: 'Hola, {nombre}. En «Iniciar sesión» usa «Olvidé mi contraseña» y te llegará un correo para crear una nueva.' },
  { label: 'Subir entrega por Drive', text: 'Hola, {nombre}. El límite es de 50 MB por archivo. Súbelo a Drive y pega el link en «Links» de tu entrega: así no hay límite de peso.' },
  { label: 'Nota aún no publicada', text: 'Hola, {nombre}. Tu docente aún no publica la nota. Te llegará un aviso en la campana apenas lo haga.' },
];

// Estado de una solicitud, también de las antiguas ('pending' = nueva).
// new: esperando a soporte · answered: soporte respondió · resolved: resuelta.
export const ticketStatus = (t) => (t?.status === 'resolved' ? 'resolved' : t?.status === 'answered' ? 'answered' : 'new');
export const STUDENT_STATUS = {
  new: { label: 'Enviada', cls: 'admin-status-gray' },
  answered: { label: 'Respondida', cls: 'admin-status-green' },
  resolved: { label: 'Resuelta', cls: 'admin-status-violet' },
};
export const ADMIN_STATUS = {
  new: { label: 'Nuevo', cls: 'admin-status-amber' },
  answered: { label: 'Respondido', cls: 'admin-status-green' },
  resolved: { label: 'Resuelto', cls: 'admin-status-gray' },
};

// Hilo de mensajes; una solicitud antigua solo tenía `message`.
export const ticketMessages = (t) => {
  if (Array.isArray(t?.messages) && t.messages.length) return t.messages;
  return t?.message ? [{ from: 'requester', authorName: t.requesterName, text: t.message, at: t.createdAt }] : [];
};
export const lastSupportReply = (t) => [...ticketMessages(t)].reverse().find((m) => m.from === 'support') || null;

// Título de la solicitud: la primera frase del mensaje, corta.
export const ticketTitle = (t) => {
  if (t?.title) return t.title;
  if (t?.type === 'tutoria') return `Tutoría · ${t.courseTitle || ''}`.trim();
  const text = String(ticketMessages(t)[0]?.text || '').trim();
  const first = text.split(/(?<=[.?!])\s|\n/)[0] || text;
  return first.length > 70 ? `${first.slice(0, 67)}…` : (first || 'Solicitud de soporte');
};

export const fillReply = (text, name) => String(text || '').replaceAll('{nombre}', (name || '').split(' ')[0] || '');

// Días sin respuesta de soporte (para el aviso del admin).
export const daysWaiting = (t, now = Date.now()) => {
  if (ticketStatus(t) !== 'new') return 0;
  const last = t.lastMessageAt || t.createdAt;
  return last ? Math.floor((now - new Date(last).getTime()) / 86400000) : 0;
};
