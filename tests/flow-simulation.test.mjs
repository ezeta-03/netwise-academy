// Simulación de extremo a extremo del flujo real de calificación, con las
// librerías puras REALES (sin firebase):
//   curso (módulos con entregable y sesiones) -> matrículas -> courseRoster ->
//   por alumno: entregas (submitted -> reviewed con nota; reentrega vuelve a
//   'submitted' y la nota vieja deja de valer), notas manuales
//   (courseGrades.scores por clave), asistencia (present true/false; sesión
//   dictada sin registro = falta) -> buildStudentRows -> computeGradeSummary ->
//   evaluateApproval con { taken, pct: raw } (así lo hace StudentCourseEvaluacion).
//
// Los escenarios salen de un PRNG con semilla (mulberry32): son deterministas y
// un fallo se reproduce con el seed que aparece en el mensaje.
//
// Convención (igual que el resto de tests): { todo } = bug conocido del código
// fuente que se documenta sin romper la corrida.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GRADING_SCHEMES, getGradingModel, buildStudentRows, effectiveModuleWeights } from '../src/lib/gradingScheme.js';
import { computeGradeSummary, usableGrade } from '../src/lib/gradebook.js';
import { APPROVAL, MIN_PERFORMANCE_GRADE, evaluateApproval, evaluateSubstitute } from '../src/lib/approval.js';
import { attendanceStats } from '../src/lib/attendance.js';
import { getOrderedSessions } from '../src/lib/courseSessions.js';
import { courseRoster } from '../src/lib/roster.js';
import { resolveWeights } from '../src/lib/weights.js';

// ---------------------------------------------------------------- PRNG ----
const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const makeRng = (seed) => {
  const next = mulberry32(seed);
  const int = (a, b) => a + Math.floor(next() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(next() * arr.length)];
  const chance = (p) => next() < p;
  const shuffle = (arr) => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  return { next, int, pick, chance, shuffle };
};

test('mulberry32: determinista, en [0,1) y con semillas distintas da secuencias distintas', () => {
  const a = mulberry32(42); const b = mulberry32(42); const c = mulberry32(43);
  const sa = Array.from({ length: 50 }, a); const sb = Array.from({ length: 50 }, b); const sc = Array.from({ length: 50 }, c);
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  assert.ok(sa.every((x) => x >= 0 && x < 1));
});

// ------------------------------------------------------ utilidades base ----
const clamp = (n) => Math.min(20, Math.max(0, n));
const round2 = (n) => Math.round((n + 1e-9) * 100) / 100;
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const dm = (id, extra = {}) => ({ id, title: `T-${id}`, deliverable: { description: `d-${id}`, ...extra } });
const mods = (n) => Array.from({ length: n }, (_, i) => dm(`m${i + 1}`));
const rev = (moduleId, grade, status = 'reviewed') => ({ moduleId, grade, status });
const summaryOf = (model, subs, scores) => computeGradeSummary(buildStudentRows(model, subs, scores));
// Notas en pasos de 0.25 y pesos múltiplos de 0.5: las sumas son exactas en coma flotante.
const qGrade = (rng) => rng.int(0, 80) / 4;

// ---------------------------------------------- generador de escenarios ----
const makeSessions = (rng, moduleId) => {
  const n = rng.int(0, 4);
  const out = [];
  for (let j = 0; j < n; j++) {
    const s = { id: `${moduleId}-s${j}`, title: `Sesión ${j}` };
    const kind = rng.int(0, 3);
    if (kind === 0) s.status = 'done';
    else if (kind === 1) s.status = 'scheduled';
    else if (kind === 2) s.done = rng.chance(0.5); // formato antiguo: booleano
    else { s.status = 'done'; s.dateLabel = '12 mar'; }
    if (rng.chance(0.04)) delete s.id; // sesión sin id (se ignora en asistencia)
    out.push(s);
  }
  return out;
};

const makeModules = (rng, n, junkWeights) => {
  const list = [];
  for (let i = 0; i < n; i++) {
    const id = `mod-${i + 1}`;
    const deliverable = { description: `Entregable ${i + 1}` };
    if (junkWeights) deliverable.weight = rng.pick([90, 5, 0, -50, '', null, 'abc', 33, 100]);
    list.push({ id, title: `Módulo ${i + 1}`, deliverable, sessions: makeSessions(rng, id) });
  }
  if (rng.chance(0.25)) { // módulo sin entregable: no cuenta para notas pero sí tiene sesiones
    const extra = { id: 'mod-extra', title: 'Sin entregable', sessions: makeSessions(rng, 'mod-extra') };
    if (rng.chance(0.5)) extra.deliverable = { description: '' };
    list.splice(rng.int(0, list.length), 0, extra);
  }
  return list;
};

// Un alumno: acciones sobre UN doc de entrega por módulo (como la app) y notas
// manuales. `expected` = nota efectiva esperada por clave de componente (o null).
const simulateStudent = (rng, model, profile, uid) => {
  const store = new Map();
  const expected = {};
  const scores = {};
  const submit = (moduleId) => {
    const prev = store.get(moduleId);
    // Reentregar conserva la nota vieja en el documento (como db.js) pero vuelve a 'submitted'.
    store.set(moduleId, { uid, moduleId, status: 'submitted', grade: prev ? prev.grade : null });
  };
  const review = (moduleId, grade) => store.set(moduleId, { uid, moduleId, status: 'reviewed', grade });

  const graded = ['reviewed', 'rereviewed', 'dirty'];
  const ungraded = ['none', 'submitted', 'resubmitted'];
  const pool = profile === 'complete' ? graded : profile === 'none' ? ungraded : [...graded, ...ungraded, 'reviewed'];
  const paths = model.components.map(() => rng.pick(pool));
  if (profile === 'partial' && model.components.length && paths.every((p) => graded.includes(p))) {
    paths[rng.int(0, paths.length - 1)] = rng.pick(ungraded);
  }

  model.components.forEach((c, i) => {
    const path = paths[i];
    if (c.kind === 'module') {
      const id = c.moduleId;
      if (path === 'none') { expected[c.key] = null; return; }
      submit(id);
      if (path === 'submitted') { expected[c.key] = null; return; }
      const g1 = qGrade(rng);
      if (path === 'reviewed') { review(id, g1); expected[c.key] = g1; return; }
      if (path === 'resubmitted') { review(id, g1); submit(id); expected[c.key] = null; return; }
      if (path === 'rereviewed') { review(id, g1); submit(id); const g2 = qGrade(rng); review(id, g2); expected[c.key] = g2; return; }
      const dirty = rng.pick([25, -3, '15.5', 999, '0', 20.25]);
      review(id, dirty); expected[c.key] = clamp(Number(dirty));
      return;
    }
    // manual
    if (path === 'none') { expected[c.key] = null; if (rng.chance(0.5)) scores[c.key] = rng.pick([null, '', undefined, 'abc', NaN]); return; }
    if (path === 'submitted' || path === 'resubmitted') { scores[c.key] = null; expected[c.key] = null; return; } // nota borrada
    if (path === 'dirty') { const d = rng.pick([25, -3, '18.5', 999]); scores[c.key] = d; expected[c.key] = clamp(Number(d)); return; }
    const g = qGrade(rng);
    scores[c.key] = rng.chance(0.3) ? String(g) : g;
    expected[c.key] = g;
  });

  // Ruido que debe ignorarse: entregas de módulos que no son entregables y claves de scores ajenas.
  if (rng.chance(0.4)) store.set('mod-extra', { uid, moduleId: 'mod-extra', status: 'reviewed', grade: 20 });
  if (rng.chance(0.3)) store.set('ghost', { uid, moduleId: 'ghost', status: 'reviewed', grade: 0 });
  if (rng.chance(0.3)) scores.claveInexistente = 20;
  if (rng.chance(0.2)) scores.modules = 20;
  return { uid, profile, subs: rng.shuffle([...store.values()]), scores, expected };
};

