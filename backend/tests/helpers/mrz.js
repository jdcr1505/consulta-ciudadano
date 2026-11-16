import { digitoControl } from '../../src/modules/documentos/mrz.js';

const rellenar = (s, n) => s.padEnd(n, '<').slice(0, n);

/** Construye 3 líneas TD1 (30 caracteres) con dígitos de control correctos para un número de documento. */
export function construirTD1(numero, { apellidos = 'PEREZ GOMEZ', nombres = 'JUAN CARLOS' } = {}) {
  let l1;
  if (numero.length <= 9) {
    const campo = numero.padEnd(9, '<');
    l1 = rellenar(`ICCOL${campo}${digitoControl(campo)}`, 30);
  } else {
    // Más de 9 caracteres: 9 en el campo, '<' como dígito de control y el resto + su dígito en el campo opcional.
    l1 = rellenar(`ICCOL${numero.slice(0, 9)}<${numero.slice(9)}${digitoControl(numero)}`, 30);
  }
  const nac = '850101';
  const exp = '300101';
  const l2 = rellenar(`${nac}${digitoControl(nac)}M${exp}${digitoControl(exp)}COL`, 29) + '0';
  const l3 = rellenar(`${apellidos.replace(/ /g, '<')}<<${nombres.replace(/ /g, '<')}`, 30);
  return [l1, l2, l3];
}
