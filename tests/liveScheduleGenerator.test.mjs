// Tests de src/lib/liveScheduleGenerator.js
// Fechas de referencia (verificadas): 2026-03-10 = martes, 2026-03-11 = miércoles,
// 2026-12-29 = martes, 2028-02-28 = lunes.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildRecurringSessions, parseScheduleLabel, lastClassDate } from '../src/lib/liveScheduleGenerator.js';

const TJ = { scheduleDays: ['Martes', 'Jueves'], scheduleTime: '19:00-21:00', weeksLabel: '8 semanas' };

describe('parseScheduleLabel', () => {
  test('formato canónico de AdminGrupos', () => {
    assert.deepEqual(parseScheduleLabel('Martes y Jueves · 19:00-21:00'), ['Martes', 'Jueves']);
  });
  test('un solo día', () => {
    assert.deepEqual(parseScheduleLabel('Sábado · 10:00-12:00'), ['Sábado']);
  });
  test('tres días con coma y "y"', () => {
    assert.deepEqual(parseScheduleLabel('Lunes, Miércoles y Viernes · 19:00-21:00'), ['Lunes', 'Miércoles', 'Viernes']);
  });
  test('tres días unidos con " y " (así los arma AdminGrupos: days.join(" y "))', () => {
    assert.deepEqual(parseScheduleLabel('Lunes y Miércoles y Viernes · 19:00-21:00'), ['Lunes', 'Miércoles', 'Viernes']);
  });
  test('espaciado raro', () => {
    assert.deepEqual(parseScheduleLabel('   Martes    y   Jueves  ·19:00-21:00'), ['Martes', 'Jueves']);
    assert.deepEqual(parseScheduleLabel('Martes,Jueves·19:00'), ['Martes', 'Jueves']);
  });
  test('sin "·" (sólo días)', () => {
    assert.deepEqual(parseScheduleLabel('Martes y Jueves'), ['Martes', 'Jueves']);
  });
  test('vacío / null / undefined', () => {
    assert.deepEqual(parseScheduleLabel(''), []);
    assert.deepEqual(parseScheduleLabel(null), []);
    assert.deepEqual(parseScheduleLabel(undefined), []);
  });
  test('round-trip: cualquier subconjunto de días unido con " y " se parsea completo', () => {
    const all = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    for (let mask = 1; mask < 128; mask++) {
      const days = all.filter((_, i) => mask & (1 << i));
      assert.deepEqual(parseScheduleLabel(`${days.join(' y ')} · 19:00-21:00`), days);
    }
  });
  test('días con "y" pegado a un día inexistente se descartan sin error', () => {
    assert.deepEqual(parseScheduleLabel('Martes y Foo · 19:00'), ['Martes']);
  });
  test('duplicados se conservan', () => {
    assert.deepEqual(parseScheduleLabel('Martes y Martes'), ['Martes', 'Martes']);
  });
  test('la hora antes de los días -> []', () => {
    assert.deepEqual(parseScheduleLabel('19:00-21:00 · Martes y Jueves'), []);
  });

  test('minúsculas, MAYÚSCULAS, sin tilde, plural, "/", "&" y NFD se reconocen', () => {
    assert.deepEqual(parseScheduleLabel('martes y jueves'), ['Martes', 'Jueves']);
    assert.deepEqual(parseScheduleLabel('MARTES Y JUEVES'), ['Martes', 'Jueves']);
    assert.deepEqual(parseScheduleLabel('Martes y jueves · 19:00-21:00'), ['Martes', 'Jueves']);
    assert.deepEqual(parseScheduleLabel('Lunes y Miercoles'), ['Lunes', 'Miércoles']);
    assert.deepEqual(parseScheduleLabel('Sábados y Domingos'), ['Sábado', 'Domingo']);
    assert.deepEqual(parseScheduleLabel('Martes/Jueves'), ['Martes', 'Jueves']);
    assert.deepEqual(parseScheduleLabel('Martes & Jueves'), ['Martes', 'Jueves']);
    assert.deepEqual(parseScheduleLabel('Mie\u0301rcoles'), ['Miércoles']); // NFD (teclados macOS)
  });
  test('un array (legacy group.scheduleDays) ya no lanza error', () => {
    assert.deepEqual(parseScheduleLabel(['Martes', 'Jueves']), ['Martes', 'Jueves']);
  });
  test('texto que no es un día se descarta', () => {
    assert.deepEqual(parseScheduleLabel('Martes y Foo'), ['Martes']);
    assert.deepEqual(parseScheduleLabel('Mar y Jue'), []);
  });
  test('rangos "Lunes a Viernes" deberían expandirse', { todo: 'PENDIENTE liveScheduleGenerator.js:73 - "Lunes a Viernes" no se divide ni se expande: devuelve []' }, () => {
    assert.deepEqual(parseScheduleLabel('Lunes a Viernes · 19:00-21:00'), ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']);
  });
});

describe('lastClassDate', () => {
  test('inicio en día de clase: última clase de la semana 1 = jueves', () => {
    assert.equal(lastClassDate('2026-03-10', ['Martes', 'Jueves'], 1), '2026-03-12');
  });
  test('semanas siguientes avanzan 7 días', () => {
    assert.equal(lastClassDate('2026-03-10', ['Martes', 'Jueves'], 2), '2026-03-19');
    assert.equal(lastClassDate('2026-03-10', ['Martes', 'Jueves'], 8), '2026-04-30');
  });
  test('un solo día', () => {
    assert.equal(lastClassDate('2026-03-10', ['Martes'], 1), '2026-03-10');
    assert.equal(lastClassDate('2026-03-10', ['Martes'], 3), '2026-03-24');
  });
  test('tres días', () => {
    assert.equal(lastClassDate('2026-03-09', ['Lunes', 'Miércoles', 'Viernes'], 1), '2026-03-13');
  });
  test('orden de dayNames no importa', () => {
    assert.equal(lastClassDate('2026-03-10', ['Jueves', 'Martes'], 1), '2026-03-12');
  });
  test('cambio de mes y año', () => {
    assert.equal(lastClassDate('2026-12-29', ['Martes', 'Jueves'], 1), '2026-12-31');
    assert.equal(lastClassDate('2026-12-29', ['Martes', 'Jueves'], 2), '2027-01-07');
    assert.equal(lastClassDate('2026-01-31', ['Sábado'], 2), '2026-02-07');
  });
  test('año bisiesto (2028-02-28 es lunes)', () => {
    assert.equal(lastClassDate('2028-02-28', ['Lunes', 'Miércoles'], 1), '2028-03-01');
    assert.equal(lastClassDate('2028-02-28', ['Lunes'], 1), '2028-02-28');
    assert.equal(lastClassDate('2028-02-28', ['Lunes'], 2), '2028-03-06');
  });
  test('startDate/dayNames vacíos -> null', () => {
    assert.equal(lastClassDate('', ['Martes'], 1), null);
    assert.equal(lastClassDate(null, ['Martes'], 1), null);
    assert.equal(lastClassDate('2026-03-10', [], 1), null);
    assert.equal(lastClassDate('2026-03-10', undefined, 1), null);
  });

  test('inicio no alineado (miércoles, mar/jue): la última clase de la semana 1 debería ser el jueves 03-12', { todo: 'DISEÑO liveScheduleGenerator.js:85 - maxOffset asume que startDate es el primer día de clase; si no lo es, week 1 se desplaza 6 días' }, () => {
    assert.equal(lastClassDate('2026-03-11', ['Martes', 'Jueves'], 1), '2026-03-12');
  });
  test('inicio no alineado: lastClassDate coincide con la última sesión "Semana N" que genera buildRecurringSessions', () => {
    const e = buildRecurringSessions({ ...TJ, weeksLabel: '4' }, '2026-03-11');
    for (let w = 1; w <= 4; w++) {
      const last = e.filter((x) => x.title.startsWith(`Semana ${w} `)).at(-1).startsAt.slice(0, 10);
      assert.equal(lastClassDate('2026-03-11', ['Martes', 'Jueves'], w), last);
    }
  });

  test('día desconocido / startDate inválido -> null', () => {
    assert.equal(lastClassDate('2026-03-10', ['Foo'], 1), null);
    assert.equal(lastClassDate('no-es-fecha', ['Martes'], 1), null);
    assert.equal(lastClassDate('2026-13-45', ['Martes'], 1), null);
  });
  test('ignora nombres inválidos mezclados con válidos y acepta minúsculas', () => {
    assert.equal(lastClassDate('2026-03-10', ['Foo', 'Martes'], 1), '2026-03-10');
    assert.equal(lastClassDate('2026-03-10', ['martes', 'jueves'], 1), '2026-03-12');
  });
  test('semana 0 cae 7 días antes de la primera clase (endWeekOf puede devolver 0 con "Semana 0")', () => {
    assert.equal(lastClassDate('2026-03-10', ['Martes', 'Jueves'], 0), '2026-03-05');
  });
});

describe('buildRecurringSessions', () => {
  test('caso base: mar/jue 19:00-21:00 x 8 semanas', () => {
    const e = buildRecurringSessions(TJ, '2026-03-10');
    assert.equal(e.length, 16);
    assert.deepEqual(e[0], { startsAt: '2026-03-10T19:00', durationMin: 120, title: 'Semana 1 · Martes' });
    assert.deepEqual(e[1], { startsAt: '2026-03-12T19:00', durationMin: 120, title: 'Semana 1 · Jueves' });
    assert.equal(e[15].startsAt, '2026-04-30T19:00');
    assert.equal(e[15].title, 'Semana 8 · Jueves');
  });
  test('coherente con lastClassDate para todas las semanas (inicio alineado)', () => {
    const e = buildRecurringSessions(TJ, '2026-03-10');
    for (let w = 1; w <= 8; w++) {
      assert.equal(e[w * 2 - 1].startsAt.slice(0, 10), lastClassDate('2026-03-10', ['Martes', 'Jueves'], w));
    }
  });
  test('ordena los días por DAY_INDEX sin importar el orden de entrada', () => {
    const e = buildRecurringSessions({ ...TJ, scheduleDays: ['Jueves', 'Martes'] }, '2026-03-10');
    assert.deepEqual(e.slice(0, 2).map((x) => x.title), ['Semana 1 · Martes', 'Semana 1 · Jueves']);
  });
  test('un día -> N entradas, una por semana', () => {
    const e = buildRecurringSessions({ ...TJ, scheduleDays: ['Sábado'], weeksLabel: '4 semanas' }, '2026-03-14');
    assert.deepEqual(e.map((x) => x.startsAt), ['2026-03-14T19:00', '2026-03-21T19:00', '2026-03-28T19:00', '2026-04-04T19:00']);
  });
  test('tres días', () => {
    const e = buildRecurringSessions({ ...TJ, scheduleDays: ['Viernes', 'Lunes', 'Miércoles'], weeksLabel: '2' }, '2026-03-09');
    assert.equal(e.length, 6);
    assert.deepEqual(e.map((x) => x.startsAt.slice(0, 10)), ['2026-03-09', '2026-03-11', '2026-03-13', '2026-03-16', '2026-03-18', '2026-03-20']);
  });
  test('cambio de año', () => {
    const e = buildRecurringSessions({ ...TJ, weeksLabel: '2' }, '2026-12-29');
    assert.deepEqual(e.map((x) => x.startsAt.slice(0, 10)), ['2026-12-29', '2026-12-31', '2027-01-05', '2027-01-07']);
  });
  test('año bisiesto', () => {
    const e = buildRecurringSessions({ ...TJ, scheduleDays: ['Lunes'], weeksLabel: '2' }, '2028-02-28');
    assert.deepEqual(e.map((x) => x.startsAt.slice(0, 10)), ['2028-02-28', '2028-03-06']);
  });

  describe('weeksLabel', () => {
    const n = (label) => buildRecurringSessions({ ...TJ, scheduleDays: ['Martes'], weeksLabel: label }, '2026-03-10').length;
    test('"12 semanas" -> 12; "3.7" -> 3; "Semanas 5-6"... no aplica', () => { assert.equal(n('12 semanas'), 12); assert.equal(n('3.7 semanas'), 3); });
    test('ausente / vacío / sin número -> 8 por defecto', () => {
      assert.equal(n(undefined), 8); assert.equal(n(''), 8); assert.equal(n('Duración: ocho semanas'), 8);
    });
    test('"0 semanas" cae al default 8 (0 es falsy)', () => { assert.equal(n('0 semanas'), 8); });
    test('negativo -> lista vacía', () => { assert.equal(n('-2 semanas'), 0); });
    test('un curso "Duración: 8 semanas" (texto antes del número) silenciosamente usa 8', () => { assert.equal(n('Duración: 10 semanas'), 8); });
  });

  describe('scheduleTime', () => {
    const one = (time) => buildRecurringSessions({ scheduleDays: ['Martes'], scheduleTime: time, weeksLabel: '1' }, '2026-03-10')[0];
    test('minutos y hora de 1 dígito', () => {
      assert.deepEqual(one('9:30-10:45'), { startsAt: '2026-03-10T09:30', durationMin: 75, title: 'Semana 1 · Martes' });
    });
    test('espacios alrededor del guion', () => {
      assert.equal(one('19:00 - 21:00').durationMin, 120);
    });
    test('21:00-23:00 (aulas noche)', () => {
      assert.equal(one('21:00-23:00').startsAt, '2026-03-10T21:00');
    });
    test('guion largo (–, —) y "a" como separador', () => {
      assert.equal(one('19:00–21:00').durationMin, 120);
      assert.equal(one('19:00—21:00').durationMin, 120);
      assert.equal(one('19:00 a 21:00').durationMin, 120);
    });
    test('scheduleTime undefined / vacío / null -> []', () => {
      const run = (t) => buildRecurringSessions({ scheduleDays: ['Martes'], scheduleTime: t, weeksLabel: '1' }, '2026-03-10');
      assert.deepEqual(run(undefined), []);
      assert.deepEqual(run(''), []);
      assert.deepEqual(run(null), []);
    });
    test('formatos inválidos ("7pm-9pm", "25:00-26:00", "19:60-21:00", misma hora) -> []', () => {
      const run = (t) => buildRecurringSessions({ scheduleDays: ['Martes'], scheduleTime: t, weeksLabel: '1' }, '2026-03-10');
      for (const t of ['7pm-9pm', '25:00-26:00', '19:60-21:00', '19:00-19:00', '24:00-01:00']) assert.deepEqual(run(t), [], t);
    });
    test('clase que cruza medianoche 22:00-01:00 dura 180 min', () => {
      const e = one('22:00-01:00');
      assert.equal(e.durationMin, 180);
      assert.equal(e.startsAt, '2026-03-10T22:00');
    });
  });

  describe('entradas inválidas', () => {
    test('día no reconocido -> []; en minúsculas se reconoce', () => {
      assert.deepEqual(buildRecurringSessions({ ...TJ, scheduleDays: ['Foo'], weeksLabel: '1' }, '2026-03-10'), []);
      const e = buildRecurringSessions({ ...TJ, scheduleDays: ['martes'], weeksLabel: '1' }, '2026-03-10');
      assert.equal(e.length, 1);
      assert.equal(e[0].title, 'Semana 1 · Martes');
    });
    test('día inválido mezclado con válido: se ignora sólo el inválido', () => {
      assert.equal(buildRecurringSessions({ ...TJ, scheduleDays: ['Foo', 'Martes'], weeksLabel: '1' }, '2026-03-10').length, 1);
    });
    test('firstDate vacío / inválido -> []', () => {
      assert.deepEqual(buildRecurringSessions({ ...TJ, weeksLabel: '1' }, ''), []);
      assert.deepEqual(buildRecurringSessions({ ...TJ, weeksLabel: '1' }, 'mañana'), []);
      assert.deepEqual(buildRecurringSessions({ ...TJ, weeksLabel: '1' }, undefined), []);
    });
    test('días duplicados (incl. distinto casing) se deduplican', () => {
      const e = buildRecurringSessions({ ...TJ, scheduleDays: ['Martes', 'Martes', 'martes'], weeksLabel: '1' }, '2026-03-10');
      assert.equal(e.length, 1);
    });
    test('scheduleDays undefined / null -> [] sin lanzar', () => {
      assert.deepEqual(buildRecurringSessions({ ...TJ, scheduleDays: undefined }, '2026-03-10'), []);
      assert.deepEqual(buildRecurringSessions({ ...TJ, scheduleDays: null }, '2026-03-10'), []);
    });
    test('scheduleDays vacío -> []', () => {
      assert.deepEqual(buildRecurringSessions({ ...TJ, scheduleDays: [] }, '2026-03-10'), []);
    });
    test('no muta scheduleDays', () => {
      const days = ['Jueves', 'Martes'];
      buildRecurringSessions({ ...TJ, scheduleDays: days }, '2026-03-10');
      assert.deepEqual(days, ['Jueves', 'Martes']);
    });
  });

  describe('inicio en día que NO es de clase / no es el primer día del horario', () => {
    test('miércoles con mar/jue: las 2 clases de la "semana 1" (+1 y +6 días) salen en orden cronológico', () => {
      const e = buildRecurringSessions({ ...TJ, weeksLabel: '1' }, '2026-03-11');
      assert.deepEqual(e.map((x) => x.startsAt.slice(0, 10)), ['2026-03-12', '2026-03-17']);
      assert.deepEqual(e.map((x) => x.title), ['Semana 1 · Jueves', 'Semana 1 · Martes']);
    });
    test('siempre en orden cronológico y sin fechas repetidas (varias semanas, inicio no alineado)', () => {
      const dates = buildRecurringSessions({ ...TJ, weeksLabel: '6' }, '2026-03-11').map((x) => x.startsAt);
      assert.deepEqual(dates, [...dates].sort());
      assert.equal(new Set(dates).size, dates.length);
    });
    test('jueves con mar/jue: jueves primero y el martes de la semana 1 después', () => {
      const e = buildRecurringSessions({ ...TJ, weeksLabel: '1' }, '2026-03-12');
      assert.deepEqual(e.map((x) => x.startsAt.slice(0, 10)), ['2026-03-12', '2026-03-17']);
    });
    test('sábado y domingo: el sábado va antes que el domingo en el calendario', () => {
      const e = buildRecurringSessions({ ...TJ, scheduleDays: ['Sábado', 'Domingo'], weeksLabel: '1' }, '2026-03-09');
      assert.deepEqual(e.map((x) => x.startsAt.slice(0, 10)), ['2026-03-14', '2026-03-15']);
      assert.deepEqual(e.map((x) => x.title), ['Semana 1 · Sábado', 'Semana 1 · Domingo']);
    });
    test('la "Semana 1" del inicio no alineado debería empezar en la primera clase real', { todo: 'DISEÑO liveScheduleGenerator.js:56-61 - "Semana N" = ventana de 7 días desde firstDate; si firstDate no es día de clase, "Semana 1" mezcla el jueves 03-12 con el martes 03-17' }, () => {
      const e = buildRecurringSessions({ ...TJ, weeksLabel: '2' }, '2026-03-11');
      assert.deepEqual(e.map((x) => x.title), ['Semana 1 · Jueves', 'Semana 2 · Martes', 'Semana 2 · Jueves', 'Semana 3 · Martes']);
    });
  });
});