const makeRecords = (rng, sessions) => {
  const records = [];
  for (const s of sessions) {
    if (s.id === undefined || s.id === null) continue;
    const r = rng.next();
    if (r < 0.3) continue; // sin registro
    records.push({ sessionId: s.id, present: r < 0.75 });
  }
  if (rng.chance(0.3)) records.push({ sessionId: 'sesion-borrada', present: true });
  return rng.shuffle(records);
};

const COURSE_KINDS = [1, 2, 3, 4, 'none'];
const SCENARIOS_PER_COURSE = 300;
const PROFILES = ['complete', 'partial', 'none', 'mixed'];

const buildScenarios = () => {
  const list = [];
  COURSE_KINDS.forEach((kind, ci) => {
    for (let i = 0; i < SCENARIOS_PER_COURSE; i++) {
      const seed = 1000 * (ci + 1) + i;
      const rng = makeRng(seed);
      const hasScheme = kind !== 'none';
      const courseId = hasScheme ? (rng.chance(0.5) ? kind : String(kind)) : (i % 2 ? 99 : 'curso-nuevo');
      const nMods = rng.pick([4, 4, 4, 3, 5, 0]);
      const modules = makeModules(rng, nMods, hasScheme);
      const cleanModules = modules.map((m) => (m.deliverable ? { ...m, deliverable: { description: m.deliverable.description } } : m));
      const model = getGradingModel(courseId, modules);
      const sessions = getOrderedSessions(modules);
      const students = PROFILES.map((profile, k) => {
        const st = simulateStudent(rng, model, profile, `u${k}`);
        st.records = makeRecords(rng, sessions);
        st.rows = buildStudentRows(model, st.subs, st.scores);
        st.summary = computeGradeSummary(st.rows);
        st.att = attendanceStats(sessions, st.records);
        st.approval = evaluateApproval(st.summary, { taken: st.att.taken, pct: st.att.raw });
        return st;
      });
      list.push({ seed, kind, hasScheme, courseId, nMods, modules, cleanModules, model, sessions, students });
    }
  });
  return list;
};
const SCENARIOS = buildScenarios();
const forEachStudent = (fn) => {
  for (const sc of SCENARIOS) for (const st of sc.students) fn(sc, st, `curso=${sc.courseId} seed=${sc.seed} n=${sc.nMods} perfil=${st.profile}`);
};
const schemeWithFourMods = () => SCENARIOS.filter((s) => s.hasScheme && s.nMods === 4);

// Oráculo independiente del promedio: lo calcula con las notas esperadas, sin pasar por buildStudentRows.
const oracle = (model, expected) => {
  let sw = 0; let sg = 0; let n = 0;
  for (const c of model.components) {
    const g = expected[c.key];
    if (g !== null && g !== undefined) { sw += c.weight; sg += g * c.weight; n++; }
  }
  return { n, raw: n ? sg / sw : null, allGraded: model.components.length > 0 && n === model.components.length, hand: sg };
};

describe('el generador cubre lo que dice cubrir', () => {
  test('1500 escenarios: 300 por cada curso 1..4 y 300 de un curso sin esquema; módulos 3/4/5/0', () => {
    assert.equal(SCENARIOS.length, 5 * SCENARIOS_PER_COURSE);
    for (const kind of COURSE_KINDS) assert.equal(SCENARIOS.filter((s) => s.kind === kind).length, SCENARIOS_PER_COURSE);
    for (const n of [0, 3, 4, 5]) assert.ok(SCENARIOS.some((s) => s.nMods === n), `n=${n}`);
    assert.ok(SCENARIOS.some((s) => typeof s.courseId === 'string' && s.hasScheme) && SCENARIOS.some((s) => typeof s.courseId === 'number' && s.hasScheme));
    assert.ok(SCENARIOS.every((s) => s.hasScheme === s.model.hasScheme));
  });
  test('los perfiles producen lo que prometen (completo = todo calificado; ninguno = sin notas)', () => {
    forEachStudent((sc, st, ctx) => {
      const o = oracle(sc.model, st.expected);
      if (st.profile === 'complete' && sc.model.components.length) assert.equal(o.allGraded, true, ctx);
      if (st.profile === 'none') assert.equal(o.n, 0, ctx);
    });
    const stale = SCENARIOS.flatMap((s) => s.students).filter((st) => st.subs.some((x) => x.status === 'submitted' && x.grade !== null));
    assert.ok(stale.length > 50, 'hay entregas reentregadas con nota vieja');
  });
});

