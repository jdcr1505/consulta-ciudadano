import assert from 'node:assert/strict';
import { test } from 'node:test';
import { candidatosIdentificacion, huella, resumen, sinCerosIzquierda } from '../src/scanner/analisis.js';

test('huella: no revela datos, solo la forma', () => {
  const h = huella('0001012345 PEREZ DIAZ O+\u0000');
  assert.equal(h, '9999999999_AAAAA_AAAA_A#·');
  assert.ok(!/[0-9A-Za-z]/.test(h.replace(/[9A]/g, '')));
});
test('candidatos: detecta números de 6 a 10 dígitos con su posición', () => {
  const c = candidatosIdentificacion('xx0001012345yy19850312zz123');
  assert.deepEqual(c.map(({ posicion, longitud }) => [posicion, longitud]), [[2, 10], [14, 8]]);
});
test('candidatos: ignora cadenas cortas', () => assert.deepEqual(candidatosIdentificacion('12345 abc 99'), []));
test('sin ceros de relleno a la izquierda', () => {
  assert.equal(sinCerosIzquierda('0001012345'), '1012345');
  assert.equal(sinCerosIzquierda('0000000000'), '0');
  assert.equal(sinCerosIzquierda('1012345678'), '1012345678');
});
test('resumen: no incluye el contenido', () => {
  const r = resumen({ type: 'pdf417', data: 'AB0001012345', raw: null });
  assert.equal(r.tipo, 'pdf417');
  assert.equal(r.longitudData, 12);
  assert.equal(JSON.stringify(r).includes('0001012345'), false);
});
test('maneja datos vacíos o nulos', () => {
  assert.equal(huella(null), '');
  assert.deepEqual(candidatosIdentificacion(undefined), []);
});

import { extraerIdentificacionPdf417, formatoMiles, ordenarCandidatos } from '../src/scanner/analisis.js';
import { validarNumeroCedula } from '../src/validation.js';

test('[HU04] PDF417: cédula de 8 dígitos (relleno con ceros), cadenas separadas', () => {
  const data = 'PubDSK_1 1234567 9876543 0052000111PEREZ GOMEZ JUAN M1985031205001O+';
  assert.deepEqual(extraerIdentificacionPdf417(data), ['52000111']);
});
test('[HU04] PDF417: cédula de 10 dígitos separada de los números anteriores', () => {
  const data = 'PubDSK_1 1234567 9876543 1001082867PEREZ GOMEZ JUAN M1985031205001O+';
  assert.deepEqual(extraerIdentificacionPdf417(data), ['1001082867']);
});
test('[HU04] PDF417: dígitos de otro campo PEGADOS a la cédula (17 seguidos) → entrega los 10 correctos, no los últimos 7', () => {
  const data = 'PubDSK_1 1111111 ' + '1234567' + '1001082867' + 'PEREZ GOMEZ JUAN M1985031205001O+';
  assert.deepEqual(extraerIdentificacionPdf417(data), ['1001082867']);
});
test('[HU04] PDF417: pegado con un resto de solo 5 dígitos (15 seguidos) también entrega la cédula completa', () => {
  const data = 'PubDSK_1 1111111 ' + '12345' + '1001082867' + 'PEREZ GOMEZ JUAN M1985031205001O+';
  assert.equal(extraerIdentificacionPdf417(data)[0], '1001082867');
});
test('[HU04] PDF417: la fecha de nacimiento nunca se devuelve como cédula', () => {
  const r = extraerIdentificacionPdf417('PubDSK_1 1234567 9876543 0052000111PEREZ M19850312');
  assert.ok(!r.includes('19850312'));
});
test('[HU04] PDF417: sin fecha ni tercera cadena usa la posición 48 (con ceros de relleno)', () => {
  const data = 'x'.repeat(48) + '0001012345' + 'PEREZ GOMEZ JUAN';
  assert.deepEqual(extraerIdentificacionPdf417(data), ['1012345']);
});
test('[HU04] PDF417: una versión truncada va después de la completa (la completa tiene prioridad)', () => {
  assert.deepEqual(ordenarCandidatos(['1082867', '1001082867', '99999999']), ['1001082867', '1082867', '99999999']);
  assert.deepEqual(ordenarCandidatos(['52000111']), ['52000111']);
});
test('[HU04] PDF417: candidatos inválidos (solo ceros) → respaldo; sin candidatos → lista vacía', () => {
  assert.deepEqual(extraerIdentificacionPdf417('2222222 3333333 0000000000'), ['2222222', '3333333']);
  assert.deepEqual(extraerIdentificacionPdf417('abc 123 xyz'), []);
  assert.deepEqual(extraerIdentificacionPdf417(null), []);
});
test('formatoMiles agrupa de a tres con puntos', () => {
  assert.equal(formatoMiles('1012345678'), '1.012.345.678');
  assert.equal(formatoMiles('79123456'), '79.123.456');
  assert.equal(formatoMiles('123456'), '123.456');
});
test('[HU04] número escrito a mano: solo dígitos, sin ceros de relleno, 6 a 10 dígitos', () => {
  assert.deepEqual(validarNumeroCedula('1.012.345.678'), { numero: '1012345678' });
  assert.deepEqual(validarNumeroCedula('0079123456'), { numero: '79123456' });
  for (const malo of ['', 'abc', '123', '12345678901']) assert.ok(validarNumeroCedula(malo).error, malo);
});
