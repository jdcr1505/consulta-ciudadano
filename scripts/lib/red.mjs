// Detección de la IP de la red local (la que usa el teléfono para llegar al computador). Funciones puras y probadas.
import os from 'node:os';

// Adaptadores virtuales (Docker, WSL, VMs, VPN…) que NO sirven para que el teléfono llegue al computador.
const VIRTUAL = /vethernet|wsl|vmware|virtualbox|hyper-v|docker|loopback|bluetooth|vpn|tailscale|zerotier|utun|\btun\d|veth|br-|virbr|vboxnet/i;
const FISICA = /wi-?fi|wlan|wireless|inal[aá]mbric|ethernet|\ben\d|\beth\d/i;

function puntos(nombre, direccion) {
  if (VIRTUAL.test(nombre)) return -1;
  if (direccion.startsWith('169.254.')) return -1; // sin DHCP
  let p = 0;
  if (direccion.startsWith('192.168.')) p += 30;
  else if (direccion.startsWith('10.')) p += 20;
  else if (/^172\.(1[6-9]|2\d|3[01])\./.test(direccion)) p += 5; // lo usan mucho Docker y WSL
  else return -1;
  if (FISICA.test(nombre)) p += 10;
  return p;
}

/** Candidatas ordenadas de mejor a peor. */
export function listarCandidatas(interfaces = os.networkInterfaces()) {
  const res = [];
  for (const [nombre, lista] of Object.entries(interfaces)) {
    for (const i of lista ?? []) {
      if (i.family !== 'IPv4' && i.family !== 4) continue;
      if (i.internal) continue;
      const p = puntos(nombre, i.address);
      if (p >= 0) res.push({ nombre, direccion: i.address, puntos: p });
    }
  }
  return res.sort((a, b) => b.puntos - a.puntos);
}

export const elegirIp = (interfaces) => listarCandidatas(interfaces)[0]?.direccion ?? null;
