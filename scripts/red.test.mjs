import assert from 'node:assert/strict';
import { test } from 'node:test';
import { elegirIp, listarCandidatas } from './lib/red.mjs';

const ip = (address, internal = false, family = 'IPv4') => ({ address, family, internal });

test('elige la IP 192.168.x del Wi-Fi aunque haya adaptadores virtuales de Docker/WSL', () => {
  const interfaces = {
    'vEthernet (WSL)': [ip('172.28.16.1')],
    'vEthernet (Default Switch)': [ip('172.20.80.1')],
    'Wi-Fi': [ip('192.168.20.24'), ip('fe80::1', false, 'IPv6')],
    'Loopback Pseudo-Interface 1': [ip('127.0.0.1', true)],
  };
  assert.equal(elegirIp(interfaces), '192.168.20.24');
});
test('prefiere Wi-Fi/Ethernet 192.168 sobre una red 10.x de VPN', () => {
  const interfaces = { 'VPN Corporativa': [ip('10.8.0.5')], Ethernet: [ip('192.168.1.50')] };
  assert.equal(elegirIp(interfaces), '192.168.1.50');
});
test('usa 10.x cuando no hay 192.168', () => {
  assert.equal(elegirIp({ 'Wi-Fi': [ip('10.0.0.23')] }), '10.0.0.23');
});
test('ignora direcciones sin DHCP (169.254), internas e IPv6', () => {
  const interfaces = { Ethernet: [ip('169.254.12.8')], lo: [ip('127.0.0.1', true)], 'Wi-Fi': [ip('fe80::2', false, 'IPv6')] };
  assert.equal(elegirIp(interfaces), null);
  assert.deepEqual(listarCandidatas(interfaces), []);
});
test('las redes 172.x (Docker/WSL) solo se usan si no hay otra', () => {
  assert.equal(elegirIp({ Ethernet: [ip('172.16.5.9')] }), '172.16.5.9');
  assert.equal(elegirIp({ 'vEthernet (WSL)': [ip('172.28.16.1')] }), null);
});
test('acepta family numérico (Node 18.0–18.3)', () => {
  assert.equal(elegirIp({ en0: [{ address: '192.168.0.7', family: 4, internal: false }] }), '192.168.0.7');
});
