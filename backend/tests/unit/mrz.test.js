import { describe, expect, it } from 'vitest';
import { aDigitos, digitoControl, huellaMrz, interpretarMrz, normalizarTexto } from '../../src/modules/documentos/mrz.js';
import { construirTD1 } from '../helpers/mrz.js';

describe('[HU04] dígitos de control MRZ (ICAO 9303)', () => {
  it.each([
    ['520727', 3], // ejemplos publicados en ICAO 9303
    ['L898902C3', 6],
    ['740812', 2],
    ['120415', 9],
    ['<<<<<<<<<', 0],
  ])('digitoControl(%s) = %i', (entrada, esperado) => expect(digitoControl(entrada)).toBe(esperado));
});

describe('[HU04] interpretación de la MRZ de la cédula digital', () => {
  it('lee un número de 9 dígitos con su dígito de control', () => {
    const r = interpretarMrz(construirTD1('123456789').join('\n'));
    expect(r).toEqual({ valido: true, identificacion: '123456789', metodo: 'campo' });
  });
  it('lee un número de 10 dígitos (más de 9 caracteres → campo opcional)', () => {
    const r = interpretarMrz(construirTD1('1012345678').join('\n'));
    expect(r).toEqual({ valido: true, identificacion: '1012345678', metodo: 'extendido' });
  });
  it('lee un número corto relleno con "<" y quita los ceros de relleno', () => {
    expect(interpretarMrz(construirTD1('79123456').join('\n'))).toMatchObject({ valido: true, identificacion: '79123456' });
    expect(interpretarMrz(construirTD1('000123456').join('\n'))).toMatchObject({ valido: true, identificacion: '123456' });
  });
  it('tolera errores típicos del OCR: C0L, letras por dígitos, espacios y símbolos por "<"', () => {
    const [l1] = construirTD1('1012345678');
    const sucio = l1.replace('COL', 'C0L').replace('101234567', '1O1234567').replace(/</g, (_m, i) => (i % 2 ? '«' : '<'));
    expect(interpretarMrz(`${sucio.split('').join(' ')}\nbasura`)).toMatchObject({ valido: true, identificacion: '1012345678' });
  });
  it('tolera que el OCR pierda caracteres de relleno al final de la línea', () => {
    const [l1] = construirTD1('123456789');
    expect(interpretarMrz(l1.slice(0, 26))).toMatchObject({ valido: true, identificacion: '123456789' });
  });
  it('rechaza una lectura con dígito de control incorrecto (no inventa un número)', () => {
    const [l1] = construirTD1('123456789');
    const mala = l1.slice(0, 5) + '123456788' + l1.slice(14); // cambia un dígito del número
    expect(interpretarMrz(mala)).toEqual({ valido: false, motivo: 'DIGITO_CONTROL_INVALIDO' });
  });
  it('si no hay MRZ en el texto responde MRZ_NO_ENCONTRADA', () => {
    expect(interpretarMrz('REPUBLICA DE COLOMBIA\nCEDULA DE CIUDADANIA')).toEqual({ valido: false, motivo: 'MRZ_NO_ENCONTRADA' });
    expect(interpretarMrz('')).toEqual({ valido: false, motivo: 'MRZ_NO_ENCONTRADA' });
    expect(interpretarMrz(null)).toEqual({ valido: false, motivo: 'MRZ_NO_ENCONTRADA' });
  });
  it('un documento de otro país no se acepta como cédula colombiana', () => {
    const [l1] = construirTD1('123456789');
    expect(interpretarMrz(l1.replace('COL', 'USA')).valido).toBe(false);
  });
  it('utilidades: normalización y huella no revelan datos', () => {
    expect(normalizarTexto('ic col 1234\n corto')).toEqual([]);
    expect(aDigitos('O1I5S')).toBe('01155');
    const h = huellaMrz(construirTD1('1012345678').join('\n'));
    expect(h[0]).toMatch(/^[9A<]+$/);
    expect(h.join('')).not.toMatch(/[0-8]/);
  });
});
