import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config';

const CLAVE_REFRESH = 'cc.refreshToken';
let accessToken = null;
let refreshing = null;
let onSessionLost = () => {};

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details ?? [];
  }
  get campos() {
    return Object.fromEntries(this.details.map((d) => [d.campo, d.mensaje]));
  }
}

export const setOnSessionLost = (fn) => { onSessionLost = fn; };
export const setAccessToken = (t) => { accessToken = t; };

// El refresh token se guarda en el almacenamiento seguro del dispositivo (Android Keystore). Nunca la contraseña.
export const guardarRefresh = (t) => SecureStore.setItemAsync(CLAVE_REFRESH, t);
export const leerRefresh = () => SecureStore.getItemAsync(CLAVE_REFRESH);
export const borrarRefresh = () => SecureStore.deleteItemAsync(CLAVE_REFRESH);

async function llamar(path, { method = 'GET', body, timeoutMs = 15000 } = {}) {
  const headers = { 'x-client-type': 'mobile', Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    return await fetch(API_URL + '/api/v1' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controlador.signal });
  } catch {
    throw new ApiError(0, 'SIN_CONEXION', `No se pudo conectar con el servidor (${API_URL}). Verifique que el backend esté en ejecución y que el teléfono esté en la misma red.`);
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
    throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? 'Ocurrió un error inesperado', e?.details);
  }
  return data;
}

export async function refrescar() {
  refreshing ??= (async () => {
    const refreshToken = await leerRefresh();
    if (!refreshToken) throw new ApiError(401, 'TOKEN_INVALIDO', 'Sesión inválida o expirada');
    const data = await interpretar(await llamar('/auth/refresh', { method: 'POST', body: { refreshToken } }));
    accessToken = data.accessToken;
    await guardarRefresh(data.refreshToken);
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

export const get = (p) => api(p);
export const post = (p, body = {}, opciones = {}) => api(p, { method: 'POST', body, ...opciones });
