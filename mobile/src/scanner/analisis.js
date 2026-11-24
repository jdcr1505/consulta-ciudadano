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

/** Cadenas de 6 a 10 dígitos (cortadas en trozos de máximo 10), con su posición. */
export function candidatosIdentificacion(data) {
  const texto = String(data ?? '');
  const res = [];
  for (const m of texto.matchAll(/\d{6,10}/g)) res.push({ posicion: m.index, longitud: m[0].length, valor: m[0] });
  return res;
}

/** Corridas MAXIMALES de dígitos (sin tope de longitud) de al menos `minimo` dígitos, con su posición. */
export function corridasDeDigitos(data, minimo = 1) {
  const res = [];
  for (const m of String(data ?? '').matchAll(/\d+/g)) {
    if (m[0].length >= minimo) res.push({ posicion: m.index, longitud: m[0].length, valor: m[0] });
  }
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
/** ¿La cadena empieza con una fecha AAAAMMDD válida? (la fecha puede ir pegada a otros dígitos) */
const empiezaConFecha = (v) => v.length >= 8 && esFecha(v.slice(0, 8));

/** Si un candidato es el final de otro más largo, el más largo va primero (el corto suele ser una versión truncada). */
export function ordenarCandidatos(lista) {
  const r = [...lista];
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (let i = 0; i < r.length; i++) {
      for (let j = i + 1; j < r.length; j++) {
        if (r[j].length > r[i].length && r[j].endsWith(r[i])) {
          [r[i], r[j]] = [r[j], r[i]];
          cambio = true;
        }
      }
    }
  }
  return r;
}

/**
 * Cédula amarilla (PDF417). El contenido trae, en este orden: [?, ?, CÉDULA, fecha de nacimiento, …].
 * La cédula ocupa un campo de 10 posiciones (con ceros de relleno a la izquierda).
 *
 * IMPORTANTE: los dígitos finales de otro campo pueden quedar PEGADOS a la cédula (p. ej. 17 dígitos seguidos).
 * Por eso no se cortan las cadenas en trozos: se buscan tres pistas independientes y se vota entre ellas.
 *   1. La corrida de dígitos que va justo antes de la fecha de nacimiento → sus últimos 10 dígitos.
 *   2. La tercera cadena numérica, extendida hacia atrás hasta completar su corrida → últimos 10 dígitos.
 *   3. Los 10 dígitos de la posición 48 (heurística).
 * Devuelve los candidatos, el más probable primero; la app siempre pide confirmar contra la cédula.
 */
export function extraerIdentificacionPdf417(data) {
  const texto = String(data ?? '');
  const bruto = [];
  const agregar = (digitos, prioridad) => {
    const n = sinCerosIzquierda(digitos);
    if (/^\d{6,10}$/.test(n)) bruto.push({ n, prioridad });
  };

  const maximas = corridasDeDigitos(texto, 6);

  // Pista 1: la corrida que precede a la primera fecha de nacimiento.
  const iFecha = maximas.findIndex((c, i) => i > 0 && empiezaConFecha(c.valor));
  if (iFecha > 0) agregar(maximas[iFecha - 1].valor.slice(-10), 0);

  // Pista 2: la tercera cadena, completada con los dígitos que tenga pegados por delante.
  const tercera = candidatosIdentificacion(texto)[2];
  if (tercera && !empiezaConFecha(tercera.valor)) {
    const mx = maximas.find((c) => c.posicion <= tercera.posicion && tercera.posicion < c.posicion + c.longitud);
    const hastaElFinal = mx ? mx.valor.slice(0, tercera.posicion - mx.posicion + tercera.longitud) : tercera.valor;
    agregar(hastaElFinal.slice(-10), 1);
  }

  // Pista 3: posición fija.
  const enPosicion = texto.slice(48, 58);
  if (/^\d{10}$/.test(enPosicion)) agregar(enPosicion, 2);

  // Respaldo: sin ninguna pista, todas las cadenas que no parezcan fecha.
  if (bruto.length === 0) {
    for (const c of candidatosIdentificacion(texto)) if (!esFecha(c.valor)) agregar(c.valor, 3);
  }

  // Votación: gana el número que más pistas repiten; a igualdad, el de la pista más fiable.
  const grupos = new Map();
  for (const { n, prioridad } of bruto) {
    const g = grupos.get(n) ?? { n, votos: 0, prioridad };
    g.votos += 1;
    g.prioridad = Math.min(g.prioridad, prioridad);
    grupos.set(n, g);
  }
  const ordenados = [...grupos.values()].sort((a, b) => b.votos - a.votos || a.prioridad - b.prioridad).map((g) => g.n);
  return ordenarCandidatos(ordenados).slice(0, 4);
}

/** 1012345678 → 1.012.345.678 (solo para mostrar). */
export const formatoMiles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
