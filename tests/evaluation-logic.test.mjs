// Lógica que vive DENTRO de componentes React y no se puede importar sin
// arrastrar JSX/firebase. Cada helper de abajo es una COPIA de la fórmula ACTUAL
// del componente (árbol de trabajo tras las correcciones; se cita archivo). Si el
// componente cambia, actualizar la copia. Las partes puras SÍ se importan de src/lib.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildGradebookRows, computeGradeSummary } from '../src/lib/gradebook.js';
import { getOrderedSessions } from '../src/lib/courseSessions.js';
import { deliverableDueDate } from '../src/lib/deliveryDates.js';
import { resolveWeights, deliverableLabel } from '../src/lib/weights.js';
import { APPROVAL, evaluateApproval } from '../src/lib/approval.js';
import { attendanceStats } from '../src/lib/attendance.js';
import { courseRoster } from '../src/lib/roster.js';

// ---------------------------------------------------------------------------
// TeacherCourseCronograma.jsx (filas/estado; endWeekOf/fechas: lib/deliveryDates.js; roster: lib/roster.js)
// ---------------------------------------------------------------------------
const cronograma = (modules, group, roster = [], subs = []) => {
  const resolved = resolveWeights(modules);
  // "Calificado" = todos los alumnos del aula tienen su entrega revisada en ese módulo.
  const rosterUids = new Set(roster.map((r) => r.uid));
  const gradedCount = (moduleId) => new Set(subs.filter((x) => x.moduleId === moduleId && x.status === 'reviewed' && rosterUids.has(x.uid)).map((x) => x.uid)).size;
  const isGraded = (moduleId) => roster.length > 0 && gradedCount(moduleId) === roster.length;
  const firstOpenIdx = resolved.rows.findIndex((r) => !isGraded(r.module.id));
  const rows = resolved.rows.map((r, i) => {
    const m = r.module;
    const dueIso = deliverableDueDate(m, modules.indexOf(m), group);
    const status = isGraded(m.id) ? 'graded' : (i === firstOpenIdx ? 'current' : 'scheduled');
    return { id: m.id, m, dueIso, status, weight: r.weight, explicit: r.explicit, graded: gradedCount(m.id), name: `${deliverableLabel(i, resolved.rows.length)} · ${m.title}` };
  });
  const nextRow = rows[firstOpenIdx];
  const totalWeight = resolved.total;
  const formula = rows.length > 0 ? `PF = ${rows.map((r, i) => `M${i + 1} × ${r.weight}%`).join(' + ')}` : null;
  const warnings = { sumNot100: rows.length > 0 && !resolved.sumsTo100, missingWeights: rows.length > 0 && !resolved.allExplicit };
  return { rows, nextRow, totalWeight, formula, warnings };
};

const M = (id, weeksLabel, deliverable) => ({ id, title: `T-${id}`, weeksLabel, ...(deliverable ? { deliverable } : {}) });
const D = (weight, extra = {}) => ({ description: 'desc', ...(weight !== undefined ? { weight } : {}), ...extra });
const GROUP = { startDate: '2026-03-10', scheduleTime: 'Martes y Jueves · 19:00-21:00' };

