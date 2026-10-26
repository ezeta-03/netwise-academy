import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COURSES } from '../src/lib/data.js';
import { buildRecurringSessions } from '../src/lib/liveScheduleGenerator.js';
import { courseWeeksFromModules } from '../src/lib/deliveryDates.js';
import { planScheduleSync } from '../src/lib/scheduleSync.js';
import { formatStartDate } from '../src/lib/courseDates.js';

// Calendario oficial de los 4 talleres (hora de Perú, 4 semanas cada uno).
const OFFICIAL = {
  1: { title: 'Estrategias de Redes Sociales', start: '2026-11-10', days: ['Martes', 'Jueves'], time: '20:00-22:00', first: '2026-11-10T20:00-05:00', last: '2026-12-03T20:00-05:00', label: 'Martes 10 de noviembre' },
  2: { title: 'Branding y Gestión de Marcas', start: '2026-11-09', days: ['Lunes', 'Miércoles'], time: '20:00-22:00', first: '2026-11-09T20:00-05:00', last: '2026-12-02T20:00-05:00', label: 'Lunes 9 de noviembre' },
  3: { title: 'Marketing Digital desde 0', start: '2026-11-13', days: ['Viernes', 'Sábado'], time: '20:00-22:00', first: '2026-11-13T20:00-05:00', last: '2026-12-05T20:00-05:00', label: 'Viernes 13 de noviembre' },
  4: { title: 'Creación de Negocios Digitales', start: '2026-11-10', days: ['Martes', 'Jueves'], time: '18:00-20:00', first: '2026-11-10T18:00-05:00', last: '2026-12-03T18:00-05:00', label: 'Martes 10 de noviembre' },
};

describe('catálogo con el calendario oficial', () => {
  test('están los 4 talleres', () => assert.deepEqual(COURSES.map((c) => c.id), [1, 2, 3, 4]));

  for (const c of COURSES) {
    const o = OFFICIAL[c.id];
    describe(o.title, () => {
      test('nombre oficial en título y tarjeta', () => {
        assert.equal(c.title, o.title);
        assert.equal(c.cardTitle.join(' '), o.title);
      });
      test('inicio, días, horario y 4 semanas', () => {
        assert.equal(c.startDate, o.start);
        assert.deepEqual(c.scheduleDays, o.days);
        assert.equal(c.scheduleTime, o.time);
        assert.equal(c.duration, '4 semanas');
        assert.ok(!/ocho semanas|8 semanas/i.test(c.longDescription.join(' ')), 'la descripción no debe hablar de 8 semanas');
      });
      test('la fecha de inicio cae en el primer día de clase', () => {
        assert.equal(formatStartDate(c.startDate), o.label);
        assert.ok(o.label.startsWith(c.scheduleDays[0]));
      });
      test('el calendario del aula da 8 clases de 2 horas en 4 semanas', () => {
        const list = buildRecurringSessions({ scheduleDays: c.scheduleDays, scheduleTime: c.scheduleTime, weeksLabel: c.duration }, c.startDate);
        assert.equal(list.length, 8);
        assert.ok(list.every((e) => e.durationMin === 120));
        assert.equal(list[0].startsAt, o.first);
        assert.equal(list.at(-1).startsAt, o.last);
      });
    });
  }
});

describe('formatStartDate', () => {
  test('no corre la fecha por zona horaria', () => assert.equal(formatStartDate('2026-11-09'), 'Lunes 9 de noviembre'));
  test('sin fecha válida devuelve null', () => {
    assert.equal(formatStartDate(null), null);
    assert.equal(formatStartDate('9/11'), null);
  });
});

describe('aula de Redes Sociales a 4 semanas', () => {
  const modules = [1, 2, 3, 4].map((n) => ({ id: `m${n}`, weeksLabel: `Semana ${n}` }));
  const slots = [{ day: 'Martes', start: '20:00', end: '22:00' }, { day: 'Jueves', start: '20:00', end: '22:00' }];

  test('los módulos "Semana 1".."Semana 4" dan 4 semanas', () => {
    assert.equal(courseWeeksFromModules(modules), 4);
  });

  test('resincronizar un aula de 8 semanas borra solo las semanas 5-8', () => {
    const now = Date.parse('2026-10-26T12:00:00-05:00');
    const existing = buildRecurringSessions({ slots, weeksLabel: '8' }, '2026-11-10')
      .map((e, i) => ({ ...e, id: `s${i}`, groupId: 'g1', generated: true, status: 'upcoming' }));
    const desired = buildRecurringSessions({ slots, weeksLabel: '4' }, '2026-11-10');
    const plan = planScheduleSync({ desired, existing, groupId: 'g1', now });
    assert.equal(plan.toCreate.length, 0);
    assert.equal(plan.toDelete.length, 8);
    assert.ok(plan.toDelete.every((s) => s.startsAt >= '2026-12-08'));
    assert.equal(plan.toUpdate.length, 0);
  });
});

describe('banner superior', () => {
  const db = readFileSync(new URL('../src/lib/db.js', import.meta.url), 'utf8');
  const navbar = readFileSync(new URL('../src/components/Navbar.jsx', import.meta.url), 'utf8');
  test('por defecto anuncia el inicio de clases', () => {
    assert.match(db, /promoBanner: 'Inicio de clases - 9 de Noviembre'/);
  });
  test('el Navbar lo lee de la configuración, sin texto fijo', () => {
    assert.match(navbar, /fetchAcademySettings\(\)/);
    assert.doesNotMatch(navbar, /hasta el 16\/10/);
  });
});
