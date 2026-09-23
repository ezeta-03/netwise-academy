// Tests de src/lib/deliveryDates.js y src/lib/placeholders.js (importados del código real).
// Fechas de referencia: 2026-08-11 = martes, 2026-08-12 = miércoles.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { endWeekOf, courseWeeksFromModules, deliverableDueDate } from '../src/lib/deliveryDates.js';
import { lastClassDate, parseScheduleLabel } from '../src/lib/liveScheduleGenerator.js';
import { isPendingUrl } from '../src/lib/placeholders.js';

describe('endWeekOf', () => {
  test('etiquetas típicas', () => {
    assert.equal(endWeekOf('Semana 3', 9), 3);
    assert.equal(endWeekOf('Semanas 5-6', 9), 6);
    assert.equal(endWeekOf('Semanas 1 - 2', 9), 2);
    assert.equal(endWeekOf('Semanas 1–2', 9), 2);
    assert.equal(endWeekOf('Semanas 5 a 6', 9), 6);
    assert.equal(endWeekOf('Semanas 10-12', 9), 12);
    assert.equal(endWeekOf('Semana 12', 9), 12);
    assert.equal(endWeekOf('SEMANA 3', 9), 3);
  });
  test('"Semanas 5 y 6" -> 6 y abreviaturas "Sem. 3" / "Sem 3" -> 3', () => {
    assert.equal(endWeekOf('Semanas 5 y 6', 1), 6);
    assert.equal(endWeekOf('Sem. 3', 9), 3);
    assert.equal(endWeekOf('Sem 3', 9), 3);
    assert.equal(endWeekOf('Sem. 5-6', 9), 6);
  });
  test('números extra después de la semana no cambian el resultado', () => {
    assert.equal(endWeekOf('Semana 3 (4 horas)', 1), 3);
    assert.equal(endWeekOf('Semanas 1-2 · 8 h', 1), 2);
    assert.equal(endWeekOf('Semanas 5-6 (16 h)', 1), 6);
    assert.equal(endWeekOf('Semana 4 · 16 h', 1), 4);
  });
  test('ausente / sin "semana" / sin número -> fallback', () => {
    for (const label of [undefined, null, '', 'Semana', 'Módulo 3', '5-6', 'Semestre']) assert.equal(endWeekOf(label, 4), 4, String(label));
  });
  test('el fallback puede ser null', () => {
    assert.equal(endWeekOf('', null), null);
  });
  test('rango invertido "6-5" toma el segundo número; "Semana 0" se respeta', () => {
    assert.equal(endWeekOf('Semanas 6-5', 1), 5);
    assert.equal(endWeekOf('Semana 0', 1), 0);
  });
  test('un label con "Módulo 2 · Semana 4" toma la semana, no el módulo', () => {
    assert.equal(endWeekOf('Módulo 2 · Semana 4', 1), 4);
  });
});

describe('courseWeeksFromModules', () => {
  test('la mayor semana de cierre', () => {
    assert.equal(courseWeeksFromModules([{ weeksLabel: 'Semanas 1-2' }, { weeksLabel: 'Semanas 7-8' }, { weeksLabel: 'Semanas 3-4' }]), 8);
    assert.equal(courseWeeksFromModules([{ weeksLabel: 'Semana 1' }, { weeksLabel: 'Semana 4' }]), 4);
  });
  test('sin módulos / null / sin etiquetas -> null', () => {
    assert.equal(courseWeeksFromModules([]), null);
    assert.equal(courseWeeksFromModules(null), null);
    assert.equal(courseWeeksFromModules(undefined), null);
    assert.equal(courseWeeksFromModules([{ title: 'a' }, { weeksLabel: '' }, { weeksLabel: 'Tema libre' }]), null);
  });
  test('ignora los módulos sin etiqueta y usa los que sí la tienen', () => {
    assert.equal(courseWeeksFromModules([{ weeksLabel: 'Semana 2' }, { title: 'sin etiqueta' }]), 2);
  });
  test('las semanas de los módulos no necesitan estar en orden', () => {
    assert.equal(courseWeeksFromModules([{ weeksLabel: 'Semanas 7-8' }, { weeksLabel: 'Semanas 1-2' }]), 8);
  });
});