// ------------------------------------------------------------ pesos --------
describe('propiedades: pesos del modelo', () => {
  test('con 4 entregables los pesos de todo esquema suman 100 (±0.05)', () => {
    const list = schemeWithFourMods();
    assert.ok(list.length > 400);
    for (const sc of list) assert.ok(Math.abs(sc.model.total - 100) <= 0.05, `seed=${sc.seed} total=${sc.model.total}`);
  });
  test('sin esquema y con >=1 entregable, el reparto por partes iguales suma 100 (±0.05); sin entregables suma 0', () => {
    for (const sc of SCENARIOS.filter((s) => !s.hasScheme)) {
      if (sc.nMods === 0) { assert.equal(sc.model.total, 0); assert.deepEqual(sc.model.components, []); }
      else assert.ok(Math.abs(sc.model.total - 100) <= 0.05, `seed=${sc.seed} n=${sc.nMods} total=${sc.model.total}`);
    }
  });
  test('con esquema y 3/5 módulos el total sigue a <=0.1 de 100 y se avisa moduleCountMismatch; con 4 o 0 no hay aviso', () => {
    for (const sc of SCENARIOS.filter((s) => s.hasScheme)) {
      if (sc.nMods === 3 || sc.nMods === 5) {
        assert.ok(Math.abs(sc.model.total - 100) <= 0.1, `seed=${sc.seed}`);
        assert.deepEqual(sc.model.moduleCountMismatch, { expected: 4, actual: sc.nMods });
      } else assert.equal(sc.model.moduleCountMismatch, null, `seed=${sc.seed}`);
    }
  });
  test('los componentes salen con clave única, peso > 0, módulos = sólo entregables y en orden; blocks[].components == components', () => {
    for (const sc of SCENARIOS) {
      const keys = sc.model.components.map((c) => c.key);
      assert.equal(new Set(keys).size, keys.length, `seed=${sc.seed}`);
      assert.ok(sc.model.components.every((c) => c.weight > 0), `seed=${sc.seed}`);
      assert.deepEqual(sc.model.components.filter((c) => c.kind === 'module').map((c) => c.moduleId), sc.modules.filter((m) => m.deliverable?.description).map((m) => m.id), `seed=${sc.seed}`);
      assert.deepEqual(sc.model.blocks.flatMap((b) => b.components), sc.model.components);
    }
  });
  test('effectiveModuleWeights coincide con los pesos de los componentes de módulo', () => {
    for (const sc of SCENARIOS) {
      const eff = effectiveModuleWeights(sc.courseId, sc.modules);
      const mc = sc.model.components.filter((c) => c.kind === 'module');
      assert.deepEqual(Object.keys(eff), mc.map((c) => c.moduleId));
      for (const c of mc) assert.equal(eff[c.moduleId], c.weight);
    }
  });
  test('deliverable.weight se IGNORA cuando el curso tiene esquema (pesos absurdos = pesos ausentes)', () => {
    for (const sc of SCENARIOS.filter((s) => s.hasScheme)) {
      const clean = getGradingModel(sc.courseId, sc.cleanModules);
      assert.deepEqual(sc.model.components.map((c) => [c.key, c.weight]), clean.components.map((c) => [c.key, c.weight]), `seed=${sc.seed}`);
      assert.deepEqual(effectiveModuleWeights(sc.courseId, sc.modules), effectiveModuleWeights(sc.courseId, sc.cleanModules));
      // ...y por tanto el promedio de cada alumno es el mismo con o sin esos pesos
      for (const st of sc.students) {
        assert.deepEqual(summaryOf(clean, st.subs, st.scores), st.summary, `seed=${sc.seed} ${st.profile}`);
      }
    }
  });
  test('SIN esquema los deliverable.weight sí mandan (contraste con la propiedad anterior)', () => {
    const m = getGradingModel('curso-nuevo', [dm('a', { weight: 30 }), dm('b', { weight: 70 })]);
    assert.deepEqual(m.components.map((c) => c.weight), [30, 70]);
    assert.deepEqual(m.components.map((c) => c.weight), resolveWeights([dm('a', { weight: 30 }), dm('b', { weight: 70 })]).rows.map((r) => r.weight));
  });
  test('id de curso como texto o número da el mismo modelo, aun con módulos al azar', () => {
    for (const sc of SCENARIOS.filter((s) => s.hasScheme)) {
      const id = Number(sc.courseId);
      assert.deepEqual(getGradingModel(String(id), sc.modules), getGradingModel(id, sc.modules), `seed=${sc.seed}`);
    }
  });
  test('los esquemas declarados siguen sumando 100 por bloques', () => {
    for (const [id, s] of Object.entries(GRADING_SCHEMES)) assert.equal(s.blocks.reduce((a, b) => a + b.weight, 0), 100, id);
  });
});