describe('Cronograma: filas, estado, pesos y fórmula', () => {
  const branding = [
    M('a', 'Semana 1', D(20)), M('b', 'Semana 2', D(20)),
    M('c', 'Semana 3', D(25)), M('d', 'Semana 4', D(35)),
  ];

  test('caso Branding 20/20/25/35: fechas, estados, total y fórmula', () => {
    const roster = [{ uid: 'u1' }, { uid: 'u2' }];
    const subs = [{ uid: 'u1', moduleId: 'a', status: 'reviewed' }, { uid: 'u2', moduleId: 'a', status: 'reviewed' }];
    const c = cronograma(branding, GROUP, roster, subs);
    assert.deepEqual(c.rows.map((r) => r.dueIso), ['2026-03-12', '2026-03-19', '2026-03-26', '2026-04-02']);
    assert.deepEqual(c.rows.map((r) => r.status), ['graded', 'current', 'scheduled', 'scheduled']);
    assert.deepEqual(c.rows.map((r) => r.name), ['Entregable M1 · T-a', 'Entregable M2 · T-b', 'Entregable M3 · T-c', 'Trabajo final · T-d']);
    assert.equal(c.totalWeight, 100);
    assert.equal(c.formula, 'PF = M1 × 20% + M2 × 20% + M3 × 25% + M4 × 35%');
    assert.equal(c.nextRow.id, 'b');
    assert.deepEqual(c.warnings, { sumNot100: false, missingWeights: false });
  });
  test('dueDate explícito gana sobre el calculado; string vacío cae al calculado', () => {
    const c = cronograma([M('a', 'Semana 1', D(50, { dueDate: '2026-05-01' })), M('b', 'Semana 2', D(50, { dueDate: '' }))], GROUP);
    assert.deepEqual(c.rows.map((r) => r.dueIso), ['2026-05-01', '2026-03-19']);
  });
  test('horario con días en minúscula / sin tilde ya calcula las fechas de entrega', () => {
    for (const label of ['martes y jueves · 19:00-21:00', 'Martes y jueves', 'MARTES Y JUEVES', 'Martes/Jueves']) {
      const c = cronograma(branding, { startDate: '2026-03-10', scheduleTime: label });
      assert.deepEqual(c.rows.map((r) => r.dueIso), ['2026-03-12', '2026-03-19', '2026-03-26', '2026-04-02'], label);
    }
  });
  test('sin startDate, sin horario o con horario ilegible -> dueIso null (se muestra "—")', () => {
    assert.equal(cronograma([M('a', 'Semana 1', D(100))], { scheduleTime: 'Martes y Jueves · 19:00-21:00' }).rows[0].dueIso, null);
    assert.equal(cronograma([M('a', 'Semana 1', D(100))], { startDate: '2026-03-10' }).rows[0].dueIso, null);
    assert.equal(cronograma([M('a', 'Semana 1', D(100))], { startDate: '2026-03-10', scheduleTime: 'a convenir' }).rows[0].dueIso, null);
    assert.equal(cronograma([M('a', 'Semana 1', D(100))], undefined).rows[0].dueIso, null);
  });
  test('sin módulos', () => {
    const c = cronograma([], GROUP);
    assert.deepEqual(c.rows, []);
    assert.equal(c.nextRow, undefined);
    assert.equal(c.totalWeight, 0);
    assert.equal(c.formula, null);
    assert.deepEqual(c.warnings, { sumNot100: false, missingWeights: false });
  });
  describe('estado "Calificado" según las notas reales del aula', () => {
    const mods = [M('a', 'Semana 1', D(50)), M('b', 'Semana 2', D(50)), M('c', 'Semana 3', D(0))];
    const roster = [{ uid: 'u1' }, { uid: 'u2' }, { uid: 'u3' }];
    const rev = (uid, moduleId, status = 'reviewed') => ({ uid, moduleId, status });

    test('sin alumnos en el aula nunca hay "Calificado": la primera fila es "current"', () => {
      const c = cronograma(mods, GROUP, [], [rev('u1', 'a')]);
      assert.deepEqual(c.rows.map((r) => r.status), ['current', 'scheduled', 'scheduled']);
      assert.deepEqual(c.rows.map((r) => r.graded), [0, 0, 0]);
    });
    test('un módulo es "graded" sólo si TODOS los alumnos tienen entrega revisada', () => {
      const partial = cronograma(mods, GROUP, roster, [rev('u1', 'a'), rev('u2', 'a')]);
      assert.equal(partial.rows[0].status, 'current');
      assert.equal(partial.rows[0].graded, 2);
      const full = cronograma(mods, GROUP, roster, [rev('u1', 'a'), rev('u2', 'a'), rev('u3', 'a')]);
      assert.deepEqual(full.rows.map((r) => r.status), ['graded', 'current', 'scheduled']);
      assert.equal(full.rows[0].graded, 3);
      assert.equal(full.nextRow.id, 'b');
    });
    test('las entregas "submitted" (sin revisar) no cuentan como calificadas', () => {
      const c = cronograma(mods, GROUP, roster, [rev('u1', 'a'), rev('u2', 'a'), rev('u3', 'a', 'submitted')]);
      assert.equal(c.rows[0].status, 'current');
      assert.equal(c.rows[0].graded, 2);
    });
    test('el conteo usa uids distintos: entregas duplicadas del mismo alumno cuentan una vez', () => {
      const c = cronograma(mods, GROUP, [{ uid: 'u1' }, { uid: 'u2' }], [rev('u1', 'a'), rev('u1', 'a'), rev('u1', 'a')]);
      assert.equal(c.rows[0].graded, 1);
      assert.equal(c.rows[0].status, 'current');
    });
    test('las entregas de alumnos fuera del roster (pendientes, otros cursos) se ignoran', () => {
      const c = cronograma(mods, GROUP, [{ uid: 'u1' }], [rev('u1', 'a'), rev('x9', 'a'), rev('x8', 'b')]);
      assert.deepEqual(c.rows.map((r) => r.status), ['graded', 'current', 'scheduled']);
      assert.equal(c.rows[0].graded, 1);
    });
    test('el primer módulo NO calificado es "current" aunque un módulo posterior ya esté calificado', () => {
      const c = cronograma(mods, GROUP, [{ uid: 'u1' }], [rev('u1', 'b')]);
      assert.deepEqual(c.rows.map((r) => r.status), ['current', 'graded', 'scheduled']);
      assert.equal(c.nextRow.id, 'a');
    });
    test('todos los módulos calificados: ninguno "current" y no hay próxima evaluación', () => {
      const c = cronograma(mods, GROUP, [{ uid: 'u1' }], [rev('u1', 'a'), rev('u1', 'b'), rev('u1', 'c')]);
      assert.deepEqual(c.rows.map((r) => r.status), ['graded', 'graded', 'graded']);
      assert.equal(c.nextRow, undefined);
    });
    test('el flag manual deliverable.open === false ya no marca "Calificado"', () => {
      const c = cronograma([M('a', 'Semana 1', D(100, { open: false }))], GROUP, [{ uid: 'u1' }], []);
      assert.equal(c.rows[0].status, 'current');
    });
    test('los módulos sin entregable no participan en el estado', () => {
      const c = cronograma([M('z', 'Semana 1'), M('a', 'Semana 2', D(100))], GROUP, [{ uid: 'u1' }], [rev('u1', 'z')]);
      assert.deepEqual(c.rows.map((r) => [r.id, r.status]), [['a', 'current']]);
    });
    test('un roster armado con courseRoster (sin pendientes ni duplicados) determina el estado', () => {
      const enrollments = [
        { uid: 'u1', courseId: 2, status: 'active' }, { uid: 'u1', courseId: 2, status: 'active' },
        { uid: 'p1', courseId: 2, status: 'pending' }, { uid: 'o1', courseId: 9, status: 'active' },
      ];
      const r = courseRoster(enrollments, 2);
      const c = cronograma(mods, GROUP, r, [rev('u1', 'a')]);
      assert.equal(c.rows[0].status, 'graded'); // el pendiente p1 no bloquea la calificación
    });
  });
  test('un único entregable se llama "Trabajo final"', () => {
    assert.equal(cronograma([M('a', 'Semana 1', D(100))], GROUP).rows[0].name, 'Trabajo final · T-a');
  });

  describe('pesos', () => {
    test('sin pesos: reparto equitativo marcado como estimado, misma cifra que el gradebook, avisos activos', () => {
      const mods = [M('a', 'Semana 1', D()), M('b', 'Semana 2', D()), M('c', 'Semana 3', D())];
      const c = cronograma(mods, GROUP);
      assert.deepEqual(c.rows.map((r) => r.weight), [33.33, 33.33, 33.33]);
      assert.deepEqual(c.rows.map((r) => r.explicit), [false, false, false]);
      assert.equal(c.totalWeight, 99.99);
      assert.deepEqual(c.warnings, { sumNot100: false, missingWeights: true }); // 99.99 está dentro de la tolerancia
      assert.equal(c.formula, 'PF = M1 × 33.33% + M2 × 33.33% + M3 × 33.33%');
      assert.deepEqual(buildGradebookRows(mods, {}).map((r) => r.weight), c.rows.map((r) => r.weight));
    });
    test('pesos parciales: los faltantes reparten el remanente y el total cierra en 100', () => {
      const mods = [M('a', 'S1', D(20)), M('b', 'S2', D()), M('c', 'S3', D(30))];
      const c = cronograma(mods, GROUP);
      assert.deepEqual(c.rows.map((r) => r.weight), [20, 50, 30]);
      assert.equal(c.totalWeight, 100);
      assert.equal(c.warnings.missingWeights, true);
      assert.equal(c.warnings.sumNot100, false);
    });
    test('pesos que no suman 100 activan el aviso y el total se muestra tal cual', () => {
      const c1 = cronograma([M('a', 'S1', D(20)), M('b', 'S2', D(20)), M('c', 'S3', D(25))], GROUP);
      assert.equal(c1.totalWeight, 65);
      assert.equal(c1.warnings.sumNot100, true);
      assert.equal(cronograma([M('a', 'S1', D(60)), M('b', 'S2', D(60))], GROUP).totalWeight, 120);
    });
    test('weight 0 explícito: fórmula "M1 × 0%"', () => {
      const c = cronograma([M('a', 'S1', D(0)), M('b', 'S2', D(100))], GROUP);
      assert.equal(c.formula, 'PF = M1 × 0% + M2 × 100%');
      assert.equal(c.rows[0].explicit, true);
    });
    test('weight null (campo vacío en Contenido) se trata como no definido', () => {
      const c = cronograma([M('a', 'S1', D(null))], GROUP);
      assert.equal(c.rows[0].explicit, false);
      assert.equal(c.rows[0].weight, 100);
    });
    test('el total no arrastra ruido de coma flotante (0.1 + 0.2 = 0.3)', () => {
      assert.equal(cronograma([M('a', 'S1', D(0.1)), M('b', 'S2', D(0.2))], GROUP).totalWeight, 0.3);
    });
    test('33.33 x3 tecleado: 99.99 y sin aviso de "no suma 100"', () => {
      const c = cronograma([M('a', 'S1', D(33.33)), M('b', 'S2', D(33.33)), M('c', 'S3', D(33.33))], GROUP);
      assert.equal(c.totalWeight, 99.99);
      assert.equal(c.warnings.sumNot100, false);
    });
  });

  describe('módulos SIN entregable dentro del curso', () => {
    const mods = [M('a', 'Semana 1', D(50)), M('b', 'Semana 2'), M('c', 'Semana 3', D(50)), M('d', 'Semana 4')];
    test('sólo los módulos con entregable generan filas, numeradas como en el Registro de notas', () => {
      const c = cronograma(mods, GROUP);
      assert.deepEqual(c.rows.map((r) => r.id), ['a', 'c']);
      assert.deepEqual(c.rows.map((r) => r.name), ['Entregable M1 · T-a', 'Trabajo final · T-c']);
      // Evaluación (docente) etiqueta M{i+1} sobre los que tienen entregable: mismos números.
      const evalLabels = mods.filter((m) => m.deliverable?.description).map((m, i) => `M${i + 1}`);
      assert.deepEqual(evalLabels, ['M1', 'M2']);
      assert.deepEqual(c.rows.map((_, i) => `M${i + 1}`), evalLabels);
    });
    test('la "Próxima evaluación" nunca es un módulo sin entregable', () => {
      const c = cronograma([M('a', 'Semana 1'), M('b', 'Semana 2', D(100))], GROUP);
      assert.equal(c.nextRow.id, 'b');
      assert.equal(c.rows[0].status, 'current');
    });
    test('la fórmula omite los módulos sin entregable y el total cierra en 100', () => {
      const c = cronograma(mods, GROUP);
      assert.equal(c.formula, 'PF = M1 × 50% + M2 × 50%');
      assert.equal(c.totalWeight, 100);
    });
    test('las fechas usan la semana de cada módulo aunque haya módulos sin entregable en medio', () => {
      const c = cronograma(mods, GROUP);
      assert.deepEqual(c.rows.map((r) => r.dueIso), ['2026-03-12', '2026-03-26']);
    });
    test('sin weeksLabel el fallback es la posición del módulo entre TODOS los módulos', () => {
      const c = cronograma([M('a', undefined, D(50)), M('b', 'Semana 2'), M('c', undefined, D(50))], GROUP);
      // "c" es el 3.er módulo => semana 3 => 2026-03-26
      assert.equal(c.rows[1].dueIso, '2026-03-26');
      assert.equal(c.rows[0].dueIso, '2026-03-12');
    });
  });
});

