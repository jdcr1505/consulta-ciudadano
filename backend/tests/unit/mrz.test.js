import { describe, expect, it } from 'vitest';
import { aDigitos, digitoControl, huellaMrz, interpretarMrz, normalizarTexto } from '../../src/modules/documentos/mrz.js';
import { construirTD1 } from '../helpers/mrz.js';

const leer = (lineas) => interpretarMrz(lineas.join('\n'));

describe('[HU04] dígitos de control MRZ (ICAO 9303)', () => {
  it.each([
    ['520727', 3], // ejemplos publicados en ICAO 9303
    ['L898902C3', 6],
    ['740812', 2],
    ['120415', 9],
    ['<<<<<<<<<', 0],
  ])('digitoControl(%s) = %i', (entrada, esperado) => expect(digitoControl(entrada)).toBe(esperado));
});

describe('[HU04] cédula digital: el número está en la LÍNEA 2, después de COL', () => {
  it('lee una cédula de 10 dígitos con confianza alta (dígito compuesto válido)', () => {
    expect(leer(construirTD1('1012345678'))).toEqual({ valido: true, identificacion: '1012345678', confianza: 'alta', metodo: 'linea2_compuesto' });
  });
  it('lee cédulas más cortas (relleno con "<") y quita los ceros de relleno', () => {
    expect(leer(construirTD1('79123456'))).toMatchObject({ valido: true, identificacion: '79123456', confianza: 'alta' });
    expect(leer(construirTD1('0079123456'))).toMatchObject({ valido: true, identificacion: '79123456' });
  });
  it('NO confunde con los números de la línea 1, aunque su dígito de control sea válido', () => {
    const r = leer(construirTD1('52000111', { serie: '987654321' }));
    expect(r.identificacion).toBe('52000111');
    expect(r.identificacion).not.toContain('987654321');
  });
  it('si la línea 1 se leyó mal pero las fechas cuadran, entrega el número con confianza MEDIA', () => {
    const [l1, l2, l3] = construirTD1('1012345678');
    const r = leer([l1.replace('123456789', '12X45B789'), l2, l3]);
    expect(r).toEqual({ valido: true, identificacion: '1012345678', confianza: 'media', metodo: 'linea2_fechas' });
  });
  it('tolera errores típicos del OCR: C0L, letras por dígitos, "«" por "<", espacios y pérdida de relleno', () => {
    const [l1, l2, l3] = construirTD1('1012345678');
    const sucia = l2.replace('COL', 'C0L').replace('850101', '85O1O1').replace('1012345678', '1O12345678').split('').join(' ');
    expect(leer([l1, sucia, l3])).toMatchObject({ valido: true, identificacion: '1012345678', confianza: 'alta' });

    const corta = construirTD1('79123456');
    const sinRelleno = corta[1].replace('79123456<<<', '79123456<'); // el OCR perdió dos "<"
    expect(leer([corta[0], sinRelleno, corta[2]])).toMatchObject({ valido: true, identificacion: '79123456' });

    const simbolos = construirTD1('79123456').map((l) => l.replace(/</g, '«'));
    expect(leer(simbolos)).toMatchObject({ valido: true, identificacion: '79123456' });
  });
  it('rechaza la lectura si fallan los dígitos de las fechas y el compuesto (no inventa un número)', () => {
    const [l1, l2, l3] = construirTD1('1012345678');
    const mala = l2.slice(0, 6) + String((Number(l2[6]) + 1) % 10) + l2.slice(7); // dígito de control del nacimiento alterado
    expect(leer([l1, mala, l3])).toEqual({ valido: false, motivo: 'DIGITO_CONTROL_INVALIDO' });
  });
  it('sin MRZ o sin línea 2 responde MRZ_NO_ENCONTRADA', () => {
    expect(interpretarMrz('REPUBLICA DE COLOMBIA\nCEDULA DE CIUDADANIA')).toEqual({ valido: false, motivo: 'MRZ_NO_ENCONTRADA' });
    expect(interpretarMrz('')).toEqual({ valido: false, motivo: 'MRZ_NO_ENCONTRADA' });
    expect(interpretarMrz(null)).toEqual({ valido: false, motivo: 'MRZ_NO_ENCONTRADA' });
    expect(interpretarMrz(construirTD1('1012345678')[0]).valido).toBe(false); // solo la línea 1
  });
  it('un documento de otro país no se acepta como cédula colombiana', () => {
    const [l1, l2, l3] = construirTD1('1012345678');
    expect(leer([l1.replace('COL', 'USA'), l2.replace('COL', 'USA'), l3]).valido).toBe(false);
  });
  it('utilidades: normalización y huella no revelan datos', () => {
    expect(normalizarTexto('ic col 1234\n corto')).toEqual([]);
    expect(aDigitos('O1I5S')).toBe('01155');
    const h = huellaMrz(construirTD1('1012345678').join('\n'));
    expect(h[1]).toMatch(/^[9A<]+$/);
    expect(h.join('')).not.toMatch(/[0-8]/);
  });
});