// -------------------------------------------------------- notas / promedio --
describe('propiedades: flujo de entregas y notas manuales -> promedio', () => {
  test('las filas de cada alumno reflejan el oráculo (entregas reentregadas no cuentan, notas acotadas)', () => {
    forEachStudent((sc, st, ctx) => {
      assert.deepEqual(st.rows.map((r) => r.key), sc.model.components.map((c) => c.key), ctx);
      for (const r of st.rows) assert.equal(r.grade, st.expected[r.key], `${ctx} ${r.key}`);
    });
  });
  test('el promedio, el conteo y allGraded del flujo coinciden con el cálculo manual independiente', () => {
    forEachStudent((sc, st, ctx) => {
      const o = oracle(sc.model, st.expected);
      assert.equal(st.summary.gradedCount, o.n, ctx);
      assert.equal(st.summary.totalCount, sc.model.components.length, ctx);
      assert.equal(st.summary.allGraded, o.allGraded, ctx);
      if (o.raw === null) assert.equal(st.summary.promedioParcial, null, ctx);
      else {
        assert.ok(Math.abs(st.summary.promedioParcial - o.raw) <= 0.0051, `${ctx}: ${st.summary.promedioParcial} vs ${o.raw}`);
        assert.equal(st.summary.promedioParcial, round2(o.raw), ctx);
      }
    });
  });
  test('sin ninguna nota: promedioParcial null, allGraded false y veredicto global pending (incluye reentregas con nota vieja)', () => {
    let seen = 0;
    forEachStudent((sc, st, ctx) => {
      if (st.profile !== 'none') return;
      seen++;
      assert.equal(st.summary.promedioParcial, null, ctx);
      assert.equal(st.summary.rendimientoRaw, null, ctx);
      assert.equal(st.summary.rendimientoPct, null, ctx);
      assert.equal(st.summary.allGraded, false, ctx);
      assert.equal(st.summary.gradedCount, 0, ctx);
      assert.deepEqual([st.approval.overall, st.approval.finalGrade, st.approval.performance], ['pending', 'pending', 'pending'], ctx);
    });
    assert.equal(seen, SCENARIOS.length);
  });
  test('promedioParcial siempre cae entre la nota mínima y la máxima de lo calificado (y en 0-20)', () => {
    forEachStudent((sc, st, ctx) => {
      const gs = st.rows.map((r) => r.grade).filter((g) => g !== null);
      if (!gs.length) return;
      const p = st.summary.promedioParcial;
      assert.ok(p >= Math.min(...gs) && p <= Math.max(...gs), `${ctx}: ${p} fuera de [${Math.min(...gs)}, ${Math.max(...gs)}]`);
      assert.ok(p >= 0 && p <= 20, ctx);
    });
  });
  test('con TODO calificado el promedio = sum(nota_i * peso_i) / sum(pesos); con total ~100 también = sum/100 (±0.01)', () => {
    let complete = 0;
    forEachStudent((sc, st, ctx) => {
      if (!st.summary.allGraded) return;
      complete++;
      const hand = sc.model.components.reduce((s, c) => s + st.expected[c.key] * c.weight, 0);
      const W = sc.model.components.reduce((s, c) => s + c.weight, 0);
      assert.ok(Math.abs(st.summary.promedioParcial - hand / W) <= 0.0051, ctx);
      if (Math.abs(sc.model.total - 100) <= 0.05) assert.ok(Math.abs(st.summary.promedioParcial - hand / 100) <= 0.01, `${ctx}: ${st.summary.promedioParcial} vs ${hand / 100}`);
    });
    assert.ok(complete > 1000, `escenarios completos: ${complete}`);
  });
  test('agregar un componente calificado con nota IGUAL al promedio actual no cambia el resultado', () => {
    let tried = 0;
    forEachStudent((sc, st, ctx) => {
      const p = st.summary.promedioParcial;
      if (p === null) return;
      const c = sc.model.components.find((x) => st.expected[x.key] === null);
      if (!c) return;
      tried++;
      const subs = st.subs.filter((s) => s.moduleId !== c.moduleId);
      const scores = { ...st.scores };
      if (c.kind === 'module') subs.push(rev(c.moduleId, p)); else scores[c.key] = p;
      const after = summaryOf(sc.model, subs, scores);
      assert.equal(after.promedioParcial, p, `${ctx} + ${c.key}`);
      assert.equal(after.gradedCount, st.summary.gradedCount + 1, ctx);
    });
    assert.ok(tried > 500, `casos: ${tried}`);
  });
  test('el orden de las entregas y de las claves de scores no cambia nada', () => {
    forEachStudent((sc, st, ctx) => {
      const rng = makeRng(sc.seed * 7 + st.uid.length + st.profile.length);
      const subs = rng.shuffle(st.subs);
      const scores = Object.fromEntries(rng.shuffle(Object.entries(st.scores)));
      assert.deepEqual(summaryOf(sc.model, subs, scores), st.summary, ctx);
      assert.deepEqual(buildStudentRows(sc.model, subs, scores), st.rows, ctx);
    });
  });
  test('una entrega en status "submitted" (aunque conserve una nota vieja) no aporta nada', () => {
    let touched = 0;
    forEachStudent((sc, st, ctx) => {
      const has = st.subs.some((s) => s.status === 'submitted');
      if (!has) return;
      touched++;
      const withStale = st.subs.map((s) => (s.status === 'submitted' ? { ...s, grade: 20 } : s));
      const withNull = st.subs.map((s) => (s.status === 'submitted' ? { ...s, grade: null } : s));
      const without = st.subs.filter((s) => s.status !== 'submitted');
      const a = summaryOf(sc.model, withStale, st.scores);
      assert.deepEqual(a, st.summary, ctx);
      assert.deepEqual(summaryOf(sc.model, withNull, st.scores), st.summary, ctx);
      // quitar la entrega deja el promedio igual (sólo cambia el status de la fila, no la nota)
      assert.deepEqual(summaryOf(sc.model, without, st.scores), st.summary, ctx);
    });
    assert.ok(touched > 300);
  });
  test('reentrega: la nota anterior deja de contar hasta que el docente califica de nuevo (secuencia paso a paso)', () => {
    const model = getGradingModel(1, mods(4));
    const store = new Map();
    const view = () => summaryOf(model, [...store.values()], { sustentacion: 10 });
    store.set('m1', rev('m1', null, 'submitted'));
    assert.equal(view().promedioParcial, 10);
    store.set('m1', rev('m1', 20, 'reviewed'));
    assert.equal(view().promedioParcial, round2((14 * 20 + 30 * 10) / 44));
    store.set('m1', { ...store.get('m1'), status: 'submitted' }); // reentrega, la nota 20 queda guardada
    assert.equal(store.get('m1').grade, 20);
    assert.equal(usableGrade(store.get('m1')), null);
    assert.equal(view().promedioParcial, 10);
    store.set('m1', { ...store.get('m1'), status: 'reviewed', grade: 12 });
    assert.equal(view().promedioParcial, round2((14 * 12 + 30 * 10) / 44));
  });
  test('notas fuera de 0-20 (entregas y manuales) se acotan; rows y promedio siempre quedan en [0, 20]', () => {
    forEachStudent((sc, st, ctx) => {
      assert.ok(st.rows.every((r) => r.grade === null || (r.grade >= 0 && r.grade <= 20)), ctx);
    });
    for (const sc of SCENARIOS.filter((s) => s.model.components.length)) {
      const wild = (v) => summaryOf(sc.model,
        sc.model.components.filter((c) => c.kind === 'module').map((c) => rev(c.moduleId, v)),
        Object.fromEntries(sc.model.components.filter((c) => c.kind === 'manual').map((c) => [c.key, v])));
      assert.equal(wild(999).promedioParcial, 20, `seed=${sc.seed}`);
      assert.equal(wild(-999).promedioParcial, 0, `seed=${sc.seed}`);
      assert.equal(wild(999).allGraded, true);
    }
  });
  test('rendimientoRaw = promedio mostrado (2 decimales)/20*100 y rendimientoPct es su redondeo', () => {
    forEachStudent((sc, st, ctx) => {
      const s = st.summary;
      if (s.promedioParcial === null) return;
      const o = oracle(sc.model, st.expected);
      assert.ok(close(s.rendimientoRaw, (o.raw / 20) * 100, 0.0251), ctx);
      assert.equal(s.rendimientoRaw, (s.promedioParcial / 20) * 100, ctx);
      assert.ok(Math.abs(s.rendimientoRaw - s.promedioParcial * 5) <= 0.0251, `${ctx}: ${s.rendimientoRaw} vs ${s.promedioParcial * 5}`);
      assert.equal(s.rendimientoPct, Math.round(s.rendimientoRaw), ctx);
    });
  });
});

