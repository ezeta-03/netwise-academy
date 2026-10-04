// Tests de src/lib/phone.js: números para los enlaces de WhatsApp.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { toWhatsAppNumber, whatsAppLink } from '../src/lib/phone.js';

describe('toWhatsAppNumber', () => {
  test('celular peruano sin código de país recibe el 51', () => {
    assert.equal(toWhatsAppNumber('987654321'), '51987654321');
    assert.equal(toWhatsAppNumber('987 654 321'), '51987654321');
    assert.equal(toWhatsAppNumber('987-654-321'), '51987654321');
  });
  test('con código de país se respeta, en cualquier formato', () => {
    assert.equal(toWhatsAppNumber('+51 987 654 321'), '51987654321');
    assert.equal(toWhatsAppNumber('0051987654321'), '51987654321');
    assert.equal(toWhatsAppNumber('+1 (415) 555-0100'), '14155550100');
    assert.equal(toWhatsAppNumber('+34 612 34 56 78'), '34612345678');
  });
  test('números incompletos o vacíos -> null', () => {
    for (const bad of ['', null, undefined, '12345', '98765432', 'no tengo', '1234567890123456']) {
      assert.equal(toWhatsAppNumber(bad), null);
    }
  });
  test('un fijo de 9 dígitos que no empieza en 9 no se adivina', () => {
    assert.equal(toWhatsAppNumber('014567890'), null);
  });
});

describe('whatsAppLink', () => {
  test('con número abre el chat de esa persona con el mensaje', () => {
    assert.equal(whatsAppLink('987654321', 'Hola Ana'), 'https://wa.me/51987654321?text=Hola%20Ana');
  });
  test('sin número válido deja elegir el contacto', () => {
    assert.equal(whatsAppLink('', 'Hola'), 'https://wa.me/?text=Hola');
  });
  test('el mensaje viaja codificado (saltos de línea y enlaces)', () => {
    const link = whatsAppLink('987654321', 'Línea 1\nhttps://x.pe/a?b=1&c=2');
    assert.ok(link.endsWith('?text=L%C3%ADnea%201%0Ahttps%3A%2F%2Fx.pe%2Fa%3Fb%3D1%26c%3D2'));
  });
});
