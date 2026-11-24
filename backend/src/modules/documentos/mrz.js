// Lectura de la zona MRZ de la cédula de ciudadanía DIGITAL colombiana (ICAO 9303, 3 líneas × 30 caracteres).
//
// Distribución de ESTA cédula (confirmada leyendo una cédula real):
//   Línea 1: "ICCOL" + números propios del documento (NO es la cédula) + "<<<"
//   Línea 2: AAMMDD nacimiento + dígito, sexo, AAMMDD vencimiento + dígito, "COL",
//            NÚMERO DE CÉDULA (11 posiciones, relleno con "<") + dígito de control compuesto
//   Línea 3: apellidos << nombres
//
// Los dígitos de control (pesos 7-3-1) validan la lectura del OCR.

const PESOS = [7, 3, 1];
const valor = (c) => (c === '<' ? 0 : /[0-9]/.test(c) ? Number(c) : c.charCodeAt(0) - 55); // A=10 … Z=35

export const digitoControl = (s) => [...s].reduce((acc, c, i) => acc + valor(c) * PESOS[i % 3], 0) % 10;

// Confusiones típicas del OCR en zonas numéricas.
const A_DIGITO = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6', T: '7' };
export const aDigitos = (s) => [...s].map((c) => A_DIGITO[c] ?? c).join('');

const sinCeros = (d) => d.replace(/^0+(?=\d)/, '');
const unicos = (xs) => [...new Set(xs)];

/** Mayúsculas, sin espacios; cualquier símbolo raro que el OCR confunda con '<' pasa a '<'. */
export function normalizarTexto(texto) {
  return String(texto ?? '')
    .toUpperCase()
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, '').replace(/[^A-Z0-9<]/g, '<'))
    .filter((l) => l.length >= 20);
}

const D = '[0-9OQDILZSBGT]'; // carácter que debería ser un dígito (tolera confusiones del OCR)
// Línea 2: nacimiento(6)+dígito, sexo, vencimiento(6)+dígito, COL, y el resto (cédula + dígito compuesto).
const LINEA2 = new RegExp(`(${D}{6})(${D})([MFX<])(${D}{6})(${D})C[O0]L([A-Z0-9<]+)`);
const INICIO_LINEA1 = /I[A-Z<]C[O0]L/; // "ICCOL"

/** Línea 1 exacta de 30 caracteres (se rellena con '<' lo que el OCR haya perdido al final). */
function buscarLinea1(lineas) {
  for (const l of lineas) {
    const i = l.search(INICIO_LINEA1);
    if (i >= 0 && i <= 2) return l.slice(i).padEnd(30, '<').slice(0, 30);
  }
  return null;
}

/** El OCR a veces pierde o añade "<": se reconstruyen las posibles colas de 12 caracteres (11 de cédula + 1 de control). */
function colasPosibles(cola) {
  if (cola.length === 12) return [cola];
  if (cola.length < 12) return [cola.slice(0, -1).padEnd(11, '<') + cola.slice(-1)];
  return unicos([cola.slice(0, 12), cola.slice(-12)]);
}

/** Interpreta una línea candidata a "línea 2". Devuelve null si no tiene esa forma. */
export function interpretarLinea2(linea, linea1) {
  const m = linea.match(LINEA2);
  if (!m) return null;
  const nac = aDigitos(m[1]);
  const dn = Number(aDigitos(m[2]));
  const exp = aDigitos(m[4]);
  const de = Number(aDigitos(m[5]));
  const fechasOk = digitoControl(nac) === dn && digitoControl(exp) === de;

  for (const cola of colasPosibles(m[6])) {
    const opcional = cola.slice(0, 11);
    const bruto = opcional.match(/^[0-9OQDILZSBGT]+/)?.[0];
    if (!bruto) continue;
    const numero = sinCeros(aDigitos(bruto));
    if (!/^\d{6,10}$/.test(numero)) continue;

    // Dígito compuesto: línea 1 (pos. 6–30) + línea 2 (pos. 1–7, 9–15 y 19–29).
    const opcionalCorregido = aDigitos(bruto) + opcional.slice(bruto.length);
    const compuestoOk =
      linea1 !== null &&
      digitoControl(linea1.slice(5, 30) + nac + dn + exp + de + opcionalCorregido) === Number(aDigitos(cola.slice(11)));

    if (compuestoOk) return { estructura: true, numero, confianza: 'alta', metodo: 'linea2_compuesto' };
    if (fechasOk) return { estructura: true, numero, confianza: 'media', metodo: 'linea2_fechas' };
  }
  return { estructura: true };
}

/** Huella no sensible del texto leído (9 = dígito, A = letra, < = relleno) para diagnóstico. */
export function huellaMrz(texto) {
  return normalizarTexto(texto).map((l) => l.replace(/[0-9]/g, '9').replace(/[A-Z]/g, 'A'));
}

/**
 * Interpreta el texto crudo del OCR.
 *  confianza 'alta' : el dígito de control compuesto (líneas 1 y 2) cuadra.
 *  confianza 'media': cuadran los dígitos de control de las dos fechas, pero no se pudo validar el compuesto
 *                     (p. ej. la línea 1 se leyó mal). Se debe confirmar con cuidado.
 */
export function interpretarMrz(texto) {
  const lineas = normalizarTexto(texto);
  const linea1 = buscarLinea1(lineas);
  let mejor = null;
  let hayEstructura = false;
  for (const l of lineas) {
    const r = interpretarLinea2(l, linea1);
    if (!r) continue;
    hayEstructura = true;
    if (r.numero && (!mejor || (r.confianza === 'alta' && mejor.confianza !== 'alta'))) mejor = r;
  }
  if (mejor) return { valido: true, identificacion: mejor.numero, confianza: mejor.confianza, metodo: mejor.metodo };
  return { valido: false, motivo: hayEstructura ? 'DIGITO_CONTROL_INVALIDO' : 'MRZ_NO_ENCONTRADA' };
}