// -------------------------------------------------------------- aprobación --
describe('propiedades: evaluateApproval sobre el flujo completo', () => {
  test('constantes: 15 nota mínima, 80% -> 16, sustitutoria 16, asistencia 75', () => {
    assert.deepEqual([APPROVAL.minFinalGrade, APPROVAL.minPerformancePct, APPROVAL.minSubstituteGrade, APPROVAL.minAttendancePct], [15, 80, 16, 75]);
    assert.equal(MIN_PERFORMANCE_GRADE, 16);
  });
  test('overall es "pending" salvo que allGraded; finalGrade y performance también', () => {
    forEachStudent((sc, st, ctx) => {
      if (st.summary.allGraded) return;
      assert.deepEqual([st.approval.overall, st.approval.finalGrade, st.approval.performance], ['pending', 'pending', 'pending'], ctx);
    });
  });
  test('con todo calificado: finalGrade ok iff promedio >= 15; performance ok iff rendimientoRaw >= 80', () => {
    let settled = 0;
    forEachStudent((sc, st, ctx) => {
      if (!st.summary.allGraded) return;
      settled++;
      assert.equal(st.approval.finalGrade, st.summary.promedioParcial >= 15 ? 'ok' : 'fail', ctx);
      assert.equal(st.approval.performance, st.summary.rendimientoRaw >= 80 ? 'ok' : 'fail', ctx);
    });
    assert.ok(settled > 1000);
  });
  test('umbral de 16 EXACTO con aritmética entera (pesos múltiplos de 0.5, notas en cuartos): performance ok iff sum(g*w) >= 1600', () => {
    let exact = 0;
    forEachStudent((sc, st, ctx) => {
      if (!st.summary.allGraded) return;
      const w2 = sc.model.components.map((c) => c.weight * 2);
      if (!w2.every(Number.isInteger) || w2.reduce((a, b) => a + b, 0) !== 200) return;
      exact++;
      const total = sc.model.components.reduce((s, c) => s + (st.expected[c.key] * 4) * (c.weight * 2), 0); // = 800 * promedio real
      assert.equal(st.approval.performance, total >= 16 * 800 ? 'ok' : 'fail', `${ctx} total=${total}`);
    });
    assert.ok(exact > 500, `casos exactos: ${exact}`);
  });
  test('overall = "regular" iff finalGrade ok Y performance ok; si no, "substitute"', () => {
    const seen = { regular: 0, substitute: 0 };
    forEachStudent((sc, st, ctx) => {
      if (!st.summary.allGraded) return;
      const a = st.approval;
      const expectedOverall = a.finalGrade === 'ok' && a.performance === 'ok' ? 'regular' : 'substitute';
      assert.equal(a.overall, expectedOverall, ctx);
      seen[a.overall]++;
    });
    assert.ok(seen.regular > 20 && seen.substitute > 20, JSON.stringify(seen));
  });
  test('performance ok implica finalGrade ok (el piso de 15 nunca decide) y sustituto/regular son excluyentes', () => {
    forEachStudent((sc, st, ctx) => {
      if (st.approval.performance === 'ok') assert.equal(st.approval.finalGrade, 'ok', ctx);
      if (st.approval.finalGrade === 'fail') assert.equal(st.approval.overall, 'substitute', ctx);
    });
  });
  test('asistencia: taken 0 -> pending; si no, ok iff raw >= 75 (independiente de las notas)', () => {
    forEachStudent((sc, st, ctx) => {
      const a = st.approval.attendance;
      if (st.att.taken === 0) assert.equal(a, 'pending', ctx);
      else assert.equal(a, st.att.raw >= 75 ? 'ok' : 'fail', ctx);
      // la asistencia no altera los veredictos de notas
      assert.deepEqual(evaluateApproval(st.summary, null).overall, st.approval.overall, ctx);
    });
  });
  test('summary null/undefined: todo pending', () => {
    for (const s of [null, undefined, {}]) {
      const v = evaluateApproval(s, null);
      assert.deepEqual([v.finalGrade, v.performance, v.attendance, v.overall], ['pending', 'pending', 'pending', 'pending']);
    }
  });
  test('evaluateSubstitute: ok iff 16 <= nota <= 20; vacío / fuera de rango / no numérico -> pending', () => {
    for (const [g, r] of [[16, 'ok'], [20, 'ok'], ['17.5', 'ok'], [15.99, 'fail'], [0, 'fail'], [15, 'fail'],
      [null, 'pending'], [undefined, 'pending'], ['', 'pending'], ['abc', 'pending'], [NaN, 'pending'], [21, 'pending'], [-1, 'pending'], [Infinity, 'pending']]) {
      assert.equal(evaluateSubstitute(g), r, String(g));
    }
  });
  test('un promedio que se muestra como 16.00 cumple el rendimiento (se compara el promedio mostrado)', () => {
    const model = getGradingModel(2, mods(4));
    const s = summaryOf(model, ['m1', 'm2', 'm3', 'm4'].map((m) => rev(m, 16)), { sustentacion: 15.99 });
    assert.equal(s.promedioParcial, 16);
    assert.ok(s.allGraded);
    // si el promedio mostrado ya es >= 16, no debería fallar el rendimiento
    assert.equal(evaluateApproval(s, null).performance, 'ok');
  });
});

// -------------------------------------------------------------- asistencia --
const oracleAttendance = (modules, records) => {
  const rec = new Map();
  for (const r of records) rec.set(r.sessionId, r); // el último gana, como Map
  let taken = 0; let present = 0; let unregistered = 0; let doneWithoutRecord = 0;
  for (const m of modules) {
    for (const s of m.sessions || []) {
      if (s.id === undefined || s.id === null) continue;
      const isDone = s.status ? s.status === 'done' : s.done === true;
      const has = rec.has(s.id);
      if (!(isDone || has)) continue;
      taken++;
      if (has && rec.get(s.id).present) present++;
      if (!has) { unregistered++; doneWithoutRecord++; }
    }
  }
  return { taken, present, absent: taken - present, unregistered, raw: taken ? (present / taken) * 100 : null, doneWithoutRecord };
};

