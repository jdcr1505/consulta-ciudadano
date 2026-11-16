// Lectura de la zona MRZ (ICAO 9303, formato TD1: 3 líneas de 30 caracteres) de la cédula digital.
// Funciones puras. Los dígitos de control (pesos 7-3-1) validan la lectura y descartan errores de OCR.

const PESOS = [7, 3, 1];
const valor = (c) => (c === '<' ? 0 : /[0-9]/.test(c) ? Number(c) : c.charCodeAt(0) - 55); // A=10 … Z=35

export const digitoControl = (s) => [...s].reduce((acc, c, i) => acc + valor(c) * PESOS[i % 3], 0) % 10;

// Confusiones típicas del OCR en zonas numéricas.
const A_DIGITO = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6', T: '7' };
export const aDigitos = (s) => [...s].map((c) => A_DIGITO[c] ?? c).join('');

const sinCeros = (d) => d.replace(/^0+(?=\d)/, '');
const soloDigitos = (s) => /^[0-9]+$/.test(s);
const unicos = (xs) => [...new Set(xs)];

/** Mayúsculas, sin espacios; cualquier símbolo raro que el OCR confunda con '<' pasa a '<'. */
export function normalizarTexto(texto) {
  return String(texto ?? '')
    .toUpperCase()
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, '').replace(/[^A-Z0-9<]/g, '<'))
    .filter((l) => l.length >= 20);
}

// Línea 1 del TD1: tipo(2) + país(3) + nº documento(9) + dígito de control(1) + opcional(15).
// "COL" se tolera con "C0L" (confusión O/0 del OCR).
const LINEA1 = /([A-Z<]{2})C[O0]L([A-Z0-9<]{9})([A-Z0-9<])([A-Z0-9<]{0,15})/;

function validarNumero(candidato, check) {
  const c = Number(check);
  for (const v of unicos([candidato, aDigitos(candidato)])) {
    const limpio = v.replace(/</g, '');
    if (limpio && soloDigitos(limpio) && digitoControl(v) === c) return limpio;
  }
  return null;
}

/** Devuelve { estructura: bool, numero?, metodo? } para una línea candidata. */
export function interpretarLinea1(linea) {
  const m = linea.match(LINEA1);
  if (!m) return { estructura: false };
  const [, , campo, cdRaw, opcional] = m;
  const cd = aDigitos(cdRaw);

  // a) Número de hasta 9 caracteres con su dígito de control en la posición estándar.
  if (/^\d$/.test(cd)) {
    const n = validarNumero(campo, cd);
    if (n) return { estructura: true, numero: sinCeros(n), metodo: 'campo' };
  }

  // b) Número de más de 9 caracteres: la parte restante + dígito de control van al inicio del campo opcional.
  if (cdRaw === '<') {
    const r = opcional.match(/^[A-Z0-9]+/)?.[0];
    if (r && r.length >= 2) {
      const check = aDigitos(r.slice(-1));
      if (/^\d$/.test(check)) {
        for (const resto of unicos([r.slice(0, -1), aDigitos(r.slice(0, -1))])) {
          const n = validarNumero(campo + resto, check);
          if (n) return { estructura: true, numero: sinCeros(n), metodo: 'extendido' };
        }
      }
    }
  }

  // c) Número nacional en el campo opcional con su propio dígito de control (menor confianza).
  for (const token of opcional.match(/[0-9OQDILZSBGT]{7,11}/g) ?? []) {
    const n = validarNumero(token.slice(0, -1), aDigitos(token.slice(-1)));
    if (n && n.length >= 6) return { estructura: true, numero: sinCeros(n), metodo: 'opcional' };
  }
  return { estructura: true };
}

/** Huella no sensible del texto leído (9 = dígito, A = letra, < = relleno) para diagnóstico. */
export function huellaMrz(texto) {
  return normalizarTexto(texto).map((l) => l.replace(/[0-9]/g, '9').replace(/[A-Z]/g, 'A'));
}

/** Interpreta el texto crudo del OCR. */
export function interpretarMrz(texto) {
  let hayEstructura = false;
  for (const linea of normalizarTexto(texto)) {
    const r = interpretarLinea1(linea);
    if (r.estructura) hayEstructura = true;
    if (r.numero) return { valido: true, identificacion: r.numero, metodo: r.metodo };
  }
  return { valido: false, motivo: hayEstructura ? 'DIGITO_CONTROL_INVALIDO' : 'MRZ_NO_ENCONTRADA' };
}