// ---------------------------------------------------------------------------
// TeacherCourseRubrica.jsx: pointsValue y totalPoints
// ---------------------------------------------------------------------------
const pointsValue = (text) => {
  const nums = String(text ?? '').match(/\d+(?:[.,]\d+)?/g);
  return nums ? Math.max(...nums.map((n) => Number(n.replace(',', '.')))) : 0;
};
const totalPoints = (criteria) => criteria.reduce((sum, c) => sum + pointsValue(c.levels?.destacado?.points), 0);
const crit = (p) => ({ levels: { destacado: { points: p } } });

describe('Rúbrica: pointsValue / totalPoints (suma de "destacado")', () => {
  test('sin criterios -> 0', () => assert.equal(totalPoints([]), 0));
  test('caso Branding: 4 criterios x 5 = 20', () => {
    assert.equal(totalPoints([crit('5'), crit('5'), crit('5'), crit('5')]), 20);
  });
  test('espacios y sufijos: " 5", "5 pts"', () => {
    assert.equal(totalPoints([crit(' 5'), crit('5 pts')]), 10);
  });
  test('vacío, no numérico, undefined, null, sin levels -> 0', () => {
    assert.equal(totalPoints([crit(''), crit('abc'), crit(undefined), crit(null), { title: 'sin levels' }, { levels: {} }]), 0);
  });
  test('un number nativo se acepta', () => assert.equal(totalPoints([crit(5), crit(0)]), 5));
  test('rangos: "0-2" -> 2 y "4-5" -> 5 (máximo del rango)', () => {
    assert.equal(pointsValue('0-2'), 2);
    assert.equal(pointsValue('4-5'), 5);
    assert.equal(pointsValue('5-4'), 5);
    assert.equal(totalPoints([crit('4-5'), crit('0-2')]), 7);
  });
  test('decimales con punto o coma: "2.5" y "2,5" -> 2.5', () => {
    assert.equal(pointsValue('2.5'), 2.5);
    assert.equal(pointsValue('2,5'), 2.5);
    assert.equal(totalPoints([crit('2.5'), crit('2,5')]), 5);
  });
  test('textos con varios números toman el mayor ("10/20" -> 20, "20%" -> 20, "Nivel 3 de 5" -> 5)', () => {
    assert.equal(pointsValue('10/20'), 20);
    assert.equal(pointsValue('20%'), 20);
    assert.equal(pointsValue('Nivel 3 de 5'), 5);
  });
  test('negativos pierden el signo (el "-" se ignora)', () => {
    assert.equal(pointsValue('-3'), 3);
  });
  test('un total distinto de 20 es válido pero la UI avisa (5 criterios x 5 = 25)', () => {
    assert.equal(totalPoints(Array.from({ length: 5 }, () => crit('5'))), 25);
  });
});

