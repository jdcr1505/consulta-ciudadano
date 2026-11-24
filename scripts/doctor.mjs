// Diagnóstico del entorno:  npm run doctor
// Revisa lo que más suele fallar y dice exactamente qué hacer.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { RAIZ, esLocal, leerEnv, ocultarClave, probarBd } from './lib/bd.mjs';
import { elegirIp } from './lib/red.mjs';

let errores = 0;
const bien = (t) => console.log(`\x1b[32m✔\x1b[0m ${t}`);
const aviso = (t, ayuda) => { console.log(`\x1b[33m!\x1b[0m ${t}`); if (ayuda) console.log(`    → ${ayuda}`); };
const mal = (t, ayuda) => { errores++; console.log(`\x1b[31m✖\x1b[0m ${t}`); if (ayuda) console.log(`    → ${ayuda}`); };
const salud = async (url) => {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(2500) }); return r.ok ? await r.json() : null; } catch { return null; }
};

console.log('\n\x1b[1mDiagnóstico del Sistema de Consulta Ciudadano\x1b[0m\n');

const [mayor, menor] = process.versions.node.split('.').map(Number);
if (mayor > 22 || (mayor === 22 && menor >= 9)) bien(`Node.js ${process.versions.node}`);
else mal(`Node.js ${process.versions.node} es muy antiguo`, 'Instale Node.js 22.9 o superior: https://nodejs.org');

const cfg = leerEnv();
if (!existsSync(path.join(RAIZ, 'backend', '.env'))) mal('Falta backend/.env', 'Ejecute: npm run setup   (o copie backend/.env.example a backend/.env)');
else bien('backend/.env existe');
if (cfg.JWT_ACCESS_SECRET && cfg.JWT_ACCESS_SECRET.length >= 32) bien('JWT_ACCESS_SECRET definido');
else mal('JWT_ACCESS_SECRET falta o tiene menos de 32 caracteres', 'Defínalo en backend/.env');
if (cfg.JWT_ACCESS_SECRET?.startsWith('cambie-este-secreto')) aviso('JWT_ACCESS_SECRET es el valor de ejemplo', 'Cámbielo antes de desplegar');

for (const [carpeta, nombre] of [['backend', 'backend'], ['web', 'web'], ['mobile', 'móvil']]) {
  if (!existsSync(path.join(RAIZ, carpeta, 'node_modules'))) mal(`Faltan las dependencias de ${nombre}`, 'Ejecute: npm run setup');
}

if (!cfg.DATABASE_URL) mal('DATABASE_URL no está definida en backend/.env');
else {
  console.log(`  Base de datos: ${ocultarClave(cfg.DATABASE_URL)}`);
  const bd = await probarBd(cfg.DATABASE_URL);
  if (!bd.ok) {
    mal(`No se puede conectar a la base de datos (${bd.error})`,
      esLocal(cfg.DATABASE_URL) ? 'Abra Docker Desktop y ejecute: npm run db:up   (o use Neon: ver docs/DESPLIEGUE.md)' : 'Revise DATABASE_URL y que el proyecto de Neon esté activo (se suspende solo tras unos minutos; la primera conexión puede tardar)');
  } else {
    bien('La base de datos responde');
    const t = bd.tablas;
    if (!t.includes('usuario')) mal('La base está vacía (sin tablas)', 'Ejecute: npm run setup   (o: npm --prefix backend run db:migrate)');
    else if (!t.includes('consulta')) mal('Falta la tabla "consulta" (migración del Sprint 2)', 'Ejecute: npm --prefix backend run db:migrate');
    else bien(`Tablas al día (${t.length})`);
  }
}

const puerto = cfg.PORT ?? 4000;
const local = await salud(`http://localhost:${puerto}/api/v1/health`);
if (local) bien(`El backend está en ejecución (puerto ${puerto})`);
else aviso(`El backend no responde en el puerto ${puerto}`, 'Si lo necesita, ejecute: npm run dev');

const ip = elegirIp();
if (!ip) aviso('No se detectó una IP de red local (¿sin Wi-Fi?)', 'El teléfono necesita estar en la misma red; o use un backend desplegado: npm run dev:movil -- --url https://...');
else {
  console.log(`  IP de su red: ${ip}  → la app móvil usará http://${ip}:${puerto}`);
  if (local) {
    const lan = await salud(`http://${ip}:${puerto}/api/v1/health`);
    if (lan) bien('El backend es accesible desde la red local (el teléfono podrá conectarse)');
    else mal(`El backend NO es accesible en http://${ip}:${puerto}`, 'Probablemente es el Firewall de Windows. En PowerShell como administrador: powershell -File scripts/firewall-windows.ps1');
  }
}

if (existsSync(path.join(RAIZ, 'mobile', 'eas.json'))) {
  const { readFileSync } = await import('node:fs');
  if (readFileSync(path.join(RAIZ, 'mobile', 'eas.json'), 'utf8').includes('REEMPLACE-CON')) aviso('mobile/eas.json aún tiene la URL de ejemplo', 'Antes de compilar el APK, ponga la URL pública de su backend (docs/DESPLIEGUE.md)');
}

console.log(errores ? `\n\x1b[31m${errores} problema(s) por resolver.\x1b[0m\n` : '\n\x1b[32mTodo en orden.\x1b[0m\n');
process.exit(errores ? 1 : 0);
