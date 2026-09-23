import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { planScheduleSync } from '../src/lib/scheduleSync.js';
import { buildRecurringSessions } from '../src/lib/liveScheduleGenerator.js';

// Escenarios de EDICIÓN de un aula (ver AdminGrupos): qué se regenera y qué no.
// Aula "g1" del curso 2: empieza el martes 2026-08-11, mar/jue 19:00-21:00,
// 4 semanas (8 clases). "Hoy" es el lunes 2026-08-17 12:00 hora de Perú: ya
// pasó la semana 1 (mar 11 y jue 13) y quedan 6 clases futuras.
const NOW = Date.parse('2026-08-17T12:00:00-05:00');
const TUE_THU = [{ day: 'Martes', start: '19:00', end: '21:00' }, { day: 'Jueves', start: '19:00', end: '21:00' }];
const desiredFor = (slots, start = '2026-08-11', weeks = 4) => buildRecurringSessions({ slots, weeksLabel: String(weeks) }, start);
const asSessions = (entries, extra = {}) => entries.map((e, i) => ({
  id: `s${i}`, courseId: 2, title: e.title, startsAt: e.startsAt, durationMin: e.durationMin,
  status: 'upcoming', instructor: 'Ana', instructorUid: 'u-ana', generated: true, groupId: 'g1', ...extra,
}));
const base = () => asSessions(desiredFor(TUE_THU));
const plan = (over = {}) => planScheduleSync({
  desired: desiredFor(TUE_THU), existing: base(), groupId: 'g1', now: NOW, instructor: 'Ana', instructorUid: 'u-ana', ...over,
});

