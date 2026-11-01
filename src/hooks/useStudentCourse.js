import { useCallback, useEffect, useState } from 'react';
import { fetchCourseContent, fetchCourseSubmissions, fetchCourseAttendance, fetchCourseGrades, fetchGroupProgress, fetchLiveSessions, fetchPractices, fetchProjectProfile } from '../lib/db';
import { buildClassList, normalizeAttendance } from '../lib/classList';
import { buildWorkItems, practicesForGroup } from '../lib/workItems';

// Todo lo de un alumno en un curso, en una sola carga: módulos, prácticas de
// su aula, sus entregas, su empresa (Mi proyecto), la lista única de clases de
// su aula con su asistencia y sus notas manuales. Lo usan Mi proyecto, Mis
// notas, Mi asistencia y Ver mi entrega.
export const useStudentCourse = (course, group, uid) => {
  const [data, setData] = useState(null);
  const groupId = group?.id || null;

  const load = useCallback(async () => {
    if (!uid || !course) return;
    const [content, subs, att, grades, doneIds, live, practices, profile] = await Promise.all([
      fetchCourseContent(course.id), fetchCourseSubmissions(course.id, uid), fetchCourseAttendance(course.id, uid),
      fetchCourseGrades(course.id, uid), fetchGroupProgress(groupId).catch(() => []), fetchLiveSessions(course.id).catch(() => []),
      fetchPractices(course.id).catch(() => []), fetchProjectProfile(uid, course.id).catch(() => null),
    ]);
    const modules = content.modules || [];
    const mine = (list) => (list || []).filter((x) => x.uid === uid);
    const classList = buildClassList({ liveSessions: live, modules, groupId, doneIds });
    const myPractices = practicesForGroup(practices, groupId);
    setData({
      modules, classList, profile,
      practices: myPractices,
      items: buildWorkItems({ course, modules, practices: myPractices, group }),
      submissions: mine(subs),
      attendance: normalizeAttendance(mine(att), classList),
      scores: mine(grades)[0]?.scores || {},
    });
  }, [course, group, groupId, uid]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial, mismo patrón que el resto del panel
    load().catch(() => setData((d) => d || { error: true }));
  }, [load]);

  return { data, reload: load };
};
