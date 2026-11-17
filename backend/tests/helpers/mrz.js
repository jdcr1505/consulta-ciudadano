import { digitoControl } from '../../src/modules/documentos/mrz.js';

const rellenar = (s, n) => s.padEnd(n, '<').slice(0, n);

/**
 * Construye las 3 líneas de la MRZ de la cédula digital colombiana (30 caracteres) con dígitos de control correctos:
 *  línea 1: ICCOL + números del documento (NO es la cédula) + relleno
 *  línea 2: nacimiento+dígito, sexo, vencimiento+dígito, COL, CÉDULA (11 posiciones) + dígito compuesto
 *  línea 3: apellidos << nombres
 */
export function construirTD1(cedula, { serie = '123456789', nacimiento = '850101', vencimiento = '300101', apellidos = 'PEREZ GOMEZ', nombres = 'JUAN CARLOS' } = {}) {
  const l1 = rellenar(`ICCOL${serie}${digitoControl(serie)}`, 30);
  const opcional = rellenar(cedula, 11);
  const dn = digitoControl(nacimiento);
  const de = digitoControl(vencimiento);
  const compuesto = l1.slice(5, 30) + nacimiento + dn + vencimiento + de + opcional;
  const l2 = `${nacimiento}${dn}M${vencimiento}${de}COL${opcional}${digitoControl(compuesto)}`;
  const l3 = rellenar(`${apellidos.replace(/ /g, '<')}<<${nombres.replace(/ /g, '<')}`, 30);
  return [l1, l2, l3];
}