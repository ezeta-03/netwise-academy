// Enlace de Google Meet de una clase en vivo: la sala fija de su aula
// (`groups/{id}.classLink`). Solo enlaces https; si no hay, null y la clase
// sigue abriendo /live/:id, que avisa que falta la sala.
export const isMeetLink = (link) => /^https:\/\//.test(link || '');

// Aulas distintas de una lista de clases, para pedir cada enlace una sola vez.
export const groupIdsOf = (sessions) => [...new Set((sessions || []).map((s) => s.groupId).filter(Boolean))];

export const meetLinkFor = (session, linksByGroup) => {
  const link = session?.groupId ? linksByGroup?.[session.groupId] : null;
  return isMeetLink(link) ? link : null;
};
