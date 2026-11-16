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

import { extraerIdentificacionPdf417, formatoMiles } from '../src/scanner/analisis.js';
import { validarNumeroCedula } from '../src/validation.js';

test('[HU04] PDF417: propone primero el número de 10 dígitos en la posición esperada, sin ceros de relleno', () => {
  const data = 'x'.repeat(48) + '0001012345' + 'PEREZ GOMEZ JUAN';
  assert.deepEqual(extraerIdentificacionPdf417(data), ['1012345']);
});
test('[HU04] PDF417: descarta fechas (AAAAMMDD) y deja los demás candidatos en orden', () => {
  const data = 'ab1012345678cd19850312ef79123456';
  assert.deepEqual(extraerIdentificacionPdf417(data), ['1012345678', '79123456']);
});
test('[HU04] PDF417: sin candidatos válidos devuelve lista vacía', () => {
  assert.deepEqual(extraerIdentificacionPdf417('abc 123 xyz'), []);
  assert.deepEqual(extraerIdentificacionPdf417(null), []);
});
test('[HU04] PDF417: no duplica candidatos y limita a 4', () => {
  const data = '1111111 2222222 3333333 4444444 5555555 1111111';
  assert.deepEqual(extraerIdentificacionPdf417(data), ['1111111', '2222222', '3333333', '4444444']);
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