// ---------------------------------------------------------------------------
// TeacherCourseEvaluacion.jsx: Asistencia (statsFor / sessionsTaken / totalSinRegistrar)
//   y classSummary; lib/attendance.js (attendanceStats)
// ---------------------------------------------------------------------------
const teacherAttendance = (modules, roster, attendance) => {
  const sessions = getOrderedSessions(modules);
  // Sesión dictada sin registro = falta (ver lib/attendance.js).
  const statsFor = (uid) => {
    const st = attendanceStats(sessions, attendance.filter((a) => a.uid === uid));
    return { pct: st.pct, raw: st.raw, faltas: st.absent, sinRegistrar: st.unregistered };
  };
  const sessionsTaken = sessions.filter((s) => s.done || attendance.some((a) => a.sessionId === s.id)).length;
  const totalSinRegistrar = roster.reduce((sum, r) => sum + statsFor(r.uid).sinRegistrar, 0);
  const withAtt = roster.map((r) => statsFor(r.uid).raw).filter((p) => p !== null);
  const avgPct = withAtt.length ? Math.round(withAtt.reduce((sum, p) => sum + p, 0) / withAtt.length) : null;
  const bajo75 = withAtt.filter((p) => p < APPROVAL.minAttendancePct).length;
  return { statsFor, sessionsTaken, totalSinRegistrar, avgPct, bajo75, total: sessions.length };
};
const classSummary = (modules, roster, submissions, attendance) => {
  const withDeliverable = modules.filter((m) => m.deliverable?.description);
  const sessions = getOrderedSessions(modules);
  let riskCount = 0; let gradeSum = 0; let gradeN = 0; let attSum = 0; let attN = 0;
  roster.forEach((r) => {
    const byModule = {};
    withDeliverable.forEach((m) => { byModule[m.id] = submissions.find((s) => s.uid === r.uid && s.moduleId === m.id) || null; });
    const summary = computeGradeSummary(buildGradebookRows(withDeliverable, byModule));
    const attPct = attendanceStats(sessions, attendance.filter((a) => a.uid === r.uid)).raw;
    if (attPct !== null) { attSum += attPct; attN += 1; }
    if (summary.promedioParcial !== null) { gradeSum += summary.promedioParcial; gradeN += 1; }
    if ((summary.promedioParcial !== null && summary.promedioParcial < APPROVAL.minFinalGrade) || (attPct !== null && attPct < APPROVAL.minAttendancePct)) riskCount += 1;
  });
  return {
    promedioParcial: gradeN ? Math.round((gradeSum / gradeN) * 100) / 100 : null,
    asistenciaPromedio: attN ? Math.round(attSum / attN) : null,
    enRiesgo: riskCount, total: roster.length,
  };
};

