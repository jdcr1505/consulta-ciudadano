// Cliente HTTP único de la aplicación web. El access token vive solo en memoria;
// el refresh token viaja en una cookie httpOnly que JavaScript no puede leer.
const BASE = '/api/v1';
let accessToken = null;
let onSessionLost = () => {};
let refreshing = null;

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details ?? [];
  }
  /** { campo: mensaje } para pintar los errores de validación junto a cada campo. */
  get campos() {
    return Object.fromEntries(this.details.map((d) => [d.campo, d.mensaje]));
  }
}

export const setAccessToken = (t) => { accessToken = t; };
export const setOnSessionLost = (fn) => { onSessionLost = fn; };

async function llamar(path, { method = 'GET', body, timeoutMs = 65000 } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    return await fetch(BASE + path, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controlador.signal,
    });
  } catch {
    throw new ApiError(0, 'SIN_CONEXION', 'No se pudo conectar con el servidor. Verifique su conexión e intente de nuevo.');
  } finally {
    clearTimeout(timer);
  }
}

async function interpretar(res) {
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  if (!res.ok) {
    const e = data?.error;
    // Sin cuerpo de error de la API: el proxy o un intermediario respondió porque el backend no está disponible.
    if (!e && res.status >= 500) {
      throw new ApiError(res.status, 'SERVIDOR_NO_DISPONIBLE', 'El servidor no responde. Verifique que el backend esté en ejecución e intente de nuevo.');
    }
    throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? 'Ocurrió un error inesperado', e?.details);
  }
  return data;
}

export async function refrescar() {
  refreshing ??= (async () => {
    const res = await llamar('/auth/refresh', { method: 'POST' });
    const data = await interpretar(res);
    accessToken = data.accessToken;
    return data;
  })().finally(() => { refreshing = null; });
  return refreshing;
}

export async function api(path, opciones = {}) {
  let res = await llamar(path, opciones);
  if (res.status === 401 && !path.startsWith('/auth/')) {
    try {
      await refrescar();
      res = await llamar(path, opciones);
    } catch {
      accessToken = null;
      onSessionLost();
    }
  }
  return interpretar(res);
}

/** Descarga un archivo binario (p. ej. PDF) conservando la renovación automática del token. */
export async function descargarArchivo(path, nombrePorDefecto = 'reporte.pdf') {
  let res = await llamar(path);
  if (res.status === 401) {
    try {
      await refrescar();
      res = await llamar(path);
    } catch {
      accessToken = null;
      onSessionLost();
    }
  }
  if (!res.ok) {
    await interpretar(res);
    return;
  }
  const dispo = res.headers?.get?.('Content-Disposition') ?? '';
  const match = dispo.match(/filename="?([^"]+)"?/i);
  const nombreArchivo = match?.[1] ?? nombrePorDefecto;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const get = (p, opciones = {}) => api(p, opciones);
export const post = (p, body = {}) => api(p, { method: 'POST', body });
export const patch = (p, body) => api(p, { method: 'PATCH', body });
export const put = (p, body) => api(p, { method: 'PUT', body });
export const del = (p) => api(p, { method: 'DELETE' });

export const qs = (obj) => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (v !== '' && v !== undefined && v !== null) p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};