describe('propiedades: asistencia', () => {
  test('taken = dictadas ∪ con registro del alumno; absent = taken - present; sin registro en dictada = falta y sin registrar', () => {
    let withTaken = 0;
    forEachStudent((sc, st, ctx) => {
      const o = oracleAttendance(sc.modules, st.records);
      assert.equal(st.att.taken, o.taken, ctx);
      assert.equal(st.att.present, o.present, ctx);
      assert.equal(st.att.absent, st.att.taken - st.att.present, ctx);
      assert.equal(st.att.absent, o.absent, ctx);
      assert.equal(st.att.unregistered, o.unregistered, ctx);
      assert.ok(st.att.unregistered <= st.att.absent, ctx); // toda sin registrar es falta
      if (o.taken) withTaken++;
    });
    assert.ok(withTaken > 1000);
  });
  test('pct es null si no hay nada dictado; si no pct = round(raw) y raw = present/taken*100', () => {
    forEachStudent((sc, st, ctx) => {
      if (st.att.taken === 0) { assert.equal(st.att.raw, null, ctx); assert.equal(st.att.pct, null, ctx); return; }
      assert.ok(close(st.att.raw, (st.att.present / st.att.taken) * 100), ctx);
      assert.equal(st.att.pct, Math.round(st.att.raw), ctx);
      assert.ok(st.att.raw >= 0 && st.att.raw <= 100, ctx);
    });
  });
  test('una sesión Realizada sin registro cuenta como falta y sin registrar (y baja el porcentaje)', () => {
    const modules = [{ id: 'a', title: 'A', sessions: [{ id: 's1', status: 'done' }, { id: 's2', status: 'done' }, { id: 's3', status: 'scheduled' }] }];
    const sessions = getOrderedSessions(modules);
    const st = attendanceStats(sessions, [{ sessionId: 's1', present: true }]);
    assert.deepEqual([st.taken, st.present, st.absent, st.unregistered, st.raw, st.pct], [2, 1, 1, 1, 50, 50]);
    assert.deepEqual(attendanceStats(sessions, []).pct, 0);
    assert.equal(attendanceStats(getOrderedSessions([{ id: 'a', sessions: [{ id: 's3', status: 'scheduled' }] }]), []).pct, null);
  });
  test('un registro en una sesión sólo "programada" la vuelve dictada; un registro huérfano (sesión borrada) se ignora', () => {
    const sessions = getOrderedSessions([{ id: 'a', sessions: [{ id: 's1', status: 'scheduled' }, { id: 's2', status: 'scheduled' }] }]);
    const st = attendanceStats(sessions, [{ sessionId: 's1', present: false }, { sessionId: 'fantasma', present: true }]);
    assert.deepEqual([st.taken, st.present, st.absent, st.unregistered], [1, 0, 1, 0]);
  });
  test('límite del 75% exacto: 3 de 4 -> 75 ok; 2 de 3 (66.7) fail; 149/200 = 74.5 fail comparando raw', () => {
    const mk = (n, presentCount) => {
      const sessions = getOrderedSessions([{ id: 'a', sessions: Array.from({ length: n }, (_, i) => ({ id: `s${i}`, status: 'done' })) }]);
      const records = Array.from({ length: n }, (_, i) => ({ sessionId: `s${i}`, present: i < presentCount }));
      const a = attendanceStats(sessions, records);
      return { a, ev: evaluateApproval({ allGraded: false }, { taken: a.taken, pct: a.raw }).attendance };
    };
    const r34 = mk(4, 3);
    assert.equal(r34.a.raw, 75);
    assert.equal(r34.ev, 'ok');
    assert.equal(mk(3, 2).ev, 'fail');
    const r = mk(200, 149);
    assert.equal(r.a.raw, 74.5);
    assert.equal(r.ev, 'fail');
    assert.equal(mk(200, 150).ev, 'ok');
    assert.equal(mk(100, 75).ev, 'ok');
    assert.equal(mk(100, 74).ev, 'fail');
  });
  test('la app debe pasar raw (no pct redondeado): 38/51 = 74.51 -> fail con raw, pero el pct redondeado (75) daría ok', () => {
    const sessions = getOrderedSessions([{ id: 'a', sessions: Array.from({ length: 51 }, (_, i) => ({ id: `s${i}`, status: 'done' })) }]);
    const a = attendanceStats(sessions, Array.from({ length: 51 }, (_, i) => ({ sessionId: `s${i}`, present: i < 38 })));
    assert.equal(a.pct, 75);
    assert.equal(evaluateApproval(null, { taken: a.taken, pct: a.raw }).attendance, 'fail');
    assert.equal(evaluateApproval(null, { taken: a.taken, pct: a.pct }).attendance, 'ok'); // por eso StudentCourseEvaluacion pasa raw
  });
  test('regla exacta con enteros: 4*present >= 3*taken en todas las combinaciones hasta 60 sesiones', () => {
    for (let n = 1; n <= 60; n++) {
      const sessions = getOrderedSessions([{ id: 'a', sessions: Array.from({ length: n }, (_, i) => ({ id: `s${i}`, status: 'done' })) }]);
      for (let p = 0; p <= n; p++) {
        const a = attendanceStats(sessions, Array.from({ length: p }, (_, i) => ({ sessionId: `s${i}`, present: true })));
        const v = evaluateApproval(null, { taken: a.taken, pct: a.raw }).attendance;
        assert.equal(v, 4 * p >= 3 * n ? 'ok' : 'fail', `${p}/${n}`);
      }
    }
  });
  test('getOrderedSessions numera S01.. a través de módulos, respeta status y el booleano antiguo, y tolera módulos sin sesiones', () => {
    const s = getOrderedSessions([
      { id: 'a', title: 'A', sessions: [{ id: 'x1', status: 'done' }, { id: 'x2', done: true }, { id: 'x3', status: 'scheduled', done: true }] },
      { id: 'b', title: 'B' },
      { id: 'c', title: 'C', sessions: [{ id: 'y1' }] },
    ]);
    assert.deepEqual(s.map((x) => [x.label, x.id, x.moduleId, x.done]), [['S01', 'x1', 'a', true], ['S02', 'x2', 'a', true], ['S03', 'x3', 'a', false], ['S04', 'y1', 'c', false]]);
    assert.deepEqual(getOrderedSessions(null), []);
    assert.deepEqual(getOrderedSessions(undefined), []);
  });
});