// n sesiones s1..sn; las primeras `done` están marcadas como Realizadas (status 'done').
const sessionsMod = (n, done = 0) => ({ id: 'm1', title: 'M1', sessions: Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, ...(i < done ? { status: 'done' } : {}) })) });
const att = (uid, flags) => flags.map((p, i) => ({ uid, sessionId: `s${i + 1}`, present: p }));
const ROSTER = [{ uid: 'u1', studentName: 'Ana' }, { uid: 'u2', studentName: 'Luis' }];

describe('Asistencia (docente)', () => {
  test('cero sesiones: sin división por cero; pct null (sin datos)', () => {
    const a = teacherAttendance([], ROSTER, []);
    assert.equal(a.statsFor('u1').pct, null);
    assert.equal(a.avgPct, null);
    assert.equal(a.sessionsTaken, 0);
    assert.equal(a.total, 0);
    assert.equal(a.bajo75, 0);
    assert.equal(a.totalSinRegistrar, 0);
  });
  test('sesiones definidas pero ninguna realizada ni registrada -> sin datos, nadie bajo el 75%', () => {
    const a = teacherAttendance([sessionsMod(8)], ROSTER, []);
    assert.equal(a.statsFor('u1').pct, null);
    assert.equal(a.avgPct, null);
    assert.equal(a.bajo75, 0);
    assert.equal(a.sessionsTaken, 0);
  });
  test('exactamente 75% (3/4 realizadas) NO está bajo el 75%; 2/3 = 67% sí', () => {
    const ok = teacherAttendance([sessionsMod(4, 4)], [ROSTER[0]], att('u1', [true, true, true, false]));
    assert.equal(ok.statsFor('u1').pct, 75);
    assert.equal(ok.statsFor('u1').raw, 75);
    assert.equal(ok.bajo75, 0);
    const low = teacherAttendance([sessionsMod(3, 3)], [ROSTER[0]], att('u1', [true, true, false]));
    assert.equal(low.statsFor('u1').pct, 67);
    assert.equal(low.bajo75, 1);
  });
  test('38/51 = 74.51%: se muestra 75 pero SÍ cuenta como bajo el 75% (compara sin redondear)', () => {
    const flags = Array.from({ length: 51 }, (_, i) => i < 38);
    const a = teacherAttendance([sessionsMod(51)], [ROSTER[0]], att('u1', flags));
    assert.equal(a.statsFor('u1').pct, 75);
    assert.ok(a.statsFor('u1').raw < 75);
    assert.equal(a.bajo75, 1);
  });
  test('una sesión Realizada SIN registro cuenta como FALTA y como "sin registrar"', () => {
    // s1 y s2 realizadas; u1 sólo tiene registro en s1 (presente): s2 sin registrar = falta -> 1/2
    const a = teacherAttendance([sessionsMod(2, 2)], [ROSTER[0]], att('u1', [true]));
    assert.equal(a.statsFor('u1').pct, 50);
    assert.equal(a.statsFor('u1').faltas, 1);
    assert.equal(a.statsFor('u1').sinRegistrar, 1);
    assert.equal(a.bajo75, 1);
  });
  test('alumno con CERO registros en una sesión Realizada: 0%, falta, sin registrar, bajo el 75% (ya no es invisible)', () => {
    const a = teacherAttendance([sessionsMod(2, 1)], ROSTER, att('u1', [true]));
    assert.deepEqual(a.statsFor('u2'), { pct: 0, raw: 0, faltas: 1, sinRegistrar: 1 });
    assert.deepEqual(a.statsFor('u1'), { pct: 100, raw: 100, faltas: 0, sinRegistrar: 0 });
    assert.equal(a.bajo75, 1);
    assert.equal(a.avgPct, 50);
    assert.equal(a.totalSinRegistrar, 1);
    assert.equal(a.sessionsTaken, 1);
  });
  test('nadie tiene registros pero hay 1 sesión Realizada: todos 0%', () => {
    const a = teacherAttendance([sessionsMod(3, 1)], ROSTER, []);
    assert.equal(a.statsFor('u1').pct, 0);
    assert.equal(a.statsFor('u2').pct, 0);
    assert.equal(a.bajo75, 2);
    assert.equal(a.avgPct, 0);
    assert.equal(a.totalSinRegistrar, 2);
    assert.equal(a.sessionsTaken, 1);
  });
  test('un registro en una sesión NO marcada como Realizada la vuelve "dictada" para ese alumno', () => {
    const a = teacherAttendance([sessionsMod(4)], [ROSTER[0]], att('u1', [true, false]));
    assert.equal(a.statsFor('u1').pct, 50);
    assert.equal(a.sessionsTaken, 2);
  });
  test('sesiones Realizadas sin registro + registros en otras: cuentan todas', () => {
    // s1 (done, sin registro), s2 (done, presente), s3 (no done, ausente) -> dictadas = 3, presentes 1
    const m = { id: 'm1', sessions: [{ id: 's1', status: 'done' }, { id: 's2', status: 'done' }, { id: 's3' }] };
    const a = teacherAttendance([m], [ROSTER[0]], [{ uid: 'u1', sessionId: 's2', present: true }, { uid: 'u1', sessionId: 's3', present: false }]);
    assert.equal(a.statsFor('u1').raw, (1 / 3) * 100);
    assert.equal(a.statsFor('u1').sinRegistrar, 1);
  });
  test('0% y 100%; faltas; promedio', () => {
    const a = teacherAttendance([sessionsMod(2, 2)], ROSTER, [...att('u1', [true, true]), ...att('u2', [false, false])]);
    assert.deepEqual(a.statsFor('u1'), { pct: 100, raw: 100, faltas: 0, sinRegistrar: 0 });
    assert.deepEqual(a.statsFor('u2'), { pct: 0, raw: 0, faltas: 2, sinRegistrar: 0 });
    assert.equal(a.avgPct, 50);
    assert.equal(a.bajo75, 1);
  });
  test('el promedio se calcula con porcentajes sin redondear (66.67 y 100 -> 83, no 84)', () => {
    const a = teacherAttendance([sessionsMod(3, 3)], ROSTER, [...att('u1', [true, true, false]), ...att('u2', [true, true, true])]);
    assert.equal(a.avgPct, 83);
  });
  test('registros de sesiones que ya no existen se ignoran', () => {
    const a = teacherAttendance([sessionsMod(1, 1)], [ROSTER[0]], [...att('u1', [true]), { uid: 'u1', sessionId: 'borrada', present: false }]);
    assert.equal(a.statsFor('u1').pct, 100);
  });
  test('roster vacío: la pestaña Asistencia y el panel lateral coinciden (null)', () => {
    const tab = teacherAttendance([sessionsMod(2, 2)], [], []).avgPct;
    const side = classSummary([sessionsMod(2, 2)], [], [], []).asistenciaPromedio;
    assert.equal(tab, null);
    assert.equal(side, tab);
  });
  test('con roster no vacío la pestaña y el panel lateral coinciden (incluye sesiones Realizadas sin registro)', () => {
    for (const [mods, rows] of [
      [[sessionsMod(2, 2)], [...att('u1', [true, true]), ...att('u2', [true, false])]],
      [[sessionsMod(3, 3)], [...att('u1', [true, true, false]), ...att('u2', [true, true, true])]],
      [[sessionsMod(3, 3)], att('u1', [true])],
      [[sessionsMod(3, 0)], []],
    ]) {
      assert.equal(teacherAttendance(mods, ROSTER, rows).avgPct, classSummary(mods, ROSTER, [], rows).asistenciaPromedio);
    }
  });
  test('una sesión con registros de OTROS alumnos pero no marcada Realizada debería contar como dictada para todos', { todo: 'DISEÑO lib/attendance.js:200 - dictated = s.done || registro de ESE alumno; si el docente sólo tomó lista a algunos y no marcó la sesión como Realizada, los alumnos sin fila quedan con pct null (invisibles) aunque sessionsTaken ya cuenta la sesión' }, () => {
    const a = teacherAttendance([sessionsMod(2)], ROSTER, att('u1', [true]));
    assert.equal(a.statsFor('u2').pct, 0);
  });
});

