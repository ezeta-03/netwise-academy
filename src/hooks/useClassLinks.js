import { useEffect, useState } from 'react';
import { fetchGroupClassLink } from '../lib/db';
import { groupIdsOf } from '../lib/classLinks';

// { [groupId]: classLink } de las aulas de `sessions`. Así cada clase de la
// agenda o del inicio abre directo el Meet de su aula (ver meetLinkFor).
export const useClassLinks = (sessions) => {
  const [links, setLinks] = useState({});
  const key = groupIdsOf(sessions).sort().join(',');

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    Promise.all(key.split(',').map((id) => fetchGroupClassLink(id).then((link) => [id, link]).catch(() => [id, null])))
      .then((pairs) => { if (!cancelled) setLinks(Object.fromEntries(pairs)); });
    return () => { cancelled = true; };
  }, [key]);

  return links;
};
