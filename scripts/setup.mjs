// Preparación completa del proyecto con UN comando:  npm run setup
// Instala dependencias, crea backend/.env si falta, genera el cliente de Prisma, comprueba la base de datos
// (levanta Docker si usa una BD local), aplica migraciones y carga los datos de demostración.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { BACKEND, RAIZ, esLocal, leerEnv, ocultarClave, probarBd } from './lib/bd.mjs';

const sinMovil = process.argv.includes('--sin-movil');
const ok = (t) => console.log(`\x1b[32m✔\x1b[0m ${t}`);
const paso = (t) => console.log(`\n\x1b[1m▶ ${t}\x1b[0m`);
const fallo = (t) => { console.error(`\x1b[31m✖ ${t}\x1b[0m`); process.exit(1); };
const run = (cmd, cwd = RAIZ, args = []) => spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true }).status === 0;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const [mayor, menor] = process.versions.node.split('.').map(Number);
if (mayor < 22 || (mayor === 22 && menor < 9)) fallo(`Se necesita Node.js 22.9 o superior (tiene ${process.versions.node}). Descárguelo de https://nodejs.org`);
ok(`Node.js ${process.versions.node}`);

paso('Configuración (backend/.env)');
const env = path.join(BACKEND, '.env');
if (existsSync(env)) ok('backend/.env ya existe (no se modifica)');
else {
  copyFileSync(path.join(BACKEND, '.env.example'), env);
  ok('backend/.env creado a partir de .env.example (revise JWT_ACCESS_SECRET antes de desplegar)');
}

paso('Dependencias');
for (const [nombre, carpeta] of [['raíz', RAIZ], ['backend', BACKEND], ['web', path.join(RAIZ, 'web')], ...(sinMovil ? [] : [['móvil', path.join(RAIZ, 'mobile')]])]) {
  console.log(`  npm install (${nombre})…`);
  if (!run('npm install --no-audit --no-fund --loglevel=error', carpeta)) fallo(`Falló npm install en ${nombre}`);
}
ok('Dependencias instaladas');

paso('Cliente de Prisma');
if (!run('npm run prisma:generate', BACKEND)) fallo('Falló prisma generate');

paso('Base de datos');
const cfg = leerEnv();
if (!cfg.DATABASE_URL) fallo('Falta DATABASE_URL en backend/.env');
console.log(`  ${ocultarClave(cfg.DATABASE_URL)}`);
let bd = await probarBd(cfg.DATABASE_URL, 5000);
if (!bd.ok && esLocal(cfg.DATABASE_URL)) {
  console.log('  La base local no responde. Intentando iniciarla con Docker…');
  if (run('docker compose up -d', RAIZ)) {
    for (let i = 0; i < 30 && !bd.ok; i++) { await espera(1000); bd = await probarBd(cfg.DATABASE_URL, 3000); }
  }
}
if (!bd.ok) {
  console.error(`\x1b[31m✖ No se pudo conectar a la base de datos: ${bd.error}\x1b[0m`);
  console.error('  • Con Docker: abra Docker Desktop y ejecute  npm run db:up');
  console.error('  • Con Neon: pegue sus cadenas DATABASE_URL (con -pooler) y DIRECT_URL en backend/.env');
  console.error('  Cuando la base responda, vuelva a ejecutar  npm run setup');
  process.exit(1);
}
ok('La base de datos responde');
if (!run('npm run db:migrate', BACKEND)) fallo('Fallaron las migraciones');
if (!run('npm run db:seed', BACKEND)) fallo('Falló la carga de datos');

console.log(`
\x1b[32m\x1b[1m✔ Todo listo.\x1b[0m
  npm run dev          → API + web en una sola terminal   (http://localhost:5173)
  npm run dev:movil    → app móvil, detecta la IP de su red sola
  npm run dev:todo     → las tres cosas a la vez
  npm run doctor       → diagnostica si algo no funciona
Administrador inicial: 1000000001 / Admin1 (debe cambiar la contraseña al ingresar)`);