describe('Asistencia (alumno): MiAsistencia y MisNotas (attendanceStats)', () => {
  // StudentCourseEvaluacion.jsx MiAsistencia: pct = stats.pct (display) ; MisNotas: { taken, pct: raw }
  const student = (modules, attendance) => {
    const st = attendanceStats(getOrderedSessions(modules), attendance);
    return { display: st.pct, info: { taken: st.taken, pct: st.raw }, faltas: st.absent, taken: st.taken };
  };
  test('sin sesiones dictadas: null (no 100%) y veredicto pending', () => {
    const r = student([sessionsMod(5)], []);
    assert.equal(r.display, null);
    assert.equal(evaluateApproval(computeGradeSummary([]), r.info).attendance, 'pending');
    assert.equal(student([], []).display, null);
  });
  test('una sesión Realizada sin registro del alumno cuenta como falta -> 0% y veredicto fail', () => {
    const r = student([sessionsMod(4, 2)], []);
    assert.equal(r.display, 0);
    assert.equal(r.faltas, 2);
    assert.equal(evaluateApproval(null, r.info).attendance, 'fail');
  });
  test('exactamente 75% -> ok; 2/3 -> fail', () => {
    assert.equal(evaluateApproval(null, student([sessionsMod(4, 4)], att('u1', [true, true, true, false])).info).attendance, 'ok');
    assert.equal(evaluateApproval(null, student([sessionsMod(3, 3)], att('u1', [true, true, false])).info).attendance, 'fail');
  });
  test('38/51: se muestra 75% pero el veredicto es fail (usa el valor sin redondear)', () => {
    const r = student([sessionsMod(51)], att('u1', Array.from({ length: 51 }, (_, i) => i < 38)));
    assert.equal(r.display, 75);
    assert.equal(evaluateApproval(null, r.info).attendance, 'fail');
  });
  test('coincide con la vista del docente para el mismo alumno (con y sin sesiones sin registrar)', () => {
    for (const [mods, rows] of [
      [[sessionsMod(3, 3)], att('u1', [true, false, true])],
      [[sessionsMod(4, 2)], att('u1', [true])],
      [[sessionsMod(4, 0)], []],
    ]) {
      assert.equal(student(mods, rows).display, teacherAttendance(mods, [ROSTER[0]], rows).statsFor('u1').pct);
    }
  });
  test('el resumen lateral del alumno (asistenciaPct) usa el mismo porcentaje redondeado', () => {
    const st = attendanceStats(getOrderedSessions([sessionsMod(3, 3)]), att('u1', [true, true, false]));
    assert.equal(st.pct, 67);
    assert.equal(evaluateApproval(computeGradeSummary([]), { taken: st.taken, pct: st.raw }).attendance, 'fail');
  });
});

