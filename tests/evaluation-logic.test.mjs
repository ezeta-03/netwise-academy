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
import { getGradingModel, buildStudentRows } from '../src/lib/gradingScheme.js';
import { courseRoster } from '../src/lib/roster.js';

// ---------------------------------------------------------------------------
// TeacherCourseCronograma.jsx (filas/estado; endWeekOf/fechas: lib/deliveryDates.js; roster: lib/roster.js)
// ---------------------------------------------------------------------------
const cronograma = (modules, group, roster = [], subs = [], scores = [], courseId = 99) => {
  // Mismos componentes y pesos que el Registro de notas (lib/gradingScheme.js).
  const model = getGradingModel(courseId, modules);
  const resolved = resolveWeights(modules);
  const moduleComps = model.components.filter((c) => c.kind === 'module');
  const manualComps = model.components.filter((c) => c.kind === 'manual');
  // "Calificado" = todos los alumnos del aula tienen su entrega revisada en ese módulo.
  const rosterUids = new Set(roster.map((r) => r.uid));
  const gradedCount = (moduleId) => new Set(subs.filter((x) => x.moduleId === moduleId && x.status === 'reviewed' && rosterUids.has(x.uid)).map((x) => x.uid)).size;
  const isGraded = (moduleId) => roster.length > 0 && gradedCount(moduleId) === roster.length;
  const scoredUids = (key) => new Set(scores.filter((g) => rosterUids.has(g.uid) && g.scores?.[key] !== null && g.scores?.[key] !== undefined).map((g) => g.uid));
  const isManualGraded = (key) => roster.length > 0 && scoredUids(key).size === roster.length;
  const firstOpenIdx = moduleComps.findIndex((c) => !isGraded(c.moduleId));
  const moduleRows = moduleComps.map((c, i) => {
    const m = c.module;
    const dueIso = deliverableDueDate(m, modules.indexOf(m), group);
    const status = isGraded(m.id) ? 'graded' : (i === firstOpenIdx ? 'current' : 'scheduled');
    const label = model.hasScheme ? `Entregable M${i + 1}` : deliverableLabel(i, moduleComps.length);
    return { id: m.id, dueIso, status, weight: c.weight, explicit: model.hasScheme || resolved.rows[i]?.explicit, graded: gradedCount(m.id), name: `${label} · ${m.title}` };
  });
  const manualRows = manualComps.map((c) => ({
    id: c.key, dueIso: null, status: isManualGraded(c.key) ? 'graded' : 'scheduled', weight: c.weight, explicit: true, graded: scoredUids(c.key).size, name: c.label,
  }));
  const rows = [...moduleRows, ...manualRows];
  const nextRow = moduleRows[firstOpenIdx] || manualRows.find((r) => r.status !== 'graded');
  const totalWeight = model.total;
  const weightsOk = Math.abs(totalWeight - 100) <= 0.05;
  const formula = rows.length > 0 ? `PF = ${model.components.map((c) => `${c.label} × ${c.weight}%`).join(' + ')}` : null;
  const warnings = { sumNot100: rows.length > 0 && !weightsOk, missingWeights: rows.length > 0 && !model.hasScheme && !resolved.allExplicit };
  return { rows, moduleRows, manualRows, nextRow, totalWeight, weightsOk, formula, warnings, model };
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
const classSummary = (modules, roster, submissions, attendance, scores = [], courseId = 99) => {
  const model = getGradingModel(courseId, modules);
  const scoresByUid = Object.fromEntries(scores.map((g) => [g.uid, g.scores || {}]));
  const sessions = getOrderedSessions(modules);
  let riskCount = 0; let gradeSum = 0; let gradeN = 0; let attSum = 0; let attN = 0;
  roster.forEach((r) => {
    const summary = computeGradeSummary(buildStudentRows(model, submissions.filter((sub) => sub.uid === r.uid), scoresByUid[r.uid]));
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
  test('nota exactamente 16 no está en riesgo; 15.99 sí', () => {
    assert.equal(classSummary(dmods, [ROSTER[0]], [sub('u1', 'a', 16), sub('u1', 'b', 16)], []).enRiesgo, 0);
    assert.equal(classSummary(dmods, [ROSTER[0]], [sub('u1', 'a', 15.99), sub('u1', 'b', 15.99)], []).enRiesgo, 1);
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
// StudentCourseEvaluacion.jsx MisNotas (fórmula) y EntregasNotas (calificados);
// TeacherCourseEvaluacion.jsx RegistroNotas (cabeceras y saveCell)
// ---------------------------------------------------------------------------
const misNotasFormula = (model) => model.components.map((c) => `${c.label} × ${c.weight}%`).join(' + ');
const subHeader = (c, model) => `${c.weightInBlock}% ${model.hasScheme ? 'del bloque' : 'de la nota'}`; // RegistroNotas :321
const blockHeader = (b) => `${b.label} · ${b.weight}%`;                                                 // RegistroNotas :313-314
const headerKindOf = (b) => b.components[0].kind;                                                        // RegistroNotas :312 (sin "?.")
const entregasSummary = (model, submissions, scores) => {                                                // EntregasNotas :98-103
  const gradeRows = buildStudentRows(model, submissions, scores);
  const moduleRows = gradeRows.filter((r) => r.kind === 'module');
  return { calificados: moduleRows.filter((r) => r.grade !== null).length, totalModulos: moduleRows.length, summary: computeGradeSummary(gradeRows) };
};

const revd = (moduleId, grade, status = 'reviewed') => ({ moduleId, grade, status });

describe('Mis notas: fórmula PF y pesos mostrados (con y sin esquema)', () => {
  test('sin esquema: "M1 × 20% + M2 × 80%" (igual que el Cronograma)', () => {
    const mods = [M('a', 'S1', D(20)), M('b', 'S2', D(80))];
    assert.equal(misNotasFormula(getGradingModel(99, mods)), 'M1 × 20% + M2 × 80%');
    assert.equal(misNotasFormula(getGradingModel(99, mods)), cronograma(mods, GROUP).formula.replace('PF = ', ''));
  });
  test('sin pesos y sin esquema: reparto equitativo (33.33%)', () => {
    const mods = [1, 2, 3].map((i) => M(`m${i}`, `Semana ${i}`, D()));
    assert.equal(misNotasFormula(getGradingModel(99, mods)), 'M1 × 33.33% + M2 × 33.33% + M3 × 33.33%');
  });
  test('Redes: incluye el componente manual con su nombre y pesos efectivos', () => {
    const mods = ['a', 'b', 'c', 'd'].map((id) => M(id, 'S1', D()));
    assert.equal(misNotasFormula(getGradingModel(1, mods)), 'M1 × 14% + M2 × 17.5% + M3 × 17.5% + M4 × 21% + Sustentación final × 30%');
  });
  test('el alumno y el Cronograma del docente muestran la MISMA fórmula en los 4 esquemas', () => {
    const mods = ['a', 'b', 'c', 'd'].map((id, i) => M(id, `Semana ${i + 1}`, D()));
    for (const id of [1, 2, 3, 4]) {
      assert.equal(misNotasFormula(getGradingModel(id, mods)), cronograma(mods, GROUP, [], [], [], id).formula.replace('PF = ', ''), `curso ${id}`);
    }
  });
});

describe('Registro de notas (docente): cabeceras', () => {
  const four = ['a', 'b', 'c', 'd'].map((id) => M(id, 'S1', D()));
  test('con esquema: "25% del bloque" por módulo y el bloque "Evaluación de módulos · 70%"', () => {
    const model = getGradingModel(1, four);
    assert.deepEqual(model.components.filter((c) => c.kind === 'module').map((c) => subHeader(c, model)), ['20% del bloque', '25% del bloque', '25% del bloque', '30% del bloque']);
    assert.deepEqual(model.blocks.map(blockHeader), ['Evaluación de módulos · 70%', 'Sustentación final · 30%']);
  });
  test('sin esquema: "20% de la nota" con el peso efectivo de resolveWeights', () => {
    const mods = [M('a', 'S1', D(30)), M('b', 'S2', D(30)), M('c', 'S3', D())];
    const model = getGradingModel(99, mods);
    assert.deepEqual(model.components.map((c) => subHeader(c, model)), ['30% de la nota', '30% de la nota', '40% de la nota']);
    assert.deepEqual(model.components.map((c) => c.weightInBlock), resolveWeights(mods).rows.map((r) => r.weight));
  });
  test('con esquema, el deliverable.weight no aparece en la cabecera', () => {
    const model = getGradingModel(2, [M('a', 'S1', D(90)), M('b', 'S2', D(5)), M('c', 'S3', D(3)), M('d', 'S4', D(2))]);
    assert.deepEqual(model.components.slice(0, 4).map((c) => subHeader(c, model)), Array(4).fill('25% del bloque'));
  });
  test('cada bloque con componentes tiene un primer componente (kind) para decidir la cabecera', () => {
    for (const id of [1, 2, 3, 4, 99]) for (const b of getGradingModel(id, four).blocks) assert.ok(['module', 'manual'].includes(headerKindOf(b)));
  });
  test('sin entregables definidos el bloque de módulos queda vacío y la cabecera (b.components[0].kind) lanza TypeError', () => {
    for (const id of [1, 99]) {
      const model = getGradingModel(id, []);
      assert.throws(() => model.blocks.map(headerKindOf), TypeError, `curso ${id}`);
    }
  });
  test('un curso con esquema pero sin entregables debería poder mostrar su Registro de notas', { todo: 'BUG TeacherCourseEvaluacion.jsx:312 - b.components[0].kind sin "?." (sí lo tiene :290): un bloque de módulos sin componentes (curso sin entregables definidos) lanza TypeError y deja la pantalla en blanco' }, () => {
    const model = getGradingModel(1, []);
    assert.doesNotThrow(() => model.blocks.map(headerKindOf));
  });
});

// TeacherCourseEvaluacion.jsx saveCell :256-266 (parte pura: decide qué hacer con el texto)
const saveCellDecision = (comp, text, current) => {
  const clean = String(text).trim().replace(',', '.');
  if (clean === '') {
    if (comp.kind !== 'manual' || current === null) return { ok: true, action: 'noop' };
  }
  const n = clean === '' ? null : Number(clean);
  if (n !== null && (!Number.isFinite(n) || n < 0 || n > 20)) return { ok: false, action: 'reject' };
  if (n === current) return { ok: true, action: 'noop' };
  return { ok: true, action: comp.kind === 'module' ? 'upsertSubmission' : 'setCourseScore', value: n };
};
const MOD = { kind: 'module' }; const MAN = { kind: 'manual' };
// Regla de db.setCourseScore (db.js:1298-1300)
const dbValidate = (value) => {
  const score = value === null || value === undefined || value === '' ? null : Number(value);
  if (score !== null && (!Number.isFinite(score) || score < 0 || score > 20)) throw new Error('La nota debe estar entre 0 y 20.');
  return score;
};

describe('Registro de notas (docente): saveCell', () => {
  test('texto vacío borra sólo las celdas manuales que tenían nota', () => {
    assert.deepEqual(saveCellDecision(MAN, '', 15), { ok: true, action: 'setCourseScore', value: null });
    assert.deepEqual(saveCellDecision(MAN, '   ', 15), { ok: true, action: 'setCourseScore', value: null });
  });
  test('texto vacío en una celda manual que ya estaba vacía: no hace nada', () => {
    assert.deepEqual(saveCellDecision(MAN, '', null), { ok: true, action: 'noop' });
  });
  test('texto vacío en una celda de módulo: no borra la nota (no-op)', () => {
    assert.deepEqual(saveCellDecision(MOD, '', 15), { ok: true, action: 'noop' });
    assert.deepEqual(saveCellDecision(MOD, '', null), { ok: true, action: 'noop' });
  });
  test('un módulo vaciado debería restaurar el valor mostrado en el campo (ok=false)', { todo: 'BUG TeacherCourseEvaluacion.jsx:259 - vaciar una celda de MÓDULO devuelve true, así que onBlur (:339) no restaura el valor: el campo queda en blanco aunque la nota 15 sigue guardada hasta recargar' }, () => {
    assert.equal(saveCellDecision(MOD, '', 15).ok, false);
  });
  test('coma decimal: "15,5" -> 15.5; punto también; espacios alrededor', () => {
    assert.equal(saveCellDecision(MAN, '15,5', null).value, 15.5);
    assert.equal(saveCellDecision(MAN, '15.5', null).value, 15.5);
    assert.equal(saveCellDecision(MOD, '  17  ', null).value, 17);
    assert.equal(saveCellDecision(MOD, '.5', null).value, 0.5);
    assert.equal(saveCellDecision(MOD, '15,', null).value, 15);
  });
  test('el mismo valor no guarda nada (no-op), también con distinto formato ("15,0", "15.0", "015")', () => {
    for (const t of ['15', '15,0', '15.0', '015', ' 15 ']) assert.deepEqual(saveCellDecision(MOD, t, 15), { ok: true, action: 'noop' }, t);
    assert.deepEqual(saveCellDecision(MAN, '15,5', 15.5), { ok: true, action: 'noop' });
  });
  test('0 es una nota válida: se guarda si no había nota y es no-op si ya era 0', () => {
    assert.deepEqual(saveCellDecision(MOD, '0', null), { ok: true, action: 'upsertSubmission', value: 0 });
    assert.deepEqual(saveCellDecision(MAN, '0', null), { ok: true, action: 'setCourseScore', value: 0 });
    assert.deepEqual(saveCellDecision(MOD, '0', 0), { ok: true, action: 'noop' });
    assert.deepEqual(saveCellDecision(MOD, '-0', 0), { ok: true, action: 'noop' });
  });
  test('los extremos 0 y 20 se aceptan', () => {
    assert.equal(saveCellDecision(MOD, '20', 10).value, 20);
    assert.equal(saveCellDecision(MOD, '0', 10).value, 0);
  });
  test('no numérico o fuera de 0-20 se rechaza (ok=false)', () => {
    for (const t of ['abc', '21', '20.01', '-1', '-0.5', '1,5,2', '15 puntos', 'Infinity', '--5', '1..5', 'NaN']) {
      assert.deepEqual(saveCellDecision(MOD, t, 10), { ok: false, action: 'reject' }, t);
    }
  });
  test('la acción depende del tipo: módulo -> upsertSubmission, manual -> setCourseScore', () => {
    assert.equal(saveCellDecision(MOD, '12', null).action, 'upsertSubmission');
    assert.equal(saveCellDecision(MAN, '12', null).action, 'setCourseScore');
  });
  test('todo lo que saveCell acepta pasa también la validación de setCourseScore en db.js', () => {
    for (const t of ['0', '20', '15,5', '.5', '15,', '007', '1e1', '0x10', ' 8 ']) {
      const d = saveCellDecision(MAN, t, null);
      assert.equal(d.ok, true, t);
      assert.doesNotThrow(() => dbValidate(d.value), t);
    }
  });
  test('y lo que saveCell rechaza también lo rechazaría db.js', () => {
    for (const t of ['abc', '21', '-1', 'Infinity']) assert.throws(() => dbValidate(Number(t.replace(',', '.'))), t);
  });
  test('notación hexadecimal o científica ("0x10", "1e1") debería rechazarse', { todo: 'BAJO TeacherCourseEvaluacion.jsx:261 - Number("0x10") === 16 y Number("1e1") === 10 se aceptan como nota; sólo debería aceptarse /^\\d+([.,]\\d+)?$/' }, () => {
    assert.equal(saveCellDecision(MAN, '0x10', null).ok, false);
    assert.equal(saveCellDecision(MAN, '1e1', null).ok, false);
  });
  test('una nota almacenada fuera de rango (25, mostrada acotada 20) no se corrige al reescribir 20', () => {
    // la celda muestra 20 (usableGrade acota); teclear 20 es no-op y el dato 25 sigue en el almacén
    assert.deepEqual(saveCellDecision(MOD, '20', 20), { ok: true, action: 'noop' });
  });
});

describe('Cronograma con esquema de calificación', () => {
  const four = ['a', 'b', 'c', 'd'].map((id, i) => M(id, `Semana ${i + 1}`, D()));
  const roster = [{ uid: 'u1' }, { uid: 'u2' }];
  const sc = (uid, scores) => ({ uid, scores });

  test('Branding: 4 filas de módulo (17.5%) + 1 fila manual "Sustentación del Brand Deck" (30%), total 100', () => {
    const c = cronograma(four, GROUP, [], [], [], 2);
    assert.deepEqual(c.rows.map((r) => [r.id, r.weight]), [['a', 17.5], ['b', 17.5], ['c', 17.5], ['d', 17.5], ['sustentacion', 30]]);
    assert.equal(c.totalWeight, 100);
    assert.equal(c.weightsOk, true);
    assert.equal(c.moduleRows.length, 4);
    assert.equal(c.manualRows.length, 1);
    assert.equal(c.manualRows[0].name, 'Sustentación del Brand Deck');
  });
  test('con esquema todos los módulos son "Entregable M{n}" (no hay "Trabajo final") y son explícitos', () => {
    const c = cronograma(four, GROUP, [], [], [], 2);
    assert.deepEqual(c.moduleRows.map((r) => r.name), ['Entregable M1 · T-a', 'Entregable M2 · T-b', 'Entregable M3 · T-c', 'Entregable M4 · T-d']);
    assert.ok(c.rows.every((r) => r.explicit === true));
    assert.deepEqual(c.warnings, { sumNot100: false, missingWeights: false });
  });
  test('el deliverable.weight de los módulos se ignora en las filas', () => {
    const w = ['a', 'b', 'c', 'd'].map((id, i) => M(id, `Semana ${i + 1}`, D(97 - i)));
    assert.deepEqual(cronograma(w, GROUP, [], [], [], 2).rows.map((r) => r.weight), [17.5, 17.5, 17.5, 17.5, 30]);
  });
  test('las filas manuales no tienen fecha (dueIso null) y las de módulo sí (fecha calculada)', () => {
    const c = cronograma(four, GROUP, [], [], [], 1);
    assert.deepEqual(c.moduleRows.map((r) => r.dueIso), ['2026-03-12', '2026-03-19', '2026-03-26', '2026-04-02']);
    assert.equal(c.manualRows[0].dueIso, null);
  });
  test('fórmula: "PF = M1 × 14% + ... + Sustentación final × 30%"', () => {
    assert.equal(cronograma(four, GROUP, [], [], [], 1).formula, 'PF = M1 × 14% + M2 × 17.5% + M3 × 17.5% + M4 × 21% + Sustentación final × 30%');
  });
  test('Marketing: 3 filas manuales además de los módulos; total 100', () => {
    const c = cronograma(four, GROUP, [], [], [], 3);
    assert.deepEqual(c.manualRows.map((r) => [r.id, r.weight]), [['participacion', 20], ['caso1', 20], ['proyecto', 40]]);
    assert.equal(c.totalWeight, 100);
  });

  describe('estado de las filas manuales', () => {
    test('sin alumnos en el aula nunca es "graded"', () => {
      assert.equal(cronograma(four, GROUP, [], [], [sc('u1', { sustentacion: 15 })], 2).manualRows[0].status, 'scheduled');
    });
    test('"graded" sólo si TODOS los alumnos del roster tienen nota no nula en esa clave', () => {
      const partial = cronograma(four, GROUP, roster, [], [sc('u1', { sustentacion: 15 })], 2).manualRows[0];
      assert.deepEqual([partial.status, partial.graded], ['scheduled', 1]);
      const full = cronograma(four, GROUP, roster, [], [sc('u1', { sustentacion: 15 }), sc('u2', { sustentacion: 12 })], 2).manualRows[0];
      assert.deepEqual([full.status, full.graded], ['graded', 2]);
    });
    test('la nota 0 cuenta como calificada; null / undefined (borrada) no', () => {
      const zero = cronograma(four, GROUP, roster, [], [sc('u1', { sustentacion: 0 }), sc('u2', { sustentacion: 0 })], 2).manualRows[0];
      assert.equal(zero.status, 'graded');
      const cleared = cronograma(four, GROUP, roster, [], [sc('u1', { sustentacion: 10 }), sc('u2', { sustentacion: null })], 2).manualRows[0];
      assert.deepEqual([cleared.status, cleared.graded], ['scheduled', 1]);
      const missing = cronograma(four, GROUP, roster, [], [sc('u1', { sustentacion: 10 }), sc('u2', {})], 2).manualRows[0];
      assert.equal(missing.graded, 1);
    });
    test('se ignoran las notas de alumnos fuera del roster y las claves de otros componentes', () => {
      const c = cronograma(four, GROUP, [{ uid: 'u1' }], [], [sc('u1', { proyecto: 10 }), sc('x9', { sustentacion: 20 })], 2).manualRows[0];
      assert.deepEqual([c.status, c.graded], ['scheduled', 0]);
    });
    test('los uids se cuentan una vez aunque haya varios documentos de notas del mismo alumno', () => {
      const c = cronograma(four, GROUP, roster, [], [sc('u1', { sustentacion: 10 }), sc('u1', { sustentacion: 12 })], 2).manualRows[0];
      assert.equal(c.graded, 1);
      assert.equal(c.status, 'scheduled');
    });
    test('Marketing: cada componente manual se evalúa por separado', () => {
      const c = cronograma(four, GROUP, [{ uid: 'u1' }], [], [sc('u1', { participacion: 10, proyecto: 15 })], 3);
      assert.deepEqual(c.manualRows.map((r) => [r.id, r.status]), [['participacion', 'graded'], ['caso1', 'scheduled'], ['proyecto', 'graded']]);
    });
  });

  describe('próxima evaluación (nextRow)', () => {
    const allSubs = (uids, ids) => uids.flatMap((uid) => ids.map((moduleId) => ({ uid, moduleId, status: 'reviewed' })));
    test('la primera fila de MÓDULO sin calificar, aunque haya manuales pendientes', () => {
      const c = cronograma(four, GROUP, roster, allSubs(['u1', 'u2'], ['a']), [], 2);
      assert.equal(c.nextRow.id, 'b');
      assert.equal(c.moduleRows[1].status, 'current');
    });
    test('con todos los módulos calificados, la primera fila manual sin calificar', () => {
      const c = cronograma(four, GROUP, roster, allSubs(['u1', 'u2'], ['a', 'b', 'c', 'd']), [], 3);
      assert.deepEqual(c.moduleRows.map((r) => r.status), Array(4).fill('graded'));
      assert.equal(c.nextRow.id, 'participacion');
      const c2 = cronograma(four, GROUP, roster, allSubs(['u1', 'u2'], ['a', 'b', 'c', 'd']), [sc('u1', { participacion: 10 }), sc('u2', { participacion: 10 })], 3);
      assert.equal(c2.nextRow.id, 'caso1');
    });
    test('todo calificado (módulos y manuales): no hay próxima evaluación', () => {
      const c = cronograma(four, GROUP, roster, allSubs(['u1', 'u2'], ['a', 'b', 'c', 'd']), [sc('u1', { sustentacion: 10 }), sc('u2', { sustentacion: 10 })], 1);
      assert.equal(c.nextRow, undefined);
      assert.deepEqual(c.rows.map((r) => r.status), Array(5).fill('graded'));
    });
    test('los módulos usan la próxima manual sólo cuando ya no queda ningún módulo abierto', () => {
      const c = cronograma(four, GROUP, roster, [], [], 1);
      assert.equal(c.nextRow.id, 'a');
    });
    test('sin roster: primero módulo "current" y ninguna manual es "graded"', () => {
      const c = cronograma(four, GROUP, [], [], [], 1);
      assert.equal(c.nextRow.id, 'a');
      assert.ok(c.manualRows.every((r) => r.status === 'scheduled'));
    });
  });

  describe('cantidades de módulos raras', () => {
    test('4 módulos pero sólo 3 con entregable: 3 filas de módulo + manual; pesos iguales; total dentro de tolerancia', () => {
      const three = [M('a', 'Semana 1', D()), M('z', 'Semana 2'), M('b', 'Semana 3', D()), M('c', 'Semana 4', D())];
      const c = cronograma(three, GROUP, [], [], [], 1);
      assert.deepEqual(c.moduleRows.map((r) => r.id), ['a', 'b', 'c']);
      assert.deepEqual(c.moduleRows.map((r) => r.weight), [23.33, 23.33, 23.33]);
      assert.equal(c.totalWeight, 99.99);
      assert.equal(c.weightsOk, true);
      assert.deepEqual(c.moduleRows.map((r) => r.name), ['Entregable M1 · T-a', 'Entregable M2 · T-b', 'Entregable M3 · T-c']);
    });
    test('las fechas usan la semana real de cada módulo aun con un módulo sin entregable en medio', () => {
      const three = [M('a', 'Semana 1', D()), M('z', 'Semana 2'), M('b', 'Semana 3', D())];
      assert.deepEqual(cronograma(three, GROUP, [], [], [], 2).moduleRows.map((r) => r.dueIso), ['2026-03-12', '2026-03-26']);
    });
    test('5 módulos: 5 filas de módulo (14% c/u en Redes) y total 100', () => {
      const five = [1, 2, 3, 4, 5].map((i) => M(`m${i}`, `Semana ${i}`, D()));
      const c = cronograma(five, GROUP, [], [], [], 1);
      assert.deepEqual(c.moduleRows.map((r) => r.weight), [14, 14, 14, 14, 14]);
      assert.equal(c.totalWeight, 100);
    });
    test('sin módulos con entregable: sólo filas manuales, total 30 y aviso de pesos', () => {
      const c = cronograma([M('z', 'Semana 1')], GROUP, [], [], [], 1);
      assert.equal(c.moduleRows.length, 0);
      assert.equal(c.totalWeight, 30);
      assert.equal(c.weightsOk, false);
      assert.equal(c.warnings.sumNot100, true);
      assert.equal(c.nextRow.id, 'sustentacion');
    });
    test('sin esquema (curso 99) no aparecen filas manuales y se mantiene la etiqueta "Trabajo final"', () => {
      const c = cronograma(four, GROUP, [], [], [], 99);
      assert.equal(c.manualRows.length, 0);
      assert.equal(c.moduleRows.at(-1).name, 'Trabajo final · T-d');
    });
    test('el aviso de "pesos sin definir" nunca se muestra con esquema', () => {
      assert.equal(cronograma(four, GROUP, [], [], [], 4).warnings.missingWeights, false);
      assert.equal(cronograma(four, GROUP, [], [], [], 99).warnings.missingWeights, true);
    });
    test('con esquema y 3 de 4 entregables el docente debería ser avisado de que se ignoraron los pesos [20,25,25,30]', { todo: 'DISEÑO gradingScheme.js:79 / TeacherCourseCronograma.jsx - moduleWeights.length !== nº de entregables cae en silencio a partes iguales (total 99.99 pasa la tolerancia); no hay flag en el modelo ni aviso' }, () => {
      const three = [M('a', 'S1', D()), M('b', 'S2', D()), M('c', 'S3', D())];
      const c = cronograma(three, GROUP, [], [], [], 1);
      assert.ok(c.model.blocks[0].components.some((x) => x.weightInBlock !== 33.33), 'se aplicó el reparto por defecto sin avisar');
    });
    test('una fila manual con nota no numérica ("") en el almacén cuenta como calificada en el Cronograma pero no en el Registro', { todo: 'BAJO TeacherCourseCronograma.jsx (scoredUids: != null) vs gradingScheme.js:106-108 (Number.isFinite): score "" cuenta como calificado en un lado y sin nota en el otro' }, () => {
      const c = cronograma(four, GROUP, [{ uid: 'u1' }], [], [{ uid: 'u1', scores: { sustentacion: '' } }], 1).manualRows[0];
      const model = getGradingModel(1, four);
      const inGradebook = buildStudentRows(model, [], { sustentacion: '' })[4].grade !== null;
      assert.equal(c.status === 'graded', inGradebook);
    });
  });
});

describe('Rúbrica: appliesRows', () => {
  // TeacherCourseRubrica.jsx:149-158
  const appliesRows = (courseId, modules) => {
    const model = getGradingModel(courseId, modules);
    const resolved = resolveWeights(modules);
    const moduleCount = model.components.filter((c) => c.kind === 'module').length;
    return model.components.map((c) => ({
      id: c.key,
      name: c.kind === 'module' ? `${model.hasScheme ? `Entregable M${c.index + 1}` : deliverableLabel(c.index, moduleCount)} · ${c.module.title}` : c.label,
      weight: c.weight,
      estimated: !model.hasScheme && !resolved.rows[c.index]?.explicit,
    }));
  };
  const four = ['a', 'b', 'c', 'd'].map((id, i) => M(id, `Semana ${i + 1}`, D()));

  test('con esquema: módulos + componentes manuales con su peso efectivo, nunca "estimado"', () => {
    const r = appliesRows(1, four);
    assert.deepEqual(r.map((x) => [x.name, x.weight, x.estimated]), [
      ['Entregable M1 · T-a', 14, false], ['Entregable M2 · T-b', 17.5, false], ['Entregable M3 · T-c', 17.5, false], ['Entregable M4 · T-d', 21, false],
      ['Sustentación final', 30, false],
    ]);
  });
  test('Marketing: 7 filas (4 módulos + 3 manuales)', () => {
    assert.equal(appliesRows(3, four).length, 7);
  });
  test('sin esquema: "Trabajo final" para el último y "estimado" cuando el peso no fue definido', () => {
    const r = appliesRows(99, [M('a', 'S1', D(50)), M('b', 'S2', D())]);
    assert.deepEqual(r.map((x) => [x.name, x.weight, x.estimated]), [['Entregable M1 · T-a', 50, false], ['Trabajo final · T-b', 50, true]]);
  });
  test('con esquema los pesos manuales del deliverable se ignoran', () => {
    const r = appliesRows(2, ['a', 'b', 'c', 'd'].map((id) => M(id, 'S1', D(1))));
    assert.deepEqual(r.slice(0, 4).map((x) => x.weight), Array(4).fill(17.5));
  });
  test('con 3 de 4 entregables: 3 módulos + manual; suma cercana a 100', () => {
    const r = appliesRows(1, [M('a', 'S1', D()), M('z', 'S2'), M('b', 'S3', D()), M('c', 'S4', D())]);
    assert.equal(r.length, 4);
    assert.ok(Math.abs(r.reduce((s, x) => s + x.weight, 0) - 100) <= 0.05);
  });
  test('ids únicos (key del componente)', () => {
    for (const id of [1, 2, 3, 4, 99]) {
      const ids = appliesRows(id, four).map((x) => x.id);
      assert.equal(new Set(ids).size, ids.length);
    }
  });
  test('sin entregables y sin esquema: []', () => {
    assert.deepEqual(appliesRows(99, []), []);
  });
});

describe('Mis entregas (alumno): calificados / promedio', () => {
  const four = ['a', 'b', 'c', 'd'].map((id) => M(id, 'S1', D()));
  const redes = getGradingModel(1, four);

  test('"Calificados" cuenta sólo módulos revisados; el denominador son los módulos (no los componentes)', () => {
    const r = entregasSummary(redes, [revd('a', 15), revd('b', 12)], { sustentacion: 17 });
    assert.deepEqual([r.calificados, r.totalModulos], [2, 4]);
  });
  test('un alumno con sólo nota manual: 0/4 calificados pero promedio parcial calculado', () => {
    const r = entregasSummary(redes, [], { sustentacion: 17 });
    assert.deepEqual([r.calificados, r.totalModulos, r.summary.promedioParcial], [0, 4, 17]);
  });
  test('nota 0 en un módulo cuenta como calificado; "submitted" no', () => {
    const r = entregasSummary(redes, [revd('a', 0), revd('b', 18, 'submitted')], {});
    assert.equal(r.calificados, 1);
  });
  test('el total de componentes (allGraded) incluye los manuales aunque "Calificados" no', () => {
    const r = entregasSummary(redes, [revd('a', 1), revd('b', 1), revd('c', 1), revd('d', 1)], {});
    assert.deepEqual([r.calificados, r.totalModulos, r.summary.allGraded, r.summary.totalCount], [4, 4, false, 5]);
  });
  test('sin esquema no hay componentes manuales: calificados y allGraded coinciden', () => {
    const r = entregasSummary(getGradingModel(99, four), [revd('a', 10), revd('b', 10), revd('c', 10), revd('d', 10)], {});
    assert.deepEqual([r.calificados, r.summary.allGraded], [4, true]);
  });
  test('con 3 de 4 entregables el denominador es 3', () => {
    const three = getGradingModel(1, [M('a', 'S1', D()), M('z', 'S2'), M('b', 'S3', D()), M('c', 'S4', D())]);
    assert.equal(entregasSummary(three, [], {}).totalModulos, 3);
  });
  test('notas fuera de rango del almacén se acotan en el promedio del alumno', () => {
    const r = entregasSummary(redes, [revd('a', 25)], { sustentacion: -4 });
    assert.equal(r.summary.promedioParcial, 6.36); // (14*20 + 30*0) / 44
  });
});

describe('Resumen del aula con esquema de calificación (classSummary)', () => {
  const four = ['a', 'b', 'c', 'd'].map((id) => ({ id, title: `T-${id}`, deliverable: { description: 'x' } }));
  const subsFor = (uid, g) => ['a', 'b', 'c', 'd'].map((moduleId) => ({ uid, moduleId, grade: g, status: 'reviewed' }));
  const scoreOf = (uid, scores) => ({ uid, scores });

  test('la sustentación manual entra al promedio: módulos 20 y sustentación 0 -> 14 (en riesgo)', () => {
    const r = classSummary(four, [ROSTER[0]], subsFor('u1', 20), [], [scoreOf('u1', { sustentacion: 0 })], 1);
    assert.equal(r.promedioParcial, 14);
    assert.equal(r.enRiesgo, 1);
  });
  test('módulos 20 y sustentación 10 -> 17 (no en riesgo)', () => {
    const r = classSummary(four, [ROSTER[0]], subsFor('u1', 20), [], [scoreOf('u1', { sustentacion: 10 })], 1);
    assert.equal(r.promedioParcial, 17);
    assert.equal(r.enRiesgo, 0);
  });
  test('un alumno con SÓLO nota manual 15 (sin módulos) queda en riesgo; con 16 no', () => {
    assert.equal(classSummary(four, [ROSTER[0]], [], [], [scoreOf('u1', { sustentacion: 15 })], 1).enRiesgo, 1);
    assert.equal(classSummary(four, [ROSTER[0]], [], [], [scoreOf('u1', { sustentacion: 16 })], 1).enRiesgo, 0);
  });
  test('el promedio del aula promedia los promedios individuales de quienes tienen alguna nota (manual o módulo)', () => {
    const r = classSummary(four, ROSTER, subsFor('u1', 10), [], [scoreOf('u1', { sustentacion: 10 }), scoreOf('u2', { sustentacion: 20 })], 1);
    assert.equal(r.promedioParcial, 15); // u1 = 10, u2 = 20
    assert.equal(r.total, 2);
  });
  test('notas fuera de rango en el almacén se acotan: sustentación 25 -> 20', () => {
    assert.equal(classSummary(four, [ROSTER[0]], [], [], [scoreOf('u1', { sustentacion: 25 })], 1).promedioParcial, 20);
  });
  test('sin esquema (curso 99) las notas manuales no existen y no afectan', () => {
    const r = classSummary(four, [ROSTER[0]], subsFor('u1', 12), [], [scoreOf('u1', { sustentacion: 20 })], 99);
    assert.equal(r.promedioParcial, 12);
  });
  test('string vs número como id de curso da el mismo resumen', () => {
    const args = [four, [ROSTER[0]], subsFor('u1', 16), [], [scoreOf('u1', { sustentacion: 18 })]];
    assert.deepEqual(classSummary(...args, 1), classSummary(...args, '1'));
  });
});
