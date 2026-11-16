// Análisis de lo leído en un código de barras. Funciones puras (se prueban sin teléfono).

/**
 * "Huella estructural": reemplaza cada carácter por una clase para poder COMPARTIR la forma del contenido
 * sin revelar datos personales: dígitos → 9, letras → A, espacio → _, otros imprimibles → #, no imprimibles → ·
 */
export function huella(data) {
  let s = '';
  for (const ch of String(data ?? '')) {
    if (/[0-9]/.test(ch)) s += '9';
    else if (/\p{L}/u.test(ch)) s += 'A';
    else if (ch === ' ') s += '_';
    else if (/[\x21-\x7e]/.test(ch)) s += '#';
    else s += '·';
  }
  return s;
}

/** Cadenas de 6 a 10 dígitos seguidas, con su posición: posibles números de identificación (o fechas, etc.). */
export function candidatosIdentificacion(data) {
  const texto = String(data ?? '');
  const res = [];
  for (const m of texto.matchAll(/\d{6,10}/g)) res.push({ posicion: m.index, longitud: m[0].length, valor: m[0] });
  return res;
}

/** Quita los ceros de relleno a la izquierda (los códigos de barras suelen rellenar a 10 dígitos). */
export const sinCerosIzquierda = (digitos) => digitos.replace(/^0+(?=\d)/, '');

/** Resumen no sensible para reportar: tipo, longitudes y forma. */
export function resumen({ type, data, raw }) {
  return {
    tipo: type,
    longitudData: String(data ?? '').length,
    longitudRaw: raw == null ? null : String(raw).length,
    huella: huella(data),
    candidatos: candidatosIdentificacion(data).map(({ posicion, longitud }) => ({ posicion, longitud })),
  };
}

const esFecha = (d) => d.length === 8 && /^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(d);

/**
 * Cédula amarilla (PDF417): extrae los NÚMEROS CANDIDATOS a identificación, el más probable primero.
 * ATENCIÓN: la posición esperada (hacia el carácter 48, 10 dígitos con ceros de relleno) es una heurística
 * NO verificada con cédulas reales; por eso la app siempre pide confirmar el número contra la cédula.
 */
export function extraerIdentificacionPdf417(data) {
  const texto = String(data ?? '');
  const lista = [];
  const agregar = (digitos) => {
    const n = sinCerosIzquierda(digitos);
    if (/^\d{6,10}$/.test(n) && !lista.includes(n)) lista.push(n);
  };
  const enPosicion = texto.slice(48, 58);
  if (/^\d{10}$/.test(enPosicion)) agregar(enPosicion);
  for (const c of candidatosIdentificacion(texto)) if (!esFecha(c.valor)) agregar(c.valor);
  return lista.slice(0, 4);
}

/** 1012345678 → 1.012.345.678 (solo para mostrar). */
export const formatoMiles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