describe('deliverableDueDate(module, index, group)', () => {
  const group = { startDate: '2026-08-11', scheduleTime: 'Martes y Jueves · 19:00-21:00' };
  const mod = (weeksLabel, deliverable) => ({ weeksLabel, ...(deliverable ? { deliverable } : {}) });

  test('la fecha manual gana sobre la calculada', () => {
    assert.equal(deliverableDueDate(mod('Semana 1', { dueDate: '2026-10-01' }), 0, group), '2026-10-01');
    assert.equal(deliverableDueDate(mod('Semana 1', { dueDate: '2026-10-01' }), 0, null), '2026-10-01');
  });
  test('sin fecha manual: última clase de la semana de cierre', () => {
    assert.equal(deliverableDueDate(mod('Semana 1'), 0, group), '2026-08-13');
    assert.equal(deliverableDueDate(mod('Semanas 3-4'), 0, group), '2026-09-03');
    assert.equal(deliverableDueDate(mod('Semanas 5-6'), 0, group), '2026-09-17');
    assert.equal(deliverableDueDate(mod('Semanas 5 y 6'), 0, group), '2026-09-17');
  });
  test('es consistente con lastClassDate + parseScheduleLabel', () => {
    for (let w = 1; w <= 8; w++) {
      assert.equal(deliverableDueDate(mod(`Semana ${w}`), 0, group), lastClassDate(group.startDate, parseScheduleLabel(group.scheduleTime), w));
    }
  });
  test('deliverable.dueDate vacío ("" / null) cae al cálculo', () => {
    assert.equal(deliverableDueDate(mod('Semana 1', { dueDate: '' }), 0, group), '2026-08-13');
    assert.equal(deliverableDueDate(mod('Semana 1', { dueDate: null }), 0, group), '2026-08-13');
  });
  test('sin weeksLabel usa index + 1 como semana', () => {
    assert.equal(deliverableDueDate(mod(undefined), 0, group), '2026-08-13');
    assert.equal(deliverableDueDate(mod(undefined), 2, group), '2026-08-27');
    assert.equal(deliverableDueDate(mod('sin semana'), 1, group), '2026-08-20');
  });
  test('inicio en miércoles: semana anclada a la primera clase real', () => {
    const g = { startDate: '2026-08-12', scheduleTime: 'Martes y Jueves · 19:00-21:00' };
    assert.equal(deliverableDueDate(mod('Semana 1'), 0, g), '2026-08-18');
    assert.equal(deliverableDueDate(mod('Semana 3'), 0, { ...g, startDate: '2026-08-11' }), '2026-08-27');
  });
  test('acepta group.scheduleDays cuando no hay scheduleTime (etiqueta o arreglo)', () => {
    assert.equal(deliverableDueDate(mod('Semana 1'), 0, { startDate: '2026-08-11', scheduleDays: 'Martes y Jueves' }), '2026-08-13');
    assert.equal(deliverableDueDate(mod('Semana 1'), 0, { startDate: '2026-08-11', scheduleDays: ['Martes', 'Jueves'] }), '2026-08-13');
  });
  test('horario en minúsculas o con rango también se calcula', () => {
    assert.equal(deliverableDueDate(mod('Semana 1'), 0, { startDate: '2026-08-11', scheduleTime: 'martes y jueves' }), '2026-08-13');
    assert.equal(deliverableDueDate(mod('Semana 1'), 0, { startDate: '2026-08-10', scheduleTime: 'Lunes a Viernes · 09:00-11:00' }), '2026-08-14');
  });
  test('null si no se puede calcular: sin grupo, sin startDate, sin horario o ilegible', () => {
    assert.equal(deliverableDueDate(mod('Semana 1'), 0, null), null);
    assert.equal(deliverableDueDate(mod('Semana 1'), 0, undefined), null);
    assert.equal(deliverableDueDate(mod('Semana 1'), 0, { scheduleTime: 'Martes y Jueves' }), null);
    assert.equal(deliverableDueDate(mod('Semana 1'), 0, { startDate: '2026-08-11' }), null);
    assert.equal(deliverableDueDate(mod('Semana 1'), 0, { startDate: '2026-08-11', scheduleTime: 'a convenir' }), null);
    assert.equal(deliverableDueDate(mod('Semana 1'), 0, { startDate: 'no-es-fecha', scheduleTime: 'Martes' }), null);
  });
  test('tolera un módulo undefined (sólo con fallback de semana)', () => {
    assert.equal(deliverableDueDate(undefined, 0, group), '2026-08-13');
  });
  test('cambio de año y mes', () => {
    assert.equal(deliverableDueDate(mod('Semana 2'), 0, { startDate: '2026-12-29', scheduleTime: 'Martes y Jueves' }), '2027-01-07');
  });
  test('la fecha manual no se valida (cualquier texto pasa tal cual)', () => {
    assert.equal(deliverableDueDate(mod('Semana 1', { dueDate: 'mañana' }), 0, group), 'mañana');
  });
  test('una fecha manual con formato inválido debería ignorarse y caer al cálculo', { todo: 'BAJO deliveryDates.js:153 - deliverable.dueDate se devuelve sin validar YYYY-MM-DD; fmtDate del Cronograma mostraría "Invalid Date"' }, () => {
    assert.equal(deliverableDueDate(mod('Semana 1', { dueDate: 'mañana' }), 0, group), '2026-08-13');
  });
});

describe('isPendingUrl', () => {
  test('cadenas "pendientes" -> true', () => {
    for (const u of ['Pendiente de subir', 'pendiente de grabar', 'PENDIENTE', '  Pendiente  ', 'Pendiente']) assert.equal(isPendingUrl(u), true, u);
  });
  test('vacío / null / undefined -> true', () => {
    for (const u of ['', null, undefined, 0, false]) assert.equal(isPendingUrl(u), true, String(u));
  });
  test('enlaces reales -> false', () => {
    for (const u of ['https://x.com', 'http://drive.google.com/file/d/1', ' https://x.com', 'https://pendiente.com/video']) assert.equal(isPendingUrl(u), false, u);
  });
  test('texto sin enlace que no dice "pendiente" -> false (no se detecta como placeholder)', () => {
    assert.equal(isPendingUrl('Por definir'), false);
    assert.equal(isPendingUrl('TBD'), false);
  });
  test('una cadena que sólo espacios ("   ") debería tratarse como pendiente', { todo: 'BAJO placeholders.js:5 - !url es false para "   "; usar !String(url).trim()' }, () => {
    assert.equal(isPendingUrl('   '), true);
  });
  test('una url no-http ("javascript:...", "pendiente.com") debería considerarse inválida', { todo: 'BAJO placeholders.js:5 - sólo detecta el prefijo "pendiente"; no valida esquema http(s)' }, () => {
    assert.equal(isPendingUrl('javascript:alert(1)'), true);
  });
});