// ----------------------------------------------------------------- roster --
describe('propiedades: matrículas -> courseRoster', () => {
  const NAMES = ['Ana', 'Beto', '', undefined, 'Carla'];
  const makeEnrollments = (rng, courseId) => {
    const list = [];
    const n = rng.int(0, 14);
    for (let i = 0; i < n; i++) {
      const sameCourse = rng.chance(0.6);
      const cid = sameCourse ? (rng.chance(0.5) ? Number(courseId) : String(courseId)) : rng.pick([99, '99', null, undefined, 7]);
      list.push({ uid: rng.pick(['u1', 'u2', 'u3', 'u4', 'u5', '', undefined, null]), courseId: cid, status: rng.pick(['active', 'active', 'pending', 'completed', undefined]), studentName: rng.pick(NAMES) });
    }
    return list;
  };
  test('sólo curso pedido (número o texto), sin pending, sin uid vacío, un alumno por uid (gana la primera fila válida) y en orden', () => {
    for (let i = 0; i < 400; i++) {
      const rng = makeRng(50000 + i);
      const courseId = rng.pick([1, 2, 3, 4]);
      const enr = makeEnrollments(rng, courseId);
      const asked = rng.chance(0.5) ? courseId : String(courseId);
      const seen = new Set();
      const expected = [];
      for (const e of enr) {
        if (e.courseId == null || String(e.courseId) !== String(courseId) || e.status === 'pending' || !e.uid || seen.has(e.uid)) continue;
        seen.add(e.uid);
        expected.push({ uid: e.uid, studentName: e.studentName || e.uid, status: e.status });
      }
      const got = courseRoster(enr, asked);
      assert.deepEqual(got, expected, `seed=${50000 + i}`);
      assert.equal(new Set(got.map((g) => g.uid)).size, got.length);
      assert.ok(got.every((g) => g.status !== 'pending'));
    }
  });
  test('una matrícula pending NO oculta la activa del mismo uid (aunque venga primero)', () => {
    const got = courseRoster([{ uid: 'u1', courseId: 1, status: 'pending' }, { uid: 'u1', courseId: '1', status: 'active', studentName: 'Ana' }], 1);
    assert.deepEqual(got, [{ uid: 'u1', studentName: 'Ana', status: 'active' }]);
  });
  test('entradas nulas o courseId ausente -> []', () => {
    for (const e of [null, undefined, []]) assert.deepEqual(courseRoster(e, 1), []);
    assert.deepEqual(courseRoster([{ uid: 'u', courseId: 1 }], null), []);
    assert.deepEqual(courseRoster([{ uid: 'u', courseId: 1 }], undefined), []);
  });
  test('flujo: el roster define quién se califica; un alumno pending no entra a notas ni a asistencia', () => {
    const sc = SCENARIOS.find((s) => s.hasScheme && s.nMods === 4 && s.sessions.length > 2);
    const enr = [
      { uid: 'u0', courseId: sc.courseId, status: 'active', studentName: 'Cero' },
      { uid: 'u1', courseId: String(sc.courseId), status: 'pending', studentName: 'Uno' },
      { uid: 'u2', courseId: Number(sc.courseId), status: 'completed', studentName: 'Dos' },
      { uid: 'u2', courseId: sc.courseId, status: 'active', studentName: 'Dos bis' },
      { uid: 'ux', courseId: 999, status: 'active' },
    ];
    const roster = courseRoster(enr, sc.courseId);
    assert.deepEqual(roster.map((r) => r.uid), ['u0', 'u2']);
    const byUid = Object.fromEntries(sc.students.map((s) => [s.uid, s]));
    for (const r of roster) assert.ok(byUid[r.uid] || r.uid === 'u2');
  });
});

