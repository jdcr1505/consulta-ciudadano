// Pruebas de la lógica de validación del cliente móvil (node --test, sin emulador).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cumplePolitica, validarCambio, validarLogin, validarRegistro } from '../src/validation.js';

const valido = { identificacion: '1020304050', nombres: 'Carlos Andrés', apellidos: 'Vargas Mejía', fuerzaPublicaId: 1, rangoId: 3, idFuerza: 'PN-48213', correo: 'carlos@example.test' };

test('[HU01] registro válido no produce errores', () => assert.deepEqual(validarRegistro(valido), {}));
test('[HU01] campos vacíos producen error en todos los obligatorios', () => {
  const e = validarRegistro({ identificacion: '', nombres: '', apellidos: '', fuerzaPublicaId: null, rangoId: null, idFuerza: '', correo: '' });
  assert.deepEqual(Object.keys(e).sort(), ['apellidos', 'correo', 'fuerzaPublicaId', 'idFuerza', 'identificacion', 'nombres', 'rangoId']);
});
for (const [campo, valor] of [['identificacion', '12ab'], ['identificacion', '123'], ['nombres', 'Juan123'], ['correo', 'no-correo'], ['idFuerza', 'PN 48;1']]) {
  test(`[HU01] rechaza ${campo} = "${valor}"`, () => assert.ok(validarRegistro({ ...valido, [campo]: valor })[campo]));
}
test('[HU01] conserva ceros iniciales (la identificación es texto)', () => assert.deepEqual(validarRegistro({ ...valido, identificacion: '0012345' }), {}));
test('[HU03] login exige identificación y contraseña (CA04)', () => {
  assert.deepEqual(Object.keys(validarLogin('', '')).sort(), ['identificacion', 'password']);
  assert.deepEqual(validarLogin('1020304050', 'x'), {});
});
test('[HU03] política de contraseña = misma del servidor', () => {
  for (const [p, ok] of [['Abc123', true], ['abc123', false], ['ABC123', false], ['Abcdef', false], ['Ab1', false]]) assert.equal(cumplePolitica(p), ok, p);
});
test('[HU03] cambio de contraseña valida política y confirmación', () => {
  assert.ok(validarCambio('Tmp123', 'abc', 'abc').passwordNueva);
  assert.ok(validarCambio('Tmp123', 'Nueva123', 'Otra1234').confirmar);
  assert.deepEqual(validarCambio('Tmp123', 'Nueva123', 'Nueva123'), {});
});
