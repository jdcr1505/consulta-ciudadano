// Comprobación de la base de datos usando el cliente `pg` ya instalado en backend/.
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const BACKEND = path.join(RAIZ, 'backend');

/** Lee backend/.env (formato CLAVE=valor, con o sin comillas). Las variables reales del entorno tienen prioridad. */
export function leerEnv() {
  const archivo = path.join(BACKEND, '.env');
  const env = {};
  if (existsSync(archivo)) {
    for (const linea of readFileSync(archivo, 'utf8').split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m || linea.trim().startsWith('#')) continue;
      env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  return { ...env, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k in env || k === 'DATABASE_URL')) };
}

/** Misma URL con la contraseña oculta, para mostrarla sin riesgo. */
export function ocultarClave(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '(URL no válida)';
  }
}

export const esLocal = (url) => /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url ?? '');

/** Intenta conectar y lista las tablas. Nunca lanza: devuelve { ok, error, tablas }. */
export async function probarBd(url, esperaMs = 8000) {
  let Client;
  try {
    ({ Client } = createRequire(path.join(BACKEND, 'package.json'))('pg'));
  } catch {
    return { ok: false, error: 'Faltan las dependencias del backend (ejecute: npm run setup)' };
  }
  const cliente = new Client({ connectionString: url, connectionTimeoutMillis: esperaMs });
  cliente.on('error', () => {});
  try {
    await cliente.connect();
    const { rows } = await cliente.query("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'");
    return { ok: true, tablas: rows.map((r) => r.table_name) };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  } finally {
    await cliente.end().catch(() => {});
  }
}