describe('Resumen del aula (estudiantes en riesgo, promedio)', () => {
  const dmods = [
    { id: 'a', title: 'A', deliverable: { description: 'x', weight: 50 }, sessions: [{ id: 's1' }, { id: 's2' }] },
    { id: 'b', title: 'B', deliverable: { description: 'y', weight: 50 } },
  ];
  const sub = (uid, moduleId, grade, status = 'reviewed') => ({ uid, moduleId, grade, status });

  test('sin alumnos -> promedio null, asistencia null, 0 en riesgo', () => {
    assert.deepEqual(classSummary(dmods, [], [], []), { promedioParcial: null, asistenciaPromedio: null, enRiesgo: 0, total: 0 });
  });
  test('nota exactamente 15 no está en riesgo; 14.99 sí', () => {
    assert.equal(classSummary(dmods, [ROSTER[0]], [sub('u1', 'a', 15), sub('u1', 'b', 15)], []).enRiesgo, 0);
    assert.equal(classSummary(dmods, [ROSTER[0]], [sub('u1', 'a', 14.99), sub('u1', 'b', 14.99)], []).enRiesgo, 1);
  });
  test('sin notas ni asistencias no se considera en riesgo', () => {
    assert.equal(classSummary(dmods, ROSTER, [], []).enRiesgo, 0);
  });
  test('riesgo por asistencia < 75 aunque la nota sea 20', () => {
    assert.equal(classSummary(dmods, [ROSTER[0]], [sub('u1', 'a', 20)], att('u1', [true, false])).enRiesgo, 1);
  });
  test('riesgo por sesión Realizada sin registro (0% de asistencia)', () => {
    const withDone = [{ ...dmods[0], sessions: [{ id: 's1', status: 'done' }, { id: 's2' }] }, dmods[1]];
    assert.equal(classSummary(withDone, [ROSTER[0]], [], []).enRiesgo, 1);
    assert.equal(classSummary(withDone, [ROSTER[0]], [], []).asistenciaPromedio, 0);
    assert.equal(classSummary(withDone, [ROSTER[0]], [], att('u1', [true])).enRiesgo, 0);
  });
  test('riesgo por asistencia 74.5% (sin redondear)', () => {
    const big = { ...dmods[0], sessions: Array.from({ length: 51 }, (_, i) => ({ id: `s${i + 1}` })) };
    const flags = Array.from({ length: 51 }, (_, i) => i < 38);
    assert.equal(classSummary([big, dmods[1]], [ROSTER[0]], [], att('u1', flags)).enRiesgo, 1);
  });
  test('el promedio del aula promedia sólo a quienes tienen alguna nota revisada', () => {
    assert.equal(classSummary(dmods, ROSTER, [sub('u1', 'a', 10)], []).promedioParcial, 10);
  });
  test('una entrega re-presentada (submitted) con nota vieja no cuenta para el promedio ni el riesgo', () => {
    const r = classSummary(dmods, [ROSTER[0]], [sub('u1', 'a', 5, 'submitted')], []);
    assert.equal(r.promedioParcial, null);
    assert.equal(r.enRiesgo, 0);
  });
  test('riesgo por promedio parcial: 14 en el módulo 1 (sin el 2) ya marca riesgo', () => {
    assert.equal(classSummary(dmods, [ROSTER[0]], [sub('u1', 'a', 14)], []).enRiesgo, 1);
  });
  test('nota 0 explícita cuenta como calificada (promedio 0, en riesgo)', () => {
    const r = classSummary(dmods, [ROSTER[0]], [sub('u1', 'a', 0)], []);
    assert.equal(r.promedioParcial, 0);
    assert.equal(r.enRiesgo, 1);
  });
  test('notas fuera de rango llegan acotadas (25 -> 20)', () => {
    assert.equal(classSummary(dmods, [ROSTER[0]], [sub('u1', 'a', 25), sub('u1', 'b', 25)], []).promedioParcial, 20);
  });
});

