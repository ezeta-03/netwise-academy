// Tests de src/lib/liveScheduleGenerator.js
// startsAt lleva el offset de Perú (-05:00) y todo el cálculo es en UTC.
// Fechas de referencia (verificadas): 2026-03-10 = martes, 2026-03-11 = miércoles,
// 2026-12-29 = martes, 2028-02-28 = lunes.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildRecurringSessions, parseScheduleLabel, lastClassDate, toPeruIso, PERU_OFFSET, validSlots, buildScheduleLabel, groupScheduleDays } from '../src/lib/liveScheduleGenerator.js';

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
  test('duplicados se eliminan', () => {
    assert.deepEqual(parseScheduleLabel('Martes y Martes'), ['Martes']);
    assert.deepEqual(parseScheduleLabel('Martes 19:00-21:00 · martes 15:00-17:00'), ['Martes']);
  });
  test('la hora antes de los días: se encuentran igual las palabras de día', () => {
    assert.deepEqual(parseScheduleLabel('19:00-21:00 · Martes y Jueves'), ['Martes', 'Jueves']);
  });
  test('un texto con sólo horas y sin palabras de día -> []', () => {
    assert.deepEqual(parseScheduleLabel('19:00-21:00'), []);
    assert.deepEqual(parseScheduleLabel('a convenir'), []);
  });
  test('formato por día: "Lunes 19:00-21:00 · Miércoles 18:00-20:30" -> días', () => {
    assert.deepEqual(parseScheduleLabel('Lunes 19:00-21:00 · Miércoles 18:00-20:30'), ['Lunes', 'Miércoles']);
    assert.deepEqual(parseScheduleLabel('Sábado 09:00-11:00 · Sábado 15:00-17:00'), ['Sábado']);
  });
  test('los días se devuelven en el orden en que aparecen en el texto', () => {
    assert.deepEqual(parseScheduleLabel('Jueves y Martes'), ['Jueves', 'Martes']);
  });

  test('minúsculas, MAYÚSCULAS, sin tilde, plural, "/", "&" y NFD se reconocen', () => {
    assert.deepEqual(parseScheduleLabel('martes y jueves'), ['Martes', 'Jueves']);
    assert.deepEqual(parseScheduleLabel('MARTES Y JUEVES'), ['Martes', 'Jueves']);
    assert.deepEqual(parseScheduleLabel('Martes y jueves · 19:00-21:00'), ['Martes', 'Jueves']);
    assert.deepEqual(parseScheduleLabel('Lunes y Miercoles'), ['Lunes', 'Miércoles']);
    assert.deepEqual(parseScheduleLabel('Sábados y Domingos'), ['Sábado', 'Domingo']);
    assert.deepEqual(parseScheduleLabel('Martes/Jueves'), ['Martes', 'Jueves']);
    assert.deepEqual(parseScheduleLabel('Martes & Jueves'), ['Martes', 'Jueves']);
  });
  test('"Miércoles" en NFD (teclados macOS) debería reconocerse', { todo: 'BAJO liveScheduleGenerator.js:146 - DAY_WORDS busca "mi[eé]rcoles"/"s[aá]bado" sin normalizar NFD; "Mie\u0301rcoles" y "Sa\u0301bado" ya no se reconocen (antes sí). Aplicar .normalize("NFC") al texto' }, () => {
    assert.deepEqual(parseScheduleLabel('Mie\u0301rcoles'), ['Miércoles']);
    assert.deepEqual(parseScheduleLabel('Sa\u0301bado'), ['Sábado']);
  });
  test('un array (legacy group.scheduleDays) ya no lanza error', () => {
    assert.deepEqual(parseScheduleLabel(['Martes', 'Jueves']), ['Martes', 'Jueves']);
  });
  test('texto que no es un día se descarta', () => {
    assert.deepEqual(parseScheduleLabel('Martes y Foo'), ['Martes']);
    assert.deepEqual(parseScheduleLabel('Mar y Jue'), []);
  });
  test('rangos: "Lunes a Viernes" se expande a 5 días (con o sin hora, cualquier casing)', () => {
    assert.deepEqual(parseScheduleLabel('Lunes a Viernes · 19:00-21:00'), ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']);
    assert.deepEqual(parseScheduleLabel('lunes a viernes'), ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']);
    assert.deepEqual(parseScheduleLabel('Sábado a Domingo'), ['Sábado', 'Domingo']);
  });
  test('rangos que cruzan el domingo -> vuelta a la semana; mismo día -> un solo día', () => {
    assert.deepEqual(parseScheduleLabel('Viernes a Lunes'), ['Viernes', 'Sábado', 'Domingo', 'Lunes']);
    assert.deepEqual(parseScheduleLabel('Martes a Martes'), ['Martes']);
  });
  test('rango con un extremo inválido: no se expande, sólo quedan las palabras de día', () => {
    assert.deepEqual(parseScheduleLabel('Lunes a Foo'), ['Lunes']);
    assert.deepEqual(parseScheduleLabel('Foo a Viernes'), ['Viernes']);
  });
  test('un rango combinado con otro día ("Lunes a Miércoles y Viernes") debería expandirse', { todo: 'BAJO liveScheduleGenerator.js:153 - el rango se detecta al inicio y el resto del texto se ignora: "Lunes a Miércoles y Viernes" da [Lunes, Martes, Miércoles] y pierde "Viernes"' }, () => {
    assert.deepEqual(parseScheduleLabel('Lunes a Miércoles y Viernes'), ['Lunes', 'Martes', 'Miércoles', 'Viernes']);
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

  test('inicio no alineado: la semana 1 se ancla en la PRIMERA clase real', () => {
    // miércoles 08-12 con mar/jue: primera clase = jueves 08-13; semana 1 = jue 13 y mar 18.
    assert.equal(lastClassDate('2026-08-12', ['Martes', 'Jueves'], 1), '2026-08-18');
    assert.equal(lastClassDate('2026-08-12', ['Martes', 'Jueves'], 2), '2026-08-25');
    // martes 08-11 (día de clase): semana 3 termina el jueves 08-27.
    assert.equal(lastClassDate('2026-08-11', ['Martes', 'Jueves'], 3), '2026-08-27');
    assert.equal(lastClassDate('2026-03-11', ['Martes', 'Jueves'], 1), '2026-03-17');
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
    assert.equal(lastClassDate('', ['Martes'], 1), null);
  });
  test('fechas de calendario imposibles ("2026-13-45", "2026-02-31") dan null', () => {
    assert.equal(lastClassDate('2026-13-45', ['Martes'], 1), null);
    assert.equal(lastClassDate('2026-02-31', ['Martes'], 1), null);
    assert.equal(lastClassDate('2026-00-10', ['Martes'], 1), null);
    assert.deepEqual(buildRecurringSessions({ ...TJ, weeksLabel: '1' }, '2026-02-31'), []);
  });
  test('29 de febrero sólo es válido en año bisiesto', () => {
    assert.notEqual(lastClassDate('2028-02-29', ['Martes'], 1), null);
    assert.equal(lastClassDate('2027-02-29', ['Martes'], 1), null);
  });
  test('semana 0 cae 7 días antes de la primera clase (endWeekOf puede devolver 0 con "Semana 0")', () => {
    assert.equal(lastClassDate('2026-03-10', ['Martes', 'Jueves'], 0), '2026-03-05');
  });
});

describe('buildRecurringSessions', () => {
  test('caso base: mar/jue 19:00-21:00 x 8 semanas', () => {
    const e = buildRecurringSessions(TJ, '2026-03-10');
    assert.equal(e.length, 16);
    assert.deepEqual(e[0], { startsAt: '2026-03-10T19:00-05:00', durationMin: 120, title: 'Semana 1 · Martes' });
    assert.deepEqual(e[1], { startsAt: '2026-03-12T19:00-05:00', durationMin: 120, title: 'Semana 1 · Jueves' });
    assert.equal(e[15].startsAt, '2026-04-30T19:00-05:00');
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
    assert.deepEqual(e.map((x) => x.startsAt), ['2026-03-14T19:00-05:00', '2026-03-21T19:00-05:00', '2026-03-28T19:00-05:00', '2026-04-04T19:00-05:00']);
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
      assert.deepEqual(one('9:30-10:45'), { startsAt: '2026-03-10T09:30-05:00', durationMin: 75, title: 'Semana 1 · Martes' });
    });
    test('espacios alrededor del guion', () => {
      assert.equal(one('19:00 - 21:00').durationMin, 120);
    });
    test('21:00-23:00 (aulas noche)', () => {
      assert.equal(one('21:00-23:00').startsAt, '2026-03-10T21:00-05:00');
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
      assert.equal(e.startsAt, '2026-03-10T22:00-05:00');
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
    test('2 clases por semana y títulos "Semana n · Día" con inicio no alineado (miércoles + mar/jue)', () => {
      const e = buildRecurringSessions({ ...TJ, weeksLabel: '2' }, '2026-03-11');
      assert.deepEqual(e.map((x) => x.title), ['Semana 1 · Jueves', 'Semana 1 · Martes', 'Semana 2 · Jueves', 'Semana 2 · Martes']);
      assert.deepEqual(e.map((x) => x.startsAt.slice(0, 10)), ['2026-03-12', '2026-03-17', '2026-03-19', '2026-03-24']);
    });
    test('la primera sesión generada es SIEMPRE la primera clase real (>= firstDate, a menos de 7 días)', () => {
      const days = ['Lunes', 'Miércoles', 'Viernes'];
      for (let d = 1; d <= 14; d++) {
        const first = `2026-09-${String(d).padStart(2, '0')}`;
        const e = buildRecurringSessions({ scheduleDays: days, scheduleTime: '19:00-21:00', weeksLabel: '1' }, first);
        const firstDay = e[0].startsAt.slice(0, 10);
        const diff = (Date.parse(firstDay) - Date.parse(first)) / 86400000;
        assert.ok(diff >= 0 && diff < 7, `${first} -> ${firstDay}`);
        assert.equal(e.length, 3);
      }
    });
  });
});

describe('offset de Perú', () => {
  test('PERU_OFFSET es -05:00 y todas las sesiones lo llevan', () => {
    assert.equal(PERU_OFFSET, '-05:00');
    const e = buildRecurringSessions(TJ, '2026-08-11');
    assert.ok(e.every((x) => x.startsAt.endsWith('T19:00-05:00')));
    assert.equal(e[0].startsAt, '2026-08-11T19:00-05:00');
  });
  test('startsAt es un ISO válido que representa 19:00 hora de Lima = 00:00 UTC del día siguiente', () => {
    const [first] = buildRecurringSessions(TJ, '2026-08-11');
    assert.equal(new Date(first.startsAt).toISOString(), '2026-08-12T00:00:00.000Z');
  });
  describe('toPeruIso', () => {
    test('agrega -05:00 a una hora local sin offset', () => {
      assert.equal(toPeruIso('2026-08-11T19:00'), '2026-08-11T19:00-05:00');
      assert.equal(toPeruIso('2026-08-11T19:00:30'), '2026-08-11T19:00:30-05:00');
    });
    test('respeta "Z" y offsets existentes (+hh:mm / -hh:mm)', () => {
      assert.equal(toPeruIso('2026-08-11T19:00Z'), '2026-08-11T19:00Z');
      assert.equal(toPeruIso('2026-08-11T19:00:00.000Z'), '2026-08-11T19:00:00.000Z');
      assert.equal(toPeruIso('2026-08-11T19:00-05:00'), '2026-08-11T19:00-05:00');
      assert.equal(toPeruIso('2026-08-11T19:00+01:00'), '2026-08-11T19:00+01:00');
    });
    test('vacío / null / undefined se devuelven tal cual', () => {
      assert.equal(toPeruIso(''), '');
      assert.equal(toPeruIso(null), null);
      assert.equal(toPeruIso(undefined), undefined);
    });
    test('es idempotente', () => {
      const once = toPeruIso('2026-08-11T19:00');
      assert.equal(toPeruIso(once), once);
    });
    test('el resultado se interpreta como Lima en cualquier zona (instante fijo)', () => {
      assert.equal(new Date(toPeruIso('2026-08-11T19:00')).toISOString(), '2026-08-12T00:00:00.000Z');
    });
    test('una fecha sin hora ("2026-08-11") se completa a medianoche de Lima (ISO válido)', () => {
      assert.equal(toPeruIso('2026-08-11'), '2026-08-11T00:00-05:00');
      assert.equal(new Date(toPeruIso('2026-08-11')).toISOString(), '2026-08-11T05:00:00.000Z');
    });
  });
});

const slot = (day, start, end) => ({ day, start, end });
const dateOf = (e) => e.startsAt.slice(0, 10);
const timeOf = (e) => e.startsAt.slice(11, 16);

describe('buildRecurringSessions con slots (una hora por franja)', () => {
  test('horas distintas por día: lun 19:00-21:00 y mié 18:00-20:30', () => {
    const e = buildRecurringSessions({ slots: [slot('Lunes', '19:00', '21:00'), slot('Miércoles', '18:00', '20:30')], weeksLabel: '2' }, '2026-03-09');
    assert.deepEqual(e, [
      { startsAt: '2026-03-09T19:00-05:00', durationMin: 120, title: 'Semana 1 · Lunes' },
      { startsAt: '2026-03-11T18:00-05:00', durationMin: 150, title: 'Semana 1 · Miércoles' },
      { startsAt: '2026-03-16T19:00-05:00', durationMin: 120, title: 'Semana 2 · Lunes' },
      { startsAt: '2026-03-18T18:00-05:00', durationMin: 150, title: 'Semana 2 · Miércoles' },
    ]);
  });
  test('dos franjas el mismo día: ordenadas por hora, mismo título de día', () => {
    const e = buildRecurringSessions({ slots: [slot('Sábado', '15:00', '17:00'), slot('Sábado', '09:00', '11:00')], weeksLabel: '2' }, '2026-03-14');
    assert.deepEqual(e.map((x) => x.startsAt), ['2026-03-14T09:00-05:00', '2026-03-14T15:00-05:00', '2026-03-21T09:00-05:00', '2026-03-21T15:00-05:00']);
    assert.deepEqual(e.map((x) => x.title), ['Semana 1 · Sábado', 'Semana 1 · Sábado', 'Semana 2 · Sábado', 'Semana 2 · Sábado']);
    assert.ok(e.every((x) => x.durationMin === 120));
  });
  test('la misma franja repetida se elimina (también con distinto casing/formato de hora)', () => {
    const e = buildRecurringSessions({ slots: [slot('Martes', '19:00', '21:00'), slot('martes', '19:00', '21:00'), slot('Martes', '7:00', '9:00'), slot('Martes', '07:00', '09:00')], weeksLabel: '1' }, '2026-03-10');
    assert.deepEqual(e.map(timeOf), ['07:00', '19:00']);
  });
  test('mismo día y hora de inicio pero distinta duración: son franjas distintas', () => {
    const e = buildRecurringSessions({ slots: [slot('Martes', '19:00', '20:00'), slot('Martes', '19:00', '21:00')], weeksLabel: '1' }, '2026-03-10');
    assert.equal(e.length, 2);
  });
  test('franjas inválidas se ignoran; si ninguna es válida -> []', () => {
    const e = buildRecurringSessions({ slots: [slot('Foo', '19:00', '21:00'), slot('Martes', '19:00', '21:00'), slot('Jueves', 'xx', 'yy'), slot('Lunes', '10:00', '10:00'), slot('Viernes', '25:00', '26:00'), null, {}], weeksLabel: '1' }, '2026-03-10');
    assert.deepEqual(e.map((x) => x.title), ['Semana 1 · Martes']);
    assert.deepEqual(buildRecurringSessions({ slots: [slot('Foo', '19:00', '21:00'), slot('Lunes', '10:00', '10:00')], weeksLabel: '1' }, '2026-03-10'), []);
  });
  test('slots vacío cae al formato anterior (scheduleDays + scheduleTime); el formato anterior sigue funcionando', () => {
    const legacy = { scheduleDays: ['Martes', 'Jueves'], scheduleTime: '19:00-21:00', weeksLabel: '2' };
    assert.deepEqual(buildRecurringSessions({ ...legacy, slots: [] }, '2026-03-10'), buildRecurringSessions(legacy, '2026-03-10'));
    assert.equal(buildRecurringSessions(legacy, '2026-03-10').length, 4);
  });
  test('slots tiene prioridad sobre scheduleDays/scheduleTime', () => {
    const e = buildRecurringSessions({ slots: [slot('Lunes', '08:00', '09:00')], scheduleDays: ['Martes'], scheduleTime: '19:00-21:00', weeksLabel: '1' }, '2026-03-09');
    assert.deepEqual(e.map((x) => x.title), ['Semana 1 · Lunes']);
    assert.equal(timeOf(e[0]), '08:00');
  });
  test('franja que cruza medianoche: dura 180 min y empieza a las 22:00', () => {
    const [e] = buildRecurringSessions({ slots: [slot('Viernes', '22:00', '01:00')], weeksLabel: '1' }, '2026-03-13');
    assert.equal(e.startsAt, '2026-03-13T22:00-05:00');
    assert.equal(e.durationMin, 180);
  });
  test('weeksLabel por defecto (8) y personalizado', () => {
    assert.equal(buildRecurringSessions({ slots: [slot('Martes', '19:00', '21:00')] }, '2026-03-10').length, 8);
    assert.equal(buildRecurringSessions({ slots: [slot('Martes', '19:00', '21:00')], weeksLabel: '12 semanas' }, '2026-03-10').length, 12);
  });

  describe('inicio en un día que no es de clase', () => {
    const slots = [slot('Martes', '19:00', '21:00'), slot('Jueves', '18:00', '20:00')];
    test('miércoles: la primera clase es el jueves (18:00), luego el martes siguiente (19:00)', () => {
      const e = buildRecurringSessions({ slots, weeksLabel: '2' }, '2026-03-11');
      assert.deepEqual(e.map((x) => `${dateOf(x)} ${timeOf(x)}`), ['2026-03-12 18:00', '2026-03-17 19:00', '2026-03-19 18:00', '2026-03-24 19:00']);
      assert.deepEqual(e.map((x) => x.durationMin), [120, 120, 120, 120]);
    });
    test('2 clases por semana y orden cronológico estricto (varias semanas y franjas el mismo día)', () => {
      const many = [slot('Martes', '19:00', '21:00'), slot('Martes', '08:00', '09:00'), slot('Jueves', '18:00', '20:00'), slot('Domingo', '10:00', '12:00')];
      for (const first of ['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14', '2026-03-15']) {
        const e = buildRecurringSessions({ slots: many, weeksLabel: '5' }, first);
        assert.equal(e.length, 20, first);
        const stamps = e.map((x) => x.startsAt);
        assert.deepEqual(stamps, [...stamps].sort(), first);
        assert.equal(new Set(stamps).size, stamps.length, first);
        // cada "Semana n" tiene exactamente 4 clases
        for (let w = 1; w <= 5; w++) assert.equal(e.filter((x) => x.title.startsWith(`Semana ${w} `)).length, 4, `${first} S${w}`);
        // la primera clase real cae a menos de 7 días del inicio
        const diff = (Date.parse(dateOf(e[0])) - Date.parse(first)) / 86400000;
        assert.ok(diff >= 0 && diff < 7, `${first} -> ${dateOf(e[0])}`);
      }
    });
    test('lastClassDate coincide con la última clase generada de cada semana (franjas mixtas)', () => {
      const e = buildRecurringSessions({ slots, weeksLabel: '4' }, '2026-03-11');
      for (let w = 1; w <= 4; w++) {
        const last = dateOf(e.filter((x) => x.title.startsWith(`Semana ${w} `)).at(-1));
        assert.equal(lastClassDate('2026-03-11', groupScheduleDays({ schedule: slots }), w), last);
      }
    });
  });

  test('en horas mixtas las entradas nunca se solapan en el instante de inicio y el offset es -05:00', () => {
    const e = buildRecurringSessions({ slots: [slot('Lunes', '19:00', '21:00'), slot('Lunes', '18:00', '19:00'), slot('Miércoles', '07:30', '09:00')], weeksLabel: '3' }, '2026-03-09');
    assert.ok(e.every((x) => x.startsAt.endsWith(PERU_OFFSET)));
    assert.equal(new Set(e.map((x) => x.startsAt)).size, e.length);
  });
});

describe('validSlots', () => {
  test('normaliza día y horas ("martes", "9:00" -> "Martes", "09:00")', () => {
    assert.deepEqual(validSlots([slot('martes', '9:00', '11:00'), slot('Miercoles', '19:00', '21:00')]),
      [{ day: 'Martes', start: '09:00', end: '11:00' }, { day: 'Miércoles', start: '19:00', end: '21:00' }]);
  });
  test('descarta inválidas, con fin == inicio, horas fuera de rango, null y objetos vacíos', () => {
    assert.deepEqual(validSlots([slot('Foo', '19:00', '21:00'), slot('Lunes', '10:00', '10:00'), slot('Lunes', '25:00', '26:00'), slot('Lunes', '10:60', '11:00'), slot('Lunes', '', ''), null, {}]), []);
  });
  test('una franja que cruza la medianoche es válida (22:00-01:00)', () => {
    assert.deepEqual(validSlots([slot('Viernes', '22:00', '01:00')]), [{ day: 'Viernes', start: '22:00', end: '01:00' }]);
  });
  test('elimina duplicados y conserva el orden de entrada', () => {
    assert.deepEqual(validSlots([slot('Jueves', '19:00', '21:00'), slot('Martes', '19:00', '21:00'), slot('jueves', '19:00', '21:00')]).map((s) => s.day), ['Jueves', 'Martes']);
  });
  test('dos franjas el mismo día con distinta hora se conservan', () => {
    assert.equal(validSlots([slot('Sábado', '09:00', '11:00'), slot('Sábado', '15:00', '17:00')]).length, 2);
  });
  test('no arreglo / undefined / null -> []', () => {
    assert.deepEqual(validSlots(undefined), []);
    assert.deepEqual(validSlots(null), []);
    assert.deepEqual(validSlots('Martes'), []);
    assert.deepEqual(validSlots([]), []);
  });
  test('es idempotente', () => {
    const once = validSlots([slot('martes', '9:00', '11:00'), slot('Viernes', '22:00', '01:00')]);
    assert.deepEqual(validSlots(once), once);
  });
  test('un fin "24:00" se rechaza (hay que escribir 00:00)', () => {
    assert.deepEqual(validSlots([slot('Lunes', '22:00', '24:00')]), []);
    assert.deepEqual(validSlots([slot('Lunes', '22:00', '00:00')]), [{ day: 'Lunes', start: '22:00', end: '00:00' }]);
  });
});

describe('buildScheduleLabel', () => {
  test('todas las franjas con la misma hora: "Martes y Jueves · 19:00-21:00"', () => {
    assert.equal(buildScheduleLabel([slot('Jueves', '19:00', '21:00'), slot('Martes', '19:00', '21:00')]), 'Martes y Jueves · 19:00-21:00');
    assert.equal(buildScheduleLabel([slot('Sábado', '10:00', '12:00')]), 'Sábado · 10:00-12:00');
  });
  test('horas distintas: "Lunes 19:00-21:00 · Miércoles 18:00-20:30"', () => {
    assert.equal(buildScheduleLabel([slot('Miércoles', '18:00', '20:30'), slot('Lunes', '19:00', '21:00')]), 'Lunes 19:00-21:00 · Miércoles 18:00-20:30');
  });
  test('dos franjas el mismo día con distinta hora: formato por día, ordenadas por hora', () => {
    assert.equal(buildScheduleLabel([slot('Sábado', '15:00', '17:00'), slot('Sábado', '09:00', '11:00')]), 'Sábado 09:00-11:00 · Sábado 15:00-17:00');
  });
  test('sin franjas válidas -> ""', () => {
    assert.equal(buildScheduleLabel([]), '');
    assert.equal(buildScheduleLabel(undefined), '');
    assert.equal(buildScheduleLabel([slot('Foo', '19:00', '21:00'), slot('Lunes', '10:00', '10:00')]), '');
  });
  test('ignora las franjas inválidas y normaliza formato', () => {
    assert.equal(buildScheduleLabel([slot('martes', '9:00', '11:00'), slot('Foo', '1:00', '2:00')]), 'Martes · 09:00-11:00');
  });
  test('domingo se ordena primero (índice 0)', () => {
    assert.equal(buildScheduleLabel([slot('Sábado', '10:00', '12:00'), slot('Domingo', '10:00', '12:00')]), 'Domingo y Sábado · 10:00-12:00');
  });
  test('round-trip: parseScheduleLabel(buildScheduleLabel(slots)) devuelve los mismos días (ambos formatos)', () => {
    const all = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    for (let mask = 1; mask < 128; mask++) {
      const days = all.filter((_, i) => mask & (1 << i));
      const same = days.map((d) => slot(d, '19:00', '21:00'));
      const mixed = days.map((d, i) => slot(d, `${String(8 + i).padStart(2, '0')}:00`, `${String(9 + i).padStart(2, '0')}:30`));
      assert.deepEqual([...parseScheduleLabel(buildScheduleLabel(same))].sort(), [...days].sort(), buildScheduleLabel(same));
      assert.deepEqual([...parseScheduleLabel(buildScheduleLabel(mixed))].sort(), [...days].sort(), buildScheduleLabel(mixed));
    }
  });
  test('un rango completo no se abrevia a "Lunes a Viernes": se lista con comas y "y" final', () => {
    const l = buildScheduleLabel(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map((d) => slot(d, '19:00', '21:00')));
    assert.equal(l, 'Lunes, Martes, Miércoles, Jueves y Viernes · 19:00-21:00');
  });
  test('con 3+ días: comas y "y" antes del último', () => {
    assert.equal(buildScheduleLabel([slot('Lunes', '19:00', '21:00'), slot('Miércoles', '19:00', '21:00'), slot('Viernes', '19:00', '21:00')]), 'Lunes, Miércoles y Viernes · 19:00-21:00');
  });
});

describe('groupScheduleDays', () => {
  test('usa group.schedule (franjas) si existe, sin duplicar días', () => {
    assert.deepEqual(groupScheduleDays({ schedule: [slot('Martes', '19:00', '21:00'), slot('Martes', '08:00', '09:00'), slot('Jueves', '19:00', '21:00')], scheduleTime: 'Lunes 10:00-11:00' }), ['Martes', 'Jueves']);
  });
  test('sin schedule (o vacío) parsea scheduleTime / scheduleDays', () => {
    assert.deepEqual(groupScheduleDays({ scheduleTime: 'Martes y Jueves · 19:00-21:00' }), ['Martes', 'Jueves']);
    assert.deepEqual(groupScheduleDays({ schedule: [], scheduleTime: 'Lunes a Viernes · 19:00-21:00' }), ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']);
    assert.deepEqual(groupScheduleDays({ scheduleDays: ['Martes', 'Jueves'] }), ['Martes', 'Jueves']);
    assert.deepEqual(groupScheduleDays({ scheduleTime: 'Lunes 19:00-21:00 · Miércoles 18:00-20:30' }), ['Lunes', 'Miércoles']);
  });
  test('grupo null / undefined / sin horario -> []', () => {
    assert.deepEqual(groupScheduleDays(null), []);
    assert.deepEqual(groupScheduleDays(undefined), []);
    assert.deepEqual(groupScheduleDays({}), []);
  });
  test('schedule con franjas todas inválidas -> []', () => {
    assert.deepEqual(groupScheduleDays({ schedule: [slot('Foo', '1:00', '2:00')] }), []);
  });
  test('schedule con franjas todas inválidas debería caer al texto scheduleTime', { todo: 'BAJO liveScheduleGenerator.js:172-175 - si group.schedule tiene elementos pero ninguno es válido se devuelve [] sin mirar scheduleTime' }, () => {
    assert.deepEqual(groupScheduleDays({ schedule: [slot('Foo', '1:00', '2:00')], scheduleTime: 'Martes · 19:00-21:00' }), ['Martes']);
  });
});
