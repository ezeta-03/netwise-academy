// Grupos de trabajo (E12 alumno, D7 docente): los arma cada alumno con
// compañeros de SU aula; el docente los revisa y administra. Funciones puras.

// Grupos de un aula (los antiguos, sin aula, se muestran en todas).
export const groupsOfAula = (groups, aulaId) => (groups || []).filter((g) => !aulaId || !g.groupId || g.groupId === aulaId);

export const groupOf = (groups, uid) => (groups || []).find((g) => (g.memberUids || []).includes(uid)) || null;

export const invitationsFor = (groups, uid) => (groups || []).filter((g) => (g.pendingUids || []).includes(uid) && !(g.memberUids || []).includes(uid));

// Quita a un alumno de un grupo (integrante o invitado), con sus nombres alineados.
export const withoutUid = (group, uid) => {
  const keep = (uids, names) => {
    const idx = (uids || []).map((u, i) => (u === uid ? -1 : i)).filter((i) => i >= 0);
    return [idx.map((i) => uids[i]), idx.map((i) => (names || [])[i] || '')];
  };
  const [memberUids, memberNames] = keep(group.memberUids, group.memberNames);
  const [pendingUids, pendingNames] = keep(group.pendingUids, group.pendingNames);
  const invitedAt = { ...(group.invitedAt || {}) };
  delete invitedAt[uid];
  return { memberUids, memberNames, pendingUids, pendingNames, invitedAt };
};

// Suma integrantes (o invitados) sin repetir.
export const addTo = (group, list, people, when = new Date().toISOString()) => {
  const uids = [...(group[`${list}Uids`] || [])];
  const names = [...(group[`${list}Names`] || [])];
  const invitedAt = { ...(group.invitedAt || {}) };
  people.forEach((p) => {
    if (uids.includes(p.uid)) return;
    uids.push(p.uid);
    names.push(p.name);
    if (list === 'pending') invitedAt[p.uid] = when;
  });
  return { [`${list}Uids`]: uids, [`${list}Names`]: names, ...(list === 'pending' ? { invitedAt } : {}) };
};

export const meetShort = (link) => String(link || '').replace(/^https?:\/\//, '');