// ---------------------------------------------------------------------------
// StudentCourseEvaluacion.jsx MisNotas :161 (fórmula) y TeacherCourseEvaluacion.jsx
// RegistroNotas :266 (cabecera de peso por módulo)
// ---------------------------------------------------------------------------
const misNotasFormula = (rows) => rows.map((r, i) => `M${i + 1} × ${r.weight}%`).join(' + ');
// TeacherCourseEvaluacion.jsx:195 -> resolveWeights(withDeliverable).rows.find(id).weight
const registroHeaderWeight = (m, all) => resolveWeights(all).rows.find((r) => r.module.id === m.id)?.weight;

describe('Mis notas: fórmula PF y pesos mostrados', () => {
  test('la fórmula usa M1, M2... igual que el Cronograma (no la primera palabra del entregable)', () => {
    const rows = buildGradebookRows([{ id: 'a', title: 'a', deliverable: { description: 'Diagnóstico de marca', weight: 20 } }, { id: 'b', title: 'b', deliverable: { description: 'Brand Deck ejecutivo', weight: 80 } }], {});
    assert.equal(misNotasFormula(rows), 'M1 × 20% + M2 × 80%');
  });
  test('el alumno y el docente (Cronograma) ven la MISMA fórmula para los mismos módulos', () => {
    const mods = [M('a', 'Semana 1', D(20)), M('b', 'Semana 2', D()), M('c', 'Semana 3', D(30))];
    assert.equal(misNotasFormula(buildGradebookRows(mods, {})), cronograma(mods, GROUP).formula.replace('PF = ', ''));
  });
  test('sin pesos: el alumno ve el reparto equitativo (33.33%), igual que el Cronograma "estimado"', () => {
    const mods = [1, 2, 3].map((i) => M(`m${i}`, `Semana ${i}`, D()));
    assert.equal(misNotasFormula(buildGradebookRows(mods, {})), 'M1 × 33.33% + M2 × 33.33% + M3 × 33.33%');
  });
});

describe('Registro de notas (docente): cabecera de peso por módulo', () => {
  test('coincide con resolveWeights y con el peso que usa el cálculo, en varios escenarios', () => {
    const scenarios = [
      [M('a', 'S1', D(20)), M('b', 'S2', D(80))],
      [M('a', 'S1', D()), M('b', 'S2', D()), M('c', 'S3', D())],
      [M('a', 'S1', D(30)), M('b', 'S2', D(30)), M('c', 'S3', D())],
      [M('a', 'S1', D('')), M('b', 'S2', D(100))],
      [M('a', 'S1', D(0)), M('b', 'S2', D())],
    ];
    for (const mods of scenarios) {
      const header = mods.map((m) => registroHeaderWeight(m, mods));
      assert.deepEqual(header, resolveWeights(mods).rows.map((r) => r.weight));
      assert.deepEqual(header, buildGradebookRows(mods, {}).map((r) => r.weight));
    }
  });
  test('pesos mixtos [30, 30, faltante]: la cabecera muestra 40 (ya no 33.33)', () => {
    const mods = [M('a', 'S1', D(30)), M('b', 'S2', D(30)), M('c', 'S3', D())];
    assert.equal(registroHeaderWeight(mods[2], mods), 40);
  });
  test('los módulos sin entregable no se cuentan en el reparto de la cabecera', () => {
    const all = [M('a', 'S1', D()), M('z', 'S2'), M('b', 'S3', D())];
    const withDeliverable = all.filter((m) => m.deliverable?.description);
    assert.deepEqual(withDeliverable.map((m) => registroHeaderWeight(m, withDeliverable)), [50, 50]);
  });
});