describe('planScheduleSync: escenarios en los que SÍ se regenera (editar, no crear otra aula)', () => {
  test('sin cambios -> nada que hacer; 2 pasadas, 6 futuras al día', () => {
    const p = plan();
    assert.equal(p.hasChanges, false);
    assert.equal(p.unchanged, 6);
    assert.equal(p.pastCount, 2);
    assert.equal(p.hasStarted, true);
  });

  test('cambia la hora (19:00 -> 20:00): reemplaza solo las 6 futuras; las 2 pasadas quedan', () => {
    const slots = TUE_THU.map((s) => ({ ...s, start: '20:00', end: '22:00' }));
    const p = plan({ desired: desiredFor(slots) });
    assert.equal(p.toDelete.length, 6);
    assert.equal(p.toCreate.length, 6);
    assert.equal(p.toUpdate.length, 0);
    assert.equal(p.pastCount, 2);
    assert.ok(p.toCreate.every((e) => e.startsAt.includes('T20:00')));
  });

  test('agrega un día (sábado): crea solo las clases nuevas, mantiene las demás', () => {
    const p = plan({ desired: desiredFor([...TUE_THU, { day: 'Sábado', start: '09:00', end: '12:00' }]) });
    assert.equal(p.toDelete.length, 0);
    assert.equal(p.unchanged, 6);
    assert.ok(p.toCreate.length >= 3);
    assert.ok(p.toCreate.every((e) => e.title.includes('Sábado')));
  });

  test('quita un día (jueves): elimina solo las clases de ese día en el futuro', () => {
    const p = plan({ desired: desiredFor([TUE_THU[0]]) });
    assert.equal(p.toCreate.length, 0);
    assert.equal(p.toDelete.length, 3);
    assert.ok(p.toDelete.every((s) => s.title.includes('Jueves')));
    assert.equal(p.pastCount, 2);
  });

  test('cambia el docente: no recrea nada, solo reasigna las clases futuras', () => {
    const p = plan({ instructor: 'Luis', instructorUid: 'u-luis' });
    assert.equal(p.toCreate.length + p.toDelete.length, 0);
    assert.equal(p.toUpdate.length, 6);
    assert.equal(p.pastCount, 2);
  });

  test('cierra el aula: elimina las clases futuras y conserva el historial', () => {
    const p = plan({ closed: true });
    assert.equal(p.toDelete.length, 6);
    assert.equal(p.toCreate.length, 0);
    assert.equal(p.pastCount, 2);
  });

  test('reabre un aula cerrada: al no haber futuras, vuelve a crearlas', () => {
    const onlyPast = base().slice(0, 2);
    const p = plan({ existing: onlyPast, closed: false });
    assert.equal(p.toCreate.length, 6);
    assert.equal(p.mineCount, 2);
  });

  test('adelanta la fecha de cierre: elimina las clases posteriores a esa fecha', () => {
    const p = plan({ endDate: '2026-08-20' });
    assert.equal(p.toDelete.length, 4);
    assert.equal(p.unchanged, 2);
  });

  test('un feriado: la clase que el docente canceló a propósito NO se vuelve a crear', () => {
    const existing = base().map((s, i) => (i === 3 ? { ...s, status: 'cancelled' } : s));
    const p = plan({ existing });
    assert.equal(p.toCreate.length, 0);
    assert.equal(p.hasChanges, false);
  });

  test('la clase suelta del docente (sin `generated`) jamás se borra ni cuenta', () => {
    const manual = { id: 'manual', courseId: 2, title: 'Q&A extra', startsAt: '2026-08-25T18:00-05:00', durationMin: 60, status: 'upcoming' };
    const p = plan({ desired: desiredFor([TUE_THU[0]]), existing: [...base(), manual] });
    assert.ok(!p.toDelete.some((s) => s.id === 'manual'));
  });

  test('clases en vivo o ya terminadas no se tocan aunque el horario cambie', () => {
    const live = { ...base()[0], startsAt: '2026-08-17T11:30:00-05:00', durationMin: 120 };
    const p = plan({ existing: [live, ...base().slice(1)], desired: [] });
    assert.ok(!p.toDelete.some((s) => s.id === live.id));
    assert.equal(p.hasStarted, true);
  });

  test('aulas antiguas sin marca: se adoptan si el curso tiene un solo aula, no si tiene varias', () => {
    const legacy = base().map(({ generated, groupId, ...rest }) => rest);
    const single = plan({ existing: legacy, adoptLegacy: true });
    assert.equal(single.mineCount, 8);
    assert.equal(single.hasChanges, false);
    const several = plan({ existing: legacy, adoptLegacy: false });
    assert.equal(several.mineCount, 0);
  });

  test('las clases generadas para OTRA aula del mismo curso no se tocan', () => {
    const other = base().map((s) => ({ ...s, groupId: 'g2' }));
    const p = plan({ existing: other });
    assert.equal(p.mineCount, 0);
    assert.equal(p.toDelete.length, 0);
  });
});

describe('planScheduleSync: señales para decidir "editar" vs "crear otra aula"', () => {
  test('aula terminada (todas las clases pasaron): 0 futuras -> conviene crear un aula nueva', () => {
    const later = Date.parse('2026-10-30T12:00:00-05:00');
    const p = plan({ now: later, desired: desiredFor(TUE_THU) });
    assert.equal(p.futureCount, 0);
    assert.equal(p.hasChanges, false);
    assert.equal(p.pastCount, 8);
  });

  test('aula que aún no empezó: hasStarted=false -> se puede mover la fecha de inicio', () => {
    const before = Date.parse('2026-08-01T12:00:00-05:00');
    const p = plan({ now: before });
    assert.equal(p.hasStarted, false);
    assert.equal(p.unchanged, 8);
  });

  test('aula sin calendario generado (mineCount 0): no se sincroniza sola, hay que pedirlo', () => {
    const p = plan({ existing: [] });
    assert.equal(p.mineCount, 0);
    assert.equal(p.toCreate.length, 6);
  });

  test('mover la fecha de inicio de un aula ya iniciada reprograma solo lo futuro (por eso Admin lo bloquea)', () => {
    const p = plan({ desired: desiredFor(TUE_THU, '2026-08-18') });
    assert.equal(p.pastCount, 2);
    assert.ok(p.hasChanges);
  });
});
