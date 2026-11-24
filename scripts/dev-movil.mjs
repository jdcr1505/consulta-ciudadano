// Inicia la app móvil (Expo) apuntando a la API SIN escribir la IP a mano:
//   npm run dev:movil                          → detecta la IP de su red (Wi-Fi/Ethernet) y usa http://IP:4000
//   npm run dev:movil -- --url https://api...  → usa un backend ya desplegado (no necesita el backend local)
//   API_HOST=192.168.1.20 npm run dev:movil     → fuerza una IP
import { spawn } from 'node:child_process';
import path from 'node:path';
import { RAIZ, leerEnv } from './lib/bd.mjs';
import { elegirIp, listarCandidatas } from './lib/red.mjs';

const i = process.argv.indexOf('--url');
const urlManual = i >= 0 ? process.argv[i + 1] : process.env.EXPO_PUBLIC_API_URL;
const puerto = process.env.PORT ?? leerEnv().PORT ?? 4000;

let url = urlManual;
if (!url) {
  const ip = process.env.API_HOST ?? elegirIp();
  if (!ip) {
    console.error('\x1b[31m✖ No se encontró una IP de red local. ¿Está conectado a Wi-Fi o Ethernet?\x1b[0m');
    console.error('  Puede indicarla a mano:  API_HOST=192.168.1.20 npm run dev:movil');
    process.exit(1);
  }
  url = `http://${ip}:${puerto}`;
  const otras = listarCandidatas().filter((c) => c.direccion !== ip);
  if (otras.length) console.log(`(Otras redes detectadas: ${otras.map((c) => `${c.nombre} ${c.direccion}`).join(', ')}. Si la app no conecta, use API_HOST=<IP>.)`);
}

console.log(`\n\x1b[1mAPI que usará la app: ${url}\x1b[0m`);
if (url.startsWith('http://')) console.log('El teléfono debe estar en la MISMA red Wi-Fi y el backend en ejecución (npm run dev).\n');

spawn('npx expo start -c', { cwd: path.join(RAIZ, 'mobile'), stdio: 'inherit', shell: true, env: { ...process.env, EXPO_PUBLIC_API_URL: url } })
  .on('exit', (c) => process.exit(c ?? 0));