// ------------------------------------------------- escenarios "de oro" ----
describe('escenarios manuales (valores calculados a mano)', () => {
  test('Redes (curso 1): M1..M4 = 18,19,17,16 y sustentación 17 -> 17.28, rendimiento 86.4, regular; asistencia 3/4 = 75 ok', () => {
    const modules = [
      { id: 'r1', title: 'M1', deliverable: { description: 'Estrategia' }, sessions: [{ id: 'a1', status: 'done' }, { id: 'a2', status: 'done' }] },
      { id: 'r2', title: 'M2', deliverable: { description: 'Contenido' }, sessions: [{ id: 'b1', status: 'done' }, { id: 'b2', status: 'done' }] },
      { id: 'r3', title: 'M3', deliverable: { description: 'IA' }, sessions: [] },
      { id: 'r4', title: 'M4', deliverable: { description: 'Métricas', weight: 99 } },
    ];
    const model = getGradingModel('1', modules);
    assert.deepEqual(model.components.map((c) => c.weight), [14, 17.5, 17.5, 21, 30]);
    const subs = [rev('r1', 18), rev('r2', 19), rev('r3', 17), rev('r4', 16)];
    const summary = summaryOf(model, subs, { sustentacion: 17 });
    // 14*18 + 17.5*19 + 17.5*17 + 21*16 + 30*17 = 252 + 332.5 + 297.5 + 336 + 510 = 1728
    assert.equal(summary.promedioParcial, 17.28);
    assert.ok(close(summary.rendimientoRaw, 86.4));
    assert.equal(summary.rendimientoPct, 86);
    assert.deepEqual([summary.allGraded, summary.gradedCount, summary.totalCount], [true, 5, 5]);
    const att = attendanceStats(getOrderedSessions(modules), [{ sessionId: 'a1', present: true }, { sessionId: 'a2', present: true }, { sessionId: 'b1', present: true }, { sessionId: 'b2', present: false }]);
    assert.deepEqual([att.taken, att.present, att.absent, att.raw, att.pct], [4, 3, 1, 75, 75]);
    assert.deepEqual(evaluateApproval(summary, { taken: att.taken, pct: att.raw }), { finalGrade: 'ok', performance: 'ok', attendance: 'ok', overall: 'regular' });
    // sin la sustentación: (252+332.5+297.5+336)/70 = 1218/70 = 17.4 y todo queda pendiente
    const sinSust = summaryOf(model, subs, {});
    assert.equal(sinSust.promedioParcial, 17.4);
    assert.equal(evaluateApproval(sinSust, null).overall, 'pending');
  });

  test('Branding (curso 2): pesos 17.5 x4 + 30; M = 15,16,14,17 y sustentación 18 -> 16.25 regular; con 14,14,14,14 y 16 -> 14.6 sustitutoria', () => {
    const model = getGradingModel(2, mods(4));
    assert.deepEqual(model.components.map((c) => c.weight), [17.5, 17.5, 17.5, 17.5, 30]);
    // 17.5*(15+16+14+17) = 17.5*62 = 1085; 30*18 = 540 -> 1625 / 100
    const a = summaryOf(model, [rev('m1', 15), rev('m2', 16), rev('m3', 14), rev('m4', 17)], { sustentacion: 18 });
    assert.equal(a.promedioParcial, 16.25);
    assert.equal(a.rendimientoRaw, 81.25);
    assert.equal(evaluateApproval(a, { taken: 4, pct: 100 }).overall, 'regular');
    // 17.5*56 = 980; 30*16 = 480 -> 1460 / 100 = 14.6
    const b = summaryOf(model, [rev('m1', 14), rev('m2', 14), rev('m3', 14), rev('m4', 14)], { sustentacion: 16 });
    assert.equal(b.promedioParcial, 14.6);
    assert.deepEqual(evaluateApproval(b, null), { finalGrade: 'fail', performance: 'fail', attendance: 'pending', overall: 'substitute' });
    assert.equal(evaluateSubstitute(16), 'ok');
  });

  test('Marketing (curso 3): 4 bloques manuales; M 10,12,14,16 + participación 15 + caso 18 + proyecto 17 = 16.00 EXACTO (regular); proyecto 16.75 -> 15.90 (sustitutoria)', () => {
    const model = getGradingModel(3, mods(4));
    assert.deepEqual(model.blocks.map((b) => [b.key, b.weight]), [['modules', 20], ['participacion', 20], ['caso1', 20], ['proyecto', 40]]);
    assert.equal(model.total, 100);
    const subs = [rev('m1', 10), rev('m2', 12), rev('m3', 14), rev('m4', 16)];
    // 5*(10+12+14+16) = 260; 20*15 = 300; 20*18 = 360; 40*17 = 680 -> 1600 / 100
    const ok = summaryOf(model, subs, { participacion: 15, caso1: 18, proyecto: 17 });
    assert.equal(ok.promedioParcial, 16);
    assert.equal(ok.rendimientoRaw, 80);
    assert.equal(ok.allGraded, true);
    assert.deepEqual(evaluateApproval(ok, null), { finalGrade: 'ok', performance: 'ok', attendance: 'pending', overall: 'regular' });
    // proyecto 16.75 -> 40*16.75 = 670 -> 1590 / 100 = 15.9: pasa el piso de 15 pero no el 80%
    const low = summaryOf(model, subs, { participacion: 15, caso1: 18, proyecto: 16.75 });
    assert.equal(low.promedioParcial, 15.9);
    assert.equal(low.rendimientoRaw, 79.5);
    assert.deepEqual(evaluateApproval(low, null), { finalGrade: 'ok', performance: 'fail', attendance: 'pending', overall: 'substitute' });
    // sin caso1: (260 + 300 + 680) / 80 = 15.5 y pendiente
    const partial = summaryOf(model, subs, { participacion: 15, proyecto: 17 });
    assert.equal(partial.promedioParcial, 15.5);
    assert.equal(partial.gradedCount, 6);
    assert.equal(evaluateApproval(partial, null).overall, 'pending');
  });

  test('Negocios (curso 4): 10 x4 + participación 30 + sustentación 30; reentrega de M2 quita su nota vieja hasta recalificar', () => {
    const model = getGradingModel('4', mods(4));
    assert.deepEqual(model.components.map((c) => c.weight), [10, 10, 10, 10, 30, 30]);
    const store = new Map([
      ['m1', rev('m1', 20)], ['m2', rev('m2', 18)], ['m3', rev('m3', 14)], ['m4', rev('m4', 12)],
    ]);
    const scores = { participacion: 13, sustentacion: 11 };
    const view = () => summaryOf(model, [...store.values()], scores);
    // 10*(20+18+14+12) = 640; 30*13 = 390; 30*11 = 330 -> 1360 / 100 = 13.6
    assert.equal(view().promedioParcial, 13.6);
    assert.deepEqual(evaluateApproval(view(), null), { finalGrade: 'fail', performance: 'fail', attendance: 'pending', overall: 'substitute' });
    // el alumno reentrega M2 (nota 18 guardada pero ya no vale): 200+140+120+390+330 = 1180 / 90 = 13.111
    store.set('m2', { ...store.get('m2'), status: 'submitted' });
    assert.equal(view().promedioParcial, 13.11);
    assert.deepEqual([view().allGraded, view().gradedCount], [false, 5]);
    assert.equal(evaluateApproval(view(), null).overall, 'pending');
    // el docente recalifica con 19: 1180 + 190 = 1370 / 100 = 13.7
    store.set('m2', { ...store.get('m2'), status: 'reviewed', grade: 19 });
    assert.equal(view().promedioParcial, 13.7);
    assert.equal(evaluateApproval(view(), null).overall, 'substitute');
    // el alumno rinde la sustitutoria
    assert.equal(evaluateSubstitute(16), 'ok');
    assert.equal(evaluateSubstitute(15.5), 'fail');
  });

  test('curso sin esquema (id 99): pesos del docente 30/30/40 con notas 10,15,20 -> (300+450+800)/100 = 15.5; sin pesos -> partes iguales', () => {
    const withW = getGradingModel(99, [dm('a', { weight: 30 }), dm('b', { weight: 30 }), dm('c', { weight: 40 })]);
    const s = summaryOf(withW, [rev('a', 10), rev('b', 15), rev('c', 20)], {});
    assert.equal(s.promedioParcial, 15.5);
    assert.equal(s.allGraded, true);
    assert.equal(evaluateApproval(s, null).performance, 'fail'); // 77.5% < 80
    const equal = summaryOf(getGradingModel(99, mods(3)), [rev('m1', 10), rev('m2', 15), rev('m3', 20)], {});
    assert.equal(equal.promedioParcial, 15);
  });

  test('Redes con 5 módulos: cada uno pesa 14 (70/5) y el promedio sigue siendo la media ponderada', () => {
    const model = getGradingModel(1, mods(5));
    assert.deepEqual(model.components.map((c) => c.weight), [14, 14, 14, 14, 14, 30]);
    const s = summaryOf(model, [10, 12, 14, 16, 18].map((g, i) => rev(`m${i + 1}`, g)), { sustentacion: 20 });
    // 14*70 = 980; 30*20 = 600 -> 1580 / 100 = 15.8
    assert.equal(s.promedioParcial, 15.8);
    assert.equal(evaluateApproval(s, null).overall, 'substitute');
  });
